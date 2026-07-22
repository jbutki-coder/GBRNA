import * as pdfjsLib from "/pdfjs/legacy/build/pdf.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "/pdfjs/legacy/build/pdf.worker.mjs";

const params = new URLSearchParams(window.location.search);
const sourceUrl = params.get("url") || "";
const requestedTitle = params.get("title") || "Archive PDF";

const readerTitle = document.getElementById("readerTitle");
const readerMain = document.getElementById("readerMain");
const pageList = document.getElementById("pageList");
const pageStatus = document.getElementById("pageStatus");
const loadStatus = document.getElementById("loadStatus");

const zoomOut = document.getElementById("zoomOut");
const zoomReset = document.getElementById("zoomReset");
const zoomIn = document.getElementById("zoomIn");
const fitWidth = document.getElementById("fitWidth");
const closeReader = document.getElementById("closeReader");
const zoomLabel = document.getElementById("zoomLabel");

let pdfDocument = null;
let userZoom = 1;
let fitMode = true;
let renderGeneration = 0;
let activePage = 1;
let observer = null;
let resizeTimer = null;

const minZoom = 0.5;
const maxZoom = 2.0;
const zoomStep = 0.1;
const renderTasks = new Map();
const pageShells = new Map();

function setControlsDisabled(disabled) {
  [zoomOut, zoomReset, zoomIn, fitWidth].forEach((button) => {
    button.disabled = disabled;
  });
}

function showError(message) {
  pageList.innerHTML = "";

  const error = document.createElement("div");
  error.className = "reader-error";
  error.textContent = message;

  pageList.appendChild(error);
  loadStatus.textContent = "Unable to display PDF";
  pageStatus.textContent = "Reader error";
  setControlsDisabled(true);
}

function buildProxyUrl(url) {
  return `/pdf-proxy?url=${encodeURIComponent(url)}`;
}

function updateZoomLabel() {
  zoomLabel.textContent = fitMode
    ? `Fit ${Math.round(userZoom * 100)}%`
    : `${Math.round(userZoom * 100)}%`;
}

function cancelRenderTasks() {
  for (const task of renderTasks.values()) {
    try {
      task.cancel();
    } catch {
      // A completed task cannot always be cancelled.
    }
  }

  renderTasks.clear();
}

function clearRenderedPages() {
  cancelRenderTasks();
  renderGeneration += 1;

  for (const shell of pageShells.values()) {
    shell.dataset.renderedGeneration = "";
    const canvas = shell.querySelector("canvas");
    const loading = shell.querySelector(".page-loading");

    canvas.width = 0;
    canvas.height = 0;
    canvas.style.width = "";
    canvas.style.height = "";

    loading.hidden = false;
    loading.textContent = "Loading page…";
  }
}

function getVisibleShells() {
  const viewportTop = -window.innerHeight;
  const viewportBottom = window.innerHeight * 2;

  return [...pageShells.values()].filter((shell) => {
    const rect = shell.getBoundingClientRect();
    return rect.bottom >= viewportTop && rect.top <= viewportBottom;
  });
}

async function calculateScale(page) {
  const baseViewport = page.getViewport({ scale: 1 });
  const horizontalPadding = window.innerWidth <= 680 ? 16 : 34;
  const availableWidth = Math.max(
    260,
    readerMain.clientWidth - horizontalPadding
  );

  const fitScale = availableWidth / baseViewport.width;

  return fitMode
    ? fitScale * userZoom
    : userZoom;
}

async function renderPage(pageNumber, shell) {
  if (!pdfDocument) return;

  const generation = renderGeneration;

  if (shell.dataset.renderedGeneration === String(generation)) {
    return;
  }

  shell.dataset.renderedGeneration = String(generation);

  const canvas = shell.querySelector("canvas");
  const loading = shell.querySelector(".page-loading");

  try {
    const page = await pdfDocument.getPage(pageNumber);

    if (generation !== renderGeneration) return;

    const scale = await calculateScale(page);
    const viewport = page.getViewport({ scale });

    const outputScale = Math.min(window.devicePixelRatio || 1, 2);
    const context = canvas.getContext("2d", {
      alpha: false,
      willReadFrequently: false
    });

    canvas.width = Math.max(1, Math.floor(viewport.width * outputScale));
    canvas.height = Math.max(1, Math.floor(viewport.height * outputScale));
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;

    shell.style.minHeight = `${Math.floor(viewport.height)}px`;

    const transform = outputScale === 1
      ? null
      : [outputScale, 0, 0, outputScale, 0, 0];

    const renderTask = page.render({
      canvasContext: context,
      viewport,
      transform,
      background: "rgb(255,255,255)"
    });

    renderTasks.set(pageNumber, renderTask);
    await renderTask.promise;
    renderTasks.delete(pageNumber);

    if (generation !== renderGeneration) return;

    loading.hidden = true;
  } catch (error) {
    renderTasks.delete(pageNumber);

    if (error?.name === "RenderingCancelledException") {
      return;
    }

    shell.dataset.renderedGeneration = "";
    loading.hidden = false;
    loading.textContent = `Page ${pageNumber} could not be rendered.`;
    console.error(error);
  }
}

