"""Import only the reviewed legal-document allowlist, never an entire mailbox or Drive folder."""
import argparse
import hashlib
import io
import json
import re
from pathlib import Path
from pypdf import PdfReader

parser = argparse.ArgumentParser()
parser.add_argument('review_folder')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
review = Path(args.review_folder)
collection = 'FIPT & Literature Litigation Records/'
# source, collection, category, public title, descriptive note
selected = [
    ('arna-petition.pdf', 'arna', 'Filing', 'ARNA petition with exhibits', 'Filed January 28, 2020. Petition concerning instructions, trustee compensation, removal and replacement of trustee, and surcharge.'),
    ('naws-demurrer.pdf', 'arna', 'Filing', 'NAWS notice of demurrer and demurrer', 'Includes memorandum of points and authorities and declaration of Jonathan H. Park. The cover lists a May 14, 2020 hearing.'),
    ('Bo-Sewell-Declaration-7.30.20.pdf', 'arna', 'Declaration', 'Bo Sewell declaration in support of opposition to demurrer', 'July 30, 2020. The original three-page scan is upside down; use the PDF reader rotation control.'),
    (collection+'1990-11-27-Hollahan-Declaration.pdf', 'moorhead', 'Declaration', 'Hollahan declaration', 'November 27, 1990.'),
    (collection+'1990-11-27-Tooredman-Declaration.pdf', 'moorhead', 'Declaration', 'Tooredman declaration', 'November 27, 1990.'),
    (collection+'1991-01-02-WSO-vs-Moorhead-COMPLAINT.pdf', 'moorhead', 'Filing', 'WSO filing: preliminary-injunction memorandum', 'Archived under the filename COMPLAINT. The document begins with WSO\'s memorandum and arguments for a preliminary injunction.'),
    (collection+'1991-01-04-Court-Order.pdf', 'moorhead', 'Order', 'January 1991 order document', 'The supplied copy begins with an order labeled Exhibit A. See the signed agreement and hearing transcripts alongside it.'),
    (collection+'1991-01-04-WSO-v-Dave-M.-Signed-Agreement.pdf', 'moorhead', 'Agreement', 'WSO and David Moorhead signed agreement', 'Archived as January 4, 1991.'),
    ('Court-Transcript-of-Grateful-Dave-Moorhead-Lawsuit-text-searchable.pdf', 'moorhead', 'Transcript', 'January 2, 1991 hearing transcript - searchable copy', '160 pages. World Service Office, Inc. v. David Moorhead, before Judge Louis H. Pollak.'),
    ('1991-01-02-WSO-vs-Moorhead-Transcripts.pdf', 'moorhead', 'Transcript', 'January 2, 1991 hearing transcript - alternate scan', 'A second 160-page scan of the same proceeding, retained as a separate archival version.'),
    (collection+'1991-04-20-Jim-Kathleen-Millers-Declaration.pdf', 'moorhead', 'Declaration', 'Jim and Kathleen Miller declaration', 'Archived as April 20, 1991.'),
    (collection+'1992-04-22-Basis-For-Motion-for-Contempt.pdf', 'moorhead', 'Filing', 'Basis for motion for contempt', 'Archived as April 22, 1992.'),
    (collection+'1992-04-29-Court-Transcripts-of-Contempt-Hearing.pdf', 'moorhead', 'Transcript', 'April 29, 1992 contempt-hearing transcript', 'World Service Office, Inc. v. David Moorhead.'),
    (collection+'1992-04-Dave-M-Motion-for-Preliminary-Injuction.pdf', 'moorhead', 'Filing', 'David Moorhead motion notice: enforce or vacate and preliminary injunction', 'One-page April 1992 notice referring to motions and expedited proceedings; not the complete motion packet.'),
]
documents = []
seen = set()
for source, group, kind, title, note in selected:
    original = review / source
    raw = original.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    if digest in seen:
        raise ValueError(f'Duplicate file in allowlist: {source}')
    seen.add(digest)
    reader = PdfReader(io.BytesIO(raw))
    slug = re.sub(r'[^a-z0-9]+', '-', original.stem.lower()).strip('-')
    relative = Path('legal/documents') / (slug + '.pdf')
    target = root / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(raw)
    documents.append({'id': slug, 'group': group, 'kind': kind, 'title': title, 'note': note,
                      'pdf': '/'+relative.as_posix(), 'pages': len(reader.pages),
                      'bytes': len(raw), 'sha256': digest, 'sourceName': original.name})
(root/'data/legal-documents.json').write_text(json.dumps({'documents': documents}, indent=2)+'\n', encoding='utf-8')
print(f'Imported {len(documents)} reviewed, distinct documents without changing their bytes.')
