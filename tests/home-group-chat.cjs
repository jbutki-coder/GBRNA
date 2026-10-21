'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const cp=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const invite='https://groupme.com/join_group/112220426/cmMrS4SR';
let checked=0;
for(const file of cp.execFileSync('git',['ls-files','*.html'],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/)){
  const html=fs.readFileSync(path.join(root,file),'utf8');
  const nav=html.match(/<nav\b[^>]*(?:class="(?:global-tabs|site-tabs)"|aria-label="Readings")[^>]*>[\s\S]*?<\/nav>/)?.[0];
  if(!nav)continue;
  assert.equal(nav.split(`href="${invite}"`).length-1,1,file);
  const link=nav.match(new RegExp(`<a href="${invite}"[^>]*>`))[0];
  assert.ok(link.includes('target="_blank"'),file);
  assert.ok(link.includes('rel="noopener noreferrer"'),file);
  checked++;
}
assert.ok(checked>=1923);
const home=fs.readFileSync(path.join(root,'index.html'),'utf8');
const announcement=home.match(/<article class="announcement" id="grey-area-chat">[\s\S]*?<\/article>/)[0];
assert.ok(announcement.includes(invite));
assert.ok(announcement.includes('Join the Grey Area Home Group Chat'));
console.log(`PASS: exact GroupMe invite in announcements and once in navigation on ${checked} pages, with safe new-tab links.`);
