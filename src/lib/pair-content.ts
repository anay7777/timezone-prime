import type { Zone } from '../data/zones';
import {
  DAY,
  WORK_END,
  WORK_START,
  describeTransition,
  findTransitions,
  formatDate,
  formatHourLabel,
  formatLongDate,
  formatOffset,
  offsetMinutes,
  resolveWallTime,
  yearOffsets,
  type Transition,
} from './time';

export function abbrAt(zone: Zone, instant: number): string {
  const { daylight } = yearOffsets(zone.tz, instant);
  if (daylight !== null && offsetMinutes(zone.tz, instant) === daylight && zone.dstAbbr) return zone.dstAbbr;
  return zone.stdAbbr;
}

export interface Period {
  start: number;
  end: number;
  /** Zone whose clock change opens or closes the period; dates are shown in its local time. */
  startTz: string;
  endTz: string;
  diff: number;
  fromAbbr: string;
  toAbbr: string;
}

/** Splits [start, end) into stretches with a constant offset difference (to minus from). */
export function differencePeriods(from: Zone, to: Zone, start: number, end: number): Period[] {
  const cuts = [
    ...findTransitions(from.tz, start, end).map((t) => ({ t: t.instant, tz: from.tz })),
    ...findTransitions(to.tz, start, end).map((t) => ({ t: t.instant, tz: to.tz })),
  ].sort((a, b) => a.t - b.t);
  const bounds = [{ t: start, tz: from.tz }, ...cuts, { t: end, tz: from.tz }];
  const periods: Period[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const s = bounds[i];
    const e = bounds[i + 1];
    if (e.t <= s.t) continue;
    const mid = s.t + (e.t - s.t) / 2;
    const diff = offsetMinutes(to.tz, mid) - offsetMinutes(from.tz, mid);
    const fromAbbr = abbrAt(from, mid);
    const toAbbr = abbrAt(to, mid);
    const last = periods[periods.length - 1];
    if (last && last.diff === diff && last.fromAbbr === fromAbbr && last.toAbbr === toAbbr) {
      last.end = e.t;
      last.endTz = e.tz;
    } else periods.push({ start: s.t, end: e.t, startTz: s.tz, endTz: e.tz, diff, fromAbbr, toAbbr });
  }
  return periods;
}

export interface Season {
  diff: number;
  fromAbbr: string;
  toAbbr: string;
  days: number;
}

export function seasons(periods: Period[]): Season[] {
  const map = new Map<string, Season>();
  for (const p of periods) {
    const key = `${p.diff}|${p.fromAbbr}|${p.toAbbr}`;
    const s = map.get(key) ?? { diff: p.diff, fromAbbr: p.fromAbbr, toAbbr: p.toAbbr, days: 0 };
    s.days += (p.end - p.start) / DAY;
    map.set(key, s);
  }
  return [...map.values()].sort((a, b) => b.days - a.days);
}

export interface QuickRow {
  from: string;
  to: string[];
}

const QUICK_HOURS = [0, 6, 8, 9, 10, 12, 14, 15, 17, 18, 20, 22];

function shiftLabel(totalMinutes: number): string {
  const dayOffset = Math.floor(totalMinutes / 1440);
  if (dayOffset === 1) return ' (next day)';
  if (dayOffset === -1) return ' (previous day)';
  return '';
}

function minutesLabel(totalMinutes: number): string {
  const m = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const min = m % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(min).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export function quickRows(list: Season[]): QuickRow[] {
  return QUICK_HOURS.map((h) => ({
    from: formatHourLabel(h),
    to: list.map((s) => `${minutesLabel(h * 60 + s.diff)}${shiftLabel(h * 60 + s.diff)}`),
  }));
}

export interface Meeting {
  overlapFrom?: string;
  overlapTo?: string;
  overlapHours: number;
  /** Suggested start, expressed in both zones, when there is no overlap. */
  compromiseFrom?: string;
  compromiseTo?: string;
}

/** Working-day overlap for a given offset difference (to minus from). */
export function meetingFor(diff: number): Meeting {
  for (const d of [diff, diff - 1440, diff + 1440]) {
    const start = Math.max(WORK_START * 60, WORK_START * 60 - d);
    const end = Math.min(WORK_END * 60, WORK_END * 60 - d);
    if (end > start) {
      return {
        overlapHours: (end - start) / 60,
        overlapFrom: `${minutesLabel(start)} to ${minutesLabel(end)}`,
        overlapTo: `${minutesLabel(start + diff)} to ${minutesLabel(end + diff)}`,
      };
    }
  }
  let best = { cost: Infinity, at: 0 };
  for (let m = 6 * 60; m <= 22 * 60; m += 30) {
    const distance = (x: number) => {
      const v = ((x % 1440) + 1440) % 1440;
      if (v >= WORK_START * 60 && v < WORK_END * 60) return 0;
      return Math.min(Math.abs(v - WORK_START * 60), Math.abs(v - (WORK_END * 60 - 60)));
    };
    const cost = distance(m) + distance(m + diff);
    if (cost < best.cost) best = { cost, at: m };
  }
  return {
    overlapHours: 0,
    compromiseFrom: minutesLabel(best.at),
    compromiseTo: `${minutesLabel(best.at + diff)}${shiftLabel(best.at + diff)}`,
  };
}

export interface ClockChange {
  zone: Zone;
  text: string;
  date: string;
  transition: Transition;
}

export function clockChanges(zonesList: Zone[], start: number, end: number): ClockChange[] {
  return zonesList
    .flatMap((zone) =>
      findTransitions(zone.tz, start, end).map((t) => ({
        zone,
        transition: t,
        text: describeTransition(zone.tz, t),
        date: formatLongDate(t.instant, zone.tz),
      })),
    )
    .sort((a, b) => a.transition.instant - b.transition.instant);
}

export function offsetsSummary(zone: Zone, instant: number): string {
  const { standard, daylight } = yearOffsets(zone.tz, instant);
  if (daylight === null) return `${formatOffset(standard)} all year`;
  return `${formatOffset(standard)} standard, ${formatOffset(daylight)} daylight saving`;
}

export function periodLabel(p: Period): string {
  return `${formatDate(p.start, p.startTz)} until ${formatDate(p.end, p.endTz)}`;
}

/** Local midnight on 1 January of `year` in `tz`. */
export function yearStart(tz: string, year: number): number {
  return resolveWallTime(tz, year, 1, 1, 0, 0).instant;
}
