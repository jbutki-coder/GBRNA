"use strict";

const path = require("path");
const { Readable } = require("stream");
const { pipeline } = require("stream/promises");
const express = require("express");

const app = express();
const port = Number(process.env.PORT || 10000);
const rootDirectory = __dirname;

const allowedHosts = new Set([
  "michigan-na.org",
  "www.michigan-na.org"
]);

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

function copyHeader(upstream, response, name) {
  const value = upstream.headers.get(name);
  if (value) response.setHeader(name, value);
}

app.disable("x-powered-by");

app.get("/health", (_request, response) => {
  response.status(200).json({ status: "ok" });
});

app.get("/pdf-proxy", async (request, response) => {
  const requestedUrl = String(request.query.url || "");

  if (!isAllowedArchiveUrl(requestedUrl)) {
    response.status(400).json({
      error: "Only approved Michigan NA archive PDF addresses are allowed."
    });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const requestHeaders = {
      Accept: "application/pdf,application/octet-stream;q=0.9,*/*;q=0.8",
      Referer: "https://michigan-na.org/blue-water-area/",
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 " +
        "Chrome/149.0 Mobile Safari/537.36"
    };

    if (request.headers.range) {
      requestHeaders.Range = request.headers.range;
    }

    const upstream = await fetch(requestedUrl, {
      method: "GET",
      headers: requestHeaders,
      redirect: "follow",
      signal: controller.signal
    });

    if (!isAllowedArchiveUrl(upstream.url)) {
      response.status(403).json({
        error: "The archive server redirected to an unapproved address."
      });
      return;
    }

    if (!upstream.ok && upstream.status !== 206) {
      response.status(upstream.status).json({
        error: `The archive server returned HTTP ${upstream.status}.`
      });
      return;
    }

    response.status(upstream.status);

    copyHeader(upstream, response, "content-type");
    copyHeader(upstream, response, "content-length");
    copyHeader(upstream, response, "content-range");
    copyHeader(upstream, response, "accept-ranges");
    copyHeader(upstream, response, "etag");
    copyHeader(upstream, response, "last-modified");

    response.setHeader("Content-Disposition", "inline");
    response.setHeader("Cache-Control", "public, max-age=3600");
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("X-Content-Type-Options", "nosniff");

    if (!upstream.body) {
      response.end();
      return;
    }

    await pipeline(
      Readable.fromWeb(upstream.body),
      response
    );
  } catch (error) {
    if (!response.headersSent) {
      const timedOut = error?.name === "AbortError";

      response.status(timedOut ? 504 : 502).json({
        error: timedOut
          ? "The archive PDF request timed out."
          : "The archive PDF could not be retrieved."
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
  express.static(
    path.join(rootDirectory, "node_modules", "pdfjs-dist"),
    {
      maxAge: "1y",
      immutable: true,
      fallthrough: false
    }
  )
);

app.use(
  express.static(rootDirectory, {
    extensions: ["html"],
    index: "index.html",
    maxAge: "15m"
  })
);

app.get("*", (_request, response) => {
  response.sendFile(path.join(rootDirectory, "index.html"));
});

app.listen(port, "0.0.0.0", () => {
  console.log(`GBRNA reader service listening on port ${port}`);
});
