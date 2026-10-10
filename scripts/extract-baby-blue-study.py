"""Use native PDF text with the printed template's page and paragraph boundaries."""
import bisect
import json
import re
from difflib import SequenceMatcher
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
load = lambda name: json.loads((ROOT / name).read_text(encoding="utf-8"))
book = load("baby-blue-study/book.json")
ocr = load("draft-maps/printed-template/ocr.json")
alignment = {str(p["printedPage"]): p for p in load("draft-maps/printed-to-screen-alignment.json")}
raw = "\n".join(p["text"] for p in load("draft-maps/screen-text-pages.json")[3:])
word_matches = list(re.finditer(r"[a-z0-9]+(?:['\u2018\u2019][a-z0-9]+)*", raw, re.I))
normalize = lambda text: re.findall(r"[a-z0-9]+", re.sub(r"(\w)['\u2018\u2019](\w)", r"\1\2", text.lower()))
words = [normalize(m.group())[0] for m in word_matches]
coord = lambda value: min(value) if isinstance(value, list) else value

def clean(text):
    text = re.sub(r"(?<=\w)\ufffd(?=\w)", "'", text)
    text = text.replace("\ufffd", '"')
    text = re.sub(r'\bln order\b', 'In order', text)
    text = re.sub(r"-\s+(?=[a-z])", "-", text)
    return re.sub(r"\s+", " ", text).strip()

def slice_text(start, end):
    if start >= end:
        return ""
    # Include punctuation following the final word, but not the next word.
    left = word_matches[start].start()
    while left > 0 and raw[left - 1] in '\"\ufffd\u201c\u2018':
        left -= 1
    right = word_matches[end].start() if end < len(words) else len(raw)
    text = raw[left:right].rstrip()
    while text and text[-1] in '\"\ufffd\u201c' and '\n' in raw[word_matches[end-1].end():right]:
        text = text[:-1].rstrip()
    return clean(text)

