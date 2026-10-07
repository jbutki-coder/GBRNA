import re
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


class ArchiveIndex(HTMLParser):
    def __init__(self):
        super().__init__()
        self.inside = False
        self.expected = 0
        self.context = []
        self.heading = None
        self.link = None
        self.text = []
        self.files = []
        self.ids = set()
        self.references = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "article" and attrs.get("id") == "archive-content":
            self.inside = True
            self.expected = int(attrs["data-file-count"])
        if not self.inside:
            return
        if "id" in attrs:
            assert attrs["id"] not in self.ids, "Duplicate collection anchor"
            self.ids.add(attrs["id"])
        if tag in {"h2", "h3", "h4"}:
            self.heading = tag
            self.text = []
        if tag == "a":
            if attrs.get("href", "").startswith("#"):
                self.references.append(attrs["href"][1:])
            elif "data-file-ext" in attrs:
                self.link = attrs
                self.text = []

    def handle_data(self, data):
        if self.heading or self.link:
            self.text.append(data)

    def handle_endtag(self, tag):
        if tag == "article":
            self.inside = False
        if tag == self.heading:
            text = "".join(self.text)
            if tag == "h2":
                self.context = [text]
            elif tag == "h3":
                self.context = self.context[:1] + [text]
            else:
                self.context = self.context[:2] + [text]
            self.heading = None
        if tag == "a" and self.link:
            self.files.append((self.link, "".join(self.text), list(self.context)))
            self.link = None


page = (Path(__file__).resolve().parents[1] / "archive-master-index.html").read_text(encoding="utf-8")
index = ArchiveIndex()
index.feed(page)
assert len(index.files) == index.expected, "Displayed archive count must match every file link"
assert index.expected > 1633, "New archive collections must be included"
assert len({attrs["href"] for attrs, _, _ in index.files}) == index.expected, "File URLs must be unique"
assert all(anchor in index.ids for anchor in index.references), "Collection links must work"
assert {"origins-early-history", "literature-recovery-material", "newsletters-publications", "world-service-structure", "legal-trust-incorporation"} <= index.ids, "Existing major collection bookmarks must keep working"
assert any(context[0].startswith("NA Adjacent") for _, _, context in index.files), "NA Adjacent must be separate"
michigan_presentations = [(attrs, title) for attrs, title, context in index.files if context[-1].startswith("Michigan NA History Presentations")]
assert len(michigan_presentations) == 1 and michigan_presentations[0][1] == "PRESENTATION 2.pptx", "Keep only Presentation 2 in Michigan NA History Presentations"
assert urlsplit(michigan_presentations[0][0]["href"]).path.endswith("/PRESENTATION-2.pptx"), "Keep the original Presentation 2 link"
for heading, count in Counter(context[0] for _, _, context in index.files).items():
    assert int(re.search(r"\(([\d,]+)\)$", heading)[1].replace(",", "")) == count, "Collection counts must reflect the remaining files"
group_counts = Counter(tuple(context[:depth]) for _, _, context in index.files for depth in range(2, len(context) + 1))
for context, count in group_counts.items():
    assert int(re.search(r"\(([\d,]+)\)$", context[-1])[1].replace(",", "")) == count, "Group counts must reflect the remaining files"
