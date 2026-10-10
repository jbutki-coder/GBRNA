"""Align the complete existing study text to the printed manuscript's pages and lines."""
import bisect
import json
import re
from difflib import SequenceMatcher
from pathlib import Path
import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
load = lambda p: json.loads((ROOT / p).read_text(encoding='utf-8'))
old = load('grey-book-study/grey-form-study.json')
context = load('data/grey-book-context.json')
words = ['one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve']
ranges = {'symbol': ['Frontispiece'], 'forward': ['i','ii'], 'introduction':['iii','iv','v'],
          'chapter-1':(1,14),'chapter-2':(15,22),'chapter-3':(23,27),'chapter-4':(28,30),
          'chapter-5':(78,86),'chapter-6':(87,90),'chapter-7':(118,131),'chapter-8':(132,142),
          'chapter-9':(143,149),'chapter-10':(150,161)}
for i,(start,end) in enumerate([(30,34),(34,37),(37,40),(40,43),(43,46),(46,48),(48,50),(50,52),(52,54),(54,57),(57,59),(59,77)]):
    ranges['step-'+words[i]]=(start,end)
for i,(start,end) in enumerate([(90,92),(92,97),(97,100),(100,102),(102,104),(103,106),(106,108),(108,110),(110,112),(112,113),(113,115),(115,117)]):
    ranges['tradition-'+words[i]]=(start,end)

def tokens(text):
    return [(m.group().lower().replace("'",''),m.start(),m.end()) for m in re.finditer(r"[a-z0-9]+(?:'[a-z0-9]+)*",text,re.I)]

raw_pages={}
with pdfplumber.open(ROOT/'literature/grey-book-memphis-1981-review-form.pdf') as pdf:
    for physical in range(10,183):
        page=pdf.pages[physical]
        lines=page.extract_text_lines()
        footer=[x['text'].strip() for x in lines if x['top']>page.height*.85 and re.fullmatch(r'\d{1,3}|[iv]+',x['text'].strip())]
        # Some scanned footers are absent or OCR'd as "ll5". The numbered body
        # occupies consecutive physical leaves 19-179 in this specific manuscript.
        label=str(physical-17) if 18<=physical<=178 else footer[-1] if footer else None
        if label is None: continue
        if label.isdigit() and not 1<=int(label)<=161:continue
        if label in raw_pages:continue
        body=[]
        for line in lines:
            text=line['text'].strip()
            if re.search(r'REVIEW|DISTRIBUTION|MEMPHIS',text,re.I) or (line['top']>page.height*.85 and re.fullmatch(r'[\dliIv]+',text)):continue
            number=None
            # The manuscript alternates line numbers between the left and right margins.
            match=re.match(r'^(\d{1,2}|[lI]{1,2})\s+(.+)$',text)
            tail=re.match(r'^(.+?)\s+(\d{1,2}|[lI]{1,2})$',text)
            candidate=match if match and line['x0']<page.width*.18 else tail
            if candidate:
                n=candidate[1] if candidate is match else candidate[2]
                n=n.replace('l','1').replace('I','1')
                if n.isdigit() and 1<=int(n)<=45:
                    number=int(n);text=candidate[2] if candidate is match else candidate[1]
            body.append({'text':text,'number':number,'x':line['x0'],'top':line['top']})
        raw_pages[label]=body

