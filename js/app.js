let REFLECTIONS = [];
let DAILY_AUDIO = {};
let GREY_BOOK_CONTEXT = { dates: {}, pages: {} };
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





function formatAudioTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function renderDailyAudio(reading) {
  const audio = DAILY_AUDIO[reading.id];
  if (!audio || !audio.audioUrl) return '';

  const title = audio.title || `Grey Book Reflection Audio — ${reading.date}`;
  const alternates = Array.isArray(audio.alternates) ? audio.alternates : [];
  const trackOptions = [
    {
      label: 'Main recording',
      audioUrl: audio.audioUrl,
      title
    },
    ...alternates.map((item) => ({
      label: item.label || 'Alternate recording',
      audioUrl: item.audioUrl,
      title: item.label || title
    }))
  ];

  const trackPicker = trackOptions.length > 1 ? `
    <label class="audio-variant-picker">
      <span>Recording</span>
      <select data-track-select>
        ${trackOptions.map((track, index) => `
          <option
            value="${escapeHtml(track.audioUrl)}"
            data-track-title="${escapeHtml(track.title)}"
            ${index === 0 ? 'selected' : ''}
          >
            ${escapeHtml(track.label)}
          </option>
        `).join('')}
      </select>
    </label>
  ` : '';

  return `
    <section
      class="daily-reflection-audio cassette-player"
      data-audio-player
      aria-label="Grey Book Reflection audio for ${escapeHtml(reading.date)}"
    >
      <div class="cassette-topline">
        <div>
          <p class="daily-audio-kicker">Listen to Today's Reflection</p>
          <h4>${escapeHtml(reading.date)} Audio</h4>
        </div>
        <a
          class="audio-file-link"
          data-audio-file-link
          href="${escapeHtml(audio.audioUrl)}"
          target="_blank"
          rel="noopener noreferrer"
        >
          MP3 ↗
        </a>
      </div>

      <audio data-audio preload="none" playsinline>
        <source data-audio-source src="${escapeHtml(audio.audioUrl)}" type="audio/mpeg">
      </audio>

      <div class="cassette-shell">
        <span class="cassette-screw screw-tl" aria-hidden="true"></span>
        <span class="cassette-screw screw-tr" aria-hidden="true"></span>
        <span class="cassette-screw screw-bl" aria-hidden="true"></span>
        <span class="cassette-screw screw-br" aria-hidden="true"></span>

        <div class="cassette-label-strip">
          <span>GREY BOOK REFLECTION</span>
          <strong>${escapeHtml(reading.date.toUpperCase())}</strong>
          <span>DAILY AUDIO</span>
        </div>

        <div class="cassette-window" aria-hidden="true">
          <span class="cassette-reel cassette-reel-left"><i></i></span>
          <span class="cassette-tape-band"></span>
          <span class="cassette-reel cassette-reel-right"><i></i></span>
        </div>

        <div class="cassette-counter-row">
          <span data-current-time>0:00</span>
          <span class="cassette-counter-label">TAPE COUNTER</span>
          <span data-duration>--:--</span>
        </div>

        <input
          class="audio-progress"
          data-progress
          type="range"
          min="0"
          max="1000"
          value="0"
          step="1"
          aria-label="Audio progress"
        >
      </div>

      <div class="cassette-controls" aria-label="Audio controls">
        <button type="button" data-skip="-15" aria-label="Go back 15 seconds">↶<span>15</span></button>
        <button
          class="audio-play-button"
          type="button"
          data-play
          aria-label="Play ${escapeHtml(reading.date)} audio"
        >
          <span class="audio-play-symbol" data-play-icon aria-hidden="true">▶</span>
          <span class="cassette-control-caption" data-play-text>PLAY</span>
        </button>
        <button type="button" data-skip="15" aria-label="Go forward 15 seconds">↷<span>15</span></button>
        <button class="audio-speed-button" type="button" data-speed>1×<span>SPEED</span></button>
      </div>

      ${trackPicker}
      <p class="audio-status" data-audio-status aria-live="polite"></p>
    </section>
  `;
}

