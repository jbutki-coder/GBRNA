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
    if (!book.pdf) return;
    lastTrigger = trigger || null;
    titleEl.textContent = book.title;
    frame.src = `${book.pdf}#view=FitH`;
    openLink.href = book.pdf;
    downloadLink.href = book.pdf;
    downloadLink.setAttribute('download', book.pdf.split('/').pop() || 'literature.pdf');
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
    const disabled = !book.pdf;
    const buttonText = disabled ? 'PDF Needed' : 'Read on Site';
    const downloadHtml = disabled
      ? '<span class="literature-download-disabled">Download unavailable</span>'
      : `<a href="${escapeHtml(book.pdf)}" download>Download</a>`;

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
