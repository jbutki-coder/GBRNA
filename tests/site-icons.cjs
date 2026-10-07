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
  assert.deepEqual(icons.map(({ rel, href }) => [rel, href]), expected, `${page}: shared AF icons`);
  for (const { href, type } of icons) {
    const asset = fs.readFileSync(path.join(root, href.split("?")[0]));
    assert.ok(asset.length > 0, `${page}: icon file exists`);
    if (type === "image/png") {
      assert.equal(asset.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", "PNG signature");
    } else if (href.includes(".ico")) {
      assert.equal(asset.subarray(0, 4).toString("hex"), "00000100", "ICO signature");
    }
  }
}
console.log(`Shared AF icons verified on ${pages.length} HTML pages.`);
