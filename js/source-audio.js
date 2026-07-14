(() => {
  'use strict';

  let sourceAudioMap = {};

  const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
    const minutes = Math.floor(seconds / 60);
    const remainder = Math.floor(seconds % 60);
    return `${minutes}:${String(remainder).padStart(2, '0')}`;
  };

  function readingIdFromCard(card) {
    const match = String(card?.id || '').match(/^reading-(\d{2}-\d{2})$/);
    return match ? match[1] : '';
  }

  function sourceAudioMarkup(readingId, entry) {
    const title = entry.title || `Grey Book Source Audio — ${readingId}`;
    const pageLabel = entry.pageLabel || 'Mapped Grey Book source page';
    const audioUrl = entry.audioUrl;

    return `
      <section
        class="daily-reflection-audio cassette-player source-page-audio"
        data-source-audio-player
        data-source-audio-injected
        aria-label="${escapeHtml(title)}"
      >
        <div class="cassette-topline">
          <div>
            <p class="daily-audio-kicker">Listen to the Source Page</p>
            <h4>${escapeHtml(title)}</h4>
            <p class="source-page-audio-label">${escapeHtml(pageLabel)}</p>
          </div>
          <a
            class="audio-file-link"
            href="${escapeHtml(audioUrl)}"
            target="_blank"
            rel="noopener noreferrer"
          >AUDIO ↗</a>
        </div>

        <audio data-source-audio preload="metadata" playsinline src="${escapeHtml(audioUrl)}"></audio>

        <div class="cassette-shell">
          <span class="cassette-screw screw-tl" aria-hidden="true"></span>
          <span class="cassette-screw screw-tr" aria-hidden="true"></span>
          <span class="cassette-screw screw-bl" aria-hidden="true"></span>
          <span class="cassette-screw screw-br" aria-hidden="true"></span>

          <div class="cassette-label-strip">
            <span>GREY BOOK SOURCE</span>
            <strong>${escapeHtml(readingId)}</strong>
            <span>PAGE AUDIO</span>
          </div>

          <div class="cassette-window" aria-hidden="true">
            <span class="cassette-reel cassette-reel-left"><i></i></span>
            <span class="cassette-tape-band"></span>
            <span class="cassette-reel cassette-reel-right"><i></i></span>
          </div>

          <div class="cassette-counter-row">
            <span data-source-current-time>0:00</span>
            <span class="cassette-counter-label">TAPE COUNTER</span>
            <span data-source-duration>--:--</span>
          </div>

          <input
            class="audio-progress"
            data-source-progress
            type="range"
            min="0"
            max="1000"
            value="0"
            step="1"
            aria-label="Source audio progress"
          >
        </div>

        <div class="cassette-controls" aria-label="Source audio controls">
          <button type="button" data-source-skip="-15" aria-label="Go back 15 seconds">↶<span>15</span></button>
          <button class="audio-play-button" type="button" data-source-play aria-label="Play source audio">
            <span class="audio-play-symbol" data-source-play-icon aria-hidden="true">▶</span>
            <span class="cassette-control-caption" data-source-play-text>PLAY</span>
          </button>
          <button type="button" data-source-skip="15" aria-label="Go forward 15 seconds">↷<span>15</span></button>
          <button class="audio-speed-button" type="button" data-source-speed>1×<span>SPEED</span></button>
        </div>

        <p class="audio-status" data-source-status aria-live="polite"></p>
      </section>
    `;
  }

  function bindSourcePlayer(player) {
    if (!player || player.dataset.bound === 'true') return;
    player.dataset.bound = 'true';

    const audio = player.querySelector('[data-source-audio]');
    const playButton = player.querySelector('[data-source-play]');
    const playIcon = player.querySelector('[data-source-play-icon]');
    const playText = player.querySelector('[data-source-play-text]');
    const progress = player.querySelector('[data-source-progress]');
    const currentTime = player.querySelector('[data-source-current-time]');
    const duration = player.querySelector('[data-source-duration]');
    const speedButton = player.querySelector('[data-source-speed]');
    const status = player.querySelector('[data-source-status]');

    if (!audio || !playButton || !progress) return;

    const speeds = [1, 1.25, 1.5, 2];
    let speedIndex = 0;

    const setPlaying = (playing) => {
      playIcon.textContent = playing ? 'Ⅱ' : '▶';
      playText.textContent = playing ? 'PAUSE' : 'PLAY';
      playButton.setAttribute('aria-label', playing ? 'Pause source audio' : 'Play source audio');
      player.classList.toggle('is-playing', playing);
    };

    const updateProgress = () => {
      const percent = Number.isFinite(audio.duration) && audio.duration > 0
        ? (audio.currentTime / audio.duration) * 100
        : 0;
      progress.value = String(Math.round(percent * 10));
      progress.style.setProperty('--audio-progress', `${percent}%`);
      currentTime.textContent = formatTime(audio.currentTime);
      duration.textContent = formatTime(audio.duration);
    };

    playButton.addEventListener('click', async () => {
      if (audio.paused) {
        document.querySelectorAll('audio').forEach((other) => {
          if (other !== audio) other.pause();
        });

        try {
          await audio.play();
        } catch (error) {
          console.error(error);
          status.textContent = 'Audio could not start. Try the AUDIO link.';
        }
      } else {
        audio.pause();
      }
    });

    audio.addEventListener('play', () => {
      setPlaying(true);
      status.textContent = '';
    });
    audio.addEventListener('pause', () => setPlaying(false));
    audio.addEventListener('ended', () => setPlaying(false));
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', updateProgress);
    audio.addEventListener('durationchange', updateProgress);
    audio.addEventListener('error', () => {
      setPlaying(false);
      status.textContent = 'This source recording could not be loaded. Try the AUDIO link.';
    });

    progress.addEventListener('input', () => {
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
      audio.currentTime = (Number(progress.value) / 1000) * audio.duration;
      updateProgress();
    });

    player.querySelectorAll('[data-source-skip]').forEach((button) => {
      button.addEventListener('click', () => {
        const seconds = Number(button.dataset.sourceSkip || 0);
        const maximum = Number.isFinite(audio.duration) ? audio.duration : Number.MAX_SAFE_INTEGER;
        audio.currentTime = Math.min(Math.max(audio.currentTime + seconds, 0), maximum);
      });
    });

    speedButton.addEventListener('click', () => {
      speedIndex = (speedIndex + 1) % speeds.length;
      const speed = speeds[speedIndex];
      audio.playbackRate = speed;
      speedButton.innerHTML = `${speed}×<span>SPEED</span>`;
    });

    updateProgress();
  }

  function installSmallStyles() {
    if (document.getElementById('source-page-audio-styles')) return;
    const style = document.createElement('style');
    style.id = 'source-page-audio-styles';
    style.textContent = `
      .source-page-audio { margin: 0 0 1.25rem; }
      .source-page-audio-label { margin: .2rem 0 0; opacity: .78; font-size: .9rem; }
    `;
    document.head.appendChild(style);
  }

  function renderSourceAudioPlayers() {
    document.querySelectorAll('.reading-card').forEach((card) => {
      card.querySelectorAll('[data-source-audio-injected]').forEach((node) => node.remove());

      const readingId = readingIdFromCard(card);
      const entry = sourceAudioMap[readingId];
      if (!readingId || !entry?.audioUrl) return;

      const sourcePages = card.querySelector('.grey-book-context-details .grey-book-context-pages');
      const sourceDetails = card.querySelector('.grey-book-context-details');
      const target = sourcePages || sourceDetails;
      if (!target) return;

      const wrapper = document.createElement('div');
      wrapper.innerHTML = sourceAudioMarkup(readingId, entry).trim();
      const player = wrapper.firstElementChild;

      if (sourcePages) {
        sourcePages.prepend(player);
      } else {
        sourceDetails.append(player);
      }

      bindSourcePlayer(player);
    });
  }

  async function loadSourceAudioMap() {
    try {
      const response = await fetch('data/gbr-source-audio.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      sourceAudioMap = await response.json();
    } catch (error) {
      console.warn('Grey Book source audio map could not be loaded.', error);
      sourceAudioMap = {};
    }

    renderSourceAudioPlayers();
  }

  installSmallStyles();
  document.addEventListener('gbr:reading-rendered', renderSourceAudioPlayers);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadSourceAudioMap, { once: true });
  } else {
    loadSourceAudioMap();
  }
})();
