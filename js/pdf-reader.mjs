const params = new URLSearchParams(window.location.search);
const sourceUrl = params.get('url') || '';
const requestedTitle = params.get('title') || 'PDF document';
const returnUrl = params.get('return') || '/';

const readerTitle = document.getElementById('readerTitle');
const readerMain = document.getElementById('readerMain');
const pageList = document.getElementById('pageList');
const pageStatus = document.getElementById('pageStatus');
const loadStatus = document.getElementById('loadStatus');
const zoomOut = document.getElementById('zoomOut');
const zoomReset = document.getElementById('zoomReset');
const zoomIn = document.getElementById('zoomIn');
const fitWidth = document.getElementById('fitWidth');
const backButton = document.getElementById('backButton');
const previousPage = document.getElementById('previousPage');
const nextPage = document.getElementById('nextPage');
const fullScreen = document.getElementById('fullScreen');
const zoomLabel = document.getElementById('zoomLabel');
const openOriginal = document.getElementById('openOriginal');
const downloadPdf = document.getElementById('downloadPdf');

let pdfjsLib = null;
let pdfDocument = null;
let userZoom = 1;
let renderGeneration = 0;
let observer = null;
let resizeTimer = null;
let currentPageNumber = 1;
const pageShells = new Map();
const renderTasks = new Map();

const minZoom = 0.55;
const maxZoom = 2.2;
const zoomStep = 0.1;

function safeSource() {
  try {
    const url = new URL(sourceUrl, window.location.href);
    url.hash = '';
    return url;
  } catch {
    return null;
  }
}

function safeReturn() {
  try {
    const url = new URL(returnUrl, window.location.href);
    return url.origin === window.location.origin ? url.href : '/';
  } catch {
    return '/';
  }
}

function setControlsDisabled(disabled) {
  [zoomOut, zoomReset, zoomIn, fitWidth, previousPage, nextPage].forEach((button) => {
    if (button) button.disabled = disabled;
  });
}

function addFallbackButtons(container) {
  const actions = document.createElement('div');
  actions.className = 'reader-error-actions';

  const direct = document.createElement('a');
  direct.textContent = 'Open PDF Directly';
  direct.href = safeSource()?.href || sourceUrl;
  direct.target = '_blank';
  direct.rel = 'noopener';
  direct.dataset.directPdf = '';

  const retry = document.createElement('button');
  retry.type = 'button';
  retry.textContent = 'Retry Reader';
  retry.addEventListener('click', () => window.location.reload());

  const back = document.createElement('button');
  back.type = 'button';
  back.textContent = 'Back to Previous Page';
  back.addEventListener('click', goBack);

  actions.append(back, direct, retry);
  container.appendChild(actions);
}

function showError(message, detail = '') {
  pageList.innerHTML = '';
  const error = document.createElement('div');
  error.className = 'reader-error';

  const heading = document.createElement('strong');
  heading.textContent = message;
  error.appendChild(heading);

  if (detail) {
    const paragraph = document.createElement('p');
    paragraph.textContent = detail;
    error.appendChild(paragraph);
  }

  if (sourceUrl) addFallbackButtons(error);
  pageList.appendChild(error);
  loadStatus.textContent = 'Unable to display PDF';
  pageStatus.textContent = 'Reader error';
  setControlsDisabled(true);
}

function updateZoomLabel() {
  zoomLabel.textContent = `${Math.round(userZoom * 100)}%`;
}

function updatePageButtons() {
  previousPage.disabled = !pdfDocument || currentPageNumber <= 1;
  nextPage.disabled = !pdfDocument || currentPageNumber >= pdfDocument.numPages;
}

function cancelRenderTasks() {
  for (const task of renderTasks.values()) {
    try { task.cancel(); } catch {}
  }
  renderTasks.clear();
}

function clearRenderedPages() {
  cancelRenderTasks();
  renderGeneration += 1;
  for (const shell of pageShells.values()) {
    shell.dataset.renderedGeneration = '';
    const canvas = shell.querySelector('canvas');
    const loading = shell.querySelector('.page-loading');
    canvas.width = 0;
    canvas.height = 0;
    canvas.style.width = '';
    canvas.style.height = '';
    loading.hidden = false;
    loading.textContent = 'Loading page…';
  }
}

