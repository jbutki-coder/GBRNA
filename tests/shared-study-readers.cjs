const assert=require('node:assert/strict');
const fs=require('node:fs');
const load=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const grey=load('grey-book-study/book.json');
const old=load('grey-book-study/grey-form-study.json');
const normalize=t=>t.toLowerCase().replace(/[\u2018\u2019']/g,'').replace(/[^a-z0-9]+/g,' ').trim();
assert.equal(grey.sections.length,37);
assert.equal(grey.sections.filter(s=>s.group==='steps').length,12);
assert.equal(grey.sections.filter(s=>s.group==='traditions').length,12);
for(const section of old.sections){
  const paragraphs=grey.pages.flatMap(p=>p.paragraphs).filter(p=>p.section===section.id);
  // Compare word multisets because a page can contain two separately navigable sections.
  const actual=paragraphs.flatMap(p=>p.lines.map(l=>normalize(l.text))).sort();
  const expected=section.blocks.map(b=>normalize(b.text)).sort();
  assert.deepEqual(actual,expected,`${section.id}: all original text retained`);
}
for(const [id,source] of Object.entries(grey.sources)){
  const pages=grey.pages.filter(p=>[source.page,source.pageEnd].includes(p.id));
  assert.ok(pages.length,`${id}: source page exists`);
  const q=normalize(source.quote).split(' ');
  assert.ok(pages.some(p=>p.paragraphs.some(t=>q.some((_,i)=>i<=q.length-4 && normalize(t.text).includes(q.slice(i,i+4).join(' '))))),`${id}: excerpt can be highlighted`);
}
for(const name of ['grey-book-study','baby-blue-study']){
  const html=fs.readFileSync(`${name}/index.html`,'utf8');
  assert.match(html,/\/baby-blue-study\/style.css\?v=20261010-readers2/);
  assert.match(html,/\/baby-blue-study\/study.js\?v=20261010-readers2/);
  for(const id of ['sectionSelect','pageSelect','bookSearch','zoom','darkMode','showLines','copyLink','sourcePassage','bookText'])assert.ok(html.includes(`id="${id}"`));
}
const script=fs.readFileSync('baby-blue-study/study.js','utf8');
assert.match(script,/class="daily-excerpt"/);
assert.match(script,/class="excerpt-date"/);
assert.match(script,/url.searchParams.set\('reading',reading\)/);
assert.match(fs.readFileSync('js/app.js','utf8'),/params.set\('reading', baseReading.id\)/);
console.log('PASS: identical reader controls; all 37 Grey Book sections and original text; 366 source pages and highlightable excerpts; dated source links.');
