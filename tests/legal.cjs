'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const documents=require('../data/legal-documents.json').documents;
const html=fs.readFileSync(path.join(root,'legal/index.html'),'utf8');
assert.equal(documents.length,14);
assert.equal(new Set(documents.map(d=>d.id)).size,14);
assert.equal(new Set(documents.map(d=>d.sha256)).size,14);
assert.deepEqual(['arna','moorhead'].map(group=>documents.filter(d=>d.group===group).length),[3,11]);
assert.ok(documents.every(d=>!['Correspondence','Historical record','Discussion transcript','Trust background'].includes(d.kind)));
for(const doc of documents){
  const raw=fs.readFileSync(path.join(root,doc.pdf));
  assert.equal(raw.subarray(0,5).toString(),'%PDF-',doc.title);
  assert.equal(raw.length,doc.bytes,doc.title);
  assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),doc.sha256,doc.title);
  assert.ok(doc.pages>0);
  assert.ok(html.includes(`id="${doc.id}"`));
  assert.ok(html.includes(`href="${doc.pdf}" download`));
  assert.ok(html.includes('url='+encodeURIComponent(doc.pdf)));
}
assert.doesNotMatch(html,/mail\.google|drive\.google|mailto:|wgfritzconstruction|Hoge.Fenton|Engagement.Letter|LEGAL.STRATEGY/i);
assert.match(html,/not legal advice or a complete court docket/);
const pages=execFileSync('git',['ls-files','*.html'],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/);
for(const page of [...pages,'legal/index.html']){
  const source=fs.readFileSync(path.join(root,page),'utf8');
  if(!source.includes('global-tabs')&&!source.includes('site-tabs')&&!page.startsWith('translation-readings/'))continue;
  const nav=source.match(/<nav\b[^>]*>[\s\S]*?<\/nav>/)?.[0];
  assert.equal((nav?.match(/href="\/legal\/"/g)||[]).length,1,`${page}: one Legal tab`);
}
console.log('Legal: 14 local court PDFs, hashes, classifications, privacy exclusions, and site navigation verified.');
