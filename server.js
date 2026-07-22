"use strict";

const path = require("path");
const { Readable } = require("stream");
const { pipeline } = require("stream/promises");
const express = require("express");

const app = express();
const port = Number(process.env.PORT || 10000);
const rootDirectory = __dirname;

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
  response.status(200).json({ status: "ok", pdfReader: true, version: "6" });
});

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
  console.log(`GBRNA reader service v6 listening on port ${port}`);
});
