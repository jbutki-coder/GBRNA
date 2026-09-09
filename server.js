"use strict";

const crypto = require("crypto");
const path = require("path");
const { Readable } = require("stream");
const { pipeline } = require("stream/promises");
const express = require("express");

const app = express();
const port = Number(process.env.PORT || 10000);
const rootDirectory = __dirname;

// Render places the service behind a reverse proxy. Trusting one proxy hop lets
// the translation rate limiter distinguish visitors instead of treating the
// whole site as a single address.
app.set("trust proxy", 1);

const translationApiKey = String(
  process.env.GOOGLE_TRANSLATE_API_KEY ||
  process.env.GOOGLE_CLOUD_TRANSLATION_API_KEY ||
  ""
).trim();
const translationCache = new Map();
const translationRateWindows = new Map();
const TRANSLATION_CACHE_LIMIT = 25000;
const TRANSLATION_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const TRANSLATION_RATE_WINDOW_MS = 10 * 60 * 1000;
const TRANSLATION_RATE_MAX_REQUESTS = 120;
const TRANSLATION_MAX_ITEMS = 100;
const TRANSLATION_MAX_ITEM_CHARACTERS = 24000;
const TRANSLATION_MAX_TOTAL_CHARACTERS = 25000;
const TRANSLATION_UPSTREAM_TIMEOUT_MS = 25000;

const translationLanguageCodes = new Set([
  "ab", "ace", "ach", "af", "ak", "alz", "am", "ar", "as", "awa", "ay", "az",
  "ba", "ban", "bbc", "be", "bem", "bew", "bg", "bho", "bik", "bm", "bn", "br",
  "bs", "bts", "btx", "bua", "ca", "ceb", "cgg", "chm", "cnh", "ckb", "co", "crh",
  "crs", "cs", "cv", "cy", "da", "din", "doi", "dov", "dv", "dz", "ee", "el",
  "eo", "es", "et", "eu", "fa", "ff", "fi", "fil", "fj", "fr", "fy", "ga", "gaa",
  "gd", "gl", "gn", "gom", "gu", "ha", "haw", "he", "hi", "hil", "hmn", "hr",
  "hrx", "ht", "hu", "hy", "id", "ig", "ilo", "is", "it", "iw", "ja", "jv", "jw",
  "ka", "kk", "km", "kn", "kri", "ktu", "ku", "ky", "la", "lb", "lg", "li", "lij",
  "lmo", "ln", "lo", "lt", "ltg", "luo", "lus", "lv", "mai", "mak", "mg", "mi", "min",
  "mk", "ml", "mn", "mni-Mtei", "mr", "ms", "ms-Arab", "mt", "my", "nb", "ne", "new",
  "nl", "no", "nr", "nso", "nus", "ny", "oc", "om", "or", "pa", "pa-Arab", "pag", "pam",
  "pap", "pl", "ps", "pt", "qu", "rn", "ro", "rom", "ru", "rw", "sa", "sd", "sg", "shn",
  "si", "sk", "sl", "sm", "sn", "so", "sq", "sr", "ss", "st", "su", "sv", "sw", "szl",
  "ta", "te", "tet", "tg", "th", "ti", "tk", "tl", "tn", "tr", "ts", "tt", "ug", "uk",
  "ur", "uz", "vi", "xh", "yi", "yo", "yua", "yue", "zh-CN", "zh-TW", "zu"
]);

function normalizeTranslationLanguage(value) {
  const raw = String(value || "").trim().replace(/_/g, "-");
  if (!raw) return "en";

  const lower = raw.toLowerCase();
  if (lower === "zh" || lower.startsWith("zh-hans") || lower === "zh-cn" || lower === "zh-sg") {
    return "zh-CN";
  }
  if (
    lower.startsWith("zh-hant") ||
    lower === "zh-tw" ||
    lower === "zh-hk" ||
    lower === "zh-mo"
  ) {
    return "zh-TW";
  }
  if (lower.startsWith("pt")) return "pt";
  if (lower === "fil") return "fil";
  if (lower === "he") return "he";

  const base = lower.split("-")[0];
  if (base === "en") return "en";
  return translationLanguageCodes.has(base) ? base : null;
}

