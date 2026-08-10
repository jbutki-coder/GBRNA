"use strict";

const chapterOrder = [
  "Our N.A. Symbol",
  "Introduction",
  "Chapter One - Who Is an Addict?",
  "Chapter Two - What Is the Narcotics Anonymous Program?",
  "Chapter Three - Why Are We Here?",
  "Chapter Four - How It Works",
  "Chapter Five - What Can I Do?",
  "Chapter Six - The Twelve Traditions of N.A.",
  "Chapter Seven - Recovery and Relapse",
  "Chapter Eight - We Do Recover",
  "Chapter Nine - Just for Today",
  "Chapter Ten - More Will Be Revealed"
];

const stepOrder = [
  "Step One",
  "Step Two",
  "Step Three",
  "Step Four",
  "Step Five",
  "Step Six",
  "Step Seven",
  "Step Eight",
  "Step Nine",
  "Step Ten",
  "Step Eleven",
  "Step Twelve"
];

const relatedOrder = [
  "Our N.A. Symbol",
  "Introduction",
  "Chapter Six - The Twelve Traditions of N.A.",
  "Chapter Eight - We Do Recover",
  "Chapter Nine - Just for Today"
];

const groupLabels = {
  chapters: "Chapter",
  steps: "Step",
  related: "Related Reading"
};

const state = {
  groups: { chapters: [], steps: [], related: [] },
  activeGroup: "chapters",
  activeSlug: "",
  query: ""
};

const els = {
  subtabs: document.querySelector("[data-subtabs]"),
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

function normalizeParagraph(item) {
  const kind = item.kind || "";
  const isHeading = kind.includes("heading") || /^[A-Z0-9 .,'?&-]{4,}$/.test(item.text || "");
  return {
    text: item.text || "",
    kind,
    isHeading,
    pages: item.pages || []
  };
}

function makeSection(name, items, group) {
  const paragraphs = items.map(normalizeParagraph).filter((item) => item.text.trim());
  return {
    name,
    group,
    slug: slugify(name),
    paragraphs,
    pages: formatPages(items)
  };
}

function orderedSections(allSections, order, group) {
  return order
    .filter((name) => allSections.has(name))
    .map((name) => makeSection(name, allSections.get(name), group));
}

function buildGroups(data) {
  const bySection = new Map();
  Object.values(data.paragraphs || {}).forEach((item) => {
    if (!item.section) return;
    if (!bySection.has(item.section)) bySection.set(item.section, []);
    bySection.get(item.section).push(item);
  });

  state.groups.chapters = orderedSections(bySection, chapterOrder, "chapters");
  state.groups.steps = orderedSections(bySection, stepOrder, "steps");
  state.groups.related = orderedSections(bySection, relatedOrder, "related");

  els.sectionCount.textContent = String(new Set([
    ...state.groups.chapters.map((section) => section.name),
    ...state.groups.steps.map((section) => section.name)
  ]).size);
  els.paragraphCount.textContent = String(Object.keys(data.paragraphs || {}).length);
}

function currentSections() {
  return state.groups[state.activeGroup] || [];
}

function visibleSections() {
  const query = state.query.trim().toLowerCase();
  const sections = currentSections();
  if (!query) return sections;
  return sections.filter((section) =>
    section.name.toLowerCase().includes(query) ||
    section.paragraphs.some((paragraph) => paragraph.text.toLowerCase().includes(query))
  );
}

function setActive(group, slug) {
  const sections = state.groups[group] || [];
  if (!sections.length) return;
  state.activeGroup = group;
  state.activeSlug = slug || sections[0].slug;
  render();
}

function renderGroupTabs() {
  document.querySelectorAll("[data-group-tab]").forEach((button) => {
    const isActive = button.dataset.groupTab === state.activeGroup;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
}

function renderSubtabs() {
  const sections = visibleSections();
  if (!sections.some((section) => section.slug === state.activeSlug)) {
    state.activeSlug = sections[0]?.slug || "";
  }

  els.subtabs.innerHTML = sections.map((section) => `
    <button
      type="button"
      class="${section.slug === state.activeSlug ? "is-active" : ""}"
      data-section-tab="${escapeHtml(section.slug)}"
      role="tab"
      aria-selected="${section.slug === state.activeSlug ? "true" : "false"}"
    >${escapeHtml(section.name.replace("Chapter ", "Ch. "))}</button>
  `).join("");
}

function renderContent() {
  const sections = visibleSections();
  const active = sections.find((section) => section.slug === state.activeSlug);
  els.loading.hidden = true;

  if (!active) {
    els.group.textContent = groupLabels[state.activeGroup] || "Section";
    els.title.textContent = "No matching Grey Book section";
    els.meta.textContent = "Clear the search box to return to the full study mirror.";
    els.content.innerHTML = '<div class="grey-study-empty">No matching section was found.</div>';
    return;
  }

  els.group.textContent = groupLabels[state.activeGroup] || "Section";
  els.title.textContent = active.name;
  els.meta.textContent = `${active.paragraphs.length} paragraphs${active.pages ? ` | GBR pages ${active.pages}` : ""}`;
  els.content.innerHTML = active.paragraphs.map((paragraph) => {
    const pages = paragraph.pages.length ? `<span class="grey-study-page">GBR page ${escapeHtml(paragraph.pages.join(", "))}</span>` : "";
    if (paragraph.isHeading) {
      return `<article class="grey-study-paragraph is-heading"><h3>${escapeHtml(paragraph.text)}</h3>${pages}</article>`;
    }
    return `<article class="grey-study-paragraph"><p>${escapeHtml(paragraph.text)}</p>${pages}</article>`;
  }).join("");
}

function render() {
  renderGroupTabs();
  renderSubtabs();
  renderContent();
}

function moveSection(direction) {
  const sections = visibleSections();
  if (!sections.length) return;
  const index = Math.max(0, sections.findIndex((section) => section.slug === state.activeSlug));
  const nextIndex = (index + direction + sections.length) % sections.length;
  state.activeSlug = sections[nextIndex].slug;
  render();
  document.querySelector(".grey-study-reader")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

document.addEventListener("click", (event) => {
  const groupButton = event.target.closest("[data-group-tab]");
  if (groupButton) {
    setActive(groupButton.dataset.groupTab);
    return;
  }

  const sectionButton = event.target.closest("[data-section-tab]");
  if (sectionButton) {
    state.activeSlug = sectionButton.dataset.sectionTab;
    render();
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

fetch("/data/grey-book-context.json", { cache: "no-store" })
  .then((response) => {
    if (!response.ok) throw new Error(`Grey Book data returned ${response.status}`);
    return response.json();
  })
  .then((data) => {
    buildGroups(data);
    setActive("chapters", slugify("Chapter One - Who Is an Addict?"));
  })
  .catch((error) => {
    console.error(error);
    els.loading.textContent = "The Grey Book study text could not be loaded. Try refreshing the page.";
  });