function renderVisiblePages() {
  for (const shell of getVisibleShells()) {
    const pageNumber = Number(shell.dataset.pageNumber);
    renderPage(pageNumber, shell);
  }
}

function createPageShells(pageCount) {
  pageList.innerHTML = "";
  pageShells.clear();

  observer?.disconnect();

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;

        const shell = entry.target;
        const pageNumber = Number(shell.dataset.pageNumber);
        renderPage(pageNumber, shell);
      }
    },
    {
      root: readerMain,
      rootMargin: "140% 0px",
      threshold: 0.01
    }
  );

  const fragment = document.createDocumentFragment();

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const shell = document.createElement("section");
    shell.className = "pdf-page";
    shell.dataset.pageNumber = String(pageNumber);
    shell.dataset.renderedGeneration = "";

    const label = document.createElement("span");
    label.className = "page-label";
    label.textContent = `Page ${pageNumber}`;

    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-label", `PDF page ${pageNumber}`);

    const loading = document.createElement("span");
    loading.className = "page-loading";
    loading.textContent = "Loading page…";

    shell.append(label, canvas, loading);
    fragment.appendChild(shell);

    pageShells.set(pageNumber, shell);
    observer.observe(shell);
  }

  pageList.appendChild(fragment);
}

function setZoom(nextZoom, useFitMode = fitMode) {
  userZoom = Math.min(maxZoom, Math.max(minZoom, nextZoom));
  fitMode = useFitMode;
  updateZoomLabel();
  clearRenderedPages();
  requestAnimationFrame(renderVisiblePages);
}

function updateActivePage() {
  const readerRect = readerMain.getBoundingClientRect();
  const targetY = readerRect.top + 70;

  let closestPage = 1;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const [pageNumber, shell] of pageShells.entries()) {
    const rect = shell.getBoundingClientRect();
    const distance = Math.abs(rect.top - targetY);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestPage = pageNumber;
    }
  }

  activePage = closestPage;

  if (pdfDocument) {
    pageStatus.textContent =
      `Page ${activePage} of ${pdfDocument.numPages}`;
  }
}

async function loadPdf() {
  readerTitle.textContent = requestedTitle;
  setControlsDisabled(true);

  if (!sourceUrl) {
    showError("No PDF address was supplied to the reader.");
    return;
  }

  try {
    const loadingTask = pdfjsLib.getDocument({
      url: buildProxyUrl(sourceUrl),
      cMapUrl: "/pdfjs/cmaps/",
      cMapPacked: true,
      standardFontDataUrl: "/pdfjs/standard_fonts/",
      wasmUrl: "/pdfjs/wasm/",
      rangeChunkSize: 65536,
      disableAutoFetch: false,
      disableStream: false
    });

    loadingTask.onProgress = ({ loaded, total }) => {
      if (total > 0) {
        const percent = Math.min(100, Math.round((loaded / total) * 100));
        loadStatus.textContent = `Loading ${percent}%`;
      } else {
        loadStatus.textContent = "Loading document…";
      }
    };

    pdfDocument = await loadingTask.promise;

    createPageShells(pdfDocument.numPages);
    pageStatus.textContent = `Page 1 of ${pdfDocument.numPages}`;
    loadStatus.textContent =
      `${pdfDocument.numPages} page${pdfDocument.numPages === 1 ? "" : "s"}`;

    setControlsDisabled(false);
    updateZoomLabel();

    requestAnimationFrame(renderVisiblePages);
  } catch (error) {
    console.error(error);

    showError(
      "The PDF could not be loaded. The archive file may be unavailable, " +
      "or the site proxy may not be running yet."
    );
  }
}

zoomOut.addEventListener("click", () => {
  setZoom(userZoom - zoomStep, fitMode);
});

zoomIn.addEventListener("click", () => {
  setZoom(userZoom + zoomStep, fitMode);
});

zoomReset.addEventListener("click", () => {
  setZoom(1, true);
});

fitWidth.addEventListener("click", () => {
  setZoom(1, true);
});

closeReader.addEventListener("click", () => {
  window.parent.postMessage(
    { type: "gbr-close-pdf-reader" },
    window.location.origin
  );
});

readerMain.addEventListener(
  "scroll",
  () => {
    window.requestAnimationFrame(updateActivePage);
  },
  { passive: true }
);

window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);

  resizeTimer = setTimeout(() => {
    clearRenderedPages();
    renderVisiblePages();
  }, 180);
});

loadPdf();
