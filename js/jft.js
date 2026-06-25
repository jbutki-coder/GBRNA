let READINGS = [];
let currentId = null;

const CONFIG = {
  projectName: 'Just For Tonight',
  shortName: 'JFT',
  dataUrl: 'data/jft.json',
  formSubjectPrefix: 'JFT Review/Input',
  pdfLabel: 'JFT PDF p.',
  sourceFallback: 'Source reference pending',
  reviewHelp: 'Share review, correction, Group input, or literature feedback for this reading.',
  momentTitle: 'Just For Tonight',
  noReadingMessage: 'No Just For Tonight reading was found for this date in the source draft.'
};

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
  return READINGS.find((r) => r.id === id);
}

function getDailyReadings(date = new Date()) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();
  const readings = READINGS.filter((r) => r.month === month && r.day === day);

  if (!isLeapYear(year) && month === 2 && day === 28) {
    const feb29Readings = READINGS.filter((r) => r.month === 2 && r.day === 29);
    feb29Readings.forEach((reading) => readings.push(reading));
  }

  return readings;
}

function getReadingIndex(id) {
  return READINGS.findIndex((r) => r.id === id);
}

function moveReading(direction) {
  const index = getReadingIndex(currentId || todayId());
  if (index < 0) return;
  const nextIndex = (index + direction + READINGS.length) % READINGS.length;
  showReadingById(READINGS[nextIndex].id);
}

function paragraphHtml(text) {
  if (!text) return '';
  return text
    .split(/\n\s*\n/)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join('');
}

