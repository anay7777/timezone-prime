// Sanity checks for src/lib/time.ts. Run: node scripts/test-time.ts
import assert from 'node:assert/strict';
import {
  describeTransition,
  findTransitions,
  formatOffset,
  formatTime,
  hourRows,
  isDaylightTime,
  nextTransition,
  offsetMinutes,
  resolveWallTime,
  workingOverlap,
} from '../src/lib/time.ts';
import { clockParts, parseClockText, ribbonFor } from '../src/lib/ribbon.ts';

const iso = (s: string) => Date.parse(s);

// Offsets around the US fall-back transition (06:00 UTC on 1 Nov 2026).
assert.equal(offsetMinutes('America/New_York', iso('2026-11-01T05:30:00Z')), -240);
assert.equal(offsetMinutes('America/New_York', iso('2026-11-01T06:00:00Z')), -300);
assert.equal(offsetMinutes('Asia/Kolkata', iso('2026-07-01T00:00:00Z')), 330);
assert.equal(offsetMinutes('Asia/Kathmandu', iso('2026-07-01T00:00:00Z')), 345);
assert.equal(offsetMinutes('Australia/Lord_Howe', iso('2026-01-15T00:00:00Z')), 660);
assert.equal(offsetMinutes('Australia/Lord_Howe', iso('2026-07-15T00:00:00Z')), 630);
assert.equal(offsetMinutes('Pacific/Kiritimati', iso('2026-07-15T00:00:00Z')), 840);
assert.equal(offsetMinutes('Etc/UTC', iso('2026-07-15T00:00:00Z')), 0);

// Transition search finds the exact minute.
const ny = findTransitions('America/New_York', iso('2026-01-01T00:00:00Z'), iso('2027-01-01T00:00:00Z'));
assert.deepEqual(
  ny.map((t) => new Date(t.instant).toISOString()),
  ['2026-03-08T07:00:00.000Z', '2026-11-01T06:00:00.000Z'],
);
assert.equal(describeTransition('America/New_York', ny[1]), 'Sunday, November 1, 2026: at 2:00 AM clocks go back 1 hour to 1:00 AM');
assert.equal(describeTransition('America/New_York', ny[0]), 'Sunday, March 8, 2026: at 2:00 AM clocks go forward 1 hour to 3:00 AM');
const lh = findTransitions('Australia/Lord_Howe', iso('2026-01-01T00:00:00Z'), iso('2027-01-01T00:00:00Z'));
assert.equal(lh.length, 2);
assert.equal(lh[0].offsetAfter - lh[0].offsetBefore, -30);

// Spring-forward gap: 2:30 AM on 8 Mar 2026 does not exist in New York.
const gap = resolveWallTime('America/New_York', 2026, 3, 8, 2, 30);
assert.equal(gap.status, 'gap');
assert.equal(formatTime(gap.instant, 'America/New_York'), '3:30 AM');

// Fall-back overlap: 1:30 AM on 1 Nov 2026 happens twice.
const amb = resolveWallTime('America/New_York', 2026, 11, 1, 1, 30);
assert.equal(amb.status, 'ambiguous');
assert.equal(new Date(amb.instant).toISOString(), '2026-11-01T05:30:00.000Z');
assert.equal(new Date(amb.alternative!).toISOString(), '2026-11-01T06:30:00.000Z');

// Ordinary time.
const ok = resolveWallTime('Asia/Kolkata', 2026, 10, 26, 17, 30);
assert.equal(ok.status, 'ok');
assert.equal(formatTime(ok.instant, 'America/New_York'), '8:00 AM');

// Day crossing: Kiritimati (UTC+14) and Pago Pago (UTC-11) are 25 hours apart.
const k = resolveWallTime('Pacific/Kiritimati', 2026, 6, 1, 10, 0).instant;
assert.equal(formatTime(k, 'Pacific/Pago_Pago'), '9:00 AM');

// DST days have 23 and 25 hours.
assert.equal(hourRows('America/New_York', 'Asia/Kolkata', 2026, 3, 8).length, 23);
assert.equal(hourRows('America/New_York', 'Asia/Kolkata', 2026, 11, 1).length, 25);
assert.equal(hourRows('Asia/Kolkata', 'America/New_York', 2026, 10, 26).length, 24);

assert.equal(isDaylightTime('America/New_York', iso('2026-07-01T12:00:00Z')), true);
assert.equal(isDaylightTime('America/New_York', iso('2026-12-01T12:00:00Z')), false);
assert.equal(isDaylightTime('Australia/Sydney', iso('2026-01-01T12:00:00Z')), true);
assert.equal(isDaylightTime('Asia/Kolkata', iso('2026-07-01T12:00:00Z')), false);
assert.equal(nextTransition('Asia/Kolkata', iso('2026-07-01T12:00:00Z')), null);

assert.equal(formatOffset(330), 'UTC+5:30');
assert.equal(formatOffset(-240), 'UTC\u22124');
assert.equal(formatOffset(0), 'UTC+0');

const overlap = workingOverlap('America/New_York', 'Europe/Berlin', 2026, 10, 26);
assert.ok(overlap);
assert.equal(formatTime(overlap.start, 'America/New_York'), '9:00 AM');
assert.equal(formatTime(overlap.end, 'America/New_York'), '12:00 PM');
assert.equal(workingOverlap('Asia/Kolkata', 'America/Los_Angeles', 2026, 7, 1), null);

// Typed clock text.
assert.deepEqual(parseClockText('2:30', 'PM'), { hour: 14, minute: 30 });
assert.deepEqual(parseClockText('2:30', 'AM'), { hour: 2, minute: 30 });
assert.deepEqual(parseClockText('230pm'), { hour: 14, minute: 30 });
assert.deepEqual(parseClockText('12 am'), { hour: 0, minute: 0 });
assert.deepEqual(parseClockText('12:15 PM'), { hour: 12, minute: 15 });
assert.deepEqual(parseClockText('1430', 'AM'), { hour: 14, minute: 30 });
assert.deepEqual(parseClockText('9.05a'), { hour: 9, minute: 5 });
assert.deepEqual(parseClockText('00:00'), { hour: 0, minute: 0 });
assert.deepEqual(parseClockText('7'), { hour: 7, minute: 0 });
assert.equal(parseClockText('25:00'), null);
assert.equal(parseClockText('13pm'), null);
assert.equal(parseClockText('9:75'), null);
assert.equal(parseClockText('noon'), null);
assert.deepEqual(clockParts(iso('2026-10-26T13:05:00Z'), 'UTC'), { digits: '1:05', meridiem: 'PM' });
assert.deepEqual(clockParts(iso('2026-10-26T00:05:00Z'), 'UTC', false), { digits: '00:05', meridiem: '' });

// The day ribbon follows the destination across a clock change: 5 ticks, last one lands a day later.
const ribbon = ribbonFor('Asia/Kolkata', 'America/New_York', 2026, 11, 1);
assert.equal(ribbon.ticks.length, 5);
assert.equal(ribbon.ticks[0].toLabel, '2:30 PM');
assert.equal(ribbon.ticks[4].toLabel, '1:30 PM');
assert.match(ribbon.to, /^linear-gradient\(to right, /);

console.log('time.ts: all checks passed');
