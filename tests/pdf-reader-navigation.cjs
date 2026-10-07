"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../js/pdf-reader.mjs"), "utf8");
// Exercise the actual reader helpers without a network request or PDF engine.
const boot = source.lastIndexOf("  openDocument();");
const exposed = source.slice(0, boot) + `
  window.testReader = {
    updateCurrentFromVisibility, scrollToPage,
    setup(total, page, candidates) {
      pdfDocument = {numPages: total}; currentPage = page;
      for (const candidate of candidates) visibleRatios.set(candidate, 1);
    },
    getCurrent: () => currentPage
  };
})();`;
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, {
    textContent: "", addEventListener() {},
    getBoundingClientRect: () => ({top: 0, bottom: 0}),
  });
  return elements.get(id);
}
const window = {location: {search: "?page=53"}, addEventListener() {}};
const context = vm.createContext({window, URLSearchParams, document: {getElementById: element}});
vm.runInContext(exposed, context);
const reader = window.testReader;
element("pdfScroll").getBoundingClientRect = () => ({top: 100, bottom: 500});
element("pdf-page-52").getBoundingClientRect = () => ({top: -1100, bottom: 90});
element("pdf-page-53").getBoundingClientRect = () => ({top: 110, bottom: 1300});
element("pdf-page-54").getBoundingClientRect = () => ({top: 1310, bottom: 2500});
reader.setup(55, 53, [52, 53, 54]);
reader.updateCurrentFromVisibility();
assert.equal(reader.getCurrent(), 53, "Preloaded page 52 must not override visible page 53");
assert.equal(element("pageReadout").textContent, "53 / 55");
element("pdf-page-53").getBoundingClientRect = () => ({top: -1050, bottom: 140});
element("pdf-page-54").getBoundingClientRect = () => ({top: 150, bottom: 1340});
reader.updateCurrentFromVisibility();
assert.equal(reader.getCurrent(), 54, "Scrolling must update to the most visible page");
const opening = source.slice(source.indexOf("const initialPage"));
assert.ok(opening.indexOf("await renderPage(initialPage, true)") < opening.indexOf("startObservers()"));
assert.ok(opening.indexOf("scrollToPage(initialPage, 'instant')") < opening.indexOf("startObservers()"));
console.log("PASS: deep-link rendering precedes observation; preloaded pages do not override the visible page.");