function escapeHtml(str) {
  return String(str || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderReviewInputForm(reading) {
  const source = reading.source || CONFIG.sourceFallback;
  const page = reading.pdfPage ? `${CONFIG.pdfLabel} ${reading.pdfPage}` : '';
  const siteLink = `${location.origin}${location.pathname}#${reading.id}`;

  return `
    <section class="review-input" aria-label="Review and input for ${escapeHtml(reading.date)}">
      <h4>Review &amp; Input</h4>
      <p class="review-help">${escapeHtml(CONFIG.reviewHelp)}</p>

      <form class="review-form" action="https://formspree.io/f/xbdvjywr" method="POST">
        <input type="hidden" name="project" value="${escapeHtml(CONFIG.projectName)}">
        <input type="hidden" name="reading_date" value="${escapeHtml(reading.date)}">
        <input type="hidden" name="reading_id" value="${escapeHtml(reading.id)}">
        <input type="hidden" name="source_reference" value="${escapeHtml(source)}">
        <input type="hidden" name="pdf_page" value="${escapeHtml(page)}">
        <input type="hidden" name="site_link" value="${escapeHtml(siteLink)}">
        <input type="hidden" name="_subject" value="${escapeHtml(CONFIG.formSubjectPrefix)} — ${escapeHtml(reading.date)}">

        <label>
          Name or Group
          <input type="text" name="name_or_group" autocomplete="name" placeholder="Name or Home Group">
        </label>

        <label>
          Email
          <input type="email" name="email" autocomplete="email" placeholder="Only if you want a response">
        </label>

        <label>
          Review / Input <span>(required)</span>
          <textarea name="message" required placeholder="Enter review, correction, Group input, or suggested changes..."></textarea>
        </label>

        <button type="submit">Submit Review/Input</button>
        <p class="form-status" aria-live="polite"></p>
      </form>
    </section>
  `;
}

function attachReviewForms() {
  document.querySelectorAll('.review-form').forEach((form) => {
    if (form.dataset.bound === 'true') return;
    form.dataset.bound = 'true';

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      const status = form.querySelector('.form-status');
      const oldText = button.textContent;

      button.disabled = true;
      button.textContent = 'Submitting...';
      status.textContent = '';
      status.className = 'form-status';

      try {
        const response = await fetch(form.action, {
          method: 'POST',
          body: new FormData(form),
          headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) throw new Error('Form submission failed');

        form.reset();
        status.textContent = 'Thank you. Your review/input has been submitted.';
        status.classList.add('success');
      } catch (error) {
        console.error(error);
        status.textContent = 'Something went wrong. Please try again, or copy your input before refreshing.';
        status.classList.add('error');
      } finally {
        button.disabled = false;
        button.textContent = oldText;
      }
    });
  });
}

function renderReadingCard(reading, label = '') {
  const sourceLine = reading.source ? escapeHtml(reading.source) : CONFIG.sourceFallback;
  const pageLine = reading.pdfPage ? `${CONFIG.pdfLabel} ${reading.pdfPage}` : '';

  return `
    <article class="reading-card" id="reading-${reading.id}">
      <div class="reading-date">
        <h3>${escapeHtml(label || reading.date)}</h3>
        <div class="reading-meta">
          <span class="source-ref">${sourceLine}</span>
          ${pageLine ? `<span class="page-ref">${escapeHtml(pageLine)}</span>` : ''}
        </div>
      </div>
      <blockquote class="quote">${escapeHtml(reading.quote)}</blockquote>
      <div class="body-text">${paragraphHtml(reading.body)}</div>
      ${reading.moment ? `
        <div class="moment-box">
          <h4>${escapeHtml(CONFIG.momentTitle)}</h4>
          <p class="moment-text">${escapeHtml(reading.moment)}</p>
        </div>` : ''}
      ${renderReviewInputForm(reading)}
    </article>
  `;
}

function renderReadings(readings, notice = '') {
  const area = $('#readingArea');

  if (!readings.length) {
    area.innerHTML = `<article class="reading-card"><h3>${escapeHtml(CONFIG.noReadingMessage)}</h3><p>Please check the archive or source draft for this date.</p></article>`;
  } else {
    area.innerHTML = readings.map((reading) => renderReadingCard(reading)).join('');
    attachReviewForms();
  }

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
  const notice = readings.length > 1 && date.getMonth() + 1 === 2 && date.getDate() === 28
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
  READINGS.forEach((r) => {
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
    results.innerHTML = `<p class="small-note">Type at least two letters to search ${escapeHtml(CONFIG.projectName)}.</p>`;
    return;
  }

  const matches = READINGS.filter((r) => {
    const haystack = `${r.date} ${r.source || ''} ${r.quote} ${r.body} ${r.moment}`.toLowerCase();
    return haystack.includes(q);
  }).slice(0, 40);

  if (!matches.length) {
    results.innerHTML = '<p class="small-note">No readings matched that search.</p>';
    return;
  }

  results.innerHTML = matches.map((r) => {
    const snippetSource = `${r.date} ${r.source || ''} ${r.quote} ${r.body} ${r.moment}`;
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
  if (/^\d{2}-\d{2}(?:-\d+)?$/.test(hash)) {
    showReadingById(hash);
    return;
  }
  if (!$('#readingArea').innerHTML.trim()) {
    const readings = getDailyReadings(new Date());
    currentId = readings[0]?.id || todayId();
    renderReadings(readings);
  }
}

async function init() {
  const res = await fetch(CONFIG.dataUrl);
  READINGS = await res.json();

  renderArchive();
  handleHash();

  $('#prevBtn').addEventListener('click', () => moveReading(-1));
  $('#nextBtn').addEventListener('click', () => moveReading(1));
  $('#todayBtn').addEventListener('click', showToday);
  $('#randomBtn').addEventListener('click', () => {
    const pick = READINGS[Math.floor(Math.random() * READINGS.length)];
    showReadingById(pick.id);
  });
  $('#shareBtn').addEventListener('click', copyLink);
  $('#searchInput').addEventListener('input', (event) => doSearch(event.target.value));

  window.addEventListener('hashchange', handleHash);
}

init().catch((error) => {
  console.error(error);
  $('#readingArea').innerHTML = `<article class="reading-card"><h3>Something went wrong loading ${escapeHtml(CONFIG.projectName)}.</h3><p>Please make sure ${escapeHtml(CONFIG.dataUrl)} is present.</p></article>`;
});
