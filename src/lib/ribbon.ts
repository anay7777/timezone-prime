import { WORK_END, WORK_START, formatHourLabel, resolveWallTime, wallParts } from './time.ts';

export interface ClockParts {
  digits: string;
  meridiem: 'AM' | 'PM' | '';
}

export function clockParts(instant: number, tz: string, hour12 = true): ClockParts {
  const p = wallParts(tz, instant);
  const mm = String(p.minute).padStart(2, '0');
  if (!hour12) return { digits: `${String(p.hour).padStart(2, '0')}:${mm}`, meridiem: '' };
  return { digits: `${p.hour % 12 === 0 ? 12 : p.hour % 12}:${mm}`, meridiem: p.hour < 12 ? 'AM' : 'PM' };
}

/**
 * Reads a typed clock: "2:30", "230", "14:30", "1430", "2.30pm", "2 pm", "9a".
 * Without an AM/PM marker, hours 1 to 12 take `meridiem` when one is given.
 */
export function parseClockText(text: string, meridiem: 'AM' | 'PM' | '' = ''): { hour: number; minute: number } | null {
  const s = text.trim().toLowerCase().replace(/\s+/g, '').replace(/[.h]/g, ':');
  const m = /^(\d{1,2})(?::?(\d{2}))?(am|pm|a|p)?$/.exec(s);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = m[2] ? Number(m[2]) : 0;
  if (minute > 59) return null;
  const marker = m[3] ? (m[3].startsWith('a') ? 'AM' : 'PM') : hour >= 1 && hour <= 12 ? meridiem : '';
  if (marker) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (marker === 'PM' ? 12 : 0);
  } else if (hour > 23) {
    return null;
  }
  return { hour, minute };
}

export interface RibbonTick {
  position: number;
  fromLabel: string;
  toLabel: string;
}

export interface Ribbon {
  from: string;
  to: string;
  ticks: RibbonTick[];
}

type Band = 'work' | 'day' | 'night';

const bandOf = (hour: number): Band => (hour >= WORK_START && hour < WORK_END ? 'work' : hour >= 7 && hour < 21 ? 'day' : 'night');

const SEGMENTS = 96;

function gradient(bands: Band[], colors: Record<Band, string>): string {
  const stops: string[] = [];
  let start = 0;
  for (let i = 1; i <= bands.length; i++) {
    if (i === bands.length || bands[i] !== bands[start]) {
      const a = ((start / bands.length) * 100).toFixed(3);
      const b = ((i / bands.length) * 100).toFixed(3);
      stops.push(`${colors[bands[start]]} ${a}% ${b}%`);
      start = i;
    }
  }
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

/**
 * Two strips across one wall-clock day in `fromTz`: the source zone's own hours,
 * and the hours the destination is living through at the same moments.
 */
export function ribbonFor(fromTz: string, toTz: string, year: number, month: number, day: number, hour12 = true): Ribbon {
  const fromBands: Band[] = [];
  const toBands: Band[] = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const minutes = i * 15 + 7;
    const instant = resolveWallTime(fromTz, year, month, day, Math.floor(minutes / 60), minutes % 60).instant;
    const t = wallParts(toTz, instant);
    fromBands.push(bandOf(minutes / 60));
    toBands.push(bandOf(t.hour + t.minute / 60));
  }
  const ticks = [0, 6, 12, 18, 24].map((h) => {
    const instant =
      h === 24
        ? resolveWallTime(fromTz, year, month, day, 23, 59).instant + 60_000
        : resolveWallTime(fromTz, year, month, day, h, 0).instant;
    const t = wallParts(toTz, instant);
    const toLabel = hour12
      ? `${t.hour % 12 === 0 ? 12 : t.hour % 12}${t.minute ? `:${String(t.minute).padStart(2, '0')}` : ''} ${t.hour < 12 ? 'AM' : 'PM'}`
      : `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;
    const fromLabel = hour12 ? formatHourLabel(h % 24).replace(':00', '') : `${String(h % 24).padStart(2, '0')}:00`;
    return { position: (h / 24) * 100, fromLabel, toLabel };
  });
  return {
    from: gradient(fromBands, { work: 'var(--color-from)', day: 'var(--color-from-soft)', night: 'var(--color-night)' }),
    to: gradient(toBands, { work: 'var(--color-to)', day: 'var(--color-to-soft)', night: 'var(--color-night)' }),
    ticks,
  };
}
