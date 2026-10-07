const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'fsc/index.html'), 'utf8');
const banner = page.match(/<a class="nahelp-banner"[^>]*>[\s\S]*?<\/a>/);
assert.ok(banner, 'The FSC header must have a clickable banner');
assert.match(banner[0], /href="https:\/\/nahelp\.org\/"/);
assert.match(banner[0], /rel="noopener noreferrer"/);
assert.match(banner[0], /aria-label="Visit NAHELP\.org \(opens in a new tab\)"/);
assert.match(banner[0], /<img src="\/fsc\/images\/nahelp-banner\.png"/);
assert.ok(!page.includes('Official FSC Page on NAHELP'), 'Remove the old text box');
assert.match(page, /width: min\(360px, 100%\)/);
const image = fs.readFileSync(path.join(root, 'fsc/images/nahelp-banner.png'));
assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
assert.equal(image.readUInt32BE(16), 1891);
assert.equal(image.readUInt32BE(20), 832);
console.log('FSC banner verified: supplied image, homepage link, accessible name, and responsive size.');
