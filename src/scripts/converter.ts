import { zoneByTz } from '../data/zones';
import { clockParts, parseClockText, ribbonFor } from '../lib/ribbon';
import { createCalendar, createZonePicker } from './pickers';
import {
  DAY,
  HOUR,
  MINUTE,
  WORK_END,
  WORK_START,
  dayShift,
  describeDayShift,
  describeDifference,
  formatDate,
  formatDuration,
  formatLongDate,
  formatOffset,
  formatTime,
  hourRows,
  isDaylightTime,
  isValidTimeZone,
  nextTransition,
  offsetMinutes,
  parseDateInput,
  parseTimeInput,
  resolveWallTime,
  toDateInput,
  toTimeInput,
  wallParts,
  workingOverlap,
  yearOffsets,
  zoneName,
} from '../lib/time';

export type Side = 'from' | 'to';

export interface ConverterState {
  from: string;
  to: string;
  instant: number;
  hour12: boolean;
}

export const STATE_EVENT = 'tzp:state';
export const PICK_EVENT = 'tzp:pick';

const FORMAT_KEY = 'tzp:hour12';

export function abbreviation(tz: string, instant: number): string {
  const zone = zoneByTz.get(tz);
  if (zone) {
    const { daylight } = yearOffsets(tz, instant);
    return daylight !== null && offsetMinutes(tz, instant) === daylight && zone.dstAbbr ? zone.dstAbbr : zone.stdAbbr;
  }
  const short = zoneName(tz, instant, 'short');
  return /^(GMT|UTC)[+-−]/.test(short) || short === 'GMT' ? formatOffset(offsetMinutes(tz, instant)) : short;
}

export function placeName(tz: string): string {
  const zone = zoneByTz.get(tz);
  if (zone) return zone.city.name;
  if (tz.startsWith('Etc/')) return tz.slice(4);
  const parts = tz.split('/');
  const city = parts[parts.length - 1].replaceAll('_', ' ');
  return parts.length > 2 ? `${city}, ${parts[1].replaceAll('_', ' ')}` : city;
}

function dstText(tz: string, instant: number): string {
  const { daylight } = yearOffsets(tz, instant);
  const next = nextTransition(tz, instant);
  if (daylight === null && !next) return 'No daylight saving time';
  if (!next) return isDaylightTime(tz, instant) ? 'Daylight saving time' : 'Standard time';
  const when = formatDate(next.instant, tz);
  if (daylight === null) return `Offset changes ${when}`;
  return isDaylightTime(tz, instant) ? `Daylight saving time, ends ${when}` : `Standard time, daylight saving starts ${when}`;
}

const q = <T extends Element>(root: ParentNode, sel: string) => root.querySelector<T>(sel);

function supportedZones(): string[] {
  try {
    const list = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone');
    if (list?.length) return list;
  } catch {
    /* fall through */
  }
  return [];
}

function populateSelect(select: HTMLSelectElement, all: string[], now: number) {
  if (select.dataset.populated) return;
  select.dataset.populated = 'true';
  const groups = new Map<string, string[]>();
  for (const tz of all) {
    const region = tz.includes('/') ? tz.split('/')[0] : 'Other';
    if (region === 'Etc' || region === 'SystemV') continue;
    const list = groups.get(region) ?? [];
    list.push(tz);
    groups.set(region, list);
  }
  const frag = document.createDocumentFragment();
  for (const [region, list] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const group = document.createElement('optgroup');
    group.label = region;
    const items = list
      .map((tz) => {
        let off = 0;
        try {
          off = offsetMinutes(tz, now);
        } catch {
          return null;
        }
        return { tz, label: `${placeName(tz)} (${formatOffset(off)})` };
      })
      .filter((x): x is { tz: string; label: string } => x !== null)
      .sort((a, b) => a.label.localeCompare(b.label));
    for (const item of items) {
      const opt = document.createElement('option');
      opt.value = item.tz;
      opt.textContent = item.label;
      group.append(opt);
    }
    frag.append(group);
  }
  select.append(frag);
}

