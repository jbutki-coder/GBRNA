const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const book = JSON.parse(fs.readFileSync(path.join(root, 'baby-blue-study/book.json')));
const readings = JSON.parse(fs.readFileSync(path.join(root, 'data/just-for-today.json')));
assert.equal(book.pages.length, 83);
assert.deepEqual(book.pages.filter(p => typeof p.number === 'number').map(p => p.number), Array.from({length:79}, (_,i) => i+1));
assert.equal(book.sections.length, 37);
assert.equal(Object.keys(book.sources).length, 331);
for (const page of book.pages) {
  const png = fs.readFileSync(path.join(root, page.image));
  assert.equal(png.readUInt32BE(16), page.width);
  assert.equal(png.readUInt32BE(20), page.height);
}
for (const reading of readings) {
  const source = book.sources[reading.id];
  if (reading.babyBlueStatus !== 'matched') { assert.equal(source, undefined); continue; }
  assert.ok(source, reading.id);
  assert.equal(source.page, reading.babyBluePage === null ? 'gratitude' : String(reading.babyBluePage));
  assert.equal(source.citation, reading.babyBlueCitation);
  assert.equal(source.location, reading.babyBlueLocation);
  assert.equal(source.quote, reading.babyBlueQuote || reading.quote);
  for (const rects of Object.values(source.highlights)) for (const rect of rects) {
    assert.ok(rect.top >= 0 && rect.top + rect.height <= 100);
  }
}
assert.match(book.sources['10-06'].location, /Step Eight/);
assert.equal(book.sources['10-06'].page, '29');
assert.equal(book.sources['10-03'].page, '78');
assert.equal(book.sources['05-03'].page, 'gratitude');
new vm.Script(fs.readFileSync(path.join(root, 'baby-blue-study/study.js'), 'utf8'));
const context = {};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'baby-blue-study/study.js'), 'utf8').split('(async function')[0], context);
for (const section of book.sections) {
  assert.ok(section.pages.length, section.id);
  for (const id of section.pages) {
    const page = book.pages.find(p => p.id === id);
    assert.ok(page.paragraphs.some(p => (section.group === 'chapters' ? p.chapter : p.section) === section.id));
  }
}
assert.equal(context.babyBlueSectionForPage(book, '67', 'tradition-12', null).id, 'chapter-8');
assert.equal(context.babyBlueSectionForPage(book, '29', 'step-9', null).id, 'step-9');
assert.equal(context.babyBlueSectionForPage(book, '29', null, book.sources['10-06']).id, 'step-8');
for (const source of Object.values(book.sources)) {
  assert.ok(context.babyBlueSourceSection(book, source)?.pages.includes(source.page), source.citation);
}
assert.equal(book.pages.find(p => p.id === 'xi').paragraphs.length, 5);
assert.ok(!book.pages.find(p => p.id === 'xi').text.includes('INTRODUCTION'));
assert.ok(book.pages.find(p => p.id === '63').text.includes('we learn to trust and depend on our Higher Power as we understand it'));
assert.ok(book.pages.find(p => p.id === '74').text.includes('JUST FOR TODAY'));
assert.ok(!book.pages.some(p => p.text.includes('\ufffd')));
assert.ok(book.pages.find(p => p.id === '13').paragraphs.some(p => p.text.startsWith('8. We made a list')));
assert.ok(book.pages.find(p => p.id === '54').sections.includes('tradition-11'));
assert.ok(book.pages.find(p => p.id === '54').sections.includes('tradition-12'));
console.log('PASS: 83 physical pages, 37 sections, 331 source links, image dimensions, variants and honest exceptions.');
console.log('PASS: extracted paragraphs, transition pages, all source sections and navigation regression checks.');
