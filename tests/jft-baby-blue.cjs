"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const readings = readJson("data/just-for-today.json");
const map = readJson("data/jft-baby-blue-compatibility.json");
assert.equal(readings.length, 366);
assert.equal(new Set(readings.map((entry) => entry.id)).size, 366);
assert.equal(map.entries.length, 366);
const byId = new Map(map.entries.map((entry) => [entry.id, entry]));
const source = fs.readFileSync(path.join(root, "js/just-for-today.js"), "utf8");
const context = vm.createContext({
  URL, URLSearchParams,
  window: {location: {href: "https://gbrna.onrender.com/just-for-today/"}},
  location: {origin: "https://gbrna.onrender.com", pathname: "/just-for-today/", hash: "#10-06"},
});
vm.runInContext(source.slice(0, source.lastIndexOf("\ninit().catch(")), context);

function passageUrl(card) {
  const href = card.match(/href="([^"]+)">Open Baby Blue Passage/)[1].replaceAll("&amp;", "&");
  return new URL(href, context.location.origin);
}

function validPage(page) {
  return (Number.isInteger(page) && page >= 1 && page <= 79) || ["xi", "xiv", "xv"].includes(page);
}

for (const reading of readings) {
  const reference = byId.get(reading.id);
  for (const field of ["babyBlueLocation", "babyBluePage", "babyBluePageEnd", "babyBlueCitation", "babyBlueQuote"]) {
    assert.equal(reading[field], reference[field], `${reading.id}: ${field}`);
  }
  assert.equal(reading.babyBlueStatus, reference.status);
  assert.equal(reading.babyBluePrintedPageVerified, reference.printedPageVerified);
  assert.equal(reading.babyBluePdfPage, reference.matchEvidencePdfPage);
  const card = context.renderReadingCard(reading);
  if (reading.babyBlueQuote) {
    assert.equal(reading.babyBlueStatus, "matched");
    assert.ok(reading.babyBluePrintedPageVerified);
    const referenceBox = card.match(/<div class="jft-reference-box matched">([\s\S]*?)<\/blockquote>/)[1];
    assert.ok(referenceBox.includes("Baby Blue wording"));
    assert.ok(referenceBox.includes(context.escapeHtml(reading.babyBlueQuote)));
    assert.ok(!/[\x00-\x1f\ufffd]/.test(reading.babyBlueQuote));
  } else {
    assert.ok(!card.includes("jft-baby-blue-wording"));
  }
  if (reading.babyBlueStatus === "matched") {
    assert.ok(reading.babyBluePrintedPageVerified, reading.id);
    assert.ok(reading.babyBlueLocation);
    assert.ok(Number.isInteger(reading.babyBluePdfPage));
    assert.ok(reading.babyBluePdfPage >= 1 && reading.babyBluePdfPage <= 55);
    const url = passageUrl(card);
    assert.equal(url.searchParams.get("page"), String(reading.babyBluePdfPage));
    assert.equal(url.searchParams.get("url"), "https://gbrna.onrender.com/literature/baby-blue-third-edition-revised-screen-reading.pdf");
    assert.ok(!card.includes("awaiting verification"));
    if (reading.babyBluePage === null) {
      assert.equal(reading.id, "05-03");
      assert.ok(card.includes("unnumbered"));
    } else {
      assert.ok(validPage(reading.babyBluePage), reading.id);
      if (reading.babyBluePageEnd !== null) {
        assert.ok(validPage(reading.babyBluePageEnd));
        if (typeof reading.babyBluePage === "number") assert.ok(reading.babyBluePageEnd > reading.babyBluePage);
      }
    }
  } else {
    assert.equal(reading.babyBluePage, null);
    assert.equal(reading.babyBluePdfPage, null);
    assert.ok(!card.includes("Open Baby Blue Passage"));
  }
}

const at = (id) => readings.find((entry) => entry.id === id);
for (const [id, page, pdfPage, section] of [
  ["10-06", 29, 22, "Step Eight"],
  ["10-03", 78, 53, "More Will Be Revealed"],
  ["05-17", 25, 20, "Step Six"],
  ["07-15", 28, 22, "Step Eight"],
  ["08-26", 31, 24, "Step Ten"],
  ["09-17", 24, 19, "Step Five"],
  ["09-18", 41, 30, "What Can I Do?"],
  ["11-25", 34, 26, "Step Eleven"],
]) {
  const reading = at(id);
  assert.equal(reading.babyBluePage, page, id);
  assert.equal(reading.babyBluePdfPage, pdfPage, id);
  assert.ok(reading.babyBlueLocation.includes(section), id);
}
assert.equal(at("03-04").babyBlueStatus, "needs-review");
assert.ok(context.renderReadingCard(at("03-04")).includes("not found in this Baby Blue edition"));
assert.equal(at("05-05").babyBlueStatus, "outside-baby-blue-screen-copy");
assert.equal(at("05-01").babyBluePage, null);
assert.equal(at("05-01").babyBlueLocation, "");
assert.ok(at("05-01").babyBlueNote.includes("personal-story section"));
assert.equal(at("05-03").babyBlueLocation, "Gratitude Prayer - After Chapter Ten: More Will Be Revealed");
assert.equal(at("05-03").babyBlueMatchType, "unnumbered-end-matter");
assert.equal(at("05-03").babyBluePdfPage, 55);
assert.ok(context.renderReadingCard(at("05-03")).includes("at the end of the Baby Blue"));
assert.ok(!context.renderReadingCard(at("05-03")).includes("front matter"));
assert.equal(at("10-06").babyBlueQuote, "Projecting about actually making amends can be a major obstacle both in making the list and in becoming willing.");
assert.ok(at("10-06").quote.includes("Projections about actually making amends"));
assert.equal(readings.filter((entry) => entry.babyBlueQuote).length, 130);
assert.ok(!context.renderBabyBlueReference({...at("10-06"), babyBlueStatus: "needs-review"}).includes("jft-baby-blue-wording"));
assert.ok(!context.renderBabyBlueReference({...at("10-06"), babyBluePrintedPageVerified: false}).includes("jft-baby-blue-wording"));
const escapedWording = context.renderBabyBlueReference({...at("10-06"), babyBlueQuote: '<script>alert("wording")</script>'});
assert.ok(escapedWording.includes("&lt;script&gt;"));
assert.ok(!escapedWording.includes("<script>"));
assert.equal(at("01-06").title, '"How Does It Work?"');
assert.equal(at("11-08").source, "Basic Text p.23");
assert.equal(readings.filter((entry) => entry.babyBlueStatus === "matched").length, 331);
assert.equal(map.stats.matched, 331);
assert.equal(map.stats.verifiedPrintedPages, 330);
assert.equal(map.stats.verifiedUnnumberedLocations, 1);
assert.equal(map.stats.outsideBabyBlueScreenCopy, 34);
assert.equal(map.stats.needsReview, 1);
assert.ok(!JSON.stringify(map).includes("C:\\Users"));
console.log("PASS: all 366 dates; 330 printed-page references; unnumbered prayer; ranges, Roman pages, Step locations, PDF navigation, and honest exceptions.");
