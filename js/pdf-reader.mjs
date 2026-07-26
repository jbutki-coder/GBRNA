(() => {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const sourceUrl = params.get('url') || '';
  const requestedTitle = params.get('title') || 'PDF document';
  const returnUrl = params.get('return') || '/';

  const readerTitle = document.getElementById('readerTitle');
  const pdfFrame = document.getElementById('pdfFrame');
  const readerStage = document.getElementById('readerStage');
  const readerMessage = document.getElementById('readerMessage');
  const readerError = document.getElementById('readerError');
  const backButton = document.getElementById('backButton');
  const reloadButton = document.getElementById('reloadButton');
  const fullScreen = document.getElementById('fullScreen');
  const openOriginal = document.getElementById('openOriginal');
  const downloadPdf = document.getElementById('downloadPdf');
  const errorBack = document.getElementById('errorBack');
  const errorDirect = document.getElementById('errorDirect');

  function resolvedSource() {
    try {
      const url = new URL(sourceUrl, window.location.href);
      if (!/^https?:$/.test(url.protocol)) return null;
      return url;
    } catch {
      return null;
    }
  }

  function resolvedReturn() {
    try {
      const url = new URL(returnUrl, window.location.href);
      return url.origin === window.location.origin ? url.href : '/';
    } catch {
      return '/';
    }
  }

  function goBack() {
    let referrer = null;
    try { referrer = document.referrer ? new URL(document.referrer, window.location.href) : null; } catch {}

    if (window.history.length > 1 && referrer?.origin === window.location.origin) {
      window.history.back();
      return;
    }
    window.location.assign(resolvedReturn());
  }

  function showError() {
    readerError.style.display = 'block';
    readerMessage.style.display = 'none';
  }

  const source = resolvedSource();
  readerTitle.textContent = requestedTitle;
  document.title = `${requestedTitle} | PDF Reader`;

  if (!source) {
    readerTitle.textContent = 'Invalid PDF link';
    showError();
    return;
  }

  const directUrl = source.href;
  openOriginal.href = directUrl;
  errorDirect.href = directUrl;
  downloadPdf.href = directUrl;
  downloadPdf.download = decodeURIComponent(source.pathname.split('/').pop() || 'document.pdf');

  // Use the browser/iPhone's own PDF engine. This avoids requiring pdfjs-dist,
  // server.js routes, npm packages, workers, or a third-party viewer.
  pdfFrame.src = directUrl;

  pdfFrame.addEventListener('load', () => {
    window.setTimeout(() => {
      readerMessage.style.opacity = '0';
      window.setTimeout(() => { readerMessage.style.display = 'none'; }, 300);
    }, 3500);
  });

  pdfFrame.addEventListener('error', showError);
  backButton.addEventListener('click', goBack);
  errorBack.addEventListener('click', goBack);
  reloadButton.addEventListener('click', () => {
    readerError.style.display = 'none';
    readerMessage.style.display = 'block';
    readerMessage.style.opacity = '1';
    pdfFrame.src = 'about:blank';
    window.setTimeout(() => { pdfFrame.src = directUrl; }, 50);
  });

  fullScreen.addEventListener('click', async () => {
    try {
      if (!document.fullscreenElement) {
        await readerStage.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // iPhone Safari may not expose the Fullscreen API for page elements.
    }
  });
})();
