function formatAudioTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--';

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  return `${mins}:${String(secs).padStart(2, '0')}`;
}


/*
  ------------------------------------------------------------
  DAILY REFLECTION AUDIO
  ------------------------------------------------------------

  Audio belongs to the calendar date.

  This means January audio remains visible even when the newer
  Ties That Bind Review & Input version is being displayed.

  Example:
  January 17 always looks for DAILY_AUDIO["01-17"] regardless
  of which R&I text version is currently selected.
  ------------------------------------------------------------
*/

function resolveDailyAudioId(reading) {
  const candidates = [];

  function addCandidate(value) {
    const id = String(value || '').trim();

    if (
      /^\d{2}-\d{2}$/.test(id) &&
      !candidates.includes(id)
    ) {
      candidates.push(id);
    }
  }

  // The calendar date currently open on the site.
  addCandidate(currentId);

  // Standard reflection ID.
  addCandidate(reading?.id);

  // Possible IDs retained by versioned R&I material.
  addCandidate(reading?.calendarId);
  addCandidate(reading?.baseId);
  addCandidate(reading?.originalId);
  addCandidate(reading?.readingId);
  addCandidate(reading?.dateId);
  addCandidate(reading?.sourceId);

  // Fall back to numeric month/day.
  if (reading?.month && reading?.day) {
    addCandidate(
      makeId(
        Number(reading.month),
        Number(reading.day)
      )
    );
  }

  // Final fallback: derive date from text such as "January 17".
  const dateText = String(reading?.date || '').trim();

  const dateMatch =
    dateText.match(/^([A-Za-z]+)\s+(\d{1,2})/);

  if (dateMatch) {
    const monthNumber = monthNames.findIndex(
      (monthName) =>
        monthName.toLowerCase() ===
        dateMatch[1].toLowerCase()
    );

    if (monthNumber > 0) {
      addCandidate(
        makeId(
          monthNumber,
          Number(dateMatch[2])
        )
      );
    }
  }

  // Prefer the first candidate that actually has audio.
  const matchingId = candidates.find(
    (id) =>
      DAILY_AUDIO[id] &&
      DAILY_AUDIO[id].audioUrl
  );

  return matchingId || candidates[0] || '';
}


function renderDailyAudio(reading) {
  const audioId = resolveDailyAudioId(reading);
  const audio = DAILY_AUDIO[audioId];

  if (!audio || !audio.audioUrl) return '';

  const title =
    audio.title ||
    `Grey Book Reflection Audio — ${reading.date}`;

  const alternates = Array.isArray(audio.alternates)
    ? audio.alternates
    : [];

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

  const trackPicker =
    trackOptions.length > 1
      ? `
        <label class="audio-variant-picker">

          <span>Recording</span>

          <select data-track-select>

            ${trackOptions
              .map(
                (track, index) => `
                  <option
                    value="${escapeHtml(track.audioUrl)}"
                    data-track-title="${escapeHtml(track.title)}"
                    ${index === 0 ? 'selected' : ''}
                  >
                    ${escapeHtml(track.label)}
                  </option>
                `
              )
              .join('')}

          </select>

        </label>
      `
      : '';

  return `
    <section
      class="daily-reflection-audio cassette-player"
      data-audio-player
      aria-label="Grey Book Reflection audio for ${escapeHtml(reading.date)}"
    >

      <div class="cassette-topline">

        <div>

          <p class="daily-audio-kicker">
            Listen to Today's Reflection
          </p>

          <h4>
            ${escapeHtml(reading.date)} Audio
          </h4>

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


      <audio
        data-audio
        preload="none"
        playsinline
      >

        <source
          data-audio-source
          src="${escapeHtml(audio.audioUrl)}"
          type="audio/mpeg"
        >

      </audio>


      <div class="cassette-shell">

        <span
          class="cassette-screw screw-tl"
          aria-hidden="true"
        ></span>

        <span
          class="cassette-screw screw-tr"
          aria-hidden="true"
        ></span>

        <span
          class="cassette-screw screw-bl"
          aria-hidden="true"
        ></span>

        <span
          class="cassette-screw screw-br"
          aria-hidden="true"
        ></span>


        <div class="cassette-label-strip">

          <span>
            GREY BOOK REFLECTION
          </span>

          <strong>
            ${escapeHtml(reading.date.toUpperCase())}
          </strong>

          <span>
            DAILY AUDIO
          </span>

        </div>


        <div
          class="cassette-window"
          aria-hidden="true"
        >

          <span class="cassette-reel cassette-reel-left">
            <i></i>
          </span>

          <span class="cassette-tape-band"></span>

          <span class="cassette-reel cassette-reel-right">
            <i></i>
          </span>

        </div>


        <div class="cassette-counter-row">

          <span data-current-time>
            0:00
          </span>

          <span class="cassette-counter-label">
            TAPE COUNTER
          </span>

          <span data-duration>
            --:--
          </span>

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


      <div
        class="cassette-controls"
        aria-label="Audio controls"
      >

        <button
          type="button"
          data-skip="-15"
          aria-label="Go back 15 seconds"
        >
          ↶<span>15</span>
        </button>


        <button
          class="audio-play-button"
          type="button"
          data-play
          aria-label="Play ${escapeHtml(reading.date)} audio"
        >

          <span
            class="audio-play-symbol"
            data-play-icon
            aria-hidden="true"
          >
            ▶
          </span>

          <span
            class="cassette-control-caption"
            data-play-text
          >
            PLAY
          </span>

        </button>


        <button
          type="button"
          data-skip="15"
          aria-label="Go forward 15 seconds"
        >
          ↷<span>15</span>
        </button>


        <button
          class="audio-speed-button"
          type="button"
          data-speed
        >
          1×<span>SPEED</span>
        </button>

      </div>


      ${trackPicker}


      <p
        class="audio-status"
        data-audio-status
        aria-live="polite"
      ></p>

    </section>
  `;
}


