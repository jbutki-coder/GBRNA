let REFLECTIONS = [];
let currentId = null;

const monthNames = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const $ = (selector) => document.querySelector(selector);

function pad(n) {
  return String(n).padStart(2, '0');
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
  return REFLECTIONS.find((r) => r.id === id);
}

function getDailyReadings(date = new Date()) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();
  const readings = REFLECTIONS.filter((r) => r.month === month && r.day === day);

  if (!isLeapYear(year) && month === 2 && day === 28) {
    const feb29 = findReading('02-29');
    if (feb29) readings.push(feb29);
  }

  return readings;
}

function getReadingIndex(id) {
  return REFLECTIONS.findIndex((r) => r.id === id);
}

function moveReading(direction) {
  const index = getReadingIndex(currentId || todayId());
  if (index < 0) return;
  const nextIndex = (index + direction + REFLECTIONS.length) % REFLECTIONS.length;
  showReadingById(REFLECTIONS[nextIndex].id);
}

function paragraphHtml(text) {
  if (!text) return '';
  return text
    .split(/\n\s*\n/)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join('');
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderReadingCard(reading, label = '') {
  return `
    <article class="reading-card" id="reading-${reading.id}">
      <div class="reading-date">
        <h3>${escapeHtml(label || reading.date)}</h3>
        <span class="page-ref">PDF page ${reading.pdfPage}</span>
      </div>
      <blockquote class="quote">${escapeHtml(reading.quote)}</blockquote>
      <div class="body-text">${paragraphHtml(reading.body)}</div>
      ${reading.moment ? `
        <div class="moment-box">
          <h4>In This Moment</h4>
          <p class="moment-text">${escapeHtml(reading.moment)}</p>
        </div>` : ''}
    </article>
  `;
}

function renderReadings(readings, notice = '') {
  const area = $('#readingArea');
  area.innerHTML = readings.map((reading) => renderReadingCard(reading)).join('');

  const noticeEl = $('#dailyNotice');
  if (notice) {
    noticeEl.textContent = notice;
    noticeEl.classList.remove('hidden');
  } else {
    noticeEl.classList.add('hidden');
    noticeEl.textContent = '';
  }
}

function showToday() {
  const date = new Date();
  const readings = getDailyReadings(date);
  currentId = readings[0]?.id || todayId();
  const notice = readings.length > 1
    ? 'Non-leap year handling: the February 29 reflection is included with February 28 today.'
    : '';
  renderReadings(readings, notice);
  location.hash = 'today';
}

function showReadingById(id) {
  const reading = findReading(id);
  if (!reading) return showToday();
  currentId = id;
  renderReadings([reading]);
  location.hash = id;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderArchive() {
  const byMonth = new Map();
  REFLECTIONS.forEach((r) => {
    if (!byMonth.has(r.month)) byMonth.set(r.month, []);
    byMonth.get(r.month).push(r);
  });

  $('#archiveGrid').innerHTML = [...byMonth.entries()].map(([month, readings]) => `
    <div class="month-card">
      <h3>${monthNames[month]}</h3>
      <div class="days">
        ${readings.map((r) => `<a class="archive-link" href="#${r.id}" data-id="${r.id}">${r.day}</a>`).join('')}
      </div>
    </div>
  `).join('');

  document.querySelectorAll('.archive-link').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      showReadingById(link.dataset.id);
    });
  });
}

function doSearch(query) {
  const q = query.trim().toLowerCase();
  const results = $('#searchResults');

  if (q.length < 2) {
    results.innerHTML = '<p class="small-note">Type at least two letters to search the reflections.</p>';
    return;
  }

  const matches = REFLECTIONS.filter((r) => {
    const haystack = `${r.date} ${r.quote} ${r.body} ${r.moment}`.toLowerCase();
    return haystack.includes(q);
  }).slice(0, 40);

  if (!matches.length) {
    results.innerHTML = '<p class="small-note">No reflections matched that search.</p>';
    return;
  }

  results.innerHTML = matches.map((r) => {
    const snippetSource = `${r.quote} ${r.body} ${r.moment}`;
    const lower = snippetSource.toLowerCase();
    const idx = lower.indexOf(q);
    const start = Math.max(0, idx - 70);
    const snippet = snippetSource.slice(start, start + 190);
    return `
      <a class="result-card" href="#${r.id}" data-id="${r.id}">
        <strong>${escapeHtml(r.date)}</strong>
        <p>${escapeHtml(snippet)}${snippet.length >= 190 ? '...' : ''}</p>
      </a>`;
  }).join('');

  document.querySelectorAll('.result-card').forEach((card) => {
    card.addEventListener('click', (event) => {
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
    const btn = $('#shareBtn');
    const old = btn.textContent;
    btn.textContent = 'Copied';
    setTimeout(() => { btn.textContent = old; }, 1200);
  } catch (err) {
    prompt('Copy this link:', url);
  }
}

function handleHash() {
  const hash = location.hash.replace('#', '');
  if (!hash || hash === 'today') {
    showToday();
    return;
  }
  if (/^\d{2}-\d{2}$/.test(hash)) {
    showReadingById(hash);
    return;
  }
  // Section links such as #archive, #search, and #about should keep today's
  // reading loaded at the top without changing the user's section anchor.
  if (!$('#readingArea').innerHTML.trim()) {
    const readings = getDailyReadings(new Date());
    currentId = readings[0]?.id || todayId();
    renderReadings(readings);
  }
}

async function init() {
  const res = await fetch('data/reflections.json');
  REFLECTIONS = await res.json();

  renderArchive();
  handleHash();

  $('#prevBtn').addEventListener('click', () => moveReading(-1));
  $('#nextBtn').addEventListener('click', () => moveReading(1));
  $('#todayBtn').addEventListener('click', showToday);
  $('#randomBtn').addEventListener('click', () => {
    const pick = REFLECTIONS[Math.floor(Math.random() * REFLECTIONS.length)];
    showReadingById(pick.id);
  });
  $('#shareBtn').addEventListener('click', copyLink);
  $('#searchInput').addEventListener('input', (event) => doSearch(event.target.value));

  window.addEventListener('hashchange', handleHash);
}

init().catch((error) => {
  console.error(error);
  $('#readingArea').innerHTML = '<article class="reading-card"><h3>Something went wrong loading the reflections.</h3><p>Please make sure data/reflections.json is present.</p></article>';
});
