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

  function buildTrackMap(collections) {
    const map = new Map();

    collections.forEach((collection, collectionIndex) => {
      (collection.tracks || []).forEach((track, trackIndex) => {
        map.set(`${collectionIndex}:${trackIndex}`, {
          collection,
          track
        });
      });
    });

    return map;
  }

  function findDefaultValue(collections) {
    const greyBookIndex = collections.findIndex((collection) => collection.id === 'grey-book');
    const collection = collections[greyBookIndex];

    if (collection) {
      const chapterOneIndex = (collection.tracks || []).findIndex((track) =>
        /chapter one/i.test(track.title || '')
      );

      if (chapterOneIndex >= 0) return `${greyBookIndex}:${chapterOneIndex}`;
      if (collection.tracks?.length) return `${greyBookIndex}:0`;
    }

    for (let collectionIndex = 0; collectionIndex < collections.length; collectionIndex += 1) {
      if (collections[collectionIndex]?.tracks?.length) return `${collectionIndex}:0`;
    }

    return '';
  }

  function populateSelect(select, collections) {
    select.innerHTML = '';

    collections.forEach((collection, collectionIndex) => {
      const group = document.createElement('optgroup');
      group.label = collection.label || 'Audio';

      (collection.tracks || []).forEach((track, trackIndex) => {
        const option = document.createElement('option');
        option.value = `${collectionIndex}:${trackIndex}`;
        option.textContent = makeOptionLabel(track);
        group.appendChild(option);
      });

      select.appendChild(group);
    });
  }

  function updatePlayer(section, entry) {
    const audio = section.querySelector('[data-audio-library-player]');
    const title = section.querySelector('[data-audio-library-title]');
    const source = section.querySelector('[data-audio-library-source]');
    const duration = section.querySelector('[data-audio-library-duration]');
    const description = section.querySelector('[data-audio-library-description]');
    const external = section.querySelector('[data-audio-library-external]');

    if (!audio || !entry) return;

    const { collection, track } = entry;

    audio.pause();
    audio.src = track.audioUrl || '';
    audio.load();

    title.textContent = track.title || 'Untitled recording';
    source.textContent = collection.label || 'Audio Library';
    duration.textContent = track.duration ? `Duration: ${track.duration}` : '';
    description.textContent = track.description || collection.description || '';

    if (track.episodeUrl) {
      external.href = track.episodeUrl;
      external.hidden = false;
    } else {
      external.href = '#';
      external.hidden = true;
    }
  }

  async function initSection(section) {
    if (!section || section.dataset.audioLibraryBound === 'true') return;
    section.dataset.audioLibraryBound = 'true';

    const select = section.querySelector('[data-audio-library-select]');
    const title = section.querySelector('[data-audio-library-title]');
    const description = section.querySelector('[data-audio-library-description]');

    if (!select) return;

    try {
      const collections = await getLibrary();
      const trackMap = buildTrackMap(collections);

      populateSelect(select, collections);

      const defaultValue = findDefaultValue(collections);
      if (!defaultValue || !trackMap.has(defaultValue)) {
        throw new Error('No audio tracks found');
      }

      select.value = defaultValue;
      updatePlayer(section, trackMap.get(defaultValue));

      select.addEventListener('change', () => {
        updatePlayer(section, trackMap.get(select.value));
      });
    } catch (error) {
      console.error(error);
      select.innerHTML = '<option>Audio library unavailable</option>';
      select.disabled = true;
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
