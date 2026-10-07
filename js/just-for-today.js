"use strict";

let READINGS = [];
let currentId = null;

const DATA_URL = "/data/just-for-today.json";
const JFT_PDF_URL = "/downloads/Just-For-Today.pdf";
const BABY_BLUE_PDF_URL = "/literature/baby-blue-third-edition-revised-screen-reading.pdf";

const monthNames = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const $ = (selector) => document.querySelector(selector);

function pad(n) {
  return String(n).padStart(2, "0");
}

function makeId(month, day) {
  return `${pad(month)}-${pad(day)}`;
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function todayId() {
  const today = new Date();
  return makeId(today.getMonth() + 1, today.getDate());
}

function findReading(id) {
  return READINGS.find((reading) => reading.id === id);
}

function getDailyReadings(date = new Date()) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();
  const readings = READINGS.filter((reading) => reading.month === month && reading.day === day);

  if (!isLeapYear(year) && month === 2 && day === 28) {
    const feb29 = findReading("02-29");
    if (feb29) readings.push(feb29);
  }

  return readings;
}

function getReadingIndex(id) {
  return READINGS.findIndex((reading) => reading.id === id);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function paragraphHtml(text) {
  if (!text) return "";
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("");
}

function readerUrl(pdfUrl, title, page) {
  const params = new URLSearchParams();
  params.set("url", new URL(pdfUrl, window.location.href).href);
  params.set("title", title);
  params.set("return", `${location.origin}${location.pathname}${location.hash || ""}`);
  if (page) params.set("page", String(page));
  return `/pdf-reader.html?${params.toString()}`;
}

function babyBlueStatusLabel(status) {
  if (status === "matched") return "Matched in Baby Blue";
  if (status === "outside-baby-blue-screen-copy") return "Outside Baby Blue screen copy";
  return "Needs manual Baby Blue review";
}

function babyBlueHelp(reading) {
  if (reading.babyBlueStatus === "matched") {
    return reading.babyBluePrintedPageVerified
      ? "The printed book page was verified against the Baby Blue template."
      : "The quote has a Baby Blue source location; its printed book page is awaiting verification.";
  }
  if (reading.babyBlueStatus === "outside-baby-blue-screen-copy") {
    return "The source appears to be outside the current Baby Blue screen-reading copy.";
  }
  return "This date needs a manual check against the Baby Blue copy.";
}

function renderBabyBlueReference(reading) {
  const status = reading.babyBlueStatus || "needs-review";
  const citation = reading.babyBlueCitation || "Needs manual Baby Blue review";
  const locationLine = reading.babyBlueLocation
    ? `<p><strong>Location:</strong> ${escapeHtml(reading.babyBlueLocation)}</p>`
    : "";

  return `
    <div class="jft-reference-grid">
      <div class="jft-reference-box ${escapeHtml(status)}">
        <span>Baby Blue Basic Text</span>
        <strong>${escapeHtml(citation)}</strong>
        ${locationLine}
        <p>${escapeHtml(babyBlueStatusLabel(status))}. ${escapeHtml(babyBlueHelp(reading))}</p>
      </div>
      <div class="jft-reference-box">
        <span>Just For Today PDF</span>
        <strong>JFT PDF p. ${escapeHtml(reading.pdfPage)}</strong>
        <p>Source line: ${escapeHtml(reading.source || "Source reference pending")}</p>
      </div>
    </div>
  `;
}

function renderReadingCard(reading) {
  const sourceLine = reading.source || "Source reference pending";
  const babyBlueActionLabel = reading.babyBluePdfPage ? "Open Baby Blue Passage" : "Open Baby Blue PDF";
  return `
    <article class="reading-card" id="reading-${escapeHtml(reading.id)}">
      <div class="reading-date">
        <h3>${escapeHtml(reading.date)}: ${escapeHtml(reading.title)}</h3>
        <div class="reading-meta">
          <span class="source-ref">${escapeHtml(sourceLine)}</span>
          <span class="page-ref">JFT PDF p. ${escapeHtml(reading.pdfPage)}</span>
        </div>
      </div>

      <blockquote class="quote">${escapeHtml(reading.quote)}</blockquote>
      ${renderBabyBlueReference(reading)}
      <div class="body-text">${paragraphHtml(reading.body)}</div>

      ${reading.moment ? `
        <div class="moment-box">
          <h4>Just For Today</h4>
          <p class="moment-text">${escapeHtml(reading.moment.replace(/^Just for today:\s*/i, ""))}</p>
        </div>` : ""}

      <div class="jft-card-actions">
        <a href="${escapeHtml(readerUrl(JFT_PDF_URL, "Just For Today", reading.pdfPage))}">Open JFT PDF Page</a>
        <a class="secondary" href="${escapeHtml(readerUrl(BABY_BLUE_PDF_URL, "Baby Blue Basic Text", reading.babyBluePdfPage))}">${escapeHtml(babyBlueActionLabel)}</a>
        <a class="secondary" href="/downloads/Just-For-Today.pdf" download>Download JFT PDF</a>
      </div>
    </article>
  `;
}

function renderReadings(readings, notice = "") {
  const area = $("#readingArea");
  if (!readings.length) {
    area.innerHTML = "<article class=\"reading-card\"><h3>No Just For Today reading was found for this date.</h3><p>Please use the archive below to pick another date.</p></article>";
  } else {
    area.innerHTML = readings.map((reading) => renderReadingCard(reading)).join("");
  }

  const noticeEl = $("#dailyNotice");
  if (notice) {
    noticeEl.textContent = notice;
    noticeEl.classList.remove("hidden");
  } else {
    noticeEl.textContent = "";
    noticeEl.classList.add("hidden");
  }
}

function showReadingById(id) {
  const reading = findReading(id);
  if (!reading) return showToday();
  currentId = id;
  renderReadings([reading]);
  location.hash = id;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showToday() {
  const date = new Date();
  const readings = getDailyReadings(date);
  currentId = readings[0]?.id || todayId();
  const notice = readings.length > 1 && date.getMonth() + 1 === 2 && date.getDate() === 28
    ? "Non-leap year handling: February 29 is included with February 28 today."
    : "";
  renderReadings(readings, notice);
  location.hash = "today";
}

function moveReading(direction) {
  const index = getReadingIndex(currentId || todayId());
  if (index < 0) return;
  const nextIndex = (index + direction + READINGS.length) % READINGS.length;
  showReadingById(READINGS[nextIndex].id);
}

function renderArchive() {
  const byMonth = new Map();
  READINGS.forEach((reading) => {
    if (!byMonth.has(reading.month)) byMonth.set(reading.month, []);
    byMonth.get(reading.month).push(reading);
  });

  $("#archiveGrid").innerHTML = [...byMonth.entries()].map(([month, readings]) => `
    <div class="month-card">
      <h3>${monthNames[month]}</h3>
      <div class="days">
        ${readings.map((reading) => `<a class="archive-link" href="#${reading.id}" data-id="${reading.id}">${reading.day}</a>`).join("")}
      </div>
    </div>
  `).join("");

  document.querySelectorAll(".archive-link").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      showReadingById(link.dataset.id);
    });
  });
}

