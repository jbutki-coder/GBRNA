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

function mergeStudyBlocks(blocks) {
  const merged = [];
  let paragraph = null;

  const splitReadableParagraph = (block) => {
    if (block.isHeading || block.text.length <= 520 || typeof Intl?.Segmenter !== "function") {
      return [block];
    }

    const sentences = [...new Intl.Segmenter("en", { granularity: "sentence" }).segment(block.text)]
      .map((part) => part.segment.trim())
      .filter(Boolean);
    if (sentences.length < 2) return [block];

    const paragraphs = [];
    let text = "";
    sentences.forEach((sentence) => {
      const nextText = text ? `${text} ${sentence}` : sentence;
      if (text.length >= 260 && nextText.length > 520) {
        paragraphs.push({ ...block, text });
        text = sentence;
      } else {
        text = nextText;
      }
    });
    if (text) paragraphs.push({ ...block, text });
    return paragraphs;
  };

  const flushParagraph = () => {
    if (!paragraph) return;
    paragraph.text = paragraph.text.replace(/\s+/g, " ").trim();
    paragraph.pages = [...new Set(paragraph.pages)];
    if (paragraph.text) merged.push(...splitReadableParagraph(paragraph));
    paragraph = null;
  };

  blocks.map(normalizeBlock).forEach((block) => {
    const text = block.text.trim();
    if (!text) return;

    if (block.isHeading) {
      flushParagraph();
      merged.push({ ...block, text });
      return;
    }

    if (!paragraph) {
      paragraph = { ...block, text, pages: [...block.pages] };
    } else {
      const separator = paragraph.text.endsWith("-") ? "" : " ";
      paragraph.text += `${separator}${text}`;
      paragraph.pages.push(...block.pages);
    }

    if (/[.!?][\"')\]]?$/.test(text)) flushParagraph();
  });

  flushParagraph();
  return merged;
}

function buildGroups(data) {
  const introBlocks = [
    { kind: "heading", text: "Grey Book Study" },
    { kind: "text", text: "Choose a Step, Tradition, or chapter button above. This layout mirrors the screen-share navigation with all buttons visible at once." },
    { kind: "text", text: "Chapter 1 is Who Is an Addict?, Chapter 2 is What Is the Narcotics Anonymous Program?, Chapter 3 is Why Are We Here?, and Chapter 4 is How It Works." }
  ];

  const studySections = (data.sections || []).map((section) => ({
    ...section,
    mergedBlocks: mergeStudyBlocks(section.blocks || [])
  }));

  state.sectionMap = new Map(studySections.map((section) => [
    section.id,
    {
      id: section.id,
      name: section.title,
      group: section.group,
      slug: section.slug || slugify(section.title),
      paragraphs: section.mergedBlocks,
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
    openDirectly: true,
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
  els.paragraphCount.textContent = String(studySections.reduce(
    (total, section) => total + section.mergedBlocks.filter((block) => !block.isHeading).length,
    0
  ));
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

function setActive(target, updateHash = false) {
  if (!state.sectionMap.has(target)) return;
  state.activeItem = target;
  if (updateHash && location.hash !== `#${target}`) {
    history.replaceState(null, "", `#${target}`);
  }
  render();
}

function targetFromHash() {
  const target = decodeURIComponent(location.hash.replace(/^#/, "")).trim().toLowerCase();
  return state.sectionMap.has(target) ? target : "home";
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
  const visibleParagraphs = active.paragraphs.filter((paragraph, index) => !(
    index === 0 &&
    paragraph.isHeading &&
    slugify(paragraph.text) === slugify(active.name)
  ));
  const paragraphCount = visibleParagraphs.filter((paragraph) => !paragraph.isHeading).length;
  els.meta.textContent = `${paragraphCount} paragraphs${active.pages ? ` | GBR pages ${active.pages}` : ""}`;
  const action = active.href ? `
    <p>
      <a class="grey-study-open-link" href="${escapeHtml(active.href)}">Open ${escapeHtml(active.name)}</a>
    </p>
  ` : "";
  let bodyParagraphIndex = 0;
  els.content.innerHTML = visibleParagraphs.map((paragraph) => {
    const pages = paragraph.pages.length ? `<span class="grey-study-page">GBR page ${escapeHtml(paragraph.pages.join(", "))}</span>` : "";
    if (paragraph.isHeading) {
      return `<article class="grey-study-paragraph is-heading"><h3>${escapeHtml(paragraph.text)}</h3>${pages}</article>`;
    }
    const leadClass = bodyParagraphIndex === 0 && ["steps", "traditions"].includes(active.group)
      ? " is-lead"
      : "";
    bodyParagraphIndex += 1;
    return `<article class="grey-study-paragraph${leadClass}"><p>${escapeHtml(paragraph.text)}</p>${pages}</article>`;
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
    const target = sectionButton.dataset.screenTab;
    const section = state.sectionMap.get(target);
    if (section?.openDirectly && section.href) {
      location.href = section.href;
      return;
    }
    setActive(target, true);
    return;
  }

  if (event.target.closest("[data-prev-section]")) moveSection(-1);
  if (event.target.closest("[data-next-section]")) moveSection(1);

  if (event.target.closest("[data-theme-toggle]")) {
    const toggle = event.target.closest("[data-theme-toggle]");
    const darkModeOn = document.body.classList.toggle("grey-study-dark");
    toggle.setAttribute("aria-pressed", String(darkModeOn));
    toggle.textContent = darkModeOn ? "Light screen mode" : "Dark screen mode";
  }
});

els.search?.addEventListener("input", () => {
  state.query = els.search.value;
  render();
});

window.addEventListener("hashchange", () => {
  if (state.sectionMap.size) setActive(targetFromHash());
});

async function loadStudyData() {
  const paths = [
    "/grey-book-study/grey-form-study.json",
    "/data/grey-form-study.json"
  ];

  const errors = [];
  for (const path of paths) {
    try {
      const response = await fetch(path, { cache: "no-store" });
      if (response.ok) return response.json();
      errors.push(`${path} returned ${response.status}`);
    } catch (error) {
      errors.push(`${path} failed`);
    }
  }
  throw new Error(errors.join("; "));
}

loadStudyData()
  .then((data) => {
    buildGroups(data);
    setActive(targetFromHash());
  })
  .catch((error) => {
    console.error(error);
    els.loading.textContent = "The Grey Form study text could not be loaded. Try refreshing the page.";
  });
