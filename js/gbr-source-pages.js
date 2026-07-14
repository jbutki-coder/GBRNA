(() => {
  'use strict';

  let sourceMap = null;
  let sourceMapPromise = null;

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  async function loadSourceMap() {
    if (sourceMap) return sourceMap;
    if (!sourceMapPromise) {
      sourceMapPromise = fetch('data/gbr-source-pages.json', { cache: 'no-store' })
        .then((response) => {
          if (!response.ok) throw new Error(`GBR source-page map returned ${response.status}`);
          return response.json();
        })
        .then((data) => {
          sourceMap = data;
          return data;
        });
    }
    return sourceMapPromise;
  }

  function preserveAudioNodes(container) {
    if (!container) return [];
    const candidates = [...container.children];
    return candidates.filter((node) => {
      if (!(node instanceof HTMLElement)) return false;
      return Boolean(
        node.matches('audio, [data-source-audio-player], [data-gbr-source-audio]') ||
        node.querySelector('audio')
      );
    });
  }

  function renderImages(entry) {
    return entry.images.map((image, index) => `
      <figure class="gbr-exact-source-page${index ? ' gbr-exact-source-page-continuation' : ''}">
        <figcaption>
          <span>Original 1981 Grey Book manuscript</span>
          <strong>GBR Page ${escapeHtml(image.printedPage)}</strong>
        </figcaption>
        <a href="${escapeHtml(image.url)}" target="_blank" rel="noopener noreferrer">
          <img
            src="${escapeHtml(image.url)}"
            alt="Original Grey Book source page ${escapeHtml(image.printedPage)} for ${escapeHtml(entry.section)}"
            loading="lazy"
            decoding="async"
          >
        </a>
      </figure>
    `).join('');
  }

  function pageLabel(entry) {
    const labels = entry.images.map((image) => image.printedPage);
    if (labels.length === 1) return `Page ${labels[0]}`;
    return `Pages ${labels[0]}-${labels[labels.length - 1]}`;
  }

  function applyEntry(card, entry) {
    const section = card.querySelector('.grey-book-context');
    if (!section) return;

    const heading = section.querySelector('.grey-book-context-heading h4');
    const meta = section.querySelector('.grey-book-context-meta');
    const stamp = section.querySelector('.grey-book-page-stamp');
    const summaryStrong = section.querySelector('.grey-book-context-summary-copy strong');
    const summarySmall = section.querySelector('.grey-book-context-summary-copy small');
    const pagesContainer = section.querySelector('.grey-book-context-pages');

    const label = pageLabel(entry);
    const details = [entry.section, `GBR ${label}`];
    if (entry.lineLabel) details.push(entry.lineLabel);

    if (heading) heading.textContent = entry.images.length > 1 ? 'Read the Source Pages' : 'Read the Source Page';
    if (meta) meta.textContent = details.join(' · ');
    if (stamp) stamp.textContent = entry.images.length > 1
      ? `PP. ${entry.images[0].printedPage}-${entry.images[entry.images.length - 1].printedPage}`
      : `P. ${entry.images[0].printedPage}`;
    if (summaryStrong) summaryStrong.textContent = `Read Original Grey Book ${label}`;
    if (summarySmall) {
      summarySmall.textContent = entry.step
        ? `${entry.section} only - text from the previous and next Steps is excluded.`
        : 'The exact cited GBR page is shown with its original page and line numbers.';
    }

    if (pagesContainer) {
      const audioNodes = preserveAudioNodes(pagesContainer);
      audioNodes.forEach((node) => node.remove());
      pagesContainer.innerHTML = `
        <div class="gbr-exact-source-pages" data-gbr-exact-source>
          ${renderImages(entry)}
          <p class="gbr-exact-source-note">
            ${entry.step
              ? `${escapeHtml(entry.section)} is kept within its own Step boundary. No text from the previous or next Step is included.`
              : 'This image comes from the exact GBR page cited beneath the daily quotation.'}
          </p>
        </div>
      `;
      audioNodes.forEach((node) => pagesContainer.append(node));
    }

    section.dataset.gbrExactSource = 'true';
  }

  async function applyExactSourcePages() {
    let map;
    try {
      map = await loadSourceMap();
    } catch (error) {
      console.error('Could not load exact GBR source pages.', error);
      return;
    }

    document.querySelectorAll('.reading-card[id^="reading-"]').forEach((card) => {
      const id = card.id.replace(/^reading-/, '');
      const entry = map?.entries?.[id];
      if (entry) applyEntry(card, entry);
    });
  }

  document.addEventListener('gbr:reading-rendered', applyExactSourcePages);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyExactSourcePages, { once: true });
  } else {
    applyExactSourcePages();
  }
})();
