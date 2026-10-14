'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const data = require('../data/meeting-schedule.json');
const digits = value => value.replace(/\D/g, '');
const meetings = data.meetings;
assert.equal(data.updated, '2026-10-14');
assert.ok(!meetings.some(m => /^(NAPPG|NAPGG)$|back to (the )?basics/i.test(m.name)));
assert.equal(new Set(meetings.map(m => m.id)).size, meetings.length);
const slots = meetings.map(m => [m.day, m.start, m.timezoneIana || data.timezoneIana, digits(m.zoomId) || m.joinUrl].join('|'));
assert.equal(new Set(slots).size, slots.length, 'No duplicate room/day/time slots');
const supplied = [
  ['Saturday','87598010534'], ['Saturday','87602409459'], ['Sunday','5722138252'],
  ['Monday','83057161516'], ['Monday','87268437641'], ['Monday','8100799669'],
  ['Monday','82838028167'], ['Tuesday','96051510187'], ['Wednesday','96051510187'],
  ['Thursday','96051510187'], ['Wednesday','7304464618'], ['Wednesday','84101212448'],
  ['Friday','2885018021'], ['Friday','6041850385']
];
for (const [day, room] of supplied) assert.equal(meetings.filter(m => m.day === day && digits(m.zoomId) === room).length, 1, `${day} ${room}`);
for (const day of ['Sunday','Monday','Wednesday','Thursday']) assert.equal(meetings.filter(m => m.day === day && digits(m.zoomId) === '8405663129' && m.start.startsWith('12:')).length, 1, `Sweden ${day}`);
assert.equal(meetings.filter(m => digits(m.zoomId) === '87545112054').length, 7);
assert.equal(meetings.find(m => m.id === 'meeting-017').start, '20:30', 'Do not adopt contradictory Grey Area times');
assert.equal(meetings.find(m => m.id === 'meeting-041').timezoneUnknown, true);
assert.equal(meetings.find(m => m.id === 'meeting-071').start, '20:00');
for (const m of meetings) {
  assert.ok(/^\d{2}:\d{2}$/.test(m.start));
  assert.ok(['https:'].includes(new URL(m.joinUrl).protocol));
  if (m.qr) assert.ok(fs.existsSync(path.join(root, m.qr)), m.qr);
}
console.log(`PASS: ${meetings.length} meeting slots, supplied recurring meetings represented without duplication, inactive groups removed, QR assets present.`);
