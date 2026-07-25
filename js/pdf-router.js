(() => {
  'use strict';

  const READER_PATH = '/pdf-reader.html';

  function isPdfUrl(url) {
    try {
      const parsed = new URL(url, window.location.href);
      return /\.pdf$/i.test(parsed.pathname);
    } catch {
      return false;
    }
  }

  function readableTitle(link, url) {
    const explicit = link.dataset.pdfTitle || link.closest('[data-title]')?.dataset.title || link.getAttribute('aria-label') || link.getAttribute('title');
    if (explicit && explicit.trim()) return explicit.trim();

    const text = (link.textContent || '').replace(/\s+/g, ' ').trim();
    if (text && !/^(open|read|view|pdf|download|open pdf|read pdf|view pdf)$/i.test(text)) {
      return text;
    }

    try {
      const pathname = new URL(url, window.location.href).pathname;
      const filename = decodeURIComponent(pathname.split('/').pop() || 'PDF document');
      return filename.replace(/\.pdf$/i, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim() || 'PDF document';
    } catch {
      return 'PDF document';
    }
  }

  function buildReaderUrl(link) {
    const resolved = new URL(link.href, window.location.href);
    const params = new URLSearchParams();
    params.set('url', resolved.href);
    params.set('title', readableTitle(link, resolved.href));
    params.set('return', window.location.href);
    return `${READER_PATH}?${params.toString()}`;
  }

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const link = event.target.closest('a[href]');
    if (!link) return;
    if (link.hasAttribute('download')) return;
    if (link.dataset.directPdf !== undefined || link.dataset.noPdfReader !== undefined) return;
    if (link.closest('[data-disable-pdf-reader]')) return;
    if (!isPdfUrl(link.href)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.assign(buildReaderUrl(link));
  }, true);
})();
