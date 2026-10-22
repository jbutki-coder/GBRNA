'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const catalog=require('../data/literature-library.json');
assert.equal(catalog.books.length,20);
assert.equal(new Set(catalog.books.map(b=>b.id)).size,20);
assert.deepEqual(catalog.categories.map(c=>catalog.books.filter(b=>b.category===c.id).length),[7,2,2,6,3]);
for(const book of catalog.books){
  assert.ok(catalog.categories.some(c=>c.id===book.category),book.id);
  assert.ok(fs.existsSync(path.join(root,book.cover)),book.id+' cover');
  assert.ok(!['step-working-guide','naws-step-working-guides'].includes(book.id));
  assert.ok(!book.sourceName||!/^Step Working Guide\.pdf$|1996-12-11-NAWS-Lit-Comm-SWG/i.test(book.sourceName));
  if(book.pdf){
    const raw=fs.readFileSync(path.join(root,book.pdf));
    assert.equal(raw.subarray(0,5).toString(),'%PDF-',book.id);
    if(book.sha256)assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),book.sha256,book.id);
  }
}
assert.equal(catalog.books.filter(b=>b.sha256).length,13);
assert.equal(catalog.books.find(b=>b.id==='vito-step-guide').pages,10);
assert.ok(catalog.books.find(b=>b.id==='carolina-traditions-workbook').note.includes('Carolina Region'));
assert.ok(catalog.books.find(b=>b.id==='when-it-works').note.includes('Input & Review'));
const html=fs.readFileSync(path.join(root,'library/index.html'),'utf8');
assert.ok(html.includes('librarySearch')&&html.includes('libraryCategory'));
assert.ok(!html.includes('+<div'));
console.log('Library: 20 distinct titles, 13 exact local PDFs, covers, five sections, correct provenance, and NAWS guide exclusion verified.');
