"""Import the reviewed library additions and render their actual PDF covers."""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path
from pypdf import PdfReader

parser = argparse.ArgumentParser()
parser.add_argument('review_folder')
parser.add_argument('--pdftoppm', required=True)
parser.add_argument('--additional-review', type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
review = Path(args.review_folder)
catalog_path = root / 'data/literature-library.json'
catalog = json.loads(catalog_path.read_text(encoding='utf-8'))
catalog['categories'] = [
    {'id': 'drafts', 'title': 'Drafts & Historical Literature'},
    {'id': 'history', 'title': 'NA History Books'},
    {'id': 'principles', 'title': 'Principles & Workbooks'},
    {'id': 'steps', 'title': 'Step Guides'},
    {'id': 'traditions', 'title': 'Tradition Guides & Workbooks'},
    {'id': 'chapter-drafts', 'title': 'Basic Text Chapter Drafts & Cut-and-Paste'},
]
selected = [
    ('vito-step-guide', 'Vito_Step_Guide.pdf', "Vito's Step Guide", 'Original Step Guides - sponsor/sponsee worksheets', 'Scanned worksheets for Steps One through Twelve, with a meeting format and an institutional literature letter.', 'steps', 1),
    ('southern-exposure', 'southern-exposure.pdf', 'Southern Exposure', 'Recovery Under the Sun', 'NA history in Florida. Full archival book scan.', 'history', 1),
    ('impossible-dream', 'impossible-dream.pdf', 'The Impossible Dream', 'A History of Narcotics Anonymous in New York', '2015 Greater New York regional history. Personal accounts reflect the contributors\' views.', 'history', 1),
    ('when-it-works', 'when-it-works.pdf', 'When It Works: 12 Basics', 'The Twelve Principles of Narcotics Anonymous', 'Input & Review booklet. A literary work in progress offered for Home Group participation.', 'principles', 1),
    ('principles-workbook', 'PrinciplesWorkbook-by-Greg-P-Lois-R.pdf', 'Principles Workbook', 'Greg Pierce and Lois Pierce Richards', 'Member-written exercises for studying and applying spiritual principles.', 'principles', 1),
    ('back-to-the-basic', 'Back-to-the-Basic-Step-Guide.pdf', 'Back to the Basic', 'Antoinette W. Bishop - Basic Text study guide', 'Member-written guide with Step studies and personal inventory material. The source permits personal-use copying, not sale or profit.', 'steps', 1),
    ('back-to-the-grey-book', 'Back-To-The-Grey-Book-Final.pdf', 'Back to the Grey Book', 'Line-by-line Step and Tradition study guide', 'Study questions for the 1981 Grey Book. The source permits personal-use copying, not sale or profit.', 'steps', 1),
    ('early-step-guide', 'Early-Step-Working-Guide-pre-1983-.pdf', 'Fifty-Two Questions About Our Steps', 'Early Step-working questions', 'Two-page historical question sheet, archived as pre-1983. Not the NAWS Step Working Guides.', 'steps', 1),
    ('old-school-step-guide', 'OLD-SCHOOL-Step-Writing-Guide.pdf', 'Old-School Step Writing Guide', 'Sponsor/sponsee writing guide and worksheets', 'Alternative Step exercises and worksheets. Not the NAWS Step Working Guides.', 'steps', 1),
    ('clean-and-serene-draft', 'Clean-and-Serene-12-Step-Guide-Proposed-Review-Form-1983.pdf', 'Clean and Serene 12-Step Guide', 'Proposed Review Form - archived as 1983', 'Historical proposed review-form scan, not the published NAWS Step Working Guides.', 'steps', 1),
    ('basic-text-traditions-guide', 'Basic Text 12 Traditions Study Guide .pdf', 'Basic Text Twelve Traditions Study Guide', 'Historical Tradition study questions', 'Scanned guide for studying the Twelve Traditions alongside the Basic Text.', 'traditions', 1),
    ('lonestar-traditions-draft', 'LonestarTraditionGuide.pdf', 'Lone Star Guide to the Twelve Traditions', 'Regional literature committee draft', 'Includes drafts and revisions from the Lone Star regional literature project. Not presented as a completed or fellowship-approved book.', 'traditions', 1),
    ('carolina-traditions-workbook', 'Traditions Workbook with NArchive Note.pdf', 'Practicing the Principles of Our Traditions', 'Carolina Region literature committee work in progress', 'The included archival note identifies this as a late-1990s Carolina Region project, not a Greg Pierce-authored workbook.', 'traditions', 2),
]
additional_sources = {}
if args.additional_review:
    for entry in json.loads(args.additional_review.read_text(encoding='utf-8')):
        note = entry.get('note', 'Historical draft or member study material; not a current NAWS publication.')
        if entry['category'] == 'chapter-drafts':
            note = 'Original chapter-development manuscript from the 1980 Lincoln literature conference. Includes handwritten and cut-and-paste material, not a finished book.'
        selected.append((entry['id'], entry['filename'], entry['title'], entry['subtitle'], note, entry['category'], 1))
        additional_sources[entry['id']] = entry['sourceName']
new_ids = {entry[0] for entry in selected}
books = [book for book in catalog['books'] if book['id'] not in new_ids]
for book in books:
    book.setdefault('category', 'drafts')
    if book['id'] in {'na-tree-first', 'na-tree-second'}:
        book['category'] = 'drafts'
seen = {book['sha256'] for book in books if book.get('sha256')}
for book_id, filename, title, subtitle, note, category, cover_page in selected:
    original = review / filename
    raw = original.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    if digest in seen:
        raise ValueError(f'Duplicate addition: {filename}')
    seen.add(digest)
    pages = len(PdfReader(original).pages)
    relative = Path('literature/library') / f'{book_id}.pdf'
    target = root / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(raw)
    cover_stem = root / 'images/literature' / book_id
    subprocess.run([args.pdftoppm, '-f', str(cover_page), '-singlefile', '-scale-to', '850',
                    '-jpeg', '-jpegopt', 'quality=88', str(original), str(cover_stem)], check=True)
    books.append({'id': book_id, 'title': title, 'subtitle': subtitle, 'category': category,
                  'cover': f'images/literature/{book_id}.jpg', 'pdf': '/'+relative.as_posix(),
                  'note': note, 'pages': pages, 'bytes': len(raw), 'sha256': digest,
                  'sourceName': additional_sources.get(book_id, filename)})
existing_order = {book['id']: index for index, book in enumerate(catalog['books'])}
books.sort(key=lambda book: existing_order.get(book['id'], len(existing_order)))
catalog['books'] = books
catalog_path.write_text(json.dumps(catalog, indent=2, ensure_ascii=False)+'\n', encoding='utf-8')
print(f'Imported {len(selected)} reviewed books and guides; {len(books)} total library entries.')
