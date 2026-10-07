import re
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
        if tag in {"h2", "h3"}:
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
            else:
                self.context = self.context[:1] + [text]
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
    compact = re.sub(r"[^a-z0-9]", "", labels.lower())
    assert not any(term in compact for term in ("ascgrievance", "personalnotes", "wordpressarchive", "naarchivepublisher", "chatgptgbrna")), title
    assert attrs["data-file-ext"] not in {"zip", "ini"}, "Unreviewed packages and system files must stay out"
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
assert '/css/archive-phoenix.css?v=20261007-1' in page.split("</head>")[0]
theme = (Path(__file__).resolve().parents[1] / "css/archive-phoenix.css").read_text(encoding="utf-8")
assert "--phoenix-red:#b52525" in theme and "--phoenix-gold:#ffc234" in theme
assert "body { background:var(--phoenix-charcoal)" in theme
assert '.hero-mark img { width:72px; }' in theme and 'bottom:auto; opacity:1;' in theme
for other in ("index.html", "fsc/index.html", "just-for-today/index.html"):
    assert "archive-phoenix.css" not in (Path(__file__).resolve().parents[1] / other).read_text(encoding="utf-8"), "Phoenix colors must stay scoped to the archive"
print(f"Archive verified: {index.expected:,} unique file links; {drive_count:,} Drive links; collection anchors, exclusions, and file filters checked.")