function updateStats() {
  const matched = READINGS.filter((reading) => reading.babyBlueStatus === "matched").length;
  const outside = READINGS.filter((reading) => reading.babyBlueStatus === "outside-baby-blue-screen-copy").length;
  const review = READINGS.filter((reading) => reading.babyBlueStatus === "needs-review").length;
  $("[data-jft-total]").textContent = String(READINGS.length);
  $("[data-jft-matched]").textContent = String(matched);
  $("[data-jft-outside]").textContent = String(outside);
  $("[data-jft-review]").textContent = String(review);
}

function doSearch(query) {
  const q = query.trim().toLowerCase();
  const results = $("#searchResults");

  if (q.length < 2) {
    results.innerHTML = "<p class=\"small-note\">Type at least two letters to search Just For Today.</p>";
    return;
  }

  const matches = READINGS.filter((reading) => {
    const haystack = [
      reading.date,
      reading.title,
      reading.source,
      reading.babyBlueCitation,
      reading.babyBlueLocation,
      reading.quote,
      reading.body,
      reading.moment
    ].join(" ").toLowerCase();
    return haystack.includes(q);
  }).slice(0, 40);

  if (!matches.length) {
    results.innerHTML = "<p class=\"small-note\">No Just For Today readings matched that search.</p>";
    return;
  }

  results.innerHTML = matches.map((reading) => {
    const snippetSource = `${reading.date} ${reading.title} ${reading.babyBlueCitation || ""} ${reading.quote} ${reading.body}`;
    const lower = snippetSource.toLowerCase();
    const idx = lower.indexOf(q);
    const start = Math.max(0, idx - 70);
    const snippet = snippetSource.slice(start, start + 190);
    return `
      <a class="result-card" href="#${escapeHtml(reading.id)}" data-id="${escapeHtml(reading.id)}">
        <strong>${escapeHtml(reading.date)}: ${escapeHtml(reading.title)}</strong>
        <p>${escapeHtml(snippet)}${snippet.length >= 190 ? "..." : ""}</p>
      </a>
    `;
  }).join("");

  document.querySelectorAll(".result-card").forEach((card) => {
    card.addEventListener("click", (event) => {
      event.preventDefault();
      showReadingById(card.dataset.id);
    });
  });
}

async function copyLink() {
  const id = currentId || todayId();
  const url = `${location.origin}${location.pathname}#${id}`;
  try {
    await navigator.clipboard.writeText(url);
    const button = $("#shareBtn");
    const oldText = button.textContent;
    button.textContent = "Copied";
    setTimeout(() => { button.textContent = oldText; }, 1200);
  } catch {
    prompt("Copy this link:", url);
  }
}

function handleHash() {
  const hash = location.hash.replace("#", "");
  if (!hash || hash === "today") {
    showToday();
    return;
  }
  if (/^\d{2}-\d{2}$/.test(hash)) {
    showReadingById(hash);
    return;
  }
  if (!$("#readingArea").innerHTML.trim()) showToday();
}

async function init() {
  const response = await fetch(DATA_URL, { cache: "no-store" });
  if (!response.ok) throw new Error("Just For Today data not found");
  READINGS = await response.json();

  updateStats();
  renderArchive();
  handleHash();

  $("#prevBtn").addEventListener("click", () => moveReading(-1));
  $("#todayBtn").addEventListener("click", showToday);
  $("#nextBtn").addEventListener("click", () => moveReading(1));
  $("#randomBtn").addEventListener("click", () => {
    const pick = READINGS[Math.floor(Math.random() * READINGS.length)];
    showReadingById(pick.id);
  });
  $("#shareBtn").addEventListener("click", copyLink);
  $("#searchInput").addEventListener("input", (event) => doSearch(event.target.value));
  window.addEventListener("hashchange", handleHash);
}

init().catch((error) => {
  console.error(error);
  $("#readingArea").innerHTML = "<article class=\"reading-card\"><h3>Something went wrong loading Just For Today.</h3><p>Please refresh and try again.</p></article>";
});
