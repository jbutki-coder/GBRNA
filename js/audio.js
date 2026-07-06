(function () {
  let libraryPromise = null;

  function getLibrary() {
    if (!libraryPromise) {
      libraryPromise = fetch('data/audio-library.json', { cache: 'no-store' })
        .then((response) => {
          if (!response.ok) throw new Error('Audio library data not found');
          return response.json();
        });
    }
    return libraryPromise;
  }

  function makeOptionLabel(track) {
    return track.duration
      ? `${track.title} — ${track.duration}`
      : track.title;
  }

  function populateCollectionSelect(select, collections) {
    select.innerHTML = '<option value="">Choose an audio folder…</option>';

    collections.forEach((collection, collectionIndex) => {
      const option = document.createElement('option');
      option.value = String(collectionIndex);
      option.textContent = collection.label || 'Audio Folder';
      select.appendChild(option);
    });
  }

  function populateEpisodeSelect(select, collection) {
    select.innerHTML = '<option value="">Choose a recording…</option>';

    (collection.tracks || []).forEach((track, trackIndex) => {
      const option = document.createElement('option');
      option.value = String(trackIndex);
      option.textContent = makeOptionLabel(track);
      select.appendChild(option);
    });
  }

  function resetPlayer(section, message) {
    const audio = section.querySelector('[data-audio-library-player]');
    const title = section.querySelector('[data-audio-library-title]');
    const source = section.querySelector('[data-audio-library-source]');
    const duration = section.querySelector('[data-audio-library-duration]');
    const description = section.querySelector('[data-audio-library-description]');
    const external = section.querySelector('[data-audio-library-external]');

    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }

    if (source) source.textContent = 'Audio Library';
    if (title) title.textContent = message || 'Choose an audio folder, then a recording.';
    if (duration) duration.textContent = '';
    if (description) description.textContent = '';

    if (external) {
      external.href = '#';
      external.hidden = true;
    }
  }

  function updatePlayer(section, collection, track) {
    const audio = section.querySelector('[data-audio-library-player]');
    const title = section.querySelector('[data-audio-library-title]');
    const source = section.querySelector('[data-audio-library-source]');
    const duration = section.querySelector('[data-audio-library-duration]');
    const description = section.querySelector('[data-audio-library-description]');
    const external = section.querySelector('[data-audio-library-external]');

    if (!audio || !collection || !track) return;

    audio.pause();
    audio.src = track.audioUrl || '';
    audio.load();

    if (title) title.textContent = track.title || 'Untitled recording';
    if (source) source.textContent = collection.label || 'Audio Library';
    if (duration) duration.textContent = track.duration ? `Duration: ${track.duration}` : '';
    if (description) description.textContent = track.description || collection.description || '';

    if (external) {
      if (track.episodeUrl) {
        external.href = track.episodeUrl;
        external.hidden = false;
      } else {
        external.href = '#';
        external.hidden = true;
      }
    }
  }

  async function initSection(section) {
    if (!section || section.dataset.audioLibraryBound === 'true') return;
    section.dataset.audioLibraryBound = 'true';

    const collectionSelect = section.querySelector('[data-audio-library-collection]');
    const episodeBlock = section.querySelector('[data-audio-library-episode-block]');
    const episodeSelect = section.querySelector('[data-audio-library-episode]');
    const title = section.querySelector('[data-audio-library-title]');
    const description = section.querySelector('[data-audio-library-description]');

    if (!collectionSelect || !episodeSelect || !episodeBlock) return;

    try {
      const collections = await getLibrary();
      populateCollectionSelect(collectionSelect, collections);
      resetPlayer(section, 'Choose an audio folder, then a recording.');

      collectionSelect.addEventListener('change', () => {
        const collectionIndex = Number(collectionSelect.value);
        const collection = collections[collectionIndex];

        episodeSelect.innerHTML = '<option value="">Choose a recording…</option>';

        if (!collectionSelect.value || !collection) {
          episodeBlock.hidden = true;
          resetPlayer(section, 'Choose an audio folder, then a recording.');
          return;
        }

        populateEpisodeSelect(episodeSelect, collection);
        episodeBlock.hidden = false;
        resetPlayer(section, `Open the ${collection.label} recording list below.`);

        // Keep the newly revealed episode selector in view on smaller screens.
        if (window.matchMedia('(max-width: 680px)').matches) {
          requestAnimationFrame(() => {
            episodeBlock.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          });
        }
      });

      episodeSelect.addEventListener('change', () => {
        const collectionIndex = Number(collectionSelect.value);
        const trackIndex = Number(episodeSelect.value);
        const collection = collections[collectionIndex];
        const track = collection?.tracks?.[trackIndex];

        if (!episodeSelect.value || !collection || !track) {
          if (collection) {
            resetPlayer(section, `Choose a recording from ${collection.label}.`);
          }
          return;
        }

        updatePlayer(section, collection, track);
      });
    } catch (error) {
      console.error(error);
      collectionSelect.innerHTML = '<option>Audio library unavailable</option>';
      collectionSelect.disabled = true;
      episodeBlock.hidden = true;
      if (title) title.textContent = 'Audio could not be loaded.';
      if (description) {
        description.textContent = 'Make sure data/audio-library.json is uploaded with the site files.';
      }
    }
  }

  function initAudioLibraries() {
    document.querySelectorAll('[data-audio-library]').forEach(initSection);
  }

  window.initAudioLibraries = initAudioLibraries;

  document.addEventListener('gbr:reading-rendered', initAudioLibraries);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAudioLibraries);
  } else {
    initAudioLibraries();
  }
})();