function ensureOption(select: HTMLSelectElement, tz: string) {
  if ([...select.options].some((o) => o.value === tz)) return;
  let group = select.querySelector<HTMLOptGroupElement>('optgroup[data-selected]');
  if (!group) {
    group = document.createElement('optgroup');
    group.label = 'Selected';
    group.dataset.selected = '';
    select.prepend(group);
  }
  const opt = document.createElement('option');
  opt.value = tz;
  opt.textContent = tz.replaceAll('_', ' ');
  group.append(opt);
}

export function initConverter() {
  const root = document.querySelector<HTMLElement>('[data-converter]');
  if (!root || root.dataset.ready) return;
  root.dataset.ready = 'true';

  const defaults = { from: root.dataset.from!, to: root.dataset.to! };
  const params = new URLSearchParams(location.search);
  const paramZone = (key: Side) => {
    const v = params.get(key);
    return v && isValidTimeZone(v) ? v : null;
  };

  let storedFormat: string | null = null;
  try {
    storedFormat = localStorage.getItem(FORMAT_KEY);
  } catch {
    /* storage unavailable */
  }

  const state: ConverterState & { live: boolean; anchor: Side } = {
    from: paramZone('from') ?? defaults.from,
    to: paramZone('to') ?? defaults.to,
    instant: Math.floor(Date.now() / MINUTE) * MINUTE,
    hour12: storedFormat !== '24',
    live: true,
    anchor: 'from',
  };

  const els = {
    zone: { from: q<HTMLSelectElement>(root, '[data-zone=from]')!, to: q<HTMLSelectElement>(root, '[data-zone=to]')! },
    clock: { from: q<HTMLInputElement>(root, '[data-clock=from]')!, to: q<HTMLInputElement>(root, '[data-clock=to]')! },
    meridiem: { from: q<HTMLButtonElement>(root, '[data-meridiem=from]')!, to: q<HTMLButtonElement>(root, '[data-meridiem=to]')! },
    abbr: { from: q<HTMLElement>(root, '[data-abbr=from]')!, to: q<HTMLElement>(root, '[data-abbr=to]')! },
    place: { from: q<HTMLElement>(root, '[data-place=from]')!, to: q<HTMLElement>(root, '[data-place=to]')! },
    legend: { from: q<HTMLElement>(root, '[data-legend-abbr=from]'), to: q<HTMLElement>(root, '[data-legend-abbr=to]') },
    strip: { from: q<HTMLElement>(root, '[data-strip=from]')!, to: q<HTMLElement>(root, '[data-strip=to]')! },
    ticks: q<HTMLElement>(root, '[data-ticks]')!,
    scrub: q<HTMLInputElement>(root, '[data-scrub]')!,
    dateLabel: q<HTMLElement>(root, '[data-date-label]')!,
    datePick: q<HTMLButtonElement>(root, '[data-date-pick]')!,
    calendar: q<HTMLElement>(root, '[data-calendar]')!,
    zoneTrigger: { from: q<HTMLButtonElement>(root, '[data-zone-trigger=from]')!, to: q<HTMLButtonElement>(root, '[data-zone-trigger=to]')! },
    zonePop: { from: q<HTMLElement>(root, '[data-zone-pop=from]')!, to: q<HTMLElement>(root, '[data-zone-pop=to]')! },
    daySteps: [...root.querySelectorAll<HTMLButtonElement>('[data-day-step]')],
    dateText: { from: q<HTMLElement>(root, '[data-date-text=from]')!, to: q<HTMLElement>(root, '[data-date-text=to]')! },
    name: { from: q<HTMLElement>(root, '[data-name=from]')!, to: q<HTMLElement>(root, '[data-name=to]')! },
    offset: { from: q<HTMLElement>(root, '[data-offset=from]')!, to: q<HTMLElement>(root, '[data-offset=to]')! },
    dst: { from: q<HTMLElement>(root, '[data-dst=from]')!, to: q<HTMLElement>(root, '[data-dst=to]')! },
    iana: { from: q<HTMLElement>(root, '[data-iana=from]')!, to: q<HTMLElement>(root, '[data-iana=to]')! },
    shift: q<HTMLElement>(root, '[data-shift]')!,
    diff: q<HTMLElement>(root, '[data-diff]')!,
    note: q<HTMLElement>(root, '[data-note]')!,
    swap: q<HTMLButtonElement>(root, '[data-swap]')!,
    now: q<HTMLButtonElement>(root, '[data-now]')!,
    copy: q<HTMLButtonElement>(root, '[data-copy]')!,
    copyStatus: q<HTMLElement>(root, '[data-copy-status]')!,
    formats: [...root.querySelectorAll<HTMLButtonElement>('[data-format]')],
  };

  const hours = document.querySelector<HTMLElement>('[data-hours]');
  const sides: Side[] = ['from', 'to'];

  const dateParam = parseDateInput(params.get('date') ?? '');
  const timeParam = parseTimeInput(params.get('time') ?? '');
  let note: { text: string; error?: boolean } | null = null;
  let initial: { r: ReturnType<typeof resolveWallTime>; hour: number; minute: number } | null = null;

  if (dateParam) {
    const t = timeParam ?? { hour: 9, minute: 0 };
    const r = resolveWallTime(state.from, dateParam.year, dateParam.month, dateParam.day, t.hour, t.minute);
    state.instant = r.instant;
    state.live = false;
    initial = { r, ...t };
  }

  function setNote(n: typeof note) {
    note = n;
    els.note.textContent = n?.text ?? '';
    els.note.classList.toggle('hidden', !n);
    els.note.classList.toggle('text-error', !!n?.error);
    els.note.classList.toggle('text-ink-2', !n?.error);
  }

  function describeResolution(side: Side, r: ReturnType<typeof resolveWallTime>, typed: string) {
    const tz = state[side];
    const name = zoneName(tz, r.instant, 'longGeneric');
    if (r.status === 'gap') {
      setNote({
        text: `${typed} does not exist in ${name} on this date: clocks jump forward ${formatDuration(r.gapMinutes ?? 60)}. Showing ${formatTime(r.instant, tz, state.hour12)} instead.`,
      });
    } else if (r.status === 'ambiguous' && r.alternative) {
      setNote({
        text: `${typed} happens twice in ${name} on this date as clocks fall back. Showing the first one (${abbreviation(tz, r.instant)}); the second is ${abbreviation(tz, r.alternative)}.`,
      });
    } else {
      setNote(null);
    }
  }

  let ribbonKey = '';
  function renderRibbon() {
    const p = wallParts(state.from, state.instant);
    const key = `${state.from}|${state.to}|${p.year}-${p.month}-${p.day}|${state.hour12}`;
    if (key !== ribbonKey) {
      ribbonKey = key;
      const r = ribbonFor(state.from, state.to, p.year, p.month, p.day, state.hour12);
      els.strip.from.style.backgroundImage = r.from;
      els.strip.to.style.backgroundImage = r.to;
      els.ticks.replaceChildren(
        ...r.ticks.map((t) => {
          const span = document.createElement('span');
          span.className = 'absolute top-0 whitespace-nowrap';
          span.style.left = `${t.position}%`;
          span.style.transform = `translateX(-${t.position}%)`;
          const a = document.createElement('span');
          a.className = 'block text-ink-2';
          a.textContent = t.fromLabel;
          const b = document.createElement('span');
          b.className = 'block';
          b.textContent = t.toLabel;
          span.append(a, b);
          return span;
        }),
      );
      els.dateLabel.textContent = formatDate(state.instant, state.from);
      els.datePick.setAttribute('aria-label', `Change date, ${formatLongDate(state.instant, state.from)} in ${placeName(state.from)}`);
      els.scrub.setAttribute('aria-label', `Time of day in ${placeName(state.from)}`);
    }
    els.scrub.value = String(p.hour * 60 + p.minute);
    els.scrub.setAttribute(
      'aria-valuetext',
      `${formatTime(state.instant, state.from, state.hour12)} ${abbreviation(state.from, state.instant)}, ${formatTime(state.instant, state.to, state.hour12)} ${abbreviation(state.to, state.instant)}`,
    );
  }

  function render(opts: { skipInputs?: Side } = {}) {
    const { instant, hour12 } = state;
    for (const side of sides) {
      const tz = state[side];
      ensureOption(els.zone[side], tz);
      if (els.zone[side].value !== tz) els.zone[side].value = tz;
      const c = clockParts(instant, tz, hour12);
      if (opts.skipInputs !== side && document.activeElement !== els.clock[side]) {
        els.clock[side].value = c.digits;
        els.clock[side].removeAttribute('aria-invalid');
      }
      els.meridiem[side].textContent = c.meridiem;
      els.meridiem[side].hidden = !hour12;
      const abbr = abbreviation(tz, instant);
      const place = placeName(tz);
      els.abbr[side].textContent = abbr;
      els.place[side].textContent = place;
      const legend = els.legend[side];
      if (legend) legend.textContent = abbr;
      els.clock[side].setAttribute('aria-label', `Time in ${place}. Type a time such as 2:30 or 14:30, then press Enter`);
      els.meridiem[side].setAttribute('aria-label', `${c.meridiem}, switch ${place} to ${c.meridiem === 'AM' ? 'PM' : 'AM'}`);
      els.dateText[side].textContent = formatDate(instant, tz, false);
      els.name[side].textContent = zoneName(tz, instant, 'long');
      els.offset[side].textContent = formatOffset(offsetMinutes(tz, instant));
      els.dst[side].textContent = dstText(tz, instant);
      els.iana[side].textContent = tz;
    }
    renderRibbon();
    els.shift.textContent = describeDayShift(dayShift(instant, state.from, state.to));
    const fromAbbr = abbreviation(state.from, instant);
    const toAbbr = abbreviation(state.to, instant);
    const relation = describeDifference(offsetMinutes(state.from, instant), offsetMinutes(state.to, instant));
    const sameAbbr = fromAbbr === toAbbr;
    const fromLabel = sameAbbr ? placeName(state.from) : fromAbbr;
    const toLabel = sameAbbr ? placeName(state.to) : toAbbr;
    els.diff.textContent =
      state.from === state.to
        ? 'Both sides use the same time zone.'
        : `${formatTime(instant, state.from, hour12)} ${fromLabel} is ${formatTime(instant, state.to, hour12)} ${toLabel}. ${toLabel} is ${relation} ${fromLabel}.`;
    for (const b of els.formats) b.setAttribute('aria-pressed', String((b.dataset.format === '12') === hour12));
    renderHours();
    syncUrl();
    document.dispatchEvent(
      new CustomEvent<ConverterState>(STATE_EVENT, {
        detail: { from: state.from, to: state.to, instant: state.instant, hour12: state.hour12 },
      }),
    );
  }

  function renderHours() {
    if (!hours) return;
    const body = q<HTMLElement>(hours, '[data-hours-body]');
    const overlapEl = q<HTMLElement>(hours, '[data-overlap]');
    const fromHead = q<HTMLElement>(hours, '[data-hours-from]');
    const toHead = q<HTMLElement>(hours, '[data-hours-to]');
    const dayEl = q<HTMLElement>(hours, '[data-hours-day]');
    if (!body) return;
    const p = wallParts(state.from, state.instant);
    const rows = hourRows(state.from, state.to, p.year, p.month, p.day, state.hour12);
    const fromAbbr = abbreviation(state.from, state.instant);
    const toAbbr = abbreviation(state.to, state.instant);
    if (fromHead) fromHead.textContent = `${placeName(state.from)} (${fromAbbr})`;
    if (toHead) toHead.textContent = `${placeName(state.to)} (${toAbbr})`;
    if (dayEl) dayEl.textContent = formatLongDate(state.instant, state.from);

    const current = Math.floor((state.instant - rows[0].instant) / HOUR);
    body.replaceChildren(
      ...rows.map((r, i) => {
        const tr = document.createElement('tr');
        const both = r.fromWorking && r.toWorking;
        if (both) tr.className = 'bg-accent-wash';
        if (i === current) tr.setAttribute('aria-current', 'time');
        const td1 = document.createElement('td');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className =
          'rounded-part px-1 -mx-1 font-medium text-ink underline decoration-rule-strong underline-offset-4 hover:decoration-accent';
        btn.textContent = r.fromLabel;
        btn.dataset.hourInstant = String(r.instant);
        btn.setAttribute('aria-label', `Set the converter to ${r.fromLabel} ${fromAbbr}`);
        td1.append(btn);
        if (i === current) {
          const mark = document.createElement('span');
          mark.className = 'ml-2 rounded-pill bg-accent px-1.5 py-px text-[0.6875rem] font-medium text-accent-ink';
          mark.textContent = 'selected';
          td1.append(mark);
        }
        const td2 = document.createElement('td');
        td2.textContent = r.toLabel;
        if (r.shift !== 0) {
          const s = document.createElement('span');
          s.className = 'ml-2 text-xs text-muted';
          s.textContent = describeDayShift(r.shift).toLowerCase();
          td2.append(s);
        }
        const td3 = document.createElement('td');
        td3.className = 'text-muted';
        td3.textContent = both ? 'Both working' : r.fromWorking ? `${fromAbbr} working` : r.toWorking ? `${toAbbr} working` : '';
        tr.append(td1, td2, td3);
        return tr;
      }),
    );

    if (overlapEl) {
      const o = workingOverlap(state.from, state.to, p.year, p.month, p.day);
      const window = `${WORK_START}:00 to ${WORK_END}:00`;
      overlapEl.textContent = o
        ? `Working hours (${window}) overlap from ${formatTime(o.start, state.from, state.hour12)} to ${formatTime(o.end, state.from, state.hour12)} ${fromAbbr}, which is ${formatTime(o.start, state.to, state.hour12)} to ${formatTime(o.end, state.to, state.hour12)} ${toAbbr}.`
        : `Working hours (${window}) do not overlap on this date. Pick an hour below to find the least disruptive slot.`;
    }
  }

  let urlTimer = 0;
  function buildUrl(full: boolean): URL {
    const url = new URL(location.href);
    url.search = '';
    if (state.from !== defaults.from) url.searchParams.set('from', state.from);
    if (state.to !== defaults.to) url.searchParams.set('to', state.to);
    if (full || !state.live) {
      const p = wallParts(state.from, state.instant);
      url.searchParams.set('date', toDateInput(p));
      url.searchParams.set('time', toTimeInput(p));
    }
    url.hash = '';
    return url;
  }
  function syncUrl() {
    window.clearTimeout(urlTimer);
    urlTimer = window.setTimeout(() => {
      const url = buildUrl(false);
      if (url.href !== location.href) history.replaceState(history.state, '', url);
    }, 250);
  }

  function setWallTime(side: Side, d: { year: number; month: number; day: number }, t: { hour: number; minute: number }) {
    const r = resolveWallTime(state[side], d.year, d.month, d.day, t.hour, t.minute);
    state.instant = r.instant;
    state.live = false;
    state.anchor = side;
    describeResolution(side, r, formatTime(Date.UTC(2000, 0, 1, t.hour, t.minute), 'UTC', state.hour12));
    render();
  }

  function commitClock(side: Side) {
    const input = els.clock[side];
    const current = clockParts(state.instant, state[side], state.hour12);
    if (input.value.trim() === current.digits) {
      input.removeAttribute('aria-invalid');
      return;
    }
    const t = parseClockText(input.value, current.meridiem);
    if (!t) {
      input.setAttribute('aria-invalid', 'true');
      setNote({ text: 'Type a time such as 2:30, 2:30 pm or 14:30.', error: true });
      return;
    }
    input.removeAttribute('aria-invalid');
    setWallTime(side, wallParts(state[side], state.instant), t);
    input.value = clockParts(state.instant, state[side], state.hour12).digits;
  }

  function shiftDays(days: number) {
    const p = wallParts(state.from, state.instant);
    const d = new Date(Date.UTC(p.year, p.month - 1, p.day) + days * DAY);
    const year = d.getUTCFullYear();
    if (year < 1900 || year > 2100) return;
    setWallTime('from', { year, month: d.getUTCMonth() + 1, day: d.getUTCDate() }, p);
  }

  for (const side of sides) {
    const clock = els.clock[side];
    clock.addEventListener('focus', () => clock.select());
    clock.addEventListener('change', () => commitClock(side));
    clock.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commitClock(side);
      else if (e.key === 'Escape') {
        clock.value = clockParts(state.instant, state[side], state.hour12).digits;
        clock.removeAttribute('aria-invalid');
        setNote(null);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const step = (e.shiftKey ? 60 : 15) * (e.key === 'ArrowUp' ? 1 : -1);
        state.instant = Math.round((state.instant + step * MINUTE) / MINUTE) * MINUTE;
        state.live = false;
        state.anchor = side;
        setNote(null);
        render();
        clock.value = clockParts(state.instant, state[side], state.hour12).digits;
        clock.select();
      }
    });
    els.meridiem[side].addEventListener('click', () => {
      const p = wallParts(state[side], state.instant);
      setWallTime(side, p, { hour: (p.hour + 12) % 24, minute: p.minute });
    });
    els.zone[side].addEventListener('change', () => setZone(side, els.zone[side].value));
  }

  els.scrub.addEventListener('input', () => {
    const minutes = Number(els.scrub.value);
    const p = wallParts(state.from, state.instant);
    setWallTime('from', p, { hour: Math.floor(minutes / 60), minute: minutes % 60 });
  });

  for (const b of els.daySteps) b.addEventListener('click', () => shiftDays(Number(b.dataset.dayStep)));

  createCalendar({
    trigger: els.datePick,
    pop: els.calendar,
    value: () => wallParts(state.from, state.instant),
    today: () => wallParts(state.from, Date.now()),
    zoneLabel: () => `Dates in ${placeName(state.from)}`,
    onPick: (d) => setWallTime('from', d, wallParts(state.from, state.instant)),
  });

  for (const side of sides) {
    createZonePicker({
      trigger: els.zoneTrigger[side],
      pop: els.zonePop[side],
      select: els.zone[side],
      allZones: () => all,
      instant: () => state.instant,
      hour12: () => state.hour12,
      abbreviation,
      placeName,
    });
  }

  function setZone(side: Side, tz: string) {
    if (!isValidTimeZone(tz)) return;
    if (side === state.anchor && !state.live) {
      const p = wallParts(state[side], state.instant);
      state[side] = tz;
      const r = resolveWallTime(tz, p.year, p.month, p.day, p.hour, p.minute);
      state.instant = r.instant;
      describeResolution(side, r, formatTime(Date.UTC(2000, 0, 1, p.hour, p.minute), 'UTC', state.hour12));
    } else {
      state[side] = tz;
      setNote(null);
    }
    render();
  }

  els.swap.addEventListener('click', () => {
    [state.from, state.to] = [state.to, state.from];
    state.anchor = state.anchor === 'from' ? 'to' : 'from';
    setNote(null);
    render();
  });

  els.now.addEventListener('click', () => {
    state.live = true;
    state.instant = Math.floor(Date.now() / MINUTE) * MINUTE;
    setNote(null);
    render();
  });

  for (const b of els.formats) {
    b.addEventListener('click', () => {
      state.hour12 = b.dataset.format === '12';
      try {
        localStorage.setItem(FORMAT_KEY, state.hour12 ? '12' : '24');
      } catch {
        /* storage unavailable */
      }
      render();
    });
  }

  let copyTimer = 0;
  els.copy.addEventListener('click', async () => {
    const href = buildUrl(true).href;
    let ok = false;
    try {
      await navigator.clipboard.writeText(href);
      ok = true;
    } catch {
      ok = false;
    }
    els.copyStatus.textContent = ok ? 'Link copied' : 'Copy failed. The address bar has the link.';
    if (!ok) history.replaceState(history.state, '', href);
    window.clearTimeout(copyTimer);
    copyTimer = window.setTimeout(() => (els.copyStatus.textContent = ''), 3000);
  });

  hours?.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest<HTMLButtonElement>('[data-hour-instant]');
    if (!btn) return;
    state.instant = Number(btn.dataset.hourInstant);
    state.live = false;
    state.anchor = 'from';
    setNote(null);
    render();
  });

  document.addEventListener(PICK_EVENT, (e) => {
    const { tz, side } = (e as CustomEvent<{ tz: string; side: Side }>).detail;
    setZone(side, tz);
    root.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  });

  window.setInterval(() => {
    if (!state.live) return;
    const now = Math.floor(Date.now() / MINUTE) * MINUTE;
    if (now !== state.instant) {
      state.instant = now;
      render();
    }
  }, 10_000);

  const all = supportedZones();
  const populate = () => {
    for (const side of sides) populateSelect(els.zone[side], all, state.instant);
    for (const side of sides) els.zone[side].value = state[side];
  };
  const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
  if (idle) idle(populate);
  else window.setTimeout(populate, 200);

  if (initial) describeResolution('from', initial.r, formatTime(Date.UTC(2000, 0, 1, initial.hour, initial.minute), 'UTC', state.hour12));
  render();
}