function attachAudioPlayers() {
  document.querySelectorAll('[data-audio-player]').forEach((card) => {
    if (card.dataset.bound === 'true') return;
    card.dataset.bound = 'true';

    const audio = card.querySelector('[data-audio]');
    const playButton = card.querySelector('[data-play]');
    const playIcon = card.querySelector('[data-play-icon]');
    const playText = card.querySelector('[data-play-text]');
    const progress = card.querySelector('[data-progress]');
    const currentTime = card.querySelector('[data-current-time]');
    const duration = card.querySelector('[data-duration]');
    const speedButton = card.querySelector('[data-speed]');
    const status = card.querySelector('[data-audio-status]');
    const trackSelect = card.querySelector('[data-track-select]');
    const fileLink = card.querySelector('[data-audio-file-link]');
    const sourceEl = card.querySelector('[data-audio-source]');

    if (!audio || !playButton || !progress) return;

    const speedOptions = [1, 1.25, 1.5, 2];
    let speedIndex = 0;

    function setPlayingState(isPlaying) {
      playIcon.textContent = isPlaying ? 'Ⅱ' : '▶';
      playText.textContent = isPlaying ? 'Pause' : 'Play';
      playButton.setAttribute('aria-label', isPlaying ? 'Pause audio' : 'Play audio');
      card.classList.toggle('is-playing', isPlaying);
    }

    function updateProgress() {
      const pct = Number.isFinite(audio.duration) && audio.duration > 0
        ? (audio.currentTime / audio.duration) * 100
        : 0;

      progress.value = String(Math.round(pct * 10));
      progress.style.setProperty('--audio-progress', `${pct}%`);
      currentTime.textContent = formatAudioTime(audio.currentTime);
      duration.textContent = formatAudioTime(audio.duration);
    }

    playButton.addEventListener('click', async () => {
      if (audio.paused) {
        document.querySelectorAll('audio[data-audio]').forEach((other) => {
          if (other !== audio) other.pause();
        });

        try {
          await audio.play();
        } catch (error) {
          console.error(error);
          status.textContent = 'Audio could not start. Try the MP3 link.';
        }
      } else {
        audio.pause();
      }
    });

    audio.addEventListener('play', () => {
      setPlayingState(true);
      status.textContent = '';
    });

    audio.addEventListener('pause', () => setPlayingState(false));
    audio.addEventListener('ended', () => setPlayingState(false));
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', updateProgress);
    audio.addEventListener('durationchange', updateProgress);

    audio.addEventListener('error', () => {
      setPlayingState(false);
      status.textContent = 'This recording could not be loaded. Try the MP3 link.';
    });

    progress.addEventListener('input', () => {
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
      audio.currentTime = (Number(progress.value) / 1000) * audio.duration;
      updateProgress();
    });

    card.querySelectorAll('[data-skip]').forEach((button) => {
      button.addEventListener('click', () => {
        const seconds = Number(button.dataset.skip || 0);
        if (!Number.isFinite(audio.duration)) return;
        audio.currentTime = Math.min(
          Math.max(audio.currentTime + seconds, 0),
          audio.duration
        );
      });
    });

    speedButton.addEventListener('click', () => {
      speedIndex = (speedIndex + 1) % speedOptions.length;
      const nextSpeed = speedOptions[speedIndex];
      audio.playbackRate = nextSpeed;
      speedButton.textContent = `${nextSpeed}× Speed`;
    });

    if (trackSelect) {
      trackSelect.addEventListener('change', () => {
        const option = trackSelect.options[trackSelect.selectedIndex];
        const wasPlaying = !audio.paused;
        audio.pause();
        if (sourceEl) {
          sourceEl.src = trackSelect.value;
        } else {
          audio.src = trackSelect.value;
        }
        audio.load();
        fileLink.href = trackSelect.value;
        status.textContent = option.dataset.trackTitle || '';

        if (wasPlaying) {
          audio.play().catch((error) => {
            console.error(error);
            status.textContent = 'Recording changed. Press play to continue.';
          });
        }
      });
    }

    updateProgress();
  });
}



