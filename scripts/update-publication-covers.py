"""Render individual issue covers and optionally import reviewed Purist issues."""
import argparse
import hashlib
import json
import re
import subprocess
from datetime import datetime
from pathlib import Path
from pypdf import PdfReader

parser = argparse.ArgumentParser()
parser.add_argument('--pdftoppm', required=True)
parser.add_argument('--purist-folder', type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
catalog_path = root / 'data/publications.json'
catalog = json.loads(catalog_path.read_text(encoding='utf-8'))
issues = {issue['id']: issue for issue in catalog['issues']}
if args.purist_folder:
    for source in sorted(args.purist_folder.glob('purist-????-??.pdf')):
        date = source.stem.removeprefix('purist-')
        if not re.fullmatch(r'\d{4}-\d{2}', date):
            raise ValueError(source.name)
        raw = source.read_bytes()
        relative = Path('publications/pdfs/purist') / source.name
        (root / relative).parent.mkdir(parents=True, exist_ok=True)
        (root / relative).write_bytes(raw)
        issues[source.stem] = {
            'id': source.stem, 'series': 'purist',
            'title': 'The Purist Newsletter - ' + datetime.strptime(date, '%Y-%m').strftime('%B %Y'),
            'date': date, 'order': int(date.replace('-', '')), 'pdf': '/' + relative.as_posix(),
            'pages': len(PdfReader(source).pages), 'bytes': len(raw),
            'sha256': hashlib.sha256(raw).hexdigest(), 'sourceName': date + '-Purist-Newsletter.pdf',
        }
for issue in issues.values():
    source = root / issue['pdf'].lstrip('/')
    stem = root / 'publications/images' / issue['id']
    subprocess.run([args.pdftoppm, '-f', '1', '-singlefile', '-scale-to', '600',
                    '-jpeg', '-jpegopt', 'quality=85', str(source), str(stem)], check=True)
    issue['cover'] = '/publications/images/' + issue['id'] + '.jpg'
    if issue['id'] == 'purist-2011-01':
        issue['coverRotation'] = 90
catalog['issues'] = sorted(issues.values(), key=lambda issue: (issue['series'], -issue['order']))
catalog_path.write_text(json.dumps(catalog, indent=2) + '\n', encoding='utf-8')
print(f'{len(issues)} individual issues, each with its own actual cover.')
