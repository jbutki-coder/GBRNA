"""Import individual issues from the two user-supplied publication ZIPs."""
import argparse
import hashlib
import io
import json
import re
import zipfile
from pathlib import Path

from pypdf import PdfReader

parser = argparse.ArgumentParser()
parser.add_argument('arna_zip')
parser.add_argument('na_way_zip')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
issues = []
arna_dates = {
    'arna-newsletter-1-november-2020.pdf': '2020-11', '2020december.pdf': '2020-12',
    '2021jan.pdf': '2021-01', '2021feb.pdf': '2021-02', '2021mar.pdf': '2021-03',
    '2021apr.pdf': '2021-04', '2021may.pdf': '2021-05', '2021june.pdf': '2021-06',
    '2021sep.pdf': '2021-09', '2022jul.pdf': '2022-07', '2022oct.pdf': '2022-10',
    'arna-newsletter-may-2023.pdf': '2023-05', 'march2024.pdf': '2024-03',
}
months = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July',
          'August', 'September', 'October', 'November', 'December']
for series, archive in [('arna', args.arna_zip), ('na-way', args.na_way_zip)]:
    with zipfile.ZipFile(archive) as source:
        for entry in source.infolist():
            if entry.is_dir() or not entry.filename.lower().endswith('.pdf'):
                continue
            name = Path(entry.filename).name
            raw = source.read(entry)
            reader = PdfReader(io.BytesIO(raw))
            if series == 'arna':
                date = arna_dates[name.lower()]
                year, month = map(int, date.split('-'))
                issue_id = f'arna-{date}'
                title = f'ARNA Newsletter - {months[month]} {year}'
                order = year * 100 + month
            else:
                volume = int(re.fullmatch(r'Volume (\d+)\.pdf', name).group(1))
                date = ''
                issue_id = f'na-way-{volume:02}'
                title = f'The New/Old NA Way - Volume {volume}'
                order = volume
            relative = Path('publications') / 'pdfs' / series / f'{issue_id}.pdf'
            # Volume 63 is already hosted as the FSC Conference Report.
            existing = root / 'fsc/documents/FSC-2027-Conference-Agenda-Report.pdf'
            if series == 'na-way' and order == 63 and existing.exists() and existing.read_bytes() == raw:
                relative = existing.relative_to(root)
            else:
                target = root / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(raw)
            issues.append({'id': issue_id, 'series': series, 'title': title, 'date': date,
                           'order': order, 'pdf': '/' + relative.as_posix(), 'pages': len(reader.pages),
                           'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(), 'sourceName': name})
if len({i['id'] for i in issues}) != len(issues):
    raise ValueError('Duplicate publication identity')
issues.sort(key=lambda i: (i['series'], -i['order']))
(root / 'data/publications.json').write_text(json.dumps({'issues': issues}, indent=2) + '\n', encoding='utf-8')
print(f'Imported {len(issues)} individually linked issues; every PDF parsed successfully.')
