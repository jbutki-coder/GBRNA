'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const issues=require('../data/publications.json').issues;
assert.equal(issues.length,65);
assert.equal(issues.filter(i=>i.series==='purist').length,6);
assert.equal(issues.filter(i=>i.series==='arna').length,13);
assert.deepEqual(issues.filter(i=>i.series==='na-way').map(i=>i.order).sort((a,b)=>a-b),Array.from({length:46},(_,i)=>i+19));
assert.equal(new Set(issues.map(i=>i.id)).size,issues.length);
assert.equal(new Set(issues.map(i=>i.pdf)).size,issues.length);
const html=fs.readFileSync(path.join(root,'publications/index.html'),'utf8');
for(const issue of issues){
  const bytes=fs.readFileSync(path.join(root,issue.pdf));
  assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),issue.sha256,issue.title);
  assert.ok(html.includes(`id="${issue.id}"`));
  assert.ok(html.includes(`href="${issue.pdf}" download`));
  assert.ok(html.includes(`url=${encodeURIComponent(issue.pdf)}`));
  assert.ok(fs.existsSync(path.join(root,issue.cover)),issue.id+' cover');
  assert.ok(html.includes(`src="${issue.cover}"`),issue.id+' displayed cover');
}
assert.equal((html.match(/class="issue-row"/g)||[]).length,issues.length);
assert.equal((html.match(/class="issue-cover"/g)||[]).length,issues.length);
assert.ok(html.includes('class="publications-page"'));
assert.ok(html.includes('/publications/style.css?v=20261022-issue-covers'));
assert.ok(html.includes('/publications/images/the-group-shares.png'));
assert.ok(fs.existsSync(path.join(root,'publications/images/the-group-shares.png')));
assert.ok(!html.includes('drive.google.com/drive/folders'));
const home=fs.readFileSync(path.join(root,'index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
assert.ok(app.includes('${renderDailyAudio(baseReading)}'),'Daily reflection player remains on home');
assert.ok(app.includes('attachAudioPlayers();'));
assert.ok(app.includes("data/gbr-daily-audio.json"));
assert.ok(!app.includes('${renderAudioLibrary('),'Large audio library no longer injected into readings');
assert.ok(home.includes('/js/reflection-audio-player.js'));
assert.ok(home.includes('js/source-audio.js'));
assert.ok(!home.includes('<script src="js/audio.js"'));
const audio=fs.readFileSync(path.join(root,'audio/index.html'),'utf8');
assert.ok(audio.includes('id="audioLibrary"'));
assert.ok(!audio.includes('id="dailyAudio"'),'Daily reflection player has not moved to Audio tab');
for(const file of ['index.html','audio/index.html','publications/index.html','archive-master-index.html','meetings/index.html','fsc/index.html','grey-book-study/index.html','baby-blue-study/index.html','just-for-today/index.html','jft.html','lwb-draft/index.html','pdf-reader.html','purchase-literature/index.html','asis-ips/index.html','rni-history/index.html']){
  const nav=fs.readFileSync(path.join(root,file),'utf8').match(/<nav\b[^>]*class="(?:global-tabs|site-tabs)"[^>]*>[\s\S]*?<\/nav>/)[0];
  assert.equal(nav.split('href="/audio/"').length-1,1,file);
  assert.equal(nav.split('href="/publications/"').length-1,1,file);
}
console.log('PASS: 65 unique issue PDFs and covers, six Purist newsletters, individual read/download links, daily/source audio retained on home.');
