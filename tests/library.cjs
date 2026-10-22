'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const catalog=require('../data/literature-library.json');
assert.equal(catalog.books.length,53);
assert.equal(new Set(catalog.books.map(b=>b.id)).size,53);
assert.deepEqual(catalog.categories.map(c=>catalog.books.filter(b=>b.category===c.id).length),[16,8,2,12,5,10]);
for(const id of ['na-tree-first','na-tree-second'])assert.equal(catalog.books.find(b=>b.id===id).category,'drafts');
for(const id of ['matter-of-principle','my-years-with-na','tradition-wars'])assert.equal(catalog.books.find(b=>b.id===id).category,'history');
assert.match(catalog.books.find(b=>b.id==='tradition-wars').note,/not for distribution/);
const hashes=catalog.books.filter(b=>b.sha256).map(b=>b.sha256);
assert.equal(new Set(hashes).size,hashes.length,'No duplicate local PDF copies');
for(const id of ['getting-realer','historical-traditions','journey-traditions','daily-meditation-guide','our-way-of-life','in-loving-service','na-tree-first','na-tree-second']){
  assert.ok(catalog.books.some(b=>b.id===id),id);
}
assert.ok(!catalog.books.some(b=>/step-one-draft|iwhw-approval|h-and-i-handbook|declaration-autonomy/.test(b.id)));
assert.ok(!catalog.books.some(b=>/WSC.*Minutes|1993-IWHW-Approval|Guide.to.Service/i.test(b.sourceName||'')));
assert.equal(catalog.books.filter(b=>b.category==='chapter-drafts').length,10);
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
assert.equal(catalog.books.filter(b=>b.sha256).length,46);
assert.equal(catalog.books.find(b=>b.id==='vito-step-guide').pages,10);
assert.ok(catalog.books.find(b=>b.id==='carolina-traditions-workbook').note.includes('Carolina Region'));
assert.ok(catalog.books.find(b=>b.id==='when-it-works').note.includes('Input & Review'));
const html=fs.readFileSync(path.join(root,'library/index.html'),'utf8');
assert.ok(html.includes('librarySearch')&&html.includes('libraryCategory'));
assert.ok(!html.includes('+<div'));
console.log('Library: categories, requested history books, NA Tree placement, unique local PDFs, covers and exclusions verified.');
