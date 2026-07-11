#!/usr/bin/env python3
"""Rebuild GBRNA Grey Book source context around complete paragraphs.

Run this script from the root of the GBRNA repository. It reads:
  data/grey-book-context.json
  literature/grey-book-memphis-1981-review-form.pdf
  js/app.js

It adds a top-level `contexts` map to grey-book-context.json. Each context
contains the complete paragraph(s) surrounding the original source page(s),
including paragraph material that crosses a printed page boundary. It also
updates renderGreyBookContext() in app.js to prefer the new paragraph-complete
contexts while retaining the old page data as a fallback.

Backups are written before any file is replaced.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import shutil
import statistics
import sys
import unicodedata
from dataclasses import dataclass
from datetime import date
from difflib import SequenceMatcher
from pathlib import Path
from typing import Iterable, Sequence

try:
    import fitz  # PyMuPDF
except ImportError:
    print(
        "PyMuPDF is required. Run:  py -m pip install pymupdf\n"
        "Then run this script again.",
        file=sys.stderr,
    )
    raise SystemExit(2)


DEFAULT_CONTEXT = Path("data/grey-book-context.json")
DEFAULT_PDF = Path("literature/grey-book-memphis-1981-review-form.pdf")
DEFAULT_APP = Path("js/app.js")
REPORT_PATH = Path("data/grey-book-context-paragraph-report.json")

HEADER_PHRASES = {
    "narcotics anonymous review form",
    "memphis 1981",
}
TERMINAL_RE = re.compile(r"[.!?][\"'”’)]*$")
HEADING_RE = re.compile(
    r"^(?:CHAPTER\b|STEP\s+(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|\d+)|"
    r"TRADITION\s+(?:ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|\d+)|"
    r"FORWARD$|INTRODUCTION$|WHO IS AN ADDICT\??$|WHAT CAN I DO\??$|WHY ARE WE HERE\??$|"
    r"HOW IT WORKS$|RECOVERY AND RELAPSE$|WE DO RECOVER$|JUST FOR TODAY$|MORE WILL BE REVEALED$)",
    re.IGNORECASE,
)


@dataclass
class Line:
    page: int
    block: int
    text: str
    x0: float
    y0: float
    y1: float
    height: float


@dataclass
class Fragment:
    page: int
    text: str
    first_on_page: bool = False
    last_on_page: bool = False

    @property
    def tokens(self) -> list[str]:
        return tokenize(self.text)


def compact_spaces(text: str) -> str:
    text = text.replace("\u00ad", "")
    text = text.replace("\ufffd", "")
    text = text.replace("\u2011", "-")
    text = text.replace("\u2010", "-")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def normalize_for_compare(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = text.replace("\u00ad", "")
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def tokenize(text: str) -> list[str]:
    normalized = normalize_for_compare(text)
    return normalized.split() if normalized else []


def is_header_or_page_number(text: str, page_number: int) -> bool:
    normalized = normalize_for_compare(text)
    if normalized in HEADER_PHRASES:
        return True
    if normalized == str(page_number):
        return True
    # Some PDF exports place all three header parts in one text object.
    if (
        "narcotics anonymous review form" in normalized
        and "memphis 1981" in normalized
        and re.search(rf"(?:^| )\b{page_number}\b(?: |$)", normalized)
    ):
        return True
    return False


def join_line_text(parts: Sequence[str]) -> str:
    out = ""
    for raw in parts:
        part = compact_spaces(raw)
        if not part:
            continue
        if not out:
            out = part
            continue
        if out.endswith("-") and re.match(r"^[A-Za-z]", part):
            out = out[:-1] + part
        else:
            out += " " + part
    return compact_spaces(out)


def extract_lines(page, printed_page: int) -> list[Line]:
    payload = page.get_text("dict", sort=True)
    lines: list[Line] = []
    for block_index, block in enumerate(payload.get("blocks", [])):
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            spans = line.get("spans", [])
            text = join_line_text([span.get("text", "") for span in spans])
            if not text or is_header_or_page_number(text, printed_page):
                continue
            bbox = line.get("bbox", (0, 0, 0, 0))
            y0, y1 = float(bbox[1]), float(bbox[3])
            lines.append(
                Line(
                    page=printed_page,
                    block=block_index,
                    text=text,
                    x0=float(bbox[0]),
                    y0=y0,
                    y1=y1,
                    height=max(1.0, y1 - y0),
                )
            )
    lines.sort(key=lambda item: (item.y0, item.x0))
    return lines


def looks_like_heading(text: str) -> bool:
    clean = compact_spaces(text)
    if HEADING_RE.match(clean):
        return True
    letters = re.sub(r"[^A-Za-z]", "", clean)
    if 2 <= len(letters) <= 45 and clean.upper() == clean and not clean.endswith("."):
        return True
    return False


def split_page_into_fragments(page, printed_page: int) -> list[Fragment]:
    lines = extract_lines(page, printed_page)
    if not lines:
        return []

    heights = [line.height for line in lines if line.height > 0]
    median_height = statistics.median(heights) if heights else 11.0
    gaps = [
        max(0.0, lines[index].y0 - lines[index - 1].y1)
        for index in range(1, len(lines))
    ]
    ordinary = [gap for gap in gaps if gap <= median_height * 0.65]
    ordinary_gap = statistics.median(ordinary) if ordinary else 1.5
    paragraph_gap = max(4.0, ordinary_gap * 2.4, median_height * 0.42)

    groups: list[list[str]] = []
    current: list[str] = []

    for index, line in enumerate(lines):
        start_new = False
        if index > 0:
            previous = lines[index - 1]
            gap = max(0.0, line.y0 - previous.y1)
            block_changed = line.block != previous.block
            heading_now = looks_like_heading(line.text)
            heading_before = looks_like_heading(previous.text)

            if gap >= paragraph_gap:
                start_new = True
            elif block_changed and gap >= max(2.0, ordinary_gap * 1.45):
                start_new = True
            elif heading_now or heading_before:
                start_new = True
            elif re.match(r"^\s*(?:\d{1,2}[.)]|[A-Za-z][.)])\s+", line.text):
                start_new = True

        if start_new and current:
            groups.append(current)
            current = []
        current.append(line.text)

    if current:
        groups.append(current)

    fragments = [
        Fragment(page=printed_page, text=join_line_text(group))
        for group in groups
        if join_line_text(group)
    ]
    if fragments:
        fragments[0].first_on_page = True
        fragments[-1].last_on_page = True
    return fragments


def extract_fragments(pdf_path: Path) -> tuple[list[Fragment], dict[int, list[int]]]:
    document = fitz.open(pdf_path)
    fragments: list[Fragment] = []
    by_page: dict[int, list[int]] = {}
    try:
        for index in range(document.page_count):
            printed_page = index + 1
            page_fragments = split_page_into_fragments(document[index], printed_page)
            by_page[printed_page] = []
            for fragment in page_fragments:
                by_page[printed_page].append(len(fragments))
                fragments.append(fragment)
    finally:
        document.close()
    return fragments, by_page


def best_anchor_match(
    anchor: Sequence[str],
    candidate_tokens: Sequence[str],
    token_to_fragment: Sequence[int],
) -> tuple[int, int, float]:
    if not anchor or not candidate_tokens:
        return 0, 0, 0.0

    target_len = len(anchor)
    if len(candidate_tokens) <= target_len:
        score = SequenceMatcher(None, list(anchor), list(candidate_tokens), autojunk=False).ratio()
        return 0, len(candidate_tokens), score

    first_word = anchor[0]
    possible = [index for index, word in enumerate(candidate_tokens) if word == first_word]
    if not possible:
        step = max(1, target_len // 5)
        possible = list(range(0, len(candidate_tokens) - target_len + 1, step))

    best_start = 0
    best_end = min(len(candidate_tokens), target_len)
    best_score = -1.0

    lengths = sorted({max(6, target_len - 6), target_len, target_len + 6})
    for start in possible:
        for window_len in lengths:
            end = min(len(candidate_tokens), start + window_len)
            window = candidate_tokens[start:end]
            if len(window) < 5:
                continue
            score = SequenceMatcher(None, list(anchor), list(window), autojunk=False).ratio()
            if score > best_score:
                best_score = score
                best_start = start
                best_end = end

    return best_start, best_end, max(0.0, best_score)


def source_key(mapped) -> str:
    pages = mapped if isinstance(mapped, list) else [mapped]
    return "-".join(str(int(page)) for page in pages)


def source_pages(mapped) -> list[int]:
    values = mapped if isinstance(mapped, list) else [mapped]
    return [int(value) for value in values]


def existing_text_for_mapping(data: dict, mapped) -> str:
    chunks: list[str] = []
    for page in source_pages(mapped):
        item = data.get("pages", {}).get(str(page), {})
        text = item.get("text", "")
        if text:
            chunks.append(text)
    return "\n\n".join(chunks).strip()


def build_candidate_window(
    all_fragments: Sequence[Fragment],
    by_page: dict[int, list[int]],
    pages: Sequence[int],
    radius: int = 2,
) -> tuple[list[Fragment], list[int], list[int]]:
    low = max(1, min(pages) - radius)
    high = max(pages) + radius
    selected_indices: list[int] = []
    for page in range(low, high + 1):
        selected_indices.extend(by_page.get(page, []))
    selected = [all_fragments[index] for index in selected_indices]

    tokens: list[str] = []
    token_to_fragment: list[int] = []
    for local_index, fragment in enumerate(selected):
        fragment_tokens = fragment.tokens
        tokens.extend(fragment_tokens)
        token_to_fragment.extend([local_index] * len(fragment_tokens))
    return selected, tokens, token_to_fragment


def continuation_before(fragments: Sequence[Fragment], index: int) -> bool:
    if index <= 0:
        return False
    current = fragments[index]
    previous = fragments[index - 1]
    if current.page != previous.page + 1 or not current.first_on_page or not previous.last_on_page:
        return False
    first_alpha = re.search(r"[A-Za-z]", current.text)
    starts_lower = bool(first_alpha and current.text[first_alpha.start()].islower())
    previous_unfinished = not TERMINAL_RE.search(previous.text.strip())
    return starts_lower or previous_unfinished


def continuation_after(fragments: Sequence[Fragment], index: int) -> bool:
    if index >= len(fragments) - 1:
        return False
    current = fragments[index]
    following = fragments[index + 1]
    if following.page != current.page + 1 or not current.last_on_page or not following.first_on_page:
        return False
    first_alpha = re.search(r"[A-Za-z]", following.text)
    starts_lower = bool(first_alpha and following.text[first_alpha.start()].islower())
    current_unfinished = not TERMINAL_RE.search(current.text.strip())
    return starts_lower or current_unfinished


def section_for_mapping(data: dict, mapped) -> str:
    for page in source_pages(mapped):
        section = data.get("pages", {}).get(str(page), {}).get("section")
        if section:
            return section
    return "Grey Book"


def create_paragraph_contexts(data: dict, pdf_path: Path) -> tuple[dict, list[dict]]:
    all_fragments, by_page = extract_fragments(pdf_path)
    contexts: dict[str, dict] = {}
    report_rows: list[dict] = []

    unique_mappings: dict[str, object] = {}
    for mapped in data.get("dates", {}).values():
        unique_mappings[source_key(mapped)] = mapped

    for key, mapped in sorted(
        unique_mappings.items(),
        key=lambda pair: source_pages(pair[1]),
    ):
        pages = source_pages(mapped)
        old_text = existing_text_for_mapping(data, mapped)
        candidates, candidate_tokens, token_to_fragment = build_candidate_window(
            all_fragments, by_page, pages, radius=2
        )

        old_tokens = tokenize(old_text)
        first_anchor = old_tokens[: min(42, len(old_tokens))]
        last_anchor = old_tokens[max(0, len(old_tokens) - 42) :]

        first_start, first_end, first_score = best_anchor_match(
            first_anchor, candidate_tokens, token_to_fragment
        )
        last_start, last_end, last_score = best_anchor_match(
            last_anchor, candidate_tokens, token_to_fragment
        )

        usable = bool(candidates and token_to_fragment and old_tokens)
        if usable:
            start_fragment = token_to_fragment[min(first_start, len(token_to_fragment) - 1)]
            end_token = max(last_start, last_end - 1)
            end_fragment = token_to_fragment[min(end_token, len(token_to_fragment) - 1)]
        else:
            start_fragment = 0
            end_fragment = max(0, len(candidates) - 1)

        if start_fragment > end_fragment or min(first_score, last_score) < 0.43:
            # Conservative fallback: all fragments on the original source pages,
            # plus a boundary fragment only when the page begins/ends mid-thought.
            source_indices = [
                index for index, fragment in enumerate(candidates) if fragment.page in pages
            ]
            if source_indices:
                start_fragment = min(source_indices)
                end_fragment = max(source_indices)
            first_score = min(first_score, 0.42)
            last_score = min(last_score, 0.42)

        while continuation_before(candidates, start_fragment):
            start_fragment -= 1
        while continuation_after(candidates, end_fragment):
            end_fragment += 1

        selected = candidates[start_fragment : end_fragment + 1]
        assembled: list[str] = []
        for selected_index, fragment in enumerate(selected):
            if not assembled:
                assembled.append(fragment.text)
                continue
            previous = selected[selected_index - 1]
            crosses_page = (
                fragment.page == previous.page + 1
                and fragment.first_on_page
                and previous.last_on_page
            )
            first_alpha = re.search(r"[A-Za-z]", fragment.text)
            starts_lower = bool(
                first_alpha and fragment.text[first_alpha.start()].islower()
            )
            previous_unfinished = not TERMINAL_RE.search(previous.text.strip())
            separator = " " if crosses_page and (starts_lower or previous_unfinished) else "\n\n"
            assembled.append(separator + fragment.text)
        selected_text = "".join(assembled).strip()
        selected_pages = sorted({fragment.page for fragment in selected})

        if not selected_text:
            selected_text = old_text
            selected_pages = pages

        contexts[key] = {
            "sourcePages": pages,
            "pages": selected_pages,
            "section": section_for_mapping(data, mapped),
            "text": selected_text,
        }

        report_rows.append(
            {
                "key": key,
                "sourcePages": pages,
                "contextPages": selected_pages,
                "firstAnchorScore": round(first_score, 3),
                "lastAnchorScore": round(last_score, 3),
                "status": "review" if min(first_score, last_score) < 0.62 else "matched",
                "oldCharacters": len(old_text),
                "newCharacters": len(selected_text),
            }
        )

    return contexts, report_rows


NEW_RENDER_FUNCTION = r'''function renderGreyBookContext(reading) {
  const mapped = GREY_BOOK_CONTEXT?.dates?.[reading.id];
  if (!mapped) return '';

  const sourcePageNumbers = Array.isArray(mapped) ? mapped : [mapped];
  const contextKey = sourcePageNumbers.join('-');
  const paragraphContext = GREY_BOOK_CONTEXT?.contexts?.[contextKey];

  if (paragraphContext?.text) {
    const displayPages = Array.isArray(paragraphContext.pages) && paragraphContext.pages.length
      ? paragraphContext.pages
      : sourcePageNumbers;
    const firstDisplayPage = displayPages[0];
    const lastDisplayPage = displayPages[displayPages.length - 1];
    const pageLabel = displayPages.length > 1
      ? `Pages ${firstDisplayPage}–${lastDisplayPage}`
      : `Page ${firstDisplayPage}`;
    const sourceLabel = sourcePageNumbers.length > 1
      ? `source Pages ${sourcePageNumbers[0]}–${sourcePageNumbers[sourcePageNumbers.length - 1]}`
      : `source Page ${sourcePageNumbers[0]}`;
    const section = paragraphContext.section && paragraphContext.section !== 'Grey Book'
      ? paragraphContext.section
      : 'Grey Book';

    return `
      <section class="grey-book-context" aria-label="Grey Book source context for ${escapeHtml(reading.date)}">
        <div class="grey-book-context-heading">
          <div>
            <p class="grey-book-context-kicker">From the Grey Book</p>
            <h4>Read the Complete Source Paragraphs</h4>
            <p class="grey-book-context-meta">${escapeHtml(section)} · ${pageLabel}</p>
          </div>
          <span class="grey-book-page-stamp" aria-hidden="true">${displayPages.length > 1 ? `PP. ${firstDisplayPage}–${lastDisplayPage}` : `P. ${firstDisplayPage}`}</span>
        </div>

        <details class="grey-book-context-details">
          <summary>
            <span class="grey-book-context-summary-copy">
              <strong>Read Grey Book ${pageLabel}</strong>
              <small>Complete paragraph context surrounding ${sourceLabel}.</small>
            </span>
            <span class="grey-book-context-summary-cue" aria-hidden="true">OPEN ▼</span>
          </summary>

          <div class="grey-book-context-pages">
            <div class="grey-book-context-page">
              <div class="grey-book-context-pagehead">
                <span>Narcotics Anonymous — Review Form</span>
                <strong>Memphis 1981 · ${pageLabel}</strong>
              </div>
              <div class="grey-book-context-text">${paragraphHtml(paragraphContext.text)}</div>
            </div>
            <p class="grey-book-context-note">The source passage begins and ends at complete paragraph boundaries. Paragraphs that cross a printed page boundary are included in full.</p>
          </div>
        </details>
      </section>
    `;
  }

  // Backward-compatible fallback for an older context file.
  const pages = sourcePageNumbers
    .map((pageNumber) => GREY_BOOK_CONTEXT?.pages?.[String(pageNumber)])
    .filter((page) => page && page.text);

  if (!pages.length) return '';

  const firstPage = pages[0];
  const lastPage = pages[pages.length - 1];
  const pageLabel = pages.length > 1
    ? `Pages ${firstPage.page}–${lastPage.page}`
    : `Page ${firstPage.page}`;

  const section = firstPage.section && firstPage.section !== 'Grey Book'
    ? firstPage.section
    : 'Grey Book';

  const pageBlocks = pages.map((page, index) => `
    <div class="grey-book-context-page${index > 0 ? ' grey-book-context-page-continuation' : ''}">
      <div class="grey-book-context-pagehead">
        <span>Narcotics Anonymous — Review Form</span>
        <strong>Memphis 1981 · Page ${page.page}</strong>
      </div>
      <div class="grey-book-context-text">${paragraphHtml(page.text)}</div>
    </div>
  `).join('');

  return `
    <section class="grey-book-context" aria-label="Grey Book source context for ${escapeHtml(reading.date)}">
      <div class="grey-book-context-heading">
        <div>
          <p class="grey-book-context-kicker">From the Grey Book</p>
          <h4>Read the Source ${pages.length > 1 ? 'Pages' : 'Page'}</h4>
          <p class="grey-book-context-meta">${escapeHtml(section)} · ${pageLabel}</p>
        </div>
        <span class="grey-book-page-stamp" aria-hidden="true">${pages.length > 1 ? `PP. ${firstPage.page}–${lastPage.page}` : `P. ${firstPage.page}`}</span>
      </div>

      <details class="grey-book-context-details">
        <summary>
          <span class="grey-book-context-summary-copy">
            <strong>Read Grey Book ${pageLabel}</strong>
            <small>Open the source text used for this reflection.</small>
          </span>
          <span class="grey-book-context-summary-cue" aria-hidden="true">OPEN ▼</span>
        </summary>

        <div class="grey-book-context-pages">
          ${pageBlocks}
          <p class="grey-book-context-note">Source text is displayed from the retyped Memphis 1981 Review Form supplied for this project.</p>
        </div>
      </details>
    </section>
  `;
}'''


def patch_app_js(app_path: Path) -> bool:
    text = app_path.read_text(encoding="utf-8")
    pattern = re.compile(
        r"function\s+renderGreyBookContext\s*\(reading\)\s*\{.*?\n\}\s*\n+function\s+renderGreyAreaGroup",
        re.DOTALL,
    )
    replacement = NEW_RENDER_FUNCTION + "\n\n\nfunction renderGreyAreaGroup"
    new_text, count = pattern.subn(replacement, text, count=1)
    if count != 1:
        raise RuntimeError(
            "Could not locate exactly one renderGreyBookContext() function in js/app.js. "
            "No app.js changes were written."
        )
    app_path.write_text(new_text, encoding="utf-8", newline="\n")
    return True


def backup(path: Path) -> Path:
    candidate = path.with_suffix(path.suffix + ".paragraph-backup")
    counter = 1
    while candidate.exists():
        candidate = path.with_suffix(path.suffix + f".paragraph-backup-{counter}")
        counter += 1
    shutil.copy2(path, candidate)
    return candidate


def validate_data(data: dict) -> None:
    if not isinstance(data.get("dates"), dict) or len(data["dates"]) < 365:
        raise ValueError("Expected at least 365 date mappings in grey-book-context.json.")
    if not isinstance(data.get("pages"), dict) or not data["pages"]:
        raise ValueError("The existing pages map is missing or empty.")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Rebuild GBRNA Grey Book source contexts around complete paragraphs."
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=Path.cwd(),
        help="GBRNA repository root. Defaults to the current directory.",
    )
    parser.add_argument(
        "--no-app-patch",
        action="store_true",
        help="Update only the JSON and leave js/app.js unchanged.",
    )
    args = parser.parse_args()

    root = args.root.resolve()
    context_path = root / DEFAULT_CONTEXT
    pdf_path = root / DEFAULT_PDF
    app_path = root / DEFAULT_APP
    report_path = root / REPORT_PATH

    missing = [path for path in (context_path, pdf_path, app_path) if not path.exists()]
    if missing:
        print("Missing required GBRNA files:", file=sys.stderr)
        for path in missing:
            print(f"  - {path}", file=sys.stderr)
        print("Run this script from the GBRNA repository root.", file=sys.stderr)
        return 2

    data = json.loads(context_path.read_text(encoding="utf-8"))
    validate_data(data)

    print("Reading the Memphis 1981 Review Form…")
    contexts, rows = create_paragraph_contexts(data, pdf_path)
    if not contexts:
        raise RuntimeError("No paragraph contexts were generated.")

    data["contextMode"] = "paragraph-complete"
    data["contextGenerated"] = date.today().isoformat()
    data["contexts"] = contexts

    context_backup = backup(context_path)
    app_backup = None
    try:
        context_path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
            newline="\n",
        )
        # Parse it again before touching app.js.
        json.loads(context_path.read_text(encoding="utf-8"))

        if not args.no_app_patch:
            app_backup = backup(app_path)
            patch_app_js(app_path)

        review_rows = [row for row in rows if row["status"] == "review"]
        report = {
            "generated": date.today().isoformat(),
            "contextCount": len(contexts),
            "dateCount": len(data["dates"]),
            "reviewCount": len(review_rows),
            "reviewKeys": [row["key"] for row in review_rows],
            "contexts": rows,
        }
        report_path.write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
            newline="\n",
        )
    except Exception:
        shutil.copy2(context_backup, context_path)
        if app_backup and app_backup.exists():
            shutil.copy2(app_backup, app_path)
        raise

    print(f"Built {len(contexts)} paragraph-complete source contexts.")
    print(f"Covered {len(data['dates'])} daily readings.")
    print(f"Contexts flagged for a quick spot-check: {sum(row['status'] == 'review' for row in rows)}")
    print(f"Updated: {context_path}")
    if not args.no_app_patch:
        print(f"Updated: {app_path}")
    print(f"Report:  {report_path}")
    print(f"Backup:  {context_backup}")
    if app_backup:
        print(f"Backup:  {app_backup}")
    print("\nNext: run the site locally and spot-check July 10 plus the keys listed in the report.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