function preferredRequestLanguage(request) {
  const values = String(request.get("accept-language") || "")
    .split(",")
    .map((entry) => {
      const [tag, ...parameters] = entry.trim().split(";");
      const qualityParameter = parameters.find((part) => part.trim().startsWith("q="));
      const quality = qualityParameter ? Number(qualityParameter.trim().slice(2)) : 1;
      return { tag, quality: Number.isFinite(quality) ? quality : 0 };
    })
    .sort((a, b) => b.quality - a.quality);

  for (const value of values) {
    const language = normalizeTranslationLanguage(value.tag);
    if (!language) continue;
    if (language !== "en") return language;
    if (String(value.tag).toLowerCase().startsWith("en")) return "en";
  }
  return "en";
}

function requestHasAllowedOrigin(request) {
  const origin = String(request.get("origin") || "").trim();
  if (!origin) return true;

  try {
    const originUrl = new URL(origin);
    const requestHost = String(request.get("host") || "").toLowerCase();
    if (originUrl.host.toLowerCase() === requestHost) return true;

    const configured = String(process.env.TRANSLATION_ALLOWED_ORIGINS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    return configured.includes(originUrl.origin);
  } catch {
    return false;
  }
}

function translationRateLimit(request, response, next) {
  const now = Date.now();
  const key = String(request.ip || request.socket.remoteAddress || "unknown");
  const existing = translationRateWindows.get(key);
  const windowState = !existing || now - existing.startedAt >= TRANSLATION_RATE_WINDOW_MS
    ? { startedAt: now, requests: 0 }
    : existing;

  windowState.requests += 1;
  translationRateWindows.set(key, windowState);

  if (translationRateWindows.size > 5000) {
    for (const [address, state] of translationRateWindows) {
      if (now - state.startedAt >= TRANSLATION_RATE_WINDOW_MS) translationRateWindows.delete(address);
    }
  }

  response.setHeader(
    "X-RateLimit-Remaining",
    String(Math.max(0, TRANSLATION_RATE_MAX_REQUESTS - windowState.requests))
  );

  if (windowState.requests > TRANSLATION_RATE_MAX_REQUESTS) {
    response.setHeader(
      "Retry-After",
      String(Math.ceil((windowState.startedAt + TRANSLATION_RATE_WINDOW_MS - now) / 1000))
    );
    response.status(429).json({
      error: "translation_rate_limited",
      message: "Too many translation requests. Please wait a few minutes and try again."
    });
    return;
  }

  next();
}

function translationCacheKey(target, sourceText) {
  return crypto.createHash("sha256").update(`${target}\u0000${sourceText}`).digest("base64url");
}

function readCachedTranslation(target, sourceText) {
  const key = translationCacheKey(target, sourceText);
  const cached = translationCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.createdAt > TRANSLATION_CACHE_TTL_MS) {
    translationCache.delete(key);
    return null;
  }
  return cached.text;
}

function storeCachedTranslation(target, sourceText, translatedText) {
  if (translationCache.size >= TRANSLATION_CACHE_LIMIT) {
    const oldestKey = translationCache.keys().next().value;
    if (oldestKey) translationCache.delete(oldestKey);
  }
  translationCache.set(translationCacheKey(target, sourceText), {
    text: translatedText,
    createdAt: Date.now()
  });
}

function decodeGoogleText(value) {
  const named = { amp: "&", apos: "'", gt: ">", lt: "<", quot: '"' };
  return String(value || "").replace(
    /&(?:#(\d+)|#x([0-9a-f]+)|(amp|apos|gt|lt|quot));/gi,
    (match, decimal, hexadecimal, entity) => {
      if (decimal) return String.fromCodePoint(Number(decimal));
      if (hexadecimal) return String.fromCodePoint(Number.parseInt(hexadecimal, 16));
      return named[String(entity).toLowerCase()] || match;
    }
  );
}

const allowedHosts = new Set(["michigan-na.org", "www.michigan-na.org"]);
const allowedPathPrefixes = [
  "/blue-water-area/wp-content/uploads/",
  "/uploads/blue-water-area/"
];

function isAllowedArchiveUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      allowedHosts.has(url.hostname.toLowerCase()) &&
      allowedPathPrefixes.some((prefix) => url.pathname.startsWith(prefix)) &&
      url.pathname.toLowerCase().endsWith(".pdf")
    );
  } catch {
    return false;
  }
}

