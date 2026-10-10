const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const pages = execFileSync('git', ['ls-files', '*.html'], { cwd: root, encoding: 'utf8' })
  .trim().split(/\r?\n/);
let checked = 0;
for (const page of pages) {
  const html = fs.readFileSync(path.join(root, page), 'utf8');
  const nav = html.match(/<nav\b[^>]*class="global-tabs"[^>]*>([\s\S]*?)<\/nav>/);
  if (!nav) continue;
  const home = nav[1].match(/<a\b[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/);
  assert.ok(home, `${page}: home tab exists`);
  assert.equal(home[2], 'GBR - Home', `${page}: home tab label`);
  assert.ok(['/', '/#today', '#today'].includes(home[1]), `${page}: home destination`);
  assert.match(nav[1], /href="\/just-for-today\/"[^>]*>Just For Today<\/a>/);
  if (html.includes('id="todayBtn"')) {
    assert.match(html, /<button\b[^>]*id="todayBtn"[^>]*>Today<\/button>/);
  }
  checked++;
}
assert.equal(checked, 13);
console.log(`Home navigation verified on ${checked} pages; Just For Today and reading controls preserved.`);