for page in book["pages"]:
    key = page["id"]
    page["paragraphs"] = []
    if key == "gratitude":
        page["paragraphs"] = [{"text": '"My gratitude speaks... When I care and When I share with others The N.A. way."', "kind": "quote", "lines": [{"number": 1, "text": '"My gratitude speaks...'}, {"number": 2, "text": "When I care and"}, {"number": 3, "text": "When I share with others"}, {"number": 4, "text": 'The N.A. way."'}]}]
        page["text"] = page["paragraphs"][0]["text"]
        continue
    if key not in alignment:
        if key != '74':
            page["text"] = ""
            continue
        evidence = {"start": alignment['73']['end'], "end": alignment['75']['start'], "templatePdfPage": 9, "side": "left"}
    else:
        evidence = dict(alignment[key])
        following = next((p for p in book['pages'][book['pages'].index(page)+1:] if p['id'] in alignment), None)
        if following:
            evidence['end'] = alignment[following['id']]['start'] if key != '73' else evidence['end']
    source = next(p for p in ocr if p["templatePdfPage"] == evidence["templatePdfPage"] and p["side"] == evidence["side"])
    lines = []
    for line in source['lines']:
        if coord(line['y']) > source['height'] * .88 and re.fullmatch(r'\d{1,2}|[xiv]+', line['text'].strip()):
            continue
        if lines and abs(coord(lines[-1]['y']) - coord(line['y'])) < 12:
            previous = lines[-1]
            parts = sorted([previous, line], key=lambda part: coord(part['x']))
            previous['text'] = ' '.join(part['text'] for part in parts)
            previous['x'] = min(coord(part['x']) for part in parts)
        else:
            lines.append(dict(line))
    tokens, starts = [], []
    for line in lines:
        starts.append(len(tokens))
        tokens.extend(normalize(line["text"]))
    lower, upper = max(0, evidence["start"] - 60), min(len(words), evidence["end"] + 60)
    matcher = SequenceMatcher(None, tokens, words[lower:upper], autojunk=False)
    anchors = {}
    for a, b, length in matcher.get_matching_blocks():
        for offset in range(length):
            anchors[a + offset] = lower + b + offset
    assert len(anchors) >= len(tokens) * .45, (key, len(anchors), len(tokens))
    keys = sorted(anchors)
    def native_position(position):
        if position in anchors:
            return anchors[position]
        cursor = bisect.bisect_left(keys, position)
        candidates = keys[max(0,cursor-1):cursor+1]
        nearest = min(candidates, key=lambda i: abs(i-position))
        return anchors[nearest] + position - nearest
    bounds = [max(0, min(len(words), native_position(start))) for start in starts]
    # The earlier full-book alignment supplies the physical page endpoints.
    bounds[0] = evidence["start"]
    bounds.append(evidence["end"])
    bounds = [max(evidence['start'], min(evidence['end'], max(bounds[:i+1]))) for i in range(len(bounds))]
    left_margin = sorted(coord(line["x"]) for line in lines)[max(0, len(lines)//5)]
    previous_y = None
    for i, line in enumerate(lines):
        text = slice_text(bounds[i], bounds[i+1])
        if not text:
            continue
        x, y = coord(line["x"]), coord(line["y"])
        heading = bool(re.fullmatch(r"(?:STEP|TRADITION) [A-Z]+|INTRODUCTION|OUR SYMBOL|Chapter [A-Za-z]+", text, re.I))
        centered = x > left_margin + source["width"] * .14 and text.isupper() and len(text.split()) < 14
        kind = "heading" if heading or centered else "text"
        new_paragraph = not page["paragraphs"] or heading or centered or x > left_margin + 14 or (previous_y is not None and y-previous_y > 45)
        if page["paragraphs"] and page["paragraphs"][-1]["kind"] == "heading":
            new_paragraph = True
        if page['paragraphs'] and page['paragraphs'][-1]['kind'] == 'quote' and not page['paragraphs'][-1]['text'].endswith(('"', '\u201d')):
            new_paragraph = heading
        if new_paragraph:
            if page['paragraphs'] and page['paragraphs'][-1]['kind'] == 'heading' and text.startswith(('"', '\u201c')):
                kind = 'quote'
            page["paragraphs"].append({"kind": kind, "text": "", "lines": []})
        paragraph = page["paragraphs"][-1]
        paragraph["lines"].append({"number": i+1, "text": text})
        paragraph["text"] = clean(" ".join(part["text"] for part in paragraph["lines"]))
        previous_y = y
    if key in {'10', '13', '43'}:
        # The text PDF places list numbers in their own column; reunite each item.
        rebuilt = []
        in_list = False
        expected = 1
        maximum = 3 if key == '10' else 12
        for paragraph in page['paragraphs']:
            if expected > maximum and (paragraph['text'].startswith('Understanding these Traditions') or paragraph['text'].startswith('We must face')):
                in_list = False
            for line in paragraph['lines']:
                fragments = re.split(r'(\b\d{1,2}\.\s*)', line['text'])
                for fragment in fragments:
                    if not fragment.strip(): continue
                    if re.fullmatch(r'\d{1,2}\.\s*', fragment) and int(fragment.split('.')[0]) == expected and expected <= maximum:
                        rebuilt.append({'kind':'text','text':'','lines':[]})
                        in_list = True
                        expected += 1
                    elif not in_list and (not rebuilt or line is paragraph['lines'][0]):
                        rebuilt.append({'kind':paragraph['kind'],'text':'','lines':[]})
                    if not rebuilt: rebuilt.append({'kind':paragraph['kind'],'text':'','lines':[]})
                    rebuilt[-1]['lines'].append({'number':line['number'],'text':fragment.strip()})
                    rebuilt[-1]['text'] = clean(' '.join(part['text'] for part in rebuilt[-1]['lines']))
        page['paragraphs'] = rebuilt
    if key == '74':
        lines = [line for p in page['paragraphs'] for line in p['lines']]
        rebuilt = []
        for line in lines:
            # JFT statements are hanging-indented, not separate paragraphs per line.
            if not rebuilt or line['text'].startswith('JUST FOR TODAY'):
                rebuilt.append({'kind':'text','text':'','lines':[]})
            rebuilt[-1]['lines'].append(line)
            rebuilt[-1]['text'] = clean(' '.join(part['text'] for part in rebuilt[-1]['lines']))
        page['paragraphs'] = rebuilt
    merged = []
    for paragraph in page['paragraphs']:
        if merged and paragraph['kind'] == 'text' and merged[-1]['kind'] == 'text' and re.match(r'[a-z]', paragraph['text']) and not re.search(r'[.!?:\u201d"]$', merged[-1]['text']):
            merged[-1]['lines'].extend(paragraph['lines'])
            merged[-1]['text'] = clean(merged[-1]['text'] + ' ' + paragraph['text'])
        else:
            merged.append(paragraph)
    page['paragraphs'] = merged
    page["text"] = "\n\n".join(p["text"] for p in page["paragraphs"])

# Retain the current chapter on each page and both sections on transition pages.
chapter = None
active = None
names = ['one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve']
for page in book["pages"]:
    if page["id"] == 'xi': chapter = active = 'symbol'
    elif page["id"] == 'xiv': chapter = active = 'introduction'
    elif page["id"] == 'gratitude': chapter = active = 'gratitude'
    for paragraph in page["paragraphs"]:
        match = re.fullmatch(r"Chapter (\w+)", paragraph["text"], re.I)
        if match and match[1].lower() in names[:10]: chapter = active = f'chapter-{names.index(match[1].lower())+1}'
        match = re.fullmatch(r"(STEP|TRADITION) (\w+)", paragraph["text"], re.I)
        if match and match[2].lower() in names: active = f'{match[1].lower()}-{names.index(match[2].lower())+1}'
        paragraph["section"] = active
        paragraph["chapter"] = chapter
    page["chapter"] = chapter
    page["sections"] = list(dict.fromkeys(p['section'] for p in page['paragraphs'] if p['section']))

for section in book["sections"]:
    included = [p for p in book['pages'] if any((part['chapter'] if section['group']=='chapters' else part['section']) == section['id'] for part in p['paragraphs'])]
    section['pages'] = [p['id'] for p in included]
    if included: section['page'] = included[0]['id']

# Check the entire transcription, not just the passages used by JFT.
# "The End" is a screen-copy caption absent from the printed book template.
audit = lambda text: re.findall(r'[a-z0-9]+', re.sub(r'\bln order\b', 'In order', text).lower())
expected = audit(re.sub(r'\bThe End\b', '', raw))
actual = audit(' '.join(page['text'] for page in book['pages']))
assert actual == expected, 'The extracted book text lost or duplicated source words.'
(ROOT / 'baby-blue-study/book.json').write_text(json.dumps(book, ensure_ascii=False), encoding='utf-8')
print(f"Extracted {sum(len(p['paragraphs']) for p in book['pages'])} paragraphs on {sum(bool(p['paragraphs']) for p in book['pages'])} physical pages.")