app.disable("x-powered-by");

app.get("/health", (_request, response) => {
  response.setHeader("Cache-Control", "no-store");
  response.status(200).json({
    status: "ok",
    pdfReader: true,
    translation: translationApiKey ? "enabled" : "not-configured",
    version: "7"
  });
});

app.get("/api/translation/config", (request, response) => {
  response.setHeader("Cache-Control", "private, max-age=300");
  response.status(200).json({
    enabled: Boolean(translationApiKey),
    suggestedLanguage: preferredRequestLanguage(request),
    detection: "browser-language"
  });
});

app.post(
  "/api/translation",
  express.json({ limit: "64kb", strict: true }),
  translationRateLimit,
  async (request, response) => {
    response.setHeader("Cache-Control", "no-store");

    if (!translationApiKey) {
      response.status(503).json({
        error: "translation_not_configured",
        message: "Translation has not been enabled by the site administrator."
      });
      return;
    }

    if (!requestHasAllowedOrigin(request)) {
      response.status(403).json({
        error: "translation_origin_rejected",
        message: "This translation request did not come from an approved GBRNA page."
      });
      return;
    }

    const target = normalizeTranslationLanguage(request.body && request.body.target);
    const texts = request.body && request.body.texts;

    if (target === "en") {
      if (!Array.isArray(texts)) {
        response.status(400).json({ error: "invalid_translation_request", message: "Translation text is missing." });
        return;
      }
      response.status(200).json({ target: "en", translations: texts.map((value) => String(value || "")) });
      return;
    }

    if (!translationLanguageCodes.has(target)) {
      response.status(400).json({
        error: "unsupported_translation_language",
        message: "The selected language is not supported."
      });
      return;
    }

    if (!Array.isArray(texts) || !texts.length || texts.length > TRANSLATION_MAX_ITEMS) {
      response.status(400).json({
        error: "invalid_translation_request",
        message: `Send between 1 and ${TRANSLATION_MAX_ITEMS} text items per translation request.`
      });
      return;
    }

    const normalizedTexts = texts.map((value) => String(value || ""));
    const totalCharacters = normalizedTexts.reduce((total, value) => total + value.length, 0);
    if (
      totalCharacters > TRANSLATION_MAX_TOTAL_CHARACTERS ||
      normalizedTexts.some((value) => value.length > TRANSLATION_MAX_ITEM_CHARACTERS)
    ) {
      response.status(413).json({
        error: "translation_request_too_large",
        message: "The page sent too much text in one translation request."
      });
      return;
    }

    const translations = new Array(normalizedTexts.length);
    const missingTextToIndexes = new Map();

    normalizedTexts.forEach((sourceText, index) => {
      if (!/[A-Za-z]/.test(sourceText)) {
        translations[index] = sourceText;
        return;
      }
      const cached = readCachedTranslation(target, sourceText);
      if (cached !== null) {
        translations[index] = cached;
        return;
      }
      const indexes = missingTextToIndexes.get(sourceText) || [];
      indexes.push(index);
      missingTextToIndexes.set(sourceText, indexes);
    });

    const missingTexts = [...missingTextToIndexes.keys()];
    if (!missingTexts.length) {
      response.status(200).json({ target, translations, cached: true });
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TRANSLATION_UPSTREAM_TIMEOUT_MS);

    try {
      const endpoint = new URL("https://translation.googleapis.com/language/translate/v2");
      endpoint.searchParams.set("key", translationApiKey);
      const upstream = await fetch(endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ q: missingTexts, source: "en", target, format: "text" })
      });
      const payload = await upstream.json().catch(() => ({}));

      if (!upstream.ok) {
        const upstreamMessage = payload?.error?.message || `Google Cloud returned HTTP ${upstream.status}.`;
        console.error("Translation API error:", upstream.status, upstreamMessage);
        response.status(upstream.status === 429 ? 429 : 502).json({
          error: upstream.status === 429 ? "translation_quota_reached" : "translation_service_error",
          message: upstream.status === 429
            ? "The site's translation allowance is temporarily exhausted."
            : "The translation service is temporarily unavailable."
        });
        return;
      }

      const received = payload?.data?.translations;
      if (!Array.isArray(received) || received.length !== missingTexts.length) {
        response.status(502).json({
          error: "translation_service_response_invalid",
          message: "The translation service returned an incomplete response."
        });
        return;
      }

      missingTexts.forEach((sourceText, translatedIndex) => {
        const translatedText = decodeGoogleText(received[translatedIndex].translatedText);
        storeCachedTranslation(target, sourceText, translatedText);
        for (const originalIndex of missingTextToIndexes.get(sourceText)) {
          translations[originalIndex] = translatedText;
        }
      });

      response.status(200).json({ target, translations, cached: false });
    } catch (error) {
      console.error("Translation request error:", error);
      response.status(error?.name === "AbortError" ? 504 : 502).json({
        error: error?.name === "AbortError" ? "translation_timeout" : "translation_service_error",
        message: error?.name === "AbortError"
          ? "The translation request timed out. Please try again."
          : "The translation service is temporarily unavailable."
      });
    } finally {
      clearTimeout(timeout);
    }
  }
);

