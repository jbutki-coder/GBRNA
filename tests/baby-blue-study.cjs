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
console.log('PASS: 83 physical pages, 37 sections, 331 source links, image dimensions, variants and honest exceptions.');
