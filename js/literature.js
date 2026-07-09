(() => {
  const shelf = document.querySelector('[data-literature-shelf]');
  const reader = document.querySelector('[data-literature-reader]');
  if (!shelf || !reader) return;

  const titleEl = reader.querySelector('[data-literature-title]');
  const frame = reader.querySelector('[data-literature-frame]');
  const openLink = reader.querySelector('[data-literature-open]');
  const downloadLink = reader.querySelector('[data-literature-download]');
  const closeButtons = reader.querySelectorAll('[data-literature-close]');
  let lastTrigger = null;

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  function openReader(book, trigger) {
    const readerUrl = book.readerUrl || (book.pdf ? `${book.pdf}#view=FitH` : '');
    const openUrl = book.openUrl || book.readerUrl || book.pdf || '';
    const downloadUrl = book.downloadUrl || book.pdf || '';
    if (!readerUrl) return;
    lastTrigger = trigger || null;
    titleEl.textContent = book.title;
    frame.src = readerUrl;
    openLink.href = openUrl;
    downloadLink.href = downloadUrl;
    if (book.pdf && !book.downloadUrl) {
      downloadLink.setAttribute('download', book.pdf.split('/').pop() || 'literature.pdf');
    } else {
      downloadLink.removeAttribute('download');
      downloadLink.setAttribute('target', '_blank');
      downloadLink.setAttribute('rel', 'noopener noreferrer');
    }
    reader.hidden = false;
    document.body.classList.add('reader-open');
    reader.querySelector('.literature-reader-close')?.focus();
  }

  function closeReader() {
    reader.hidden = true;
    frame.src = 'about:blank';
    document.body.classList.remove('reader-open');
    if (lastTrigger && typeof lastTrigger.focus === 'function') lastTrigger.focus();
  }

  function renderBook(book) {
    const readable = Boolean(book.pdf || book.readerUrl);
    const downloadable = Boolean(book.pdf || book.downloadUrl);
    const disabled = !readable;
    const buttonText = disabled ? 'PDF Needed' : 'Read on Site';
    const downloadHref = book.downloadUrl || book.pdf || '';
    const downloadHtml = !downloadable
      ? '<span class="literature-download-disabled">Download unavailable</span>'
      : `<a href="${escapeHtml(downloadHref)}"${book.downloadUrl ? ' target="_blank" rel="noopener noreferrer"' : ' download'}>Download</a>`;

    return `
      <article class="literature-book-card${disabled ? ' is-pending' : ''}">
        <button
          class="literature-cover-button"
          type="button"
          data-literature-open-book="${escapeHtml(book.id)}"
          ${disabled ? 'disabled aria-disabled="true"' : ''}
        >
          <img src="${escapeHtml(book.cover)}" alt="${escapeHtml(book.title)} cover" loading="lazy">
          <span>${buttonText}</span>
        </button>
        <div class="literature-book-copy">
          <h3>${escapeHtml(book.title)}</h3>
          <p class="literature-book-subtitle">${escapeHtml(book.subtitle)}</p>
          <p>${escapeHtml(book.note || '')}</p>
          <div class="literature-book-actions">
            ${downloadHtml}
          </div>
        </div>
      </article>
    `;
  }

  fetch('data/literature-library.json')
    .then((response) => {
      if (!response.ok) throw new Error('Could not load literature library.');
      return response.json();
    })
    .then((data) => {
      const books = Array.isArray(data.books) ? data.books : [];
      shelf.innerHTML = books.map(renderBook).join('');
      shelf.addEventListener('click', (event) => {
        const trigger = event.target.closest('[data-literature-open-book]');
        if (!trigger) return;
        const book = books.find((item) => item.id === trigger.dataset.literatureOpenBook);
        if (book) openReader(book, trigger);
      });
    })
    .catch((error) => {
      console.error(error);
      shelf.innerHTML = '<p class="small-note">The literature library could not be loaded.</p>';
    });

  closeButtons.forEach((button) => button.addEventListener('click', closeReader));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !reader.hidden) closeReader();
  });
})();