function renderAudioLibrary(isPrimary = false) {
  return `
    <section
      ${isPrimary ? 'id="audio"' : ''}
      class="reading-audio-library"
      data-audio-library
      aria-label="NA audio library"
    >
      <div class="audio-library-console">
        <div class="audio-library-heading">
          <p class="audio-library-kicker">NA Audio Library</p>
          <h4>Grey Book &amp; Fellowship Audio</h4>
          <p>
            Open an audio folder first, then choose the recording you want to hear.
          </p>
        </div>

        <div class="audio-library-selector-block">
          <div class="audio-library-selector-copy">
            <span class="audio-library-selector-label">1. Choose an audio folder</span>
            <span class="audio-library-selector-help">Open this menu to choose the collection.</span>
          </div>

          <div class="audio-library-select-wrap">
            <select
              class="audio-library-select"
              data-audio-library-collection
              aria-label="Choose an audio folder"
            >
              <option>Loading audio folders…</option>
            </select>
            <span class="audio-library-select-cue" aria-hidden="true">OPEN FOLDERS ▼</span>
          </div>
        </div>

        <div
          class="audio-library-selector-block audio-library-episode-block"
          data-audio-library-episode-block
          hidden
        >
          <div class="audio-library-selector-copy">
            <span class="audio-library-selector-label">2. Choose a recording</span>
            <span class="audio-library-selector-help">Now open this menu to see the recordings in that folder.</span>
          </div>

          <div class="audio-library-select-wrap">
            <select
              class="audio-library-select"
              data-audio-library-episode
              aria-label="Choose a recording"
            >
              <option value="">Choose a recording…</option>
            </select>
            <span class="audio-library-select-cue" aria-hidden="true">OPEN RECORDINGS ▼</span>
          </div>
        </div>

        <div class="audio-library-now-playing" aria-live="polite">
          <span class="audio-library-source" data-audio-library-source>Audio Library</span>
          <strong data-audio-library-title>Choose an audio folder, then a recording.</strong>
          <span class="audio-library-duration" data-audio-library-duration></span>
          <p data-audio-library-description></p>
        </div>

        <audio
          class="audio-library-player"
          data-audio-library-player
          controls
          preload="metadata"
          playsinline
        ></audio>

        <div class="audio-library-actions">
          <a
            class="audio-library-external"
            data-audio-library-external
            href="#"
            target="_blank"
            rel="noopener noreferrer"
            hidden
          >
            Open Episode ↗
          </a>
        </div>
      </div>
    </section>
  `;
}


function renderGreyBookContext(reading) {
  const mapped = GREY_BOOK_CONTEXT?.dates?.[reading.id];
  if (!mapped) return '';

  const pageNumbers = Array.isArray(mapped) ? mapped : [mapped];
  const pages = pageNumbers
    .map((pageNumber) => GREY_BOOK_CONTEXT?.pages?.[String(pageNumber)])
    .filter((page) => page && page.text);

  if (!pages.length) return '';

  const firstPage = pages[0];
  const lastPage = pages[pages.length - 1];
  const pageLabel = pages.length > 1
    ? `Pages ${firstPage.page}–${lastPage.page}`
    : `Page ${firstPage.page}`;

  const section = firstPage.section && firstPage.section !== 'Grey Book'
    ? firstPage.section
    : 'Grey Book';

  const pageBlocks = pages.map((page, index) => `
    <div class="grey-book-context-page${index > 0 ? ' grey-book-context-page-continuation' : ''}">
      <div class="grey-book-context-pagehead">
        <span>Narcotics Anonymous — Review Form</span>
        <strong>Memphis 1981 · Page ${page.page}</strong>
      </div>
      <div class="grey-book-context-text">${paragraphHtml(page.text)}</div>
    </div>
  `).join('');

  return `
    <section class="grey-book-context" aria-label="Grey Book source context for ${escapeHtml(reading.date)}">
      <div class="grey-book-context-heading">
        <div>
          <p class="grey-book-context-kicker">From the Grey Book</p>
          <h4>Read the Source ${pages.length > 1 ? 'Pages' : 'Page'}</h4>
          <p class="grey-book-context-meta">${escapeHtml(section)} · ${pageLabel}</p>
        </div>
        <span class="grey-book-page-stamp" aria-hidden="true">${pages.length > 1 ? `PP. ${firstPage.page}–${lastPage.page}` : `P. ${firstPage.page}`}</span>
      </div>

      <details class="grey-book-context-details">
        <summary>
          <span class="grey-book-context-summary-copy">
            <strong>Read Grey Book ${pageLabel}</strong>
            <small>Open the source text used for this reflection.</small>
          </span>
          <span class="grey-book-context-summary-cue" aria-hidden="true">OPEN ▼</span>
        </summary>

        <div class="grey-book-context-pages">
          ${pageBlocks}
          <p class="grey-book-context-note">Source text is displayed from the retyped Memphis 1981 Review Form supplied for this project.</p>
        </div>
      </details>
    </section>
  `;
}


