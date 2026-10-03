"use strict";

const bbState = {
  entries: [],
  query: "",
  filter: "all"
};

const bbEls = {
  total: document.querySelector("[data-bb-total]"),
  matched: document.querySelector("[data-bb-matched]"),
  outside: document.querySelector("[data-bb-outside]"),
  review: document.querySelector("[data-bb-review]"),
  search: document.querySelector("[data-bb-search]"),
  filter: document.querySelector("[data-bb-filter]"),
  table: document.querySelector("[data-bb-table]")
};

function bbEscape(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function bbStatusLabel(status) {
  if (status === "matched") return "Matched";
  if (status === "outside-baby-blue-screen-copy") return "Outside copy";
  return "Needs review";
}

function bbFilteredEntries() {
  const query = bbState.query.trim().toLowerCase();
  return bbState.entries.filter((entry) => {
    if (bbState.filter !== "all" && entry.status !== bbState.filter) return false;
    if (!query) return true;
    const haystack = [
      entry.date,
      entry.title,
      entry.originalCitation,
      entry.babyBlueCitation,
      entry.status
    ].join(" ").toLowerCase();
    return haystack.includes(query);
  });
}

function bbRenderTable() {
  if (!bbEls.table) return;
  const entries = bbFilteredEntries();
  if (!entries.length) {
    bbEls.table.innerHTML = '<div class="baby-blue-compat-empty">No compatibility entries match that search.</div>';
    return;
  }

  bbEls.table.innerHTML = `
    <table class="baby-blue-compat-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Original BT Ref</th>
          <th>Baby Blue Ref</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${entries.map((entry) => `
          <tr>
            <td><a href="#${bbEscape(entry.id)}">${bbEscape(entry.date)}</a></td>
            <td>${bbEscape(entry.originalCitation)}</td>
            <td>${bbEscape(entry.babyBlueCitation)}</td>
            <td><span class="baby-blue-compat-badge ${bbEscape(entry.status)}">${bbEscape(bbStatusLabel(entry.status))}</span></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function bbRenderStats(stats) {
  if (!stats) return;
  if (bbEls.total) bbEls.total.textContent = String(stats.entries || 0);
  if (bbEls.matched) bbEls.matched.textContent = String(stats.matched || 0);
  if (bbEls.outside) bbEls.outside.textContent = String(stats.outsideBabyBlueScreenCopy || 0);
  if (bbEls.review) bbEls.review.textContent = String(stats.needsReview || 0);
}

async function bbInit() {
  if (!bbEls.table) return;
  try {
    const response = await fetch("/data/jft-baby-blue-compatibility.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Baby Blue compatibility data not found");
    const data = await response.json();
    bbState.entries = data.entries || [];
    bbRenderStats(data.stats);
    bbRenderTable();
  } catch (error) {
    console.error(error);
    bbEls.table.innerHTML = '<div class="baby-blue-compat-empty">The Baby Blue compatibility data could not be loaded. Try refreshing the page.</div>';
  }
}

bbEls.search?.addEventListener("input", (event) => {
  bbState.query = event.target.value;
  bbRenderTable();
});

bbEls.filter?.addEventListener("change", (event) => {
  bbState.filter = event.target.value;
  bbRenderTable();
});

bbInit();
