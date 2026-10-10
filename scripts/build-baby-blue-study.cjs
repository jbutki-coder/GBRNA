// Rebuild from the printed-page scans already used for the JFT page references.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const ocr = read('draft-maps/printed-template/ocr.json');
const readings = read('data/just-for-today.json');
const matches = read('draft-maps/printed-page-matches.json');
const words = text => text.toLowerCase().replaceAll('\u2019', "'").replace(/(\w)['\u2018\u2019](\w)/g, '$1$2').match(/[a-z0-9]+/g) || [];
const coord = v => Array.isArray(v) ? Math.min(...v) : v;
const output = path.join(root, 'baby-blue-study/pages');
fs.mkdirSync(output, { recursive: true });
const pages = [];
for (const source of ocr) {
  const index = source.templatePdfPage;
  const lower = index % 2 ? 'right' : 'left';
  let number;
  if (index >= 7) number = source.side === lower ? index - 6 : 83 - index;
  else if (index >= 4 && source.side !== lower) number = 83 - index;
  else number = ({ '4-left': 'xi', '5-right': 'xiv', '6-left': 'xv', '3-left': 'gratitude' })[`${index}-${source.side}`];
  if (number === undefined) continue;
  const key = String(number);
  const file = `spread-${String(index).padStart(2, '0')}-${source.side}.png`;
  const original = path.join(root, 'draft-maps/printed-template', file);
  const png = fs.readFileSync(original);
  fs.copyFileSync(original, path.join(output, `${key}.png`));
  const lines = source.lines.filter(line => !(coord(line.y) > source.height * .88 && /^(\d{1,2}|[xiv]+)$/.test(line.text.trim())));
  pages.push({ id: key, number, label: number === 'gratitude' ? 'Gratitude Prayer (unnumbered)' : `Book p. ${number}`,
    image: `/baby-blue-study/pages/${key}.png`, width: png.readUInt32BE(16), height: png.readUInt32BE(20),
    text: lines.map(l => l.text).join('\n'), lines, sourceHeight: source.height });
}
pages.sort((a,b) => {
  const rank = p => typeof p.number === 'number' ? p.number : ({ xi: -3, xiv: -2, xv: -1, gratitude: 80 })[p.id];
  return rank(a) - rank(b);
});
assert.deepEqual(pages.filter(p => typeof p.number === 'number').map(p => p.number), Array.from({length:79}, (_, i) => i+1));
const metadata = [];
for (const page of pages.filter(p => p.id !== 'gratitude')) {
  page.lines.forEach((line, index) => words(line.text).forEach(() => metadata.push({ page, index })));
}
const byId = new Map(pages.map(p => [p.id, p]));
const sources = {};
for (const reading of readings.filter(r => r.babyBlueStatus === 'matched' && r.babyBluePrintedPageVerified)) {
  const page = reading.babyBluePage === null ? 'gratitude' : String(reading.babyBluePage);
  assert(byId.has(page), reading.id);
  const source = { page, pageEnd: reading.babyBluePageEnd ? String(reading.babyBluePageEnd) : page, citation: reading.babyBlueCitation,
    location: reading.babyBlueLocation, quote: reading.babyBlueQuote || reading.quote, highlights: {} };
  const evidence = matches.find(m => m.id === reading.id)?.printed;
  // Highlight only evidence that agrees with the final reviewed physical-page reference.
  if (evidence && String(evidence.page) === page && evidence.score >= .72) {
    const fragments = evidence.fragments || [evidence];
    for (const fragment of fragments) {
      for (const item of metadata.slice(fragment.start, fragment.end)) {
        if (item.page.id !== page && item.page.id !== source.pageEnd) continue;
        const y = coord(item.page.lines[item.index].y);
        const next = item.page.lines[item.index + 1];
        const height = Math.min(48, Math.max(24, next ? coord(next.y) - y : 36));
        const rect = { top: y / item.page.sourceHeight * 100, height: height / item.page.sourceHeight * 100 };
        const group = source.highlights[item.page.id] ||= [];
        if (!group.some(r => r.top === rect.top)) group.push(rect);
      }
    }
  }
  sources[reading.id] = source;
}
const chapters = [
  ['symbol','Our Symbol','xi'], ['introduction','Introduction','xiv'],
  ['chapter-1','1. Who Is an Addict?',1], ['chapter-2','2. What Is the NA Program?',5],
  ['chapter-3','3. Why Are We Here?',9], ['chapter-4','4. How It Works',13],
  ['chapter-5','5. What Can I Do?',39], ['chapter-6','6. The Twelve Traditions',43],
  ['chapter-7','7. Recovery and Relapse',57], ['chapter-8','8. We Do Recover',65],
  ['chapter-9','9. Just For Today - Living the Program',69], ['chapter-10','10. More Will Be Revealed',75],
  ['gratitude','Gratitude Prayer','gratitude']
].map(([id,title,page]) => ({id,title,page:String(page),group:'chapters'}));
const names = ['One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve'];
const steps = [15,17,19,20,23,25,26,28,29,31,32,36].map((page,i) => ({id:`step-${i+1}`,title:`Step ${names[i]}`,page:String(page),group:'steps'}));
const traditions = [44,45,46,47,48,49,50,51,52,53,54,54].map((page,i) => ({id:`tradition-${i+1}`,title:`Tradition ${names[i]}`,page:String(page),group:'traditions'}));
const data = {title:'Baby Blue Basic Text', pages: pages.map(({lines,sourceHeight,...page}) => page), sections:[...chapters,...steps,...traditions], sources};
fs.writeFileSync(path.join(root, 'baby-blue-study/book.json'), JSON.stringify(data));
console.log(`Baby Blue study built: ${pages.length} printed pages, ${data.sections.length} sections, ${Object.keys(sources).length} JFT source links.`);
console.log('Finish the text reader build with: python scripts/extract-baby-blue-study.py');