async function importReaderEngine() {
  try {
    pdfjsLib = await import('/pdfjs/legacy/build/pdf.mjs');
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/legacy/build/pdf.worker.mjs';
  } catch (error) {
    console.error('PDF.js import failed', error);
    throw new Error('The PDF.js engine is unavailable. Confirm that the app is running through server.js and that pdfjs-dist is installed.');
  }
}

async function readResponseBytes(response) {
  const type = response.headers.get('content-type') || '';
  if (!response.ok) throw new Error(`The PDF request returned HTTP ${response.status}.`);
  if (!type.includes('application/pdf') && !type.includes('application/octet-stream')) {
    throw new Error(`The server returned ${type || 'an unknown file type'} instead of a PDF.`);
  }

  const total = Number(response.headers.get('content-length') || 0);
  if (!response.body) return new Uint8Array(await response.arrayBuffer());

  const reader = response.body.getReader();
  const chunks = [];
  let loaded = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    loadStatus.textContent = total > 0
      ? `Downloading ${Math.min(100, Math.round((loaded / total) * 100))}%`
      : `Downloading ${Math.round(loaded / 1024).toLocaleString()} KB`;
  }
  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function fetchPdfBytes() {
  const resolved = safeSource();
  if (!resolved) throw new Error('The PDF address is invalid.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  const isLocal = resolved.origin === window.location.origin;

  async function request(url) {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
      headers: { Accept: 'application/pdf' }
    });
    return readResponseBytes(response);
  }

  try {
    let bytes;
    if (isLocal) {
      bytes = await request(resolved.href);
    } else {
      try {
        loadStatus.textContent = 'Connecting to document…';
        bytes = await request(resolved.href);
      } catch (directError) {
        console.info('Direct external PDF request failed; trying the archive proxy.', directError);
        loadStatus.textContent = 'Connecting through archive reader…';
        bytes = await request(`/pdf-proxy?url=${encodeURIComponent(resolved.href)}`);
      }
    }

    const signature = new TextDecoder('ascii').decode(bytes.slice(0, 5));
    if (signature !== '%PDF-') throw new Error('The requested file was not a valid PDF.');
    return bytes;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('The PDF took longer than 90 seconds to load.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function createPageShell(pageNumber) {
  const shell = document.createElement('section');
  shell.className = 'pdf-page';
  shell.dataset.pageNumber = String(pageNumber);
  shell.dataset.renderedGeneration = '';

  const label = document.createElement('span');
  label.className = 'page-label';
  label.textContent = `Page ${pageNumber}`;

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-label', `PDF page ${pageNumber}`);

  const loading = document.createElement('span');
  loading.className = 'page-loading';
  loading.textContent = 'Loading page…';

  shell.append(label, canvas, loading);
  pageShells.set(pageNumber, shell);
  return shell;
}

function createPageShells(pageCount) {
  pageList.innerHTML = '';
  pageShells.clear();
  observer?.disconnect();

  const fragment = document.createDocumentFragment();
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) fragment.appendChild(createPageShell(pageNumber));
  pageList.appendChild(fragment);

  observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) renderPage(Number(entry.target.dataset.pageNumber), entry.target);
    }
  }, { root: readerMain, rootMargin: '120% 0px', threshold: 0.01 });

  for (const shell of pageShells.values()) observer.observe(shell);
}

async function calculateScale(page) {
  const base = page.getViewport({ scale: 1 });
  const padding = window.innerWidth <= 760 ? 16 : 34;
  const available = Math.max(260, readerMain.clientWidth - padding);
  return (available / base.width) * userZoom;
}

async function renderPage(pageNumber, shell) {
  if (!pdfDocument) return;
  const generation = renderGeneration;
  if (shell.dataset.renderedGeneration === String(generation)) return;
  shell.dataset.renderedGeneration = String(generation);

  const canvas = shell.querySelector('canvas');
  const loading = shell.querySelector('.page-loading');
  try {
    const page = await pdfDocument.getPage(pageNumber);
    if (generation !== renderGeneration) return;

    const scale = await calculateScale(page);
    const viewport = page.getViewport({ scale });
    const outputScale = Math.min(window.devicePixelRatio || 1, 1.7);

    canvas.width = Math.max(1, Math.floor(viewport.width * outputScale));
    canvas.height = Math.max(1, Math.floor(viewport.height * outputScale));
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;
    shell.style.minHeight = `${Math.floor(viewport.height)}px`;

    const transform = outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0];
    const task = page.render({ canvas, viewport, transform, background: 'rgb(255,255,255)' });
    renderTasks.set(pageNumber, task);
    await task.promise;
    renderTasks.delete(pageNumber);
    if (generation !== renderGeneration) return;
    loading.hidden = true;
  } catch (error) {
    renderTasks.delete(pageNumber);
    if (error?.name === 'RenderingCancelledException') return;
    console.error(`Page ${pageNumber} render failed`, error);
    shell.dataset.renderedGeneration = '';
    loading.hidden = false;
    loading.textContent = `Page ${pageNumber} could not be rendered.`;
  }
}