pages={}
sections=[]
paragraph_starts=[' '.join(t[0] for t in tokens(p['text'])) for p in context['paragraphs'].values()]
for original in old['sections']:
    sid=original['id'];bounds=ranges[sid]
    labels=[str(i) for i in range(bounds[0],bounds[1]+1)] if isinstance(bounds,tuple) else bounds
    raw=[];meta=[]
    for label in labels:
        for line in raw_pages.get(label,[]):
            for token,_,_ in tokens(line['text']):raw.append(token);meta.append((label,line['number']))
    blocks=original['blocks'];clean=[];block_offsets=[]
    for b in blocks:
        block_offsets.append(len(clean));clean.extend(t[0] for t in tokens(b['text']))
    alignment={}
    for match in SequenceMatcher(None,clean,raw,autojunk=False).get_matching_blocks():
        for n in range(match.size):alignment[match.a+n]=match.b+n
    keys=sorted(alignment)
    if not keys and sid!='symbol':raise ValueError('Cannot locate '+sid)
    chapter='chapter-4' if sid.startswith('step-') else 'chapter-6' if sid.startswith('tradition-') else sid
    group='steps' if sid.startswith('step-') else 'traditions' if sid.startswith('tradition-') else 'chapters'
    section={'id':sid,'title':original['title'],'group':group,'pages':[]}
    current=None
    for index,b in enumerate(blocks):
        offset=block_offsets[index];end=block_offsets[index+1] if index+1<len(blocks) else len(clean)
        hits=[alignment[k] for k in keys[bisect.bisect_left(keys,offset):bisect.bisect_left(keys,end)]]
        if hits:
            label,number=meta[hits[len(hits)//2]]
        elif keys:
            closest=min(keys,key=lambda k:abs(k-offset));label,number=meta[alignment[closest]]
        else:label,number=labels[0],None
        page=pages.setdefault(label,{'id':label,'number':int(label) if label.isdigit() else None,'label':f'Book p. {label}','paragraphs':[],'text':''})
        if label not in section['pages']:section['pages'].append(label)
        text=b['text'].strip()
        heading=b['kind']=='heading'
        # Existing paragraph records identify paragraph starts; retain headings separately.
        normalized=' '.join(t[0] for t in tokens(text))
        starts=any(p.startswith(normalized) for p in paragraph_starts) if normalized else False
        if current is None or current not in page['paragraphs'] or heading or current['kind']=='heading' or starts:
            current={'kind':'heading' if heading else 'text','text':text,'chapter':chapter,'section':sid,'lines':[]}
            page['paragraphs'].append(current)
        else:current['text']+=' '+text
        current['lines'].append({'number':number if number is not None else '', 'text':text})
    section['page']=section['pages'][0]
    sections.append(section)

for page in pages.values():
    page['text']='\n\n'.join(p['text'] for p in page['paragraphs'])
    for p in page['paragraphs']:
        ns=[x['number'] for x in p['lines'] if isinstance(x['number'],int)]
        p['lineLabel']=f'Lines {min(ns)}-{max(ns)}' if ns else 'Unnumbered passage'
for section in sections:
    if section['id'] in ['chapter-4','chapter-6']:
        section['pages']=[id for id,p in pages.items() if any(x['chapter']==section['id'] for x in p['paragraphs'])]

sources={}
for r in load('data/reflections.json'):
    c=context['contexts'][r['id']]
    sources[r['id']]={'page':c['sourcePages'][0],'pageEnd':c['sourcePages'][-1],'quote':r['quote'],'citation':c['citation'],'location':c['section']}
    if 'Forward' in c['citation']:
        sources[r['id']].update(page='i',pageEnd='i',location='Forward',citation='Grey Book, p. i (Forward)')
rank=lambda id:int(id) if id.isdigit() else {'Frontispiece':-6,'i':-5,'ii':-4,'iii':-3,'iv':-2,'v':-1}.get(id,-7)
for s in sections:s['pages'].sort(key=rank);s['page']=s['pages'][0]
result={'title':'Grey Book','pages':sorted(pages.values(),key=lambda p:rank(p['id'])),'sections':sections,'sources':sources}
(ROOT/'grey-book-study/book.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
assert len(sections)==37
assert sum(len(p['lines']) for pg in result['pages'] for p in pg['paragraphs'])==sum(len(s['blocks']) for s in old['sections'])
print(f"Preserved every original text block: {len(pages)} printed pages, {len(sections)} sections, {len(sources)} daily readings")
