import { zoneByTz } from '../data/zones';
import { cityLabel } from '../data/widget-cities';
import { abbrAt } from '../lib/pair-content';
import { ribbonFor } from '../lib/ribbon';
import { WORK_END, WORK_START, formatOffset, isValidTimeZone, offsetMinutes, wallParts } from '../lib/time';
import { CURRENT_NAME } from './pickers';

export const params = new URLSearchParams(location.search);
export const hour12 = params.get('format') !== '24';

const current = (tz: string) => CURRENT_NAME[tz] ?? tz;

export const viewerTz = current(Intl.DateTimeFormat().resolvedOptions().timeZone || 'Etc/UTC');

export function readTz(name: string, fallback: string): string {
  const tz = params.get(name)?.trim() ?? '';
  return isValidTimeZone(tz) ? current(tz) : fallback;
}

export function readLabel(name: string, tz: string): string {
  const label = params.get(name)?.trim().slice(0, 40);
  return label || cityLabel(tz);
}

/** "IST · UTC+5:30" for zones the site knows, otherwise just the offset. */
export function zoneTag(tz: string, instant: number): string {
  const offset = formatOffset(offsetMinutes(tz, instant));
  const zone = zoneByTz.get(tz);
  return zone ? `${abbrAt(zone, instant)} · ${offset}` : offset;
}

export type Band = 'work' | 'day' | 'night';

export function bandAt(tz: string, instant: number): Band {
  const p = wallParts(tz, instant);
  const h = p.hour + p.minute / 60;
  return h >= WORK_START && h < WORK_END ? 'work' : h >= 7 && h < 21 ? 'day' : 'night';
}

export const bandLabel: Record<Band, string> = { work: 'Working hours', day: 'Daytime', night: 'Night' };

/** Position of `instant` through the local day in `tz`, as a percentage. */
export function dayPosition(tz: string, instant: number): number {
  const p = wallParts(tz, instant);
  return ((p.hour * 60 + p.minute) / 1440) * 100;
}

const stripCache = new Map<string, ReturnType<typeof ribbonFor>>();

/** Day strips for `fromTz`'s local day; cached per day since they only change at midnight. */
export function stripsFor(fromTz: string, toTz: string, instant: number) {
  const p = wallParts(fromTz, instant);
  const key = `${fromTz}|${toTz}|${p.year}-${p.month}-${p.day}|${hour12}`;
  let r = stripCache.get(key);
  if (!r) {
    r = ribbonFor(fromTz, toTz, p.year, p.month, p.day, hour12);
    stripCache.set(key, r);
  }
  return r;
}

export function setText(el: Element | null, text: string): void {
  if (el && el.textContent !== text) el.textContent = text;
}

/** Calls `render` now and then on every second (or minute) boundary, then reveals the widget. */
export function tick(render: (now: number) => void, everySecond = false): void {
  const step = everySecond ? 1000 : 60_000;
  const run = () => {
    const now = Date.now();
    render(now);
    setTimeout(run, step - (now % step) + 20);
  };
  run();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) render(Date.now());
  });
  document.querySelector('[data-widget]')?.setAttribute('data-ready', '');
}