function renderMeetingSchedule(isPrimary = false) {
  if (!isPrimary) return '';

  return `
    <section
      id="meetings"
      class="meeting-schedule-panel meeting-schedule-inline"
      data-meeting-schedule
      aria-label="Meeting schedule"
    >
      <div class="meeting-heading">
        <div>
          <p class="eyebrow">Find a Meeting</p>
          <h4>Virtual &amp; Hybrid Meeting Schedule</h4>
          <p class="meeting-timezone">Times are shown in Eastern Time. Virtual and hybrid meetings only. Tap a meeting to open the full details.</p>
        </div>
        <div class="meeting-count" data-meeting-count aria-live="polite">Loading meetings…</div>
      </div>

      <div class="meeting-filter-shell">
        <div class="meeting-day-tabs" data-meeting-day-tabs role="tablist" aria-label="Filter meetings by weekday"></div>

        <div class="meeting-select-filters">
          <label>
            <span>City</span>
            <select data-meeting-city aria-label="Filter meetings by city">
              <option value="">All Cities</option>
            </select>
          </label>

          <label>
            <span>Location</span>
            <select data-meeting-location aria-label="Filter meetings by location">
              <option value="">All Locations</option>
            </select>
          </label>

          <label>
            <span>Venue Type</span>
            <select data-meeting-mode aria-label="Filter meetings by venue type">
              <option value="">All Venue Types</option>
            </select>
          </label>

          <label>
            <span>Format</span>
            <select data-meeting-format aria-label="Filter meetings by format">
              <option value="">All Formats</option>
            </select>
          </label>
        </div>
      </div>

      <div data-meeting-results class="meeting-results" aria-live="polite"></div>
    </section>
  `;
}

function renderReviewInputForm(reading) {
  const source = reading.source || 'Source reference pending';
  const page = reading.pdfPage ? `GBR PDF p. ${reading.pdfPage}` : '';
  const siteLink = `${location.origin}${location.pathname}#${reading.id}`;

  return `
    <section class="review-input" aria-label="Review and input for ${escapeHtml(reading.date)}">
      <h4>Review &amp; Input</h4>
      <p class="review-help">Share review, correction, Group input, or literature feedback for this reading.</p>

      <form class="review-form" action="https://formspree.io/f/xbdvjywr" method="POST">
        <input type="hidden" name="reading_date" value="${escapeHtml(reading.date)}">
        <input type="hidden" name="reading_id" value="${escapeHtml(reading.id)}">
        <input type="hidden" name="gray_book_source" value="${escapeHtml(source)}">
        <input type="hidden" name="gbr_pdf_page" value="${escapeHtml(page)}">
        <input type="hidden" name="site_link" value="${escapeHtml(siteLink)}">
        <input type="hidden" name="_subject" value="GBR Review/Input — ${escapeHtml(reading.date)}">

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

function renderReadingCard(reading, label = '', isPrimary = false) {
  const sourceLine = reading.source ? escapeHtml(reading.source) : 'Source reference pending';

  return `
    <article class="reading-card" id="reading-${reading.id}">
      ${renderDailyAudio(reading)}
      <div class="reading-date">
        <h3>${escapeHtml(label || reading.date)}</h3>
        <div class="reading-meta">
          <span class="source-ref">${sourceLine}</span>
          <span class="page-ref">GBR PDF p. ${reading.pdfPage}</span>
        </div>
      </div>
      <blockquote class="quote">${escapeHtml(reading.quote)}</blockquote>
      <div class="body-text">${paragraphHtml(reading.body)}</div>
      ${reading.moment ? `
        <div class="moment-box">
          <h4>In This Moment</h4>
          <p class="moment-text">${escapeHtml(reading.moment)}</p>
        </div>` : ''}
      ${renderGreyBookContext(reading)}
      ${renderMeetingSchedule(isPrimary)}
      ${renderAudioLibrary(isPrimary)}
      ${renderReviewInputForm(reading)}
    </article>
  `;
}

function renderReadings(readings, notice = '') {
  const area = $('#readingArea');
  area.innerHTML = readings.map((reading, index) => renderReadingCard(reading, '', index === 0)).join('');
  attachAudioPlayers();
  attachReviewForms();
  document.dispatchEvent(new CustomEvent('gbr:reading-rendered'));

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
  const reflectionsResponse = await fetch('data/reflections.json');
  if (!reflectionsResponse.ok) throw new Error('Reflection data not found');
  REFLECTIONS = await reflectionsResponse.json();

  try {
    const audioResponse = await fetch('data/gbr-daily-audio.json', { cache: 'no-store' });
    if (audioResponse.ok) DAILY_AUDIO = await audioResponse.json();
  } catch (error) {
    console.warn('Daily reflection audio map could not be loaded.', error);
    DAILY_AUDIO = {};
  }

  try {
    const contextResponse = await fetch('data/grey-book-context.json', { cache: 'no-store' });
    if (contextResponse.ok) GREY_BOOK_CONTEXT = await contextResponse.json();
  } catch (error) {
    console.warn('Grey Book source context could not be loaded.', error);
    GREY_BOOK_CONTEXT = { dates: {}, pages: {} };
  }

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
