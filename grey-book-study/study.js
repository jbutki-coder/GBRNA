"use strict";

const state = {
  groups: { chapters: [], steps: [], traditions: [], bottom: [] },
  sectionMap: new Map(),
  activeItem: "",
  query: ""
};

const els = {
  screenTabs: document.querySelector("[data-screen-tabs]"),
  content: document.querySelector("[data-content]"),
  loading: document.querySelector("[data-loading]"),
  title: document.querySelector("[data-active-title]"),
  group: document.querySelector("[data-active-group]"),
  meta: document.querySelector("[data-active-meta]"),
  search: document.querySelector("[data-search]"),
  sectionCount: document.querySelector("[data-section-count]"),
  paragraphCount: document.querySelector("[data-paragraph-count]")
};

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatPages(items) {
  const pages = new Set();
  items.forEach((item) => (item.pages || []).forEach((page) => pages.add(page)));
  return [...pages].join(", ");
}

function normalizeBlock(item) {
  const kind = item.kind || "text";
  const isHeading = kind.includes("heading") || /^[A-Z0-9 .,'?&-]{4,}$/.test(item.text || "");
  return {
    text: item.text || "",
    kind,
    isHeading,
    pages: item.pages || []
  };
}

function buildGroups(data) {
  const introBlocks = [
    { kind: "heading", text: "Grey Book Study" },
    { kind: "text", text: "Choose a Step, Tradition, or chapter button above. This layout mirrors the screen-share navigation with all buttons visible at once." },
    { kind: "text", text: "Chapter 1 is Who Is an Addict?, Chapter 2 is What Is the Narcotics Anonymous Program?, Chapter 3 is Why Are We Here?, and Chapter 4 is How It Works." }
  ];

  state.sectionMap = new Map((data.sections || []).map((section) => [
    section.id,
    {
      id: section.id,
      name: section.title,
      group: section.group,
      slug: section.slug || slugify(section.title),
      paragraphs: (section.blocks || []).map(normalizeBlock).filter((item) => item.text.trim()),
      pages: section.pages || ""
    }
  ]));
  state.sectionMap.set("home", {
    id: "home",
    name: "Grey Book Study Home",
    group: "home",
    slug: "home",
    paragraphs: introBlocks.map(normalizeBlock),
    pages: ""
  });
  state.sectionMap.set("gbr", {
    id: "gbr",
    name: "GBR",
    group: "daily",
    slug: "gbr",
    href: "/#today",
    paragraphs: [{ kind: "text", text: "Open the current Grey Book Reflection daily reading.", isHeading: false, pages: [] }],
    pages: ""
  });
  state.sectionMap.set("just-for-tonight", {
    id: "just-for-tonight",
    name: "Just For Tonight",
    group: "daily",
    slug: "just-for-tonight",
    href: "/jft.html",
    paragraphs: [{ kind: "text", text: "Open the current Just For Tonight daily reading.", isHeading: false, pages: [] }],
    pages: ""
  });
  state.sectionMap.set("keytags", {
    id: "keytags",
    name: "Keytags",
    group: "reading",
    slug: "keytags",
    href: "/lwb-draft/#keytags",
    paragraphs: [{ kind: "text", text: "Open the Keytags reading in the meeting readings section.", isHeading: false, pages: [] }],
    pages: ""
  });

  state.groups.steps = (data.groups?.steps || [])
    .map((id) => state.sectionMap.get(id))
    .filter(Boolean);
  state.groups.traditions = (data.groups?.traditions || [])
    .map((id) => state.sectionMap.get(id))
    .filter(Boolean);
  state.groups.bottom = [
    { label: "HOME", target: "home" },
    { label: "Who?", target: "chapter-1" },
    { label: "What?", target: "chapter-2" },
    { label: "Why?", target: "chapter-3" },
    { label: "How", target: "chapter-4" },
    { label: "Twelve Traditions", target: "chapter-6" },
    { label: "GBR", target: "gbr" },
    { label: "Just For Tonight", target: "just-for-tonight" },
    { label: "We Do Recover", target: "chapter-8" },
    { label: "Keytags", target: "keytags" }
  ];

  els.sectionCount.textContent = String(new Set([
    ...state.groups.steps.map((section) => section.name),
    ...state.groups.traditions.map((section) => section.name),
    "Who Is an Addict?",
    "What Is the Narcotics Anonymous Program?",
    "Why Are We Here?",
    "How It Works"
  ]).size);
  els.paragraphCount.textContent = String((data.sections || []).reduce((total, section) => total + (section.blocks || []).length, 0));
}

function allNavItems() {
  return [
    ...state.groups.steps.map((section) => ({ label: section.name, target: section.id })),
    ...state.groups.traditions.map((section) => ({ label: section.name, target: section.id })),
    ...state.groups.bottom
  ];
}

function navRows() {
  const query = state.query.trim().toLowerCase();
  const rows = [
    state.groups.steps.map((section) => ({ label: section.name, target: section.id })),
    state.groups.traditions.map((section) => ({ label: section.name, target: section.id })),
    state.groups.bottom
  ];
  if (!query) return rows;
  return rows.map((row) => row.filter((item) => {
    const section = state.sectionMap.get(item.target);
    return item.label.toLowerCase().includes(query) ||
      section?.name.toLowerCase().includes(query) ||
      section?.paragraphs.some((paragraph) => paragraph.text.toLowerCase().includes(query));
  }));
}

function setActive(target) {
  if (!state.sectionMap.has(target)) return;
  state.activeItem = target;
  render();
}

function labelHtml(label) {
  const parts = String(label).split(/\s+/);
  if ((label.startsWith("Step ") || label.startsWith("Tradition ")) && parts.length === 2) {
    return `${escapeHtml(parts[0])}<br>${escapeHtml(parts[1])}`;
  }
  if (label === "Twelve Traditions") return "Twelve<br>Traditions";
  if (label === "Just For Tonight") return "Just<br>For<br>Tonight";
  return escapeHtml(label);
}

function renderScreenTabs() {
  const rows = navRows();
  els.screenTabs.innerHTML = rows.map((row, rowIndex) => `
    <div class="grey-study-screen-row grey-study-screen-row-${rowIndex + 1}" role="tablist">
      ${row.map((item) => `
    <button
      type="button"
          class="${item.target === state.activeItem ? "is-active" : ""}"
          data-screen-tab="${escapeHtml(item.target)}"
      role="tab"
          aria-selected="${item.target === state.activeItem ? "true" : "false"}"
        >${labelHtml(item.label)}</button>
      `).join("")}
    </div>
  `).join("");
}

function renderContent() {
  const active = state.sectionMap.get(state.activeItem);
  els.loading.hidden = true;

  if (!active) {
    els.group.textContent = "Grey Book";
    els.title.textContent = "No matching Grey Book section";
    els.meta.textContent = "Clear the search box to return to the full study mirror.";
    els.content.innerHTML = '<div class="grey-study-empty">No matching section was found.</div>';
    return;
  }

  els.group.textContent = active.group === "steps"
    ? "Step"
    : active.group === "traditions"
      ? "Tradition"
      : "Grey Book";
  els.title.textContent = active.name;
  els.meta.textContent = `${active.paragraphs.length} text lines${active.pages ? ` | GBR pages ${active.pages}` : ""}`;
  const action = active.href ? `
    <p>
      <a class="grey-study-open-link" href="${escapeHtml(active.href)}">Open ${escapeHtml(active.name)}</a>
    </p>
  ` : "";
  els.content.innerHTML = active.paragraphs.map((paragraph) => {
    const pages = paragraph.pages.length ? `<span class="grey-study-page">GBR page ${escapeHtml(paragraph.pages.join(", "))}</span>` : "";
    if (paragraph.isHeading) {
      return `<article class="grey-study-paragraph is-heading"><h3>${escapeHtml(paragraph.text)}</h3>${pages}</article>`;
    }
    return `<article class="grey-study-paragraph"><p>${escapeHtml(paragraph.text)}</p>${pages}</article>`;
  }).join("") + action;
}

function render() {
  renderScreenTabs();
  renderContent();
}

function moveSection(direction) {
  const items = allNavItems().filter((item) => state.sectionMap.has(item.target));
  if (!items.length) return;
  const index = Math.max(0, items.findIndex((item) => item.target === state.activeItem));
  const nextIndex = (index + direction + items.length) % items.length;
  state.activeItem = items[nextIndex].target;
  render();
  document.querySelector(".grey-study-reader")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

document.addEventListener("click", (event) => {
  const sectionButton = event.target.closest("[data-screen-tab]");
  if (sectionButton) {
    setActive(sectionButton.dataset.screenTab);
    return;
  }

  if (event.target.closest("[data-prev-section]")) moveSection(-1);
  if (event.target.closest("[data-next-section]")) moveSection(1);

  if (event.target.closest("[data-theme-toggle]")) {
    document.body.classList.toggle("grey-study-dark");
  }
});

els.search?.addEventListener("input", () => {
  state.query = els.search.value;
  render();
});

fetch("/data/grey-form-study.json", { cache: "no-store" })
  .then((response) => {
    if (!response.ok) throw new Error(`Grey Form data returned ${response.status}`);
    return response.json();
  })
  .then((data) => {
    buildGroups(data);
    setActive("home");
  })
  .catch((error) => {
    console.error(error);
    els.loading.textContent = "The Grey Form study text could not be loaded. Try refreshing the page.";
  });
