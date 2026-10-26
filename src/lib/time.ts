export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export const WORK_START = 9;
export const WORK_END = 17;

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatter(key: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  let f = formatterCache.get(key);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat('en-US', options);
    } catch {
      throw new RangeError(`Unknown time zone: ${options.timeZone}`);
    }
    formatterCache.set(key, f);
  }
  return f;
}

export function isValidTimeZone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const offsetCache = new Map<string, number>();

/**
 * UTC offset of `tz` at `instant`, in whole minutes (east of UTC is positive),
 * read from the IANA database built into the JavaScript engine.
 */
export function offsetMinutes(tz: string, instant: number): number {
  const t = Math.floor(instant / MINUTE) * MINUTE;
  const key = `${tz}|${t}`;
  const hit = offsetCache.get(key);
  if (hit !== undefined) return hit;
  const f = formatter(`offset|${tz}`, {
    timeZone: tz,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    era: 'short',
    hourCycle: 'h23',
  });
  const p: Record<string, string> = {};
  for (const part of f.formatToParts(new Date(t))) p[part.type] = part.value;
  const year = p.era === 'BC' || p.era === 'B' ? 1 - Number(p.year) : Number(p.year);
  const wall = Date.UTC(year, Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute));
  const result = Math.round((wall - t) / MINUTE);
  if (offsetCache.size > 50_000) offsetCache.clear();
  offsetCache.set(key, result);
  return result;
}

export interface WallParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: string;
}

export function wallParts(tz: string, instant: number): WallParts {
  const f = formatter(`parts|${tz}`, {
    timeZone: tz,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short',
    hourCycle: 'h23',
  });
  const out: Record<string, string> = {};
  for (const p of f.formatToParts(new Date(instant))) out[p.type] = p.value;
  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    hour: Number(out.hour) % 24,
    minute: Number(out.minute),
    weekday: out.weekday ?? '',
  };
}

export type WallStatus = 'ok' | 'gap' | 'ambiguous';

export interface ResolvedWallTime {
  instant: number;
  status: WallStatus;
  /** For ambiguous times: the later of the two instants. */
  alternative?: number;
  /** For gaps: how many minutes the clock jumps forward. */
  gapMinutes?: number;
}

/**
 * Turns a local wall-clock time in `tz` into a UTC instant, detecting
 * times skipped by a DST jump (gap) and times that happen twice (ambiguous).
 */
export function resolveWallTime(
  tz: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): ResolvedWallTime {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const before = offsetMinutes(tz, wall - 12 * HOUR);
  const after = offsetMinutes(tz, wall + 12 * HOUR);
  const candidates = [...new Set([wall - before * MINUTE, wall - after * MINUTE])]
    .filter((t) => offsetMinutes(tz, t) * MINUTE === wall - t)
    .sort((a, b) => a - b);

  if (candidates.length === 0) {
    return { instant: wall - before * MINUTE, status: 'gap', gapMinutes: after - before };
  }
  if (candidates.length > 1) {
    return { instant: candidates[0], status: 'ambiguous', alternative: candidates[candidates.length - 1] };
  }
  return { instant: candidates[0], status: 'ok' };
}

export function parseDateInput(value: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  if (year < 1900 || year > 2100) return null;
  return { year, month, day };
}