history_sources = [(attrs, title, context) for attrs, title, context in index.files if any(heading.startswith("NA History: Books, Magazines & Articles") for heading in context)]
assert len(history_sources) == 44
assert len({context[-1] for _, _, context in history_sources}) == 3, "History sources must have three readable groups"
assert all(len(context) == 3 and attrs["data-file-ext"] == "pdf" for attrs, _, context in history_sources)
assert {"na-history-books-articles", "na-history-sources-1", "na-history-sources-2", "na-history-sources-3"} <= index.ids
assert not any("NA History \u2014 Books, Magazines & Articles /" in heading for _, _, context in index.files for heading in context), "Do not expose raw folder paths as history headings"
assert any("Chapter 7 - Narcotics Anonymous" in title for _, title, _ in history_sources), "Keep the NA book excerpts"
assert any("New York NA's Our Way of Life" in title for _, title, _ in history_sources), "Keep the historical NA press references"
adjacent_titles = {title for _, title, context in index.files if context[0].startswith("NA Adjacent")}
assert any("The Night Cap (AA)" in title for title in adjacent_titles)
assert any("Recovery Through AA" in title for title in adjacent_titles)
drive_count = 0
for attrs, title, context in index.files:
    url = urlsplit(attrs["href"])
    assert url.scheme == "https"
    assert url.hostname in {"drive.google.com", "docs.google.com", "michigan-na.org", "www.michigan-na.org"}
    assert attrs["data-file-type"] in {"pdf", "audio", "video", "image", "office", "other"}
    assert attrs["data-file-ext"] and title.strip()
    # Check content labels, not the shared WordPress hosting path.
    labels = " ".join([title, *context, unquote(url.path.split("/")[-1])]).replace("_", " ")
    assert not re.search(r"blue[\s_-]*water|\bBWASC\b|\bBWANA\b|\bBWACNA\b|\bBWA\b", labels, re.I), title
    assert not re.search(r"\bARNA\b|Autonomous Region of Narcotics Anonymous|Bo-Sewell-Declaration-7\.30\.20|Seeking[ _-]Traditional[ _-]Solutions[ _-]July[ _-]2026", labels, re.I), "ARNA material must stay out of the archive"
    compact = re.sub(r"[^a-z0-9]", "", labels.lower())
    assert not any(term in compact for term in ("ascgrievance", "personalnotes", "wordpressarchive", "naarchivepublisher", "chatgptgbrna")), title
    assert attrs["data-file-ext"] not in {"zip", "ini", "db"}, "Unreviewed packages and system files must stay out"
    assert not re.search(r"Skinny girls|Old Grand-Dad|Notes to Thirst For Freedom|Notes to Monkey on my Back", title, re.I), "Unrelated articles, advertisements, and working notes must stay out"
    if url.hostname in {"drive.google.com", "docs.google.com"}:
        drive_count += 1
        assert "/file/d/" in url.path or re.match(r"/(document|spreadsheets|presentation)/d/", url.path), "Direct file link required"
assert drive_count > 1900
assert "element.dataset.fileExt || extensionFor(element.href)" in page
assert "element.dataset.fileType || typeFor(ext)" in page
assert "Number(archive.dataset.fileCount)" in page
assert ".load-all[hidden] { display:none; }" in page, "Show all must stay hidden for short result lists"
assert "--archive-tools-offset" in page and "ResizeObserver(syncAnchorOffset)" in page, "Collection headings must clear the responsive sticky toolbar"
assert "archive-phoenix.ico" in page.split("</head>")[0]
assert '/css/archive-phoenix.css?v=20261007-4' in page.split("</head>")[0]
theme = (Path(__file__).resolve().parents[1] / "css/archive-phoenix.css").read_text(encoding="utf-8")
assert "--phoenix-red:#b52525" in theme and "--phoenix-gold:#ffc234" in theme
assert "body { background:var(--phoenix-charcoal)" in theme
assert 'body::before' in theme and "background:url('/archive-phoenix-background-v1.png') center center / contain no-repeat;" in theme, "Use the approved clear phoenix as a large centered page background"
phoenix = (Path(__file__).resolve().parents[1] / "archive-phoenix-background-v1.png").read_bytes()
assert phoenix[:8] == b"\x89PNG\r\n\x1a\n" and phoenix[25] == 6, "The background must be an RGBA PNG"
assert min(int.from_bytes(phoenix[16:20], "big"), int.from_bytes(phoenix[20:24], "big")) >= 1200, "Keep the high-resolution artwork"
assert '.hero-mark { display:none; }' in theme, "Do not show the old side logo"
assert 'background-size:100% auto;' in theme, "The phone background must span the screen"
for other in ("index.html", "fsc/index.html", "just-for-today/index.html"):
    assert "archive-phoenix.css" not in (Path(__file__).resolve().parents[1] / other).read_text(encoding="utf-8"), "Phoenix colors must stay scoped to the archive"
print(f"Archive verified: {index.expected:,} unique file links; {drive_count:,} Drive links; collection anchors, exclusions, and file filters checked.")
