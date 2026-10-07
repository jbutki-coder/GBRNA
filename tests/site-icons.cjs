"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const pages = execFileSync("git", ["ls-files", "*.html"], { cwd: root, encoding: "utf8" })
  .trim().split(/\r?\n/);
const expected = [
  ["icon", "/icons/favicon.ico?v=20261006-af"],
  ["shortcut icon", "/icons/favicon.ico?v=20261006-af"],
  ["icon", "/icons/favicon-16x16.png?v=20261006-af"],
  ["icon", "/icons/favicon-32x32.png?v=20261006-af"],
  ["apple-touch-icon", "/icons/apple-touch-icon.png?v=20261006-af"],
];

for (const page of pages) {
  const html = fs.readFileSync(path.join(root, page), "utf8");
  const head = html.split(/<\/head>/i)[0];
  const icons = [...head.matchAll(/<link\b[^>]*>/gi)].map(([tag]) => {
    const attributes = Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)]
      .map((match) => [match[1], match[2]]));
    return attributes;
  }).filter(({ rel }) => ["icon", "shortcut icon", "apple-touch-icon", "apple-touch-icon-precomposed"].includes(rel));
  const preserved = ["archive-master-index.html", "lwb-draft/index.html"].includes(page);
  if (preserved) {
    const original = execFileSync("git", ["show", `c85757a:${page}`], { cwd: root, encoding: "utf8" });
    const originalIcons = [...original.matchAll(/<link\b[^>]*\brel="(?:icon|shortcut icon|apple-touch-icon)"[^>]*>/gi)]
      .map(([tag]) => tag);
    assert.deepEqual(icons.map(({ rel, href }) => [rel, href]), originalIcons.map((tag) => [
      tag.match(/rel="([^"]*)"/)[1], tag.match(/href="([^"]*)"/)[1],
    ]), `${page}: preserve its distinct icon`);
  } else {
    assert.deepEqual(icons.map(({ rel, href }) => [rel, href]), expected, `${page}: shared AF icons`);
  }
  for (const { href, type } of icons) {
    const assetPath = href.startsWith("/") ? path.join(root, href.split("?")[0])
      : path.resolve(root, path.dirname(page), href.split("?")[0]);
    const asset = fs.readFileSync(assetPath);
    assert.ok(asset.length > 0, `${page}: icon file exists`);
    if (type === "image/png") {
      assert.equal(asset.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", "PNG signature");
    } else if (href.includes(".ico")) {
      assert.equal(asset.subarray(0, 4).toString("hex"), "00000100", "ICO signature");
    }
  }
}
console.log(`Icons verified on ${pages.length} HTML pages; distinct archive and meeting icons preserved.`);
