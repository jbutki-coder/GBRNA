'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'purchase-literature/index.html'),'utf8');
assert.equal((html.match(/<tbody>([\s\S]*?)<\/tbody>/)[1].match(/<tr>/g)||[]).length,14);
for(const text of ['124 books','$190','PO Box 163','Oakley, Utah 84055','United States only','name and return address must be legible','Ecuador and Uruguay','South America','1,646 Kenyan shillings','R210','five copies reported remaining']) assert.ok(html.includes(text),text);
for(const text of ['873 pages','982 pages','652 pages','3 for $60','Greybook Reflections','Just For Today','Problems with the Concepts']) assert.ok(html.includes(text),text);
for(const url of ['https://nabookies.org/','https://www.facebook.com/nabookdrivejft']) assert.ok(html.includes(`href="${url}"`));
assert.match(html,/translation\.js\?v=20261010-readings/);
assert.match(html,/icons\/favicon\.ico/);
assert.ok(!/<form\b/.test(html),'Orders and payments belong to the suppliers');
for(const [,src] of html.matchAll(/<img[^>]*src="([^"]+)"/g)) assert.ok(fs.existsSync(path.join(root,src)),src);
const pages=['index.html','jft.html','just-for-today/index.html','baby-blue-study/index.html','grey-book-study/index.html','lwb-draft/index.html','archive-master-index.html','asis-ips/index.html','pdf-reader.html','rni-history/index.html','meetings/index.html','fsc/index.html','purchase-literature/index.html'];
for(const file of pages) {
  const page=fs.readFileSync(path.join(root,file),'utf8');
  const nav=page.match(/<nav\b[^>]*class="(?:global-tabs|site-tabs)"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
  assert.ok(nav?.includes('href="/purchase-literature/"'),file);
  assert.equal((nav.match(/href="\/purchase-literature\/"/g)||[]).length,1,file);
}
console.log('PASS: 14 literature listings, ordering instructions, supplied images, translator, and Purchase Literature navigation on 13 pages.');
