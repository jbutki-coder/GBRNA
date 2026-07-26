(() => {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const sourceUrl = params.get('url') || '';
  const requestedTitle = params.get('title') || 'PDF document';
  const returnUrl = params.get('return') || '/';

  const readerTitle = document.getElementById('readerTitle');
  const readerStage = document.getElementById('readerStage');
  const pdfScroll = document.getElementById('pdfScroll');
  const pdfPages = document.getElementById('pdfPages');
  const readerStatus = document.getElementById('readerStatus');
  const readerError = document.getElementById('readerError');
  const readerErrorText = document.getElementById('readerErrorText');
  const backButton = document.getElementById('backButton');
  const prevPage = document.getElementById('prevPage');
  const nextPage = document.getElementById('nextPage');
  const pageReadout = document.getElementById('pageReadout');
  const zoomOut = document.getElementById('zoomOut');
  const zoomIn = document.getElementById('zoomIn');
  const zoomReadout = document.getElementById('zoomReadout');
  const fitWidth = document.getElementById('fitWidth');
  const fullScreen = document.getElementById('fullScreen');
  const openOriginal = document.getElementById('openOriginal');
  const downloadPdf = document.getElementById('downloadPdf');
  const errorBack = document.getElementById('errorBack');
  const retryReader = document.getElementById('retryReader');
  const errorDirect = document.getElementById('errorDirect');

  let pdfDocument = null;
  let pageObserver = null;
  let currentPage = 1;
  let zoom = 1;
  let fitWidthPixels = 0;
  let renderGeneration = 0;
  const visibleRatios = new Map();
  const renderTasks = new Map();
  const renderedPages = new Set();

  const pdfJsSources = [
    {
      script: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
      worker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
    },
    {
      script: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
      worker: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'
    },
    {
      script: 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js',
      worker: 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js'
    }
  ];

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
    try {
      referrer = document.referrer ? new URL(document.referrer, window.location.href) : null;
    } catch {
      referrer = null;
    }

    if (window.history.length > 1 && referrer?.origin === window.location.origin) {
      window.history.back();
      return;
    }
    window.location.assign(resolvedReturn());
  }

  function showStatus(message) {
    readerStatus.textContent = message;
    readerStatus.hidden = false;
  }

  function hideStatus() {
    readerStatus.hidden = true;
  }

  function showError(message) {
    hideStatus();
    readerErrorText.textContent = message;
    readerError.style.display = 'block';
  }

  function clearError() {
    readerError.style.display = 'none';
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.onload = () => resolve();
      script.onerror = () => {
        script.remove();
        reject(new Error(`Could not load ${src}`));
      };
      document.head.appendChild(script);
    });
  }

  async function loadPdfJs() {
    if (window.pdfjsLib?.getDocument) return window.pdfjsLib;

    for (const source of pdfJsSources) {
      try {
        showStatus('Loading the multipage reader…');
        await loadScript(source.script);
        if (!window.pdfjsLib?.getDocument) throw new Error('PDF.js did not initialize.');
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = source.worker;
        return window.pdfjsLib;
      } catch (error) {
        console.warn(error);
      }
    }

    throw new Error('The reader engine could not be downloaded from any of its backup locations.');
  }

  function calculateFitWidth() {
    fitWidthPixels = Math.max(280, Math.min(1100, pdfScroll.clientWidth - 18));
  }

  function createPageShells(totalPages) {
    pdfPages.replaceChildren();
    calculateFitWidth();

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      const shell = document.createElement('section');
      shell.className = 'pdf-page';
      shell.id = `pdf-page-${pageNumber}`;
      shell.dataset.pageNumber = String(pageNumber);
      shell.dataset.renderGeneration = '-1';
      shell.style.width = `${Math.round(fitWidthPixels * zoom)}px`;
      shell.style.minHeight = `${Math.round(fitWidthPixels * zoom * 1.294)}px`;

      const number = document.createElement('span');
      number.className = 'pdf-page-number';
      number.textContent = String(pageNumber);

      const loading = document.createElement('div');
      loading.className = 'pdf-page-loading';
      loading.textContent = `Page ${pageNumber}`;

      shell.append(number, loading);
      pdfPages.appendChild(shell);
    }
  }

  function updateNavigation() {
    const total = pdfDocument?.numPages || 0;
    pageReadout.textContent = total ? `${currentPage} / ${total}` : '— / —';
    prevPage.disabled = !total || currentPage <= 1;
    nextPage.disabled = !total || currentPage >= total;
    zoomReadout.textContent = `${Math.round(zoom * 100)}%`;
  }

  function setCurrentPage(pageNumber) {
    if (!pdfDocument) return;
    const next = Math.max(1, Math.min(pdfDocument.numPages, Number(pageNumber) || 1));
    if (next !== currentPage) currentPage = next;
    updateNavigation();
    trimDistantCanvases();
  }

  function scrollToPage(pageNumber) {
    const shell = document.getElementById(`pdf-page-${pageNumber}`);
    if (!shell) return;
    setCurrentPage(pageNumber);
    shell.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'center' });
    renderPage(pageNumber).catch((error) => console.warn(error));
  }

  function updateCurrentFromVisibility() {
    let bestPage = currentPage;
    let bestRatio = -1;
    for (const [pageNumber, ratio] of visibleRatios.entries()) {
      if (ratio > bestRatio) {
        bestRatio = ratio;
        bestPage = pageNumber;
      }
    }
    setCurrentPage(bestPage);
  }

  function startObservers() {
    pageObserver?.disconnect();
    visibleRatios.clear();

    pageObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const pageNumber = Number(entry.target.dataset.pageNumber);
        if (entry.isIntersecting) {
          visibleRatios.set(pageNumber, entry.intersectionRatio);
          renderPage(pageNumber).catch((error) => console.warn(error));
          renderPage(pageNumber - 1).catch(() => {});
          renderPage(pageNumber + 1).catch(() => {});
        } else {
          visibleRatios.delete(pageNumber);
        }
      }
      updateCurrentFromVisibility();
    }, {
      root: pdfScroll,
      rootMargin: '120% 0px 120% 0px',
      threshold: [0.01, 0.15, 0.35, 0.6]
    });

    document.querySelectorAll('.pdf-page').forEach((page) => pageObserver.observe(page));
  }

  async function renderPage(pageNumber, force = false) {
    if (!pdfDocument || pageNumber < 1 || pageNumber > pdfDocument.numPages) return;

    const shell = document.getElementById(`pdf-page-${pageNumber}`);
    if (!shell) return;

    const requestedGeneration = renderGeneration;
    const existingGeneration = Number(shell.dataset.renderGeneration);
    if (!force && renderedPages.has(pageNumber) && existingGeneration === requestedGeneration) return;
    if (renderTasks.has(pageNumber)) return renderTasks.get(pageNumber);

    const task = (async () => {
      const page = await pdfDocument.getPage(pageNumber);
      if (requestedGeneration !== renderGeneration) return;

      const baseViewport = page.getViewport({ scale: 1 });
      const cssWidth = fitWidthPixels * zoom;
      const cssScale = cssWidth / baseViewport.width;
      const cssViewport = page.getViewport({ scale: cssScale });
      const outputScale = Math.min(window.devicePixelRatio || 1, 1.75);
      const renderViewport = page.getViewport({ scale: cssScale * outputScale });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('Canvas is unavailable in this browser.');

      canvas.width = Math.max(1, Math.floor(renderViewport.width));
      canvas.height = Math.max(1, Math.floor(renderViewport.height));
      canvas.style.width = `${Math.round(cssViewport.width)}px`;
      canvas.style.height = `${Math.round(cssViewport.height)}px`;

      shell.style.width = `${Math.round(cssViewport.width)}px`;
      shell.style.height = `${Math.round(cssViewport.height)}px`;
      shell.style.minHeight = '0';

      const numberBadge = shell.querySelector('.pdf-page-number');
      const oldCanvas = shell.querySelector('canvas');
      if (oldCanvas) oldCanvas.remove();
      shell.appendChild(canvas);
      if (numberBadge) shell.appendChild(numberBadge);

      const renderTask = page.render({ canvasContext: context, viewport: renderViewport });
      renderTasks.set(pageNumber, renderTask.promise);
      await renderTask.promise;

      if (requestedGeneration !== renderGeneration) {
        canvas.remove();
        return;
      }

      shell.querySelector('.pdf-page-loading')?.remove();
      shell.dataset.renderGeneration = String(requestedGeneration);
      shell.dataset.baseWidth = String(cssViewport.width / zoom);
      shell.dataset.baseHeight = String(cssViewport.height / zoom);
      renderedPages.add(pageNumber);
    })().finally(() => {
      renderTasks.delete(pageNumber);
    });

    renderTasks.set(pageNumber, task);
    return task;
  }

  function trimDistantCanvases() {
    if (renderedPages.size <= 12) return;

    for (const pageNumber of Array.from(renderedPages)) {
      if (Math.abs(pageNumber - currentPage) <= 5) continue;
      const shell = document.getElementById(`pdf-page-${pageNumber}`);
      const canvas = shell?.querySelector('canvas');
      if (!shell || !canvas) continue;

      canvas.width = 1;
      canvas.height = 1;
      canvas.remove();
      if (!shell.querySelector('.pdf-page-loading')) {
        const loading = document.createElement('div');
        loading.className = 'pdf-page-loading';
        loading.textContent = `Page ${pageNumber}`;
        shell.appendChild(loading);
      }
      shell.dataset.renderGeneration = '-1';
      renderedPages.delete(pageNumber);
    }
  }

  function applyZoom(nextZoom) {
    zoom = Math.max(0.65, Math.min(2.5, Math.round(nextZoom * 100) / 100));
    renderGeneration += 1;
    updateNavigation();

    document.querySelectorAll('.pdf-page').forEach((shell) => {
      const baseWidth = Number(shell.dataset.baseWidth) || fitWidthPixels;
      const baseHeight = Number(shell.dataset.baseHeight) || fitWidthPixels * 1.294;
      const width = baseWidth * zoom;
      const height = baseHeight * zoom;
      shell.style.width = `${Math.round(width)}px`;
      shell.style.height = `${Math.round(height)}px`;
      shell.style.minHeight = '0';

      const canvas = shell.querySelector('canvas');
      if (canvas) {
        canvas.style.width = `${Math.round(width)}px`;
        canvas.style.height = `${Math.round(height)}px`;
      }
    });

    renderPage(currentPage, true).catch((error) => console.warn(error));
    renderPage(currentPage - 1, true).catch(() => {});
    renderPage(currentPage + 1, true).catch(() => {});
  }

  let resizeTimer = null;
  function handleResize() {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      const oldFit = fitWidthPixels || 1;
      calculateFitWidth();
      if (Math.abs(fitWidthPixels - oldFit) < 8) return;

      renderGeneration += 1;
      for (const pageNumber of Array.from(renderedPages)) {
        const shell = document.getElementById(`pdf-page-${pageNumber}`);
        const canvas = shell?.querySelector('canvas');
        canvas?.remove();
        if (shell && !shell.querySelector('.pdf-page-loading')) {
          const loading = document.createElement('div');
          loading.className = 'pdf-page-loading';
          loading.textContent = `Page ${pageNumber}`;
          shell.appendChild(loading);
        }
        if (shell) {
          shell.dataset.renderGeneration = '-1';
          shell.dataset.baseWidth = '';
          shell.dataset.baseHeight = '';
          shell.style.width = `${Math.round(fitWidthPixels * zoom)}px`;
          shell.style.height = `${Math.round(fitWidthPixels * zoom * 1.294)}px`;
        }
      }
      renderedPages.clear();
      renderPage(currentPage, true).catch((error) => console.warn(error));
      scrollToPage(currentPage);
    }, 250);
  }

  async function openDocument() {
    clearError();
    pdfPages.replaceChildren();
    visibleRatios.clear();
    renderedPages.clear();
    renderGeneration += 1;
    currentPage = 1;
    updateNavigation();

    const source = resolvedSource();
    if (!source) {
      readerTitle.textContent = 'Invalid PDF link';
      showError('The PDF address is missing or invalid.');
      return;
    }

    const directUrl = source.href;
    openOriginal.href = directUrl;
    errorDirect.href = directUrl;
    downloadPdf.href = directUrl;
    downloadPdf.download = decodeURIComponent(source.pathname.split('/').pop() || 'document.pdf');

    try {
      const pdfjsLib = await loadPdfJs();
      showStatus('Opening the PDF…');

      const loadingTask = pdfjsLib.getDocument({
        url: directUrl,
        cMapPacked: true,
        useSystemFonts: true
      });

      pdfDocument = await loadingTask.promise;
      createPageShells(pdfDocument.numPages);
      updateNavigation();
      startObservers();
      hideStatus();
      await renderPage(1, true);
      renderPage(2).catch(() => {});
    } catch (error) {
      console.error(error);
      showError(error?.message || 'The PDF could not be loaded by the multipage reader.');
    }
  }

  readerTitle.textContent = requestedTitle;
  document.title = `${requestedTitle} | PDF Reader`;

  backButton.addEventListener('click', goBack);
  errorBack.addEventListener('click', goBack);
  retryReader.addEventListener('click', openDocument);
  prevPage.addEventListener('click', () => scrollToPage(currentPage - 1));
  nextPage.addEventListener('click', () => scrollToPage(currentPage + 1));
  zoomOut.addEventListener('click', () => applyZoom(zoom - 0.15));
  zoomIn.addEventListener('click', () => applyZoom(zoom + 0.15));
  fitWidth.addEventListener('click', () => applyZoom(1));
  fullScreen.addEventListener('click', async () => {
    try {
      if (!document.fullscreenElement) {
        await readerStage.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // iPhone Safari may not expose fullscreen for page elements.
    }
  });
  window.addEventListener('resize', handleResize, { passive: true });

  openDocument();
})();
