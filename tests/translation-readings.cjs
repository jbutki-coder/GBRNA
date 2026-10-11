'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {renderReader,load}=require('../translation-reader.cjs');
const root=path.resolve(__dirname,'..');
for(const book of ['gbr','jft','tonight','baby','grey']) {
  for(const reading of load('jft')) {
    const html=fs.readFileSync(path.join(root,`translation-readings/${book}/${reading.id}.html`),'utf8');
    assert.ok(!html.includes('<script'), 'Reading text must not require scripts');
    if(book==='gbr' || book==='jft') assert.ok(html.includes(reading.date));
    if(book==='baby' || book==='grey') {
      const source=load(book).sources[reading.id];
      if(source) {
        assert.ok(html.includes(source.citation.replace(/&/g,'&amp;')),`${book} ${reading.id}: physical citation`);
        assert.ok(html.includes('<mark>'),`${book} ${reading.id}: highlighted source`);
      }
    }
  }
}
let files=0, links=0;
const available=new Set(['gbr','jft','tonight','baby','grey'].flatMap(book=>fs.readdirSync(path.join(root,'translation-readings',book)).map(name=>`/translation-readings/${book}/${name}`)));
for(const book of ['gbr','jft','tonight','baby','grey']) {
  for(const filename of fs.readdirSync(path.join(root,'translation-readings',book))) {
    const html=fs.readFileSync(path.join(root,'translation-readings',book,filename),'utf8');files++;
    for(const [,href] of html.matchAll(/href="(\/translation-readings\/[^"#]+)(?:#[^"]*)?"/g)) {
      assert.ok(available.has(href),`Missing reading link: ${filename} -> ${href}`);links++;
    }
  }
}
const script=fs.readFileSync(path.join(root,'js/translation.js'),'utf8').replace('  function googleTranslateUrl(language) {','  globalThis.urlForTest = googleTranslateUrl;\n  function googleTranslateUrl(language) {');
for(const [url,expected] of [
  ['https://example.org/#10-03','/translation-readings/gbr/10-03.html'],
  ['https://example.org/just-for-today/#10-03','/translation-readings/jft/10-03.html'],
  ['https://example.org/baby-blue-study/?reading=10-03','/translation-readings/baby/10-03.html'],
  ['https://example.org/grey-book-study/?reading=10-03#step-eight','/translation-readings/grey/section-step-eight.html'],
  ['https://example.org/lwb-draft/','/lwb-draft/'],
  ['https://gbrna-onrender-com.translate.goog/just-for-today/?_x_tr_sl=en&_x_tr_tl=es#10-10','/translation-readings/jft/10-10.html'],
]) {
  const sandbox={URL,URLSearchParams,Intl,Date,Set,Map,WeakMap,WeakSet,document:{documentElement:{lang:'en',dir:''},readyState:'loading',addEventListener(){},getElementById(){return null;}},window:{location:{href:url}}};
  vm.runInNewContext(script,sandbox);
  const translated=new URL(sandbox.urlForTest('es'));
  assert.equal(translated.searchParams.get('tl'),'es');
  assert.equal(new URL(translated.searchParams.get('u')).pathname,expected);
  assert.ok(!new URL(translated.searchParams.get('u')).hostname.endsWith('.translate.goog'),'Do not nest translated proxy URLs');
}
assert.ok(!renderReader({book:'gbr',reading:'10-10',section:'<script>'}).includes('<script>'));
console.log(`Translation readings verified: ${files} pages, ${links} local reading links, all dated source passages and translator routes.`);