export function parseTimeInput(value: string): { hour: number; minute: number } | null {
  const m = /^(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(value);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateInput(p: Pick<WallParts, 'year' | 'month' | 'day'>): string {
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function toTimeInput(p: Pick<WallParts, 'hour' | 'minute'>): string {
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

export function formatTime(instant: number, tz: string, hour12 = true): string {
  const f = formatter(`time|${tz}|${hour12}`, {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
    ...(hour12 ? { hour12: true } : { hourCycle: 'h23' as const }),
  });
  return f.format(new Date(instant));
}

export function formatDate(instant: number, tz: string, withYear = true): string {
  const f = formatter(`date|${tz}|${withYear}`, {
    timeZone: tz,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' as const } : {}),
  });
  return f.format(new Date(instant));
}

export function formatLongDate(instant: number, tz: string): string {
  return formatter(`ldate|${tz}`, {
    timeZone: tz,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(instant));
}

export function formatHourLabel(hour: number, hour12 = true): string {
  if (!hour12) return `${pad(hour)}:00`;
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:00 ${hour < 12 ? 'AM' : 'PM'}`;
}

export function formatOffset(minutes: number): string {
  if (minutes === 0) return 'UTC+0';
  const sign = minutes > 0 ? '+' : '\u2212';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `UTC${sign}${h}${m ? `:${pad(m)}` : ''}`;
}

/** ISO 8601 style offset such as +05:30 or -04:00. */
export function formatIsoOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

export function formatDuration(minutes: number): string {
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h} ${h === 1 ? 'hour' : 'hours'}`);
  if (m) parts.push(`${m} ${m === 1 ? 'minute' : 'minutes'}`);
  return parts.length ? parts.join(' ') : '0 hours';
}

export function formatDurationShort(minutes: number): string {
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (!h && !m) return '0 h';
  return [h ? `${h} h` : '', m ? `${m} min` : ''].filter(Boolean).join(' ');
}

/** Describes how `other` relates to `base`, e.g. "9 hours 30 minutes ahead of". */
export function describeDifference(baseOffset: number, otherOffset: number): string {
  const diff = otherOffset - baseOffset;
  if (diff === 0) return 'the same time as';
  return `${formatDuration(diff)} ${diff > 0 ? 'ahead of' : 'behind'}`;
}

type NameStyle = 'long' | 'short' | 'longGeneric' | 'shortGeneric';

export function zoneName(tz: string, instant: number, style: NameStyle = 'long'): string {
  const f = formatter(`name|${tz}|${style}`, { timeZone: tz, timeZoneName: style });
  const part = f.formatToParts(new Date(instant)).find((p) => p.type === 'timeZoneName');
  return part?.value ?? tz;
}

/** Calendar-day difference between the local dates of two zones at one instant. */
export function dayShift(instant: number, fromTz: string, toTz: string): number {
  const a = wallParts(fromTz, instant);
  const b = wallParts(toTz, instant);
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / DAY);
}

export function describeDayShift(shift: number): string {
  if (shift === 0) return 'Same day';
  if (shift === 1) return 'Next day';
  if (shift === -1) return 'Previous day';
  return shift > 0 ? `${shift} days later` : `${-shift} days earlier`;
}

export interface YearOffsets {
  standard: number;
  daylight: number | null;
}

/** Standard and (if observed) daylight offsets for the year containing `instant`. */
export function yearOffsets(tz: string, instant: number): YearOffsets {
  const year = new Date(instant).getUTCFullYear();
  const samples: number[] = [];
  for (let m = 0; m < 12; m++) samples.push(offsetMinutes(tz, Date.UTC(year, m, 15)));
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  return { standard: min, daylight: max === min ? null : max };
}

export function isDaylightTime(tz: string, instant: number): boolean {
  const { standard, daylight } = yearOffsets(tz, instant);
  return daylight !== null && offsetMinutes(tz, instant) > standard;
}

export interface Transition {
  instant: number;
  offsetBefore: number;
  offsetAfter: number;
}

const transitionCache = new Map<string, Transition[]>();

/** Every offset change in `tz` between `from` and `to`, located to the minute. */
export function findTransitions(tz: string, from: number, to: number): Transition[] {
  const key = `${tz}|${from}|${to}`;
  const cached = transitionCache.get(key);
  if (cached) return cached;

  const found: Transition[] = [];
  const step = DAY;
  let prevT = from;
  let prevO = offsetMinutes(tz, from);
  for (let t = from + step; t <= to + step; t += step) {
    const o = offsetMinutes(tz, t);
    if (o !== prevO) {
      let lo = prevT;
      let hi = t;
      while (hi - lo > MINUTE) {
        const mid = lo + Math.floor((hi - lo) / 2 / MINUTE) * MINUTE;
        if (offsetMinutes(tz, mid) === prevO) lo = mid;
        else hi = mid;
      }
      if (hi <= to) found.push({ instant: hi, offsetBefore: prevO, offsetAfter: o });
      prevO = o;
    }
    prevT = t;
  }
  transitionCache.set(key, found);
  return found;
}

export function nextTransition(tz: string, instant: number): Transition | null {
  const start = Math.floor(instant / DAY) * DAY;
  return findTransitions(tz, start, start + 400 * DAY).find((t) => t.instant > instant) ?? null;
}

/** Wall-clock label of a transition: the local time just before the change. */
export function describeTransition(tz: string, t: Transition, hour12 = true): string {
  const shifted = t.offsetAfter - t.offsetBefore;
  const localBefore = formatTime(t.instant + t.offsetBefore * MINUTE, 'UTC', hour12);
  const localAfter = formatTime(t.instant, tz, hour12);
  const direction = shifted > 0 ? 'forward' : 'back';
  return `${formatLongDate(t.instant, tz)}: at ${localBefore} clocks go ${direction} ${formatDuration(shifted)} to ${localAfter}`;
}

export interface HourRow {
  instant: number;
  fromLabel: string;
  toLabel: string;
  shift: number;
  fromWorking: boolean;
  toWorking: boolean;
}

function isWorkingClock(tz: string, instant: number): boolean {
  const p = wallParts(tz, instant);
  const h = p.hour + p.minute / 60;
  return h >= WORK_START && h < WORK_END;
}

/** One row per real hour of the source zone's calendar day (23 or 25 rows on DST days). */
export function hourRows(fromTz: string, toTz: string, year: number, month: number, day: number, hour12 = true): HourRow[] {
  const start = resolveWallTime(fromTz, year, month, day, 0, 0).instant;
  const rows: HourRow[] = [];
  for (let t = start; rows.length < 26; t += HOUR) {
    const p = wallParts(fromTz, t);
    if (p.day !== day) break;
    rows.push({
      instant: t,
      fromLabel: formatTime(t, fromTz, hour12),
      toLabel: formatTime(t, toTz, hour12),
      shift: dayShift(t, fromTz, toTz),
      fromWorking: isWorkingClock(fromTz, t),
      toWorking: isWorkingClock(toTz, t),
    });
  }
  return rows;
}

export interface Overlap {
  start: number;
  end: number;
}

/** Shared 9-to-5 window of both zones during the source zone's calendar day. */
export function workingOverlap(fromTz: string, toTz: string, year: number, month: number, day: number): Overlap | null {
  const start = resolveWallTime(fromTz, year, month, day, 0, 0).instant;
  const step = 15 * MINUTE;
  let open: number | null = null;
  let best: Overlap | null = null;
  for (let t = start; t < start + 26 * HOUR; t += step) {
    const p = wallParts(fromTz, t);
    const inDay = p.day === day;
    const both = inDay && isWorkingClock(fromTz, t) && isWorkingClock(toTz, t);
    if (both && open === null) open = t;
    if (!both && open !== null) {
      if (!best || t - open > best.end - best.start) best = { start: open, end: t };
      open = null;
    }
    if (!inDay && t > start) break;
  }
  return best;
}