function renderNearbyPages() {
  const top = -window.innerHeight;
  const bottom = window.innerHeight * 2;
  for (const [pageNumber, shell] of pageShells.entries()) {
    const rect = shell.getBoundingClientRect();
    if (rect.bottom >= top && rect.top <= bottom) renderPage(pageNumber, shell);
  }
}

function setZoom(next) {
  userZoom = Math.min(maxZoom, Math.max(minZoom, next));
  updateZoomLabel();
  clearRenderedPages();
  requestAnimationFrame(renderNearbyPages);
}

function scrollToPage(pageNumber) {
  if (!pdfDocument) return;
  const next = Math.min(pdfDocument.numPages, Math.max(1, pageNumber));
  pageShells.get(next)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function goBack() {
  const referrer = document.referrer ? new URL(document.referrer, window.location.href) : null;
  if (window.history.length > 1 && referrer?.origin === window.location.origin) {
    window.history.back();
    return;
  }
  window.location.assign(safeReturn());
}

async function loadPdf() {
  readerTitle.textContent = requestedTitle;
  document.title = `${requestedTitle} | PDF Reader`;
  setControlsDisabled(true);

  const resolved = safeSource();
  if (!resolved) {
    showError('No valid PDF address was supplied to the reader.');
    return;
  }

  openOriginal.href = resolved.href;
  downloadPdf.href = resolved.href;
  downloadPdf.download = decodeURIComponent(resolved.pathname.split('/').pop() || 'document.pdf');

  try {
    loadStatus.textContent = 'Starting reader…';
    await importReaderEngine();
    loadStatus.textContent = 'Loading document…';
    const bytes = await fetchPdfBytes();
    loadStatus.textContent = 'Opening document…';

    const task = pdfjsLib.getDocument({
      data: bytes,
      cMapUrl: '/pdfjs/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: '/pdfjs/standard_fonts/',
      wasmUrl: '/pdfjs/wasm/'
    });
    pdfDocument = await task.promise;

    createPageShells(pdfDocument.numPages);
    currentPageNumber = 1;
    pageStatus.textContent = `Page 1 of ${pdfDocument.numPages}`;
    loadStatus.textContent = `${pdfDocument.numPages} page${pdfDocument.numPages === 1 ? '' : 's'}`;
    setControlsDisabled(false);
    updateZoomLabel();
    updatePageButtons();

    const firstShell = pageShells.get(1);
    if (firstShell) await renderPage(1, firstShell);
    requestAnimationFrame(renderNearbyPages);
  } catch (error) {
    console.error('PDF reader failed', error);
    showError('The PDF reader could not open this file.', error?.message || String(error));
  }
}

zoomOut.addEventListener('click', () => setZoom(userZoom - zoomStep));
zoomIn.addEventListener('click', () => setZoom(userZoom + zoomStep));
zoomReset.addEventListener('click', () => setZoom(1));
fitWidth.addEventListener('click', () => setZoom(1));
backButton.addEventListener('click', goBack);
previousPage.addEventListener('click', () => scrollToPage(currentPageNumber - 1));
nextPage.addEventListener('click', () => scrollToPage(currentPageNumber + 1));
fullScreen.addEventListener('click', async () => {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  } catch {}
});

readerMain.addEventListener('scroll', () => {
  requestAnimationFrame(() => {
    renderNearbyPages();
    if (!pdfDocument) return;
    let nearest = 1;
    let distance = Infinity;
    const mainTop = readerMain.getBoundingClientRect().top;
    for (const [pageNumber, shell] of pageShells.entries()) {
      const value = Math.abs(shell.getBoundingClientRect().top - mainTop - 60);
      if (value < distance) { distance = value; nearest = pageNumber; }
    }
    currentPageNumber = nearest;
    pageStatus.textContent = `Page ${nearest} of ${pdfDocument.numPages}`;
    updatePageButtons();
  });
}, { passive: true });

window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    clearRenderedPages();
    renderNearbyPages();
  }, 180);
});

loadPdf();