app.get("/pdf-proxy", async (request, response) => {
  const requestedUrl = String(request.query.url || "");
  if (!isAllowedArchiveUrl(requestedUrl)) {
    response.status(400).json({ error: "The requested address is not an approved archive PDF." });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);

  try {
    const upstream = await fetch(requestedUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "application/pdf,application/octet-stream;q=0.9,*/*;q=0.8",
        Referer: "https://michigan-na.org/blue-water-area/",
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 " +
          "Chrome/149.0 Mobile Safari/537.36"
      }
    });

    if (!upstream.ok) {
      response.status(upstream.status).json({
        error: `The archive server returned HTTP ${upstream.status}.`
      });
      return;
    }

    if (!isAllowedArchiveUrl(upstream.url)) {
      response.status(403).json({ error: "The archive redirected to an unapproved address." });
      return;
    }

    const contentType = upstream.headers.get("content-type") || "";
    if (!contentType.includes("pdf") && !contentType.includes("octet-stream")) {
      response.status(502).json({
        error: `The archive returned ${contentType || "an unknown file type"} instead of a PDF.`
      });
      return;
    }

    response.status(200);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", "inline");
    response.setHeader("Cache-Control", "public, max-age=3600");
    response.setHeader("X-Content-Type-Options", "nosniff");

    const length = upstream.headers.get("content-length");
    if (length) response.setHeader("Content-Length", length);

    if (!upstream.body) {
      response.end();
      return;
    }

    await pipeline(Readable.fromWeb(upstream.body), response);
  } catch (error) {
    console.error("PDF proxy error:", error);
    if (!response.headersSent) {
      response.status(error?.name === "AbortError" ? 504 : 502).json({
        error: error?.name === "AbortError"
          ? "The archive PDF request timed out after 90 seconds."
          : "The archive PDF could not be retrieved by the reader service."
      });
    } else {
      response.destroy(error);
    }
  } finally {
    clearTimeout(timeout);
  }
});

app.use(
  "/pdfjs",
  express.static(path.join(rootDirectory, "node_modules", "pdfjs-dist"), {
    maxAge: "1y",
    immutable: true,
    fallthrough: false
  })
);

app.use(express.static(rootDirectory, {
  extensions: ["html"],
  index: "index.html",
  maxAge: "15m",
  setHeaders(response, filePath) {
    if (
      filePath.endsWith("pdf-reader.html") ||
      filePath.endsWith("pdf-reader.mjs") ||
      filePath.endsWith("index.html") ||
      filePath.endsWith("archive-master-index.html")
    ) {
      response.setHeader("Cache-Control", "no-store");
    }
  }
}));

app.get("*", (_request, response) => {
  response.setHeader("Cache-Control", "no-store");
  response.sendFile(path.join(rootDirectory, "index.html"));
});

app.listen(port, "0.0.0.0", () => {
  console.log(`GBRNA reader service v7 listening on port ${port}`);
});