function attachAudioPlayers() {
  document
    .querySelectorAll('[data-audio-player]')
    .forEach((card) => {

      if (card.dataset.bound === 'true') return;

      card.dataset.bound = 'true';

      const audio =
        card.querySelector('[data-audio]');

      const playButton =
        card.querySelector('[data-play]');

      const playIcon =
        card.querySelector('[data-play-icon]');

      const playText =
        card.querySelector('[data-play-text]');

      const progress =
        card.querySelector('[data-progress]');

      const currentTime =
        card.querySelector('[data-current-time]');

      const duration =
        card.querySelector('[data-duration]');

      const speedButton =
        card.querySelector('[data-speed]');

      const status =
        card.querySelector('[data-audio-status]');

      const trackSelect =
        card.querySelector('[data-track-select]');

      const fileLink =
        card.querySelector('[data-audio-file-link]');

      const sourceEl =
        card.querySelector('[data-audio-source]');


      if (!audio || !playButton || !progress) return;


      const speedOptions = [
        1,
        1.25,
        1.5,
        2
      ];

      let speedIndex = 0;


      function setPlayingState(isPlaying) {

        playIcon.textContent =
          isPlaying ? 'Ⅱ' : '▶';

        playText.textContent =
          isPlaying ? 'Pause' : 'Play';

        playButton.setAttribute(
          'aria-label',
          isPlaying
            ? 'Pause audio'
            : 'Play audio'
        );

        card.classList.toggle(
          'is-playing',
          isPlaying
        );
      }


      function updateProgress() {

        const pct =
          Number.isFinite(audio.duration) &&
          audio.duration > 0
            ? (
                audio.currentTime /
                audio.duration
              ) * 100
            : 0;

        progress.value =
          String(Math.round(pct * 10));

        progress.style.setProperty(
          '--audio-progress',
          `${pct}%`
        );

        currentTime.textContent =
          formatAudioTime(audio.currentTime);

        duration.textContent =
          formatAudioTime(audio.duration);
      }


      playButton.addEventListener(
        'click',
        async () => {

          if (audio.paused) {

            document
              .querySelectorAll('audio[data-audio]')
              .forEach((other) => {

                if (other !== audio) {
                  other.pause();
                }

              });

            try {

              await audio.play();

            } catch (error) {

              console.error(error);

              status.textContent =
                'Audio could not start. Try the MP3 link.';
            }

          } else {

            audio.pause();

          }

        }
      );


      audio.addEventListener(
        'play',
        () => {

          setPlayingState(true);
          status.textContent = '';

        }
      );


      audio.addEventListener(
        'pause',
        () => setPlayingState(false)
      );


      audio.addEventListener(
        'ended',
        () => setPlayingState(false)
      );


      audio.addEventListener(
        'timeupdate',
        updateProgress
      );


      audio.addEventListener(
        'loadedmetadata',
        updateProgress
      );


      audio.addEventListener(
        'durationchange',
        updateProgress
      );


      audio.addEventListener(
        'error',
        () => {

          setPlayingState(false);

          status.textContent =
            'This recording could not be loaded. Try the MP3 link.';
        }
      );


      progress.addEventListener(
        'input',
        () => {

          if (
            !Number.isFinite(audio.duration) ||
            audio.duration <= 0
          ) {
            return;
          }

          audio.currentTime =
            (
              Number(progress.value) /
              1000
            ) *
            audio.duration;

          updateProgress();

        }
      );


      card
        .querySelectorAll('[data-skip]')
        .forEach((button) => {

          button.addEventListener(
            'click',
            () => {

              const seconds =
                Number(button.dataset.skip || 0);

              if (
                !Number.isFinite(audio.duration)
              ) {
                return;
              }

              audio.currentTime =
                Math.min(
                  Math.max(
                    audio.currentTime + seconds,
                    0
                  ),
                  audio.duration
                );

            }
          );

        });


      speedButton.addEventListener(
        'click',
        () => {

          speedIndex =
            (speedIndex + 1) %
            speedOptions.length;

          const nextSpeed =
            speedOptions[speedIndex];

          audio.playbackRate =
            nextSpeed;

          speedButton.textContent =
            `${nextSpeed}× Speed`;

        }
      );


      if (trackSelect) {

        trackSelect.addEventListener(
          'change',
          () => {

            const option =
              trackSelect.options[
                trackSelect.selectedIndex
              ];

            const wasPlaying =
              !audio.paused;

            audio.pause();


            if (sourceEl) {

              sourceEl.src =
                trackSelect.value;

            } else {

              audio.src =
                trackSelect.value;

            }


            audio.load();

            fileLink.href =
              trackSelect.value;

            status.textContent =
              option.dataset.trackTitle || '';


            if (wasPlaying) {

              audio
                .play()
                .catch((error) => {

                  console.error(error);

                  status.textContent =
                    'Recording changed. Press play to continue.';

                });

            }

          }
        );

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

          <p class="audio-library-kicker">
            NA Audio Library
          </p>

          <h4>
            Grey Book &amp; Fellowship Audio
          </h4>

          <p>
            Open an audio folder first, then choose the recording you want to hear.
          </p>

        </div>


        <div class="audio-library-selector-block">

          <div class="audio-library-selector-copy">

            <span class="audio-library-selector-label">
              1. Choose an audio folder
            </span>

            <span class="audio-library-selector-help">
              Open this menu to choose the collection.
            </span>

          </div>


          <div class="audio-library-select-wrap">

            <select
              class="audio-library-select"
              data-audio-library-collection
              aria-label="Choose an audio folder"
            >
              <option>
                Loading audio folders…
              </option>
            </select>

            <span
              class="audio-library-select-cue"
              aria-hidden="true"
            >
              OPEN FOLDERS ▼
            </span>

          </div>

        </div>


        <div
          class="audio-library-selector-block audio-library-episode-block"
          data-audio-library-episode-block
          hidden
        >

          <div class="audio-library-selector-copy">

            <span class="audio-library-selector-label">
              2. Choose a recording
            </span>

            <span class="audio-library-selector-help">
              Now open this menu to see the recordings in that folder.
            </span>

          </div>


          <div class="audio-library-select-wrap">

            <select
              class="audio-library-select"
              data-audio-library-episode
              aria-label="Choose a recording"
            >
              <option value="">
                Choose a recording…
              </option>
            </select>

            <span
              class="audio-library-select-cue"
              aria-hidden="true"
            >
              OPEN RECORDINGS ▼
            </span>

          </div>

        </div>


        <div
          class="audio-library-now-playing"
          aria-live="polite"
        >

          <span
            class="audio-library-source"
            data-audio-library-source
          >
            Audio Library
          </span>

          <strong data-audio-library-title>
            Choose an audio folder, then a recording.
          </strong>

          <span
            class="audio-library-duration"
            data-audio-library-duration
          ></span>

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
