"""Copy reviewed IPs byte-for-byte and record their local provenance."""
import argparse
import hashlib
import json
from pathlib import Path
from pypdf import PdfReader

parser=argparse.ArgumentParser()
parser.add_argument('review_folder',type=Path)
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
manifest=root/'data/asis-literature-additions.json'
data=json.loads(manifest.read_text(encoding='utf-8'))
ids={entry['id'] for entry in data['additions']}
seen={hashlib.sha256(p.read_bytes()).hexdigest() for p in (root/'asis-ips/pdfs').glob('*.pdf') if p.stem not in ids}
for entry in data['additions']:
    source=args.review_folder/entry['sourceName']
    raw=source.read_bytes()
    digest=hashlib.sha256(raw).hexdigest()
    if digest in seen:
        raise ValueError('Duplicate PDF: '+entry['sourceName'])
    seen.add(digest)
    target=root/'asis-ips/pdfs'/(entry['id']+'.pdf')
    target.write_bytes(raw)
    entry.update(pdf='/'+target.relative_to(root).as_posix(),sha256=digest,bytes=len(raw),pages=len(PdfReader(source).pages))
manifest.write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8')
print(f'Imported {len(data["additions"])} distinct reviewed IP files.')
