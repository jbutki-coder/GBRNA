let REFLECTIONS = [];
let DAILY_AUDIO = {};
let GREY_BOOK_CONTEXT = { dates: {}, pages: {} };
let RNI_HISTORY = { schemaVersion: 1, readings: {} };
const RNI_SELECTION = Object.create(null);
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


function sourceParagraphs(text) {
  return String(text || '')
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function sourceWords(text) {
  return String(text || '').toLowerCase().match(/[a-z0-9']+/g) || [];
}

function suffixPrefixWordOverlap(leftText, rightText) {
  const leftWords = sourceWords(leftText);
  const rightWords = sourceWords(rightText);
  const maximum = Math.min(leftWords.length, rightWords.length, 120);

  for (let size = maximum; size >= 1; size -= 1) {
    const leftSlice = leftWords.slice(leftWords.length - size);
    const rightSlice = rightWords.slice(0, size);

    if (leftSlice.every((word, index) => word === rightSlice[index])) {
      return size;
    }
  }

  return 0;
}

function removeLeadingSourceWords(text, count) {
  if (!count) return String(text || '').trim();

  const value = String(text || '');
  const wordPattern = /[A-Za-z0-9']+/g;
  let match;
  let wordsSeen = 0;
  let cutAt = 0;

  while ((match = wordPattern.exec(value)) !== null) {
    wordsSeen += 1;
    cutAt = wordPattern.lastIndex;
    if (wordsSeen >= count) break;
  }

  if (wordsSeen < count) return '';

  return value
    .slice(cutAt)
    .replace(/^[\s,;:.!?—–-]+/, '')
    .trim();
}

function mergeSourceParagraphs(leftText, rightText) {
  const left = String(leftText || '').trim();
  const right = String(rightText || '').trim();

  if (!left) return right;
  if (!right) return left;

  const overlap = suffixPrefixWordOverlap(left, right);
  const remainder = removeLeadingSourceWords(right, overlap);

  if (!remainder) return left;
  return `${left} ${remainder}`.replace(/\s+/g, ' ').trim();
}

function sourceParagraphContinues(leftText, rightText) {
  const left = String(leftText || '').trim();
  const right = String(rightText || '').trim();

  if (!left || !right) return false;

  const overlap = suffixPrefixWordOverlap(left, right);
  if (overlap >= 4) return true;

  // A page ending without closing punctuation is almost certainly mid-paragraph.
  if (!/[.!?]["')\]]?$/.test(left)) return true;

  // The retyped Grey Book occasionally starts a carried paragraph with a
  // lowercase word or an OCR fragment such as "A. is ..." for "N.A. is ...".
  if (/^[a-z]/.test(right)) return true;
  if (/^[A-Z]\.\s+[a-z]/.test(right)) return true;

  return false;
}

function buildCompleteSourceBlocks(sourcePageNumbers) {
  const blocks = sourcePageNumbers
    .map((pageNumber) => GREY_BOOK_CONTEXT?.pages?.[String(pageNumber)])
    .filter((page) => page && page.text)
    .map((page) => ({
      page: Number(page.page),
      section: page.section || 'Grey Book',
      paragraphs: sourceParagraphs(page.text)
    }));

  if (!blocks.length) return null;

  // Join a paragraph that crosses between two mapped source pages, while
  // avoiding the repeated words that appear in the retyped page text.
  for (let index = 0; index < blocks.length - 1; index += 1) {
    const leftBlock = blocks[index];
    const rightBlock = blocks[index + 1];
    const leftParagraph = leftBlock.paragraphs[leftBlock.paragraphs.length - 1];
    const rightParagraph = rightBlock.paragraphs[0];

    if (sourceParagraphContinues(leftParagraph, rightParagraph)) {
      leftBlock.paragraphs[leftBlock.paragraphs.length - 1] =
        mergeSourceParagraphs(leftParagraph, rightParagraph);
      rightBlock.paragraphs.shift();
    }
  }

  const firstBlock = blocks[0];
  const lastBlock = blocks[blocks.length - 1];
  let contextStartPage = firstBlock.page;
  let contextEndPage = lastBlock.page;

  // Complete only the first paragraph from the previous page.
  const previousPage = GREY_BOOK_CONTEXT?.pages?.[String(firstBlock.page - 1)];
  if (previousPage?.text && firstBlock.paragraphs.length) {
    const previousParagraphs = sourceParagraphs(previousPage.text);
    const previousLast = previousParagraphs[previousParagraphs.length - 1];
    const sourceFirst = firstBlock.paragraphs[0];

    if (sourceParagraphContinues(previousLast, sourceFirst)) {
      firstBlock.paragraphs[0] = mergeSourceParagraphs(previousLast, sourceFirst);
      contextStartPage = firstBlock.page - 1;
    }
  }

  // Complete only the final paragraph from the following page.
  const followingPage = GREY_BOOK_CONTEXT?.pages?.[String(lastBlock.page + 1)];
  if (followingPage?.text && lastBlock.paragraphs.length) {
    const followingParagraphs = sourceParagraphs(followingPage.text);
    const sourceLast = lastBlock.paragraphs[lastBlock.paragraphs.length - 1];
    const followingFirst = followingParagraphs[0];

    if (sourceParagraphContinues(sourceLast, followingFirst)) {
      lastBlock.paragraphs[lastBlock.paragraphs.length - 1] =
        mergeSourceParagraphs(sourceLast, followingFirst);
      contextEndPage = lastBlock.page + 1;
    }
  }

  return {
    blocks,
    contextStartPage,
    contextEndPage
  };
}

function renderGreyBookContext(reading) {
  const context = GREY_BOOK_CONTEXT?.contexts?.[reading.id];
  if (!context) return '';

  const paragraphStore = GREY_BOOK_CONTEXT?.paragraphs || {};
  const paragraphs = (context.paragraphIds || [])
    .map((paragraphId) => ({ id: paragraphId, ...paragraphStore[paragraphId] }))
    .filter((paragraph) => paragraph && paragraph.text);

  if (!paragraphs.length) return '';

  const citedParagraphs = new Set(context.citedParagraphIds || []);
  const sourcePages = Array.isArray(context.sourcePages) ? context.sourcePages : [];
  const contextPages = Array.isArray(context.contextPages) ? context.contextPages : sourcePages;

  const pageWord = (page) => page === 'Frontispiece' ? 'Frontispiece' : `Page ${page}`;
  const pageLabel = sourcePages.length === 1
    ? pageWord(sourcePages[0])
    : `Pages ${sourcePages[0]}–${sourcePages[sourcePages.length - 1]}`;
  const contextPageLabel = contextPages.length === 1
    ? pageWord(contextPages[0])
    : `Pages ${contextPages[0]}–${contextPages[contextPages.length - 1]}`;

  const stamp = sourcePages.length === 1
    ? (sourcePages[0] === 'Frontispiece' ? 'FRONTISPIECE' : `P. ${sourcePages[0]}`)
    : `PP. ${sourcePages[0]}–${sourcePages[sourcePages.length - 1]}`;

  let citedBadgeUsed = false;
  const paragraphMarkup = paragraphs.map((paragraph) => {
    const text = escapeHtml(paragraph.text);
    const isCited = citedParagraphs.has(paragraph.id);
    const badge = isCited && context.lineLabel && !citedBadgeUsed
      ? `<span class="gbr-source-line-badge">${escapeHtml(context.lineLabel)}</span>`
      : '';
    if (isCited && context.lineLabel) citedBadgeUsed = true;

    if (paragraph.kind === 'step-heading' || paragraph.kind === 'chapter-heading' || paragraph.kind === 'section-heading') {
      return `<h5 class="gbr-source-section-heading${isCited ? ' gbr-source-cited' : ''}">${badge}${text}</h5>`;
    }
    if (paragraph.kind === 'heading') {
      return `<h6 class="gbr-source-subheading${isCited ? ' gbr-source-cited' : ''}">${badge}${text}</h6>`;
    }
    if (paragraph.kind === 'step-statement') {
      return `<p class="gbr-source-step-statement${isCited ? ' gbr-source-cited' : ''}">${badge}${text}</p>`;
    }
    return `<p class="gbr-source-paragraph${isCited ? ' gbr-source-cited' : ''}">${badge}${text}</p>`;
  }).join('');

  const boundaryParts = [];
  if (context.boundaryBefore) boundaryParts.push('the opening paragraph is completed from the preceding GBR page');
  if (context.boundaryAfter) boundaryParts.push('the closing paragraph is completed on the following GBR page');

  const sectionNote = context.sectionType === 'step'
    ? `Only ${context.section} is included; text from the previous and following Steps is excluded.`
    : `The text remains inside ${context.section}.`;
  const boundaryNote = boundaryParts.length
    ? ` ${boundaryParts.join(' and ')}. No unrelated paragraph from an adjacent page is included.`
    : ' No neighboring-page text was needed to complete a paragraph.';

  const metaParts = [context.section, `GBR ${pageLabel}`];
  if (context.lineLabel) metaParts.push(context.lineLabel);

  return `
    <section class="grey-book-context" aria-label="Grey Book source context for ${escapeHtml(reading.date)}">
      <div class="grey-book-context-heading">
        <div>
          <p class="grey-book-context-kicker">From the Grey Book</p>
          <h4>Read the Source ${sourcePages.length > 1 ? 'Pages' : 'Page'}</h4>
          <p class="grey-book-context-meta">${metaParts.map(escapeHtml).join(' · ')}</p>
        </div>
        <span class="grey-book-page-stamp" aria-hidden="true">${escapeHtml(stamp)}</span>
      </div>

      <details class="grey-book-context-details">
        <summary>
          <span class="grey-book-context-summary-copy">
            <strong>Read GBR ${escapeHtml(pageLabel)}</strong>
            <small>Full cited-page text with complete boundary paragraphs.</small>
          </span>
          <span class="grey-book-context-summary-cue" aria-hidden="true">OPEN ▼</span>
        </summary>

        <div class="grey-book-context-pages">
          <div class="grey-book-context-page gbr-source-text-page" data-gbr-source-text>
            <div class="grey-book-context-pagehead">
              <span>Selectable corresponding source text</span>
              <strong>1981 Grey Book · GBR ${escapeHtml(pageLabel)}</strong>
            </div>
            <div class="grey-book-context-text gbr-source-text-body">
              ${paragraphMarkup}
            </div>
          </div>
          <p class="grey-book-context-note">
            The full cited-page text belonging to ${escapeHtml(context.section)} is shown through ${escapeHtml(contextPageLabel)}.
            ${escapeHtml(sectionNote + boundaryNote)}
          </p>
        </div>
      </details>
    </section>
  `;
}


const GREY_BOOK_SECTION_NUMBERS = Object.freeze({
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12
});

function greyBookStudyTarget(sectionName) {
  const section = String(sectionName || '');
  const numberedSection = section.match(/\b(Step|Tradition)\s+(One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve)\b/i);
  if (numberedSection) {
    const kind = numberedSection[1].toLowerCase();
    const numberWord = numberedSection[2].toLowerCase();
    return `${kind}-${numberWord}`;
  }

  const chapter = section.match(/\bChapter\s+(One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten)\b/i);
  if (chapter) return `chapter-${GREY_BOOK_SECTION_NUMBERS[chapter[1].toLowerCase()]}`;
  if (/\bIntroduction\b/i.test(section)) return 'introduction';
  if (/\bFor(?:e)?ward\b/i.test(section)) return 'forward';
  if (/\bSymbol\b/i.test(section)) return 'symbol';
  return '';
}

function renderGreyBookStudyLink(reading) {
  const context = GREY_BOOK_CONTEXT?.contexts?.[reading.id];
  const target = greyBookStudyTarget(reading.source) || greyBookStudyTarget(context?.section);
  if (!target) return '';

  const sectionName = context?.section || reading.source || 'Grey Book source';
  return `
    <a
      class="grey-book-study-source-link"
      href="/grey-book-study/#${escapeHtml(target)}"
      aria-label="Open ${escapeHtml(sectionName)} in the Grey Book Study"
    >Open Source in Grey Book Study</a>
  `;
}


function renderGreyAreaGroup(isPrimary = false) {
  if (!isPrimary) return '';

  return `
    <section
      id="grey-area-group"
      class="grey-area-group-panel"
      aria-label="Grey Area Group of Narcotics Anonymous"
    >
      <div class="grey-area-group-heading">
        <div>
          <p class="grey-area-group-kicker">Grey Area Group of Narcotics Anonymous</p>
          <h4>Historical Literature Study</h4>
          <p>This is the homepage of the Grey Area Group of Narcotics Anonymous. It includes the Daily Grey Book Reading, historical literature study meetings, A.S.I.S. for NA and other historical literature, announcements, audio, service information, archives, and other Group resources. Grey Book Reflection remains an FSC Review &amp; Input project, and featured projects and service communities remain separately identified.</p>
        </div>
      </div>

      <div class="grey-area-flyer-stage">
        <a
          class="grey-area-flyer-link"
          href="images/grey-area-historical-literature-study.png"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open the Grey Area Historical Literature Study flyer full size"
        >
          <img
            class="grey-area-flyer-image"
            src="images/grey-area-historical-literature-study.png"
            alt="Grey Area Historical Literature Study flyer. Every Monday at 8:30 PM Eastern Time on Zoom. Meeting ID 872 6843 7641. Passcode 1953."
            loading="lazy"
            decoding="async"
          >
          <span class="grey-area-flyer-caption">Open flyer full size ↗</span>
        </a>
      </div>

      <div class="grey-area-meeting-strip">
        <div class="grey-area-meeting-copy">
          <strong>Every Monday · 8:30 PM Eastern Time</strong>
          <span>Zoom ID: 872 6843 7641 · Passcode: 1953</span>
        </div>
        <a
          class="grey-area-join-button"
          href="https://us06web.zoom.us/j/87268437641?pwd=n573F6qbqxcD5dh0mtPaqvgvozvnbb.1"
          target="_blank"
          rel="noopener noreferrer"
        >Join Grey Area Study ↗</a>
      </div>
    </section>
  `;
}

function renderReviewInputForm(reading, isPrimary = false) {
  const source = reading.source || 'Source reference pending';
  const page = reading.pdfPage ? `GBR PDF p. ${reading.pdfPage}` : '';
  const siteLink = `${location.origin}${location.pathname}#${reading.id}`;

  return `
    <section ${isPrimary ? 'id="review-input"' : ''} class="review-input" aria-label="Review and input for ${escapeHtml(reading.date)}">
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

function getRniRecord(id) {
  return RNI_HISTORY?.readings?.[id] || null;
}

function getRniVersion(id, key) {
  const record = getRniRecord(id);
  if (!record || !Array.isArray(record.versions)) return null;
  return record.versions.find((version) => version.key === key) || null;
}

function getSelectedRniKey(reading) {
  const record = getRniRecord(reading.id);
  if (!record) return 'ny-project';
  return RNI_SELECTION[reading.id] || record.defaultVersion || 'ny-project';
}

function resolveRniReading(baseReading) {
  const key = getSelectedRniKey(baseReading);
  if (key === 'ny-project') {
    return { ...baseReading, _rniVersionKey: 'ny-project', _rniVersion: null };
  }

  const version = getRniVersion(baseReading.id, key);
  if (!version) {
    return { ...baseReading, _rniVersionKey: 'ny-project', _rniVersion: null };
  }

  return {
    ...baseReading,
    quote: version.quote || baseReading.quote,
    source: version.source || baseReading.source,
    body: version.body || baseReading.body,
    moment: version.moment || '',
    _rniVersionKey: key,
    _rniVersion: version
  };
}

function renderRniEditionMeta(version) {
  const bits = [];
  if (Array.isArray(version?.editions) && version.editions.length) {
    if (version.editions.length === 1) {
      const ed = version.editions[0];
      bits.push(`${ed.label || 'historical edition'}${ed.sourceDocumentPage ? ` p. ${ed.sourceDocumentPage}` : ''}`);
    } else {
      bits.push(`${version.editions.length} historical editions`);
    }
  }
  if (version?.sourceCalendarDate) bits.push(`source calendar date ${version.sourceCalendarDate}`);
  if (Array.isArray(version?.historicalDates) && version.historicalDates.length) {
    bits.push(`historical writing date${version.historicalDates.length > 1 ? 's' : ''}: ${version.historicalDates.join(', ')}`);
  } else if (version?.historicalDate) {
    bits.push(`historical writing date: ${version.historicalDate}`);
  }
  if (Array.isArray(version?.sourceDocumentPages) && version.sourceDocumentPages.length > 1) {
    bits.push(`source pp. ${version.sourceDocumentPages.join(', ')}`);
  } else if (version?.sourceDocumentPage && !(Array.isArray(version?.editions) && version.editions.length)) {
    bits.push(`source p. ${version.sourceDocumentPage}`);
  }
  return bits.length ? ` · ${bits.map(escapeHtml).join(' · ')}` : '';
}

function renderRniVersionPanel(baseReading, displayReading) {
  const record = getRniRecord(baseReading.id);
  if (!record || !Array.isArray(record.versions) || !record.versions.length) return '';

  const currentKey = displayReading._rniVersionKey || 'ny-project';
  const currentVersion = displayReading._rniVersion;
  const newer = record.versions.filter((version) => version.position === 'after-ny');
  const earlier = record.versions.filter((version) => version.position === 'before-ny');
  const ties = record.versions.find((version) => version.key === 'ties-that-bind-latest');

  let lead = '';
  if (currentKey === 'ties-that-bind-latest') {
    lead = `<p><strong>Review &amp; Input Update:</strong> This reading shows the most recent input submitted by <strong>The Ties That Bind Group</strong> after the NY project edition used to map this site.</p>`;
  } else if (currentKey === 'ny-project') {
    lead = ties
      ? `<p><strong>NY Project Edition:</strong> This is the version originally used to map this calendar reading on GBRNA. Newer input from <strong>The Ties That Bind Group</strong> is also available.</p>`
      : `<p><strong>NY Project Edition:</strong> This remains the current mapped reading. Earlier Review &amp; Input material is available below for historical comparison.</p>`;
  } else if (currentVersion) {
    const meta = renderRniEditionMeta(currentVersion);
    const isGwu = (currentVersion.group || '').includes('Grateful Wake Up');
    const placementNote = isGwu
      ? ' The Grateful Wake Up source states that its printed dates are historical writing dates, not final GBR calendar placement.'
      : currentVersion.sourceCalendarDate
        ? ' This historical edition explicitly printed that calendar date for the reading.'
        : ' This version predates the NY project edition and is mapped here only where the Grey Book quotation/source lineage could be established confidently.';
    lead = `<p><strong>Earlier Review &amp; Input:</strong> You are viewing ${escapeHtml(currentVersion.group || currentVersion.label || 'historical input')}${meta}.${placementNote}</p>`;
  }

  const quickButtons = [];
  if (currentKey !== 'ny-project') {
    quickButtons.push(`<button type="button" class="rni-switch-button" data-rni-switch="ny-project" data-rni-id="${escapeHtml(baseReading.id)}">View NY Project Edition</button>`);
  }
  if (ties && currentKey !== ties.key) {
    quickButtons.push(`<button type="button" class="rni-switch-button rni-switch-primary" data-rni-switch="${escapeHtml(ties.key)}" data-rni-id="${escapeHtml(baseReading.id)}">View Latest Ties That Bind Input</button>`);
  }

  const timeline = [];
  earlier.forEach((version) => {
    const meta = renderRniEditionMeta(version);
    timeline.push(`
      <li class="rni-history-item${currentKey === version.key ? ' is-current' : ''}">
        <div><strong>${escapeHtml(version.label || version.group || 'Earlier R&I')}</strong>${meta}<small>${escapeHtml(version.status || 'Historical Review & Input preceding the NY project edition.')}</small></div>
        <button type="button" data-rni-switch="${escapeHtml(version.key)}" data-rni-id="${escapeHtml(baseReading.id)}">View</button>
      </li>`);
  });

  timeline.push(`
    <li class="rni-history-item rni-history-baseline${currentKey === 'ny-project' ? ' is-current' : ''}">
      <div><strong>NY Project Edition</strong><small>Baseline edition originally used to map this site.</small></div>
      <button type="button" data-rni-switch="ny-project" data-rni-id="${escapeHtml(baseReading.id)}">View</button>
    </li>`);

  newer.forEach((version) => {
    timeline.push(`
      <li class="rni-history-item rni-history-newer${currentKey === version.key ? ' is-current' : ''}">
        <div><strong>${escapeHtml(version.group || version.label || 'Newer R&I')}</strong><small>${escapeHtml(version.status || 'Post-NY Review & Input')}</small></div>
        <button type="button" data-rni-switch="${escapeHtml(version.key)}" data-rni-id="${escapeHtml(baseReading.id)}">View</button>
      </li>`);
  });

  const proofread = currentVersion?.proofreadNote
    ? `<p class="rni-proofread-note"><strong>Web presentation note:</strong> ${escapeHtml(currentVersion.proofreadNote)}</p>`
    : '';

  const sourceCompatibility = currentKey !== 'ny-project'
    ? `<p class="rni-source-note">Daily audio and the expandable mapped Grey Book source-page view belong to the NY project edition. Switch to the NY version to use those features without mixing editions.</p>`
    : '';

  return `
    <aside class="rni-version-panel" aria-label="Grey Book Reflections Review and Input history">
      ${lead}
      <div class="rni-quick-actions">${quickButtons.join('')}</div>
      ${proofread}
      ${sourceCompatibility}
      <details class="rni-history-details">
        <summary>R&amp;I History <span aria-hidden="true">▼</span></summary>
        <p class="rni-history-intro">Earlier historical Review &amp; Input → NY project edition → newer post-NY input. Versions are shown in place; no PDF is opened.</p>
        <ol class="rni-history-list">${timeline.join('')}</ol>
        <p><a class="rni-browser-link" href="/rni-history/">Browse all mapped and unmapped historical R&amp;I</a></p>
      </details>
    </aside>`;
}

function attachRniVersionControls() {
  document.querySelectorAll('[data-rni-switch]').forEach((button) => {
    if (button.dataset.bound === 'true') return;
    button.dataset.bound = 'true';
    button.addEventListener('click', () => {
      const id = button.dataset.rniId;
      const key = button.dataset.rniSwitch;
      const baseReading = findReading(id);
      if (!baseReading) return;
      RNI_SELECTION[id] = key;
      currentId = id;
      renderReadings([baseReading]);
      requestAnimationFrame(() => {
        document.querySelector(`#reading-${CSS.escape(id)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  });
}

function renderReadingCard(reading, label = '', isPrimary = false, baseReading = reading) {
  const sourceLine = reading.source ? escapeHtml(reading.source) : 'Source reference pending';
  const isNyEdition = (reading._rniVersionKey || 'ny-project') === 'ny-project';
  const pageMeta = isNyEdition
    ? `GBR PDF p. ${baseReading.pdfPage}`
    : `Calendar mapping: ${escapeHtml(baseReading.date)} · NY GBR PDF p. ${baseReading.pdfPage}`;

  return `
    <article class="reading-card" id="reading-${reading.id}">
      ${isNyEdition ? renderDailyAudio(baseReading) : ''}
      <div class="reading-date">
        <h3>${escapeHtml(label || reading.date)}</h3>
        <div class="reading-meta">
          <span class="source-ref">${sourceLine}</span>
          <span class="page-ref">${pageMeta}</span>
          ${isNyEdition ? renderGreyBookStudyLink(baseReading) : ''}
        </div>
      </div>
      <blockquote class="quote">${escapeHtml(reading.quote)}</blockquote>
      <div class="body-text">${paragraphHtml(reading.body)}</div>
      ${reading.moment ? `
        <div class="moment-box">
          <h4>In This Moment</h4>
          <p class="moment-text">${escapeHtml(reading.moment)}</p>
        </div>` : ''}
      ${renderRniVersionPanel(baseReading, reading)}
      ${isNyEdition ? renderGreyBookContext(baseReading) : ''}
      ${renderGreyAreaGroup(isPrimary)}
      ${renderAudioLibrary(isPrimary)}
      ${renderReviewInputForm(reading, isPrimary)}
    </article>
  `;
}

function renderReadings(readings, notice = '') {
  const area = $('#readingArea');
  area.innerHTML = readings.map((baseReading, index) => {
    const displayReading = resolveRniReading(baseReading);
    return renderReadingCard(displayReading, '', index === 0, baseReading);
  }).join('');
  attachAudioPlayers();
  attachReviewForms();
  attachRniVersionControls();
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
    const versions = getRniRecord(r.id)?.versions || [];
    const versionText = versions.map((version) => `${version.label || ''} ${version.group || ''} ${version.quote || ''} ${version.body || ''} ${version.moment || ''}`).join(' ');
    const haystack = `${r.date} ${r.quote} ${r.body} ${r.moment} ${versionText}`.toLowerCase();
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
    const rniResponse = await fetch('data/rni-versions.json', { cache: 'no-store' });
    if (rniResponse.ok) RNI_HISTORY = await rniResponse.json();
  } catch (error) {
    console.warn('Review & Input version history could not be loaded.', error);
    RNI_HISTORY = { schemaVersion: 1, readings: {} };
  }

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
