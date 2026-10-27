import { zones } from '../data/zones';
import { formatOffset, formatTime, offsetMinutes } from '../lib/time';

const OPEN_EVENT = 'tzp:popover-open';

interface Popover {
  open(): void;
  close(returnFocus?: boolean): void;
  isOpen(): boolean;
}

function popover(trigger: HTMLElement, pop: HTMLElement, onOpen: () => void): Popover {
  const isOpen = () => !pop.hidden;
  function close(returnFocus = false) {
    if (!isOpen()) return;
    pop.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (returnFocus) trigger.focus();
  }
  function open() {
    document.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: pop }));
    pop.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    onOpen();
  }
  trigger.addEventListener('click', () => (isOpen() ? close() : open()));
  document.addEventListener(OPEN_EVENT, (e) => {
    if ((e as CustomEvent<HTMLElement>).detail !== pop) close();
  });
  document.addEventListener('pointerdown', (e) => {
    const t = e.target as Node;
    if (isOpen() && !pop.contains(t) && !trigger.contains(t)) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    }
  });
  pop.addEventListener('focusout', (e) => {
    const next = e.relatedTarget as Node | null;
    if (next && !pop.contains(next) && !trigger.contains(next)) close();
  });
  return { open, close, isOpen };
}

/* ---------------- zone picker ---------------- */

interface ZoneEntry {
  tz: string;
  badge: string;
  place: string;
  detail: string;
  popular: boolean;
  haystack: string;
  abbrs: string[];
}

export interface ZonePickerOptions {
  trigger: HTMLButtonElement;
  pop: HTMLElement;
  select: HTMLSelectElement;
  allZones: () => string[];
  instant: () => number;
  hour12: () => boolean;
  abbreviation: (tz: string, instant: number) => string;
  placeName: (tz: string) => string;
}

const MAX_RESULTS = 120;

/** Browsers list some zones under their pre-rename IANA links. */
export const CURRENT_NAME: Record<string, string> = {
  'Africa/Asmera': 'Africa/Asmara',
  'America/Buenos_Aires': 'America/Argentina/Buenos_Aires',
  'America/Catamarca': 'America/Argentina/Catamarca',
  'America/Coral_Harbour': 'America/Atikokan',
  'America/Cordoba': 'America/Argentina/Cordoba',
  'America/Godthab': 'America/Nuuk',
  'America/Indianapolis': 'America/Indiana/Indianapolis',
  'America/Jujuy': 'America/Argentina/Jujuy',
  'America/Louisville': 'America/Kentucky/Louisville',
  'America/Mendoza': 'America/Argentina/Mendoza',
  'Asia/Calcutta': 'Asia/Kolkata',
  'Asia/Dacca': 'Asia/Dhaka',
  'Asia/Katmandu': 'Asia/Kathmandu',
  'Asia/Rangoon': 'Asia/Yangon',
  'Asia/Saigon': 'Asia/Ho_Chi_Minh',
  'Asia/Thimbu': 'Asia/Thimphu',
  'Asia/Ujung_Pandang': 'Asia/Makassar',
  'Asia/Ulan_Bator': 'Asia/Ulaanbaatar',
  'Atlantic/Faeroe': 'Atlantic/Faroe',
  'Europe/Kiev': 'Europe/Kyiv',
  'Pacific/Enderbury': 'Pacific/Kanton',
  'Pacific/Ponape': 'Pacific/Pohnpei',
  'Pacific/Truk': 'Pacific/Chuuk',
};

export function createZonePicker(o: ZonePickerOptions) {
  const search = o.pop.querySelector<HTMLInputElement>('[data-zone-search]')!;
  const list = o.pop.querySelector<HTMLUListElement>('[data-zone-list]')!;
  const count = o.pop.querySelector<HTMLElement>('[data-zone-count]')!;
  const coarse = matchMedia('(pointer: coarse)').matches;
  let entries: ZoneEntry[] = [];
  let entriesKey = '';
  let shown: ZoneEntry[] = [];
  let active = -1;

  function buildEntries() {
    const now = o.instant();
    const key = `${Math.floor(now / 3_600_000)}|${o.allZones().length}`;
    if (key === entriesKey) return;
    entriesKey = key;
    const popular = new Set(zones.map((z) => z.tz));
    const offsetText = (tz: string) => {
      try {
        return formatOffset(offsetMinutes(tz, now));
      } catch {
        return '';
      }
    };
    entries = zones.map((z) => {
      const abbr = o.abbreviation(z.tz, now);
      const abbrs = [z.abbr, z.stdAbbr, z.dstAbbr ?? '', abbr].filter(Boolean).map((s) => s.toLowerCase());
      return {
        tz: z.tz,
        badge: abbr,
        place: z.city.name,
        detail: `${z.name} · ${offsetText(z.tz)}`,
        popular: true,
        abbrs,
        haystack: [z.tz, z.name, z.city.name, ...z.places, ...z.cities, ...abbrs, offsetText(z.tz)].join(' ').toLowerCase().replaceAll('_', ' '),
      };
    });
    const seen = new Set(popular);
    for (const listed of o.allZones()) {
      const tz = CURRENT_NAME[listed] ?? listed;
      if (seen.has(tz) || tz.startsWith('Etc/') || tz.startsWith('SystemV/') || !tz.includes('/')) continue;
      seen.add(tz);
      const off = offsetText(tz);
      if (!off) continue;
      const region = tz.split('/')[0];
      const place = o.placeName(tz);
      entries.push({
        tz,
        badge: off.replace('UTC', '') || '+0',
        place,
        detail: `${region.replaceAll('_', ' ')} · ${off}`,
        popular: false,
        abbrs: [],
        haystack: `${tz} ${place} ${region} ${off}`.toLowerCase().replaceAll('_', ' '),
      });
    }
  }

  function filter(query: string): ZoneEntry[] {
    const q = query.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!q) return entries;
    const terms = q.split(' ');
    const scored: { e: ZoneEntry; score: number }[] = [];
    for (const e of entries) {
      if (!terms.every((t) => e.haystack.includes(t))) continue;
      const place = e.place.toLowerCase();
      let score = e.popular ? 2 : 0;
      if (e.abbrs.includes(q)) score += 10;
      if (place === q) score += 8;
      else if (place.startsWith(q)) score += 5;
      scored.push({ e, score });
    }
    scored.sort((a, b) => b.score - a.score || a.e.place.localeCompare(b.e.place));
    return scored.slice(0, MAX_RESULTS).map((s) => s.e);
  }

  function optionId(i: number) {
    return `${list.id}-opt-${i}`;
  }

  function render() {
    const query = search.value;
    shown = filter(query);
    const now = o.instant();
    const hour12 = o.hour12();
    const current = o.select.value;
    const frag = document.createDocumentFragment();
    const heading = (text: string) => {
      const li = document.createElement('li');
      li.className = 'zone-group';
      li.setAttribute('role', 'presentation');
      li.textContent = text;
      frag.append(li);
    };
    if (!query.trim() && shown.length) heading('Popular');
    shown.forEach((e, i) => {
      if (!query.trim() && i > 0 && !e.popular && shown[i - 1].popular) heading('All time zones');
      const li = document.createElement('li');
      li.id = optionId(i);
      li.className = 'zone-option';
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(e.tz === current));
      li.dataset.index = String(i);
      const badge = document.createElement('span');
      badge.className = 'zone-abbr';
      badge.textContent = e.badge;
      const text = document.createElement('span');
      text.className = 'min-w-0';
      const place = document.createElement('span');
      place.className = 'block truncate text-sm font-medium';
      place.textContent = e.place;
      const detail = document.createElement('span');
      detail.className = 'block truncate text-xs text-muted';
      detail.textContent = e.detail;
      text.append(place, detail);
      const time = document.createElement('span');
      time.className = 'text-sm tabular text-ink-2';
      time.textContent = formatTime(now, e.tz, hour12);
      li.append(badge, text, time);
      frag.append(li);
    });
    if (!shown.length) {
      const li = document.createElement('li');
      li.className = 'px-3 py-6 text-center text-sm text-muted';
      li.setAttribute('role', 'presentation');
      li.textContent = 'No time zone matches that search.';
      frag.append(li);
    }
    list.replaceChildren(frag);
    count.textContent = query.trim()
      ? `${shown.length === MAX_RESULTS ? `First ${MAX_RESULTS}` : shown.length} ${shown.length === 1 ? 'match' : 'matches'}`
      : `${entries.length} time zones`;
  }

  function setActive(i: number, scroll = true) {
    list.querySelector('[data-active]')?.removeAttribute('data-active');
    active = shown.length ? Math.max(0, Math.min(shown.length - 1, i)) : -1;
    if (active < 0) {
      search.removeAttribute('aria-activedescendant');
      return;
    }
    const el = document.getElementById(optionId(active));
    el?.setAttribute('data-active', '');
    search.setAttribute('aria-activedescendant', optionId(active));
    if (scroll) el?.scrollIntoView({ block: 'nearest' });
  }

  function choose(i: number) {
    const e = shown[i];
    if (!e) return;
    if (![...o.select.options].some((opt) => opt.value === e.tz)) o.select.append(new Option(e.tz, e.tz));
    o.select.value = e.tz;
    o.select.dispatchEvent(new Event('change', { bubbles: true }));
    pop.close(true);
  }

  const pop = popover(o.trigger, o.pop, () => {
    buildEntries();
    search.value = '';
    render();
    const selected = shown.findIndex((e) => e.tz === o.select.value);
    setActive(selected >= 0 ? selected : 0);
    if (!coarse) search.focus();
    else search.blur();
  });

  search.addEventListener('input', () => {
    render();
    setActive(0);
  });
  search.addEventListener('keydown', (e) => {
    const page = 8;
    if (e.key === 'ArrowDown') setActive(active + 1);
    else if (e.key === 'ArrowUp') setActive(active - 1);
    else if (e.key === 'PageDown') setActive(active + page);
    else if (e.key === 'PageUp') setActive(active - page);
    else if (e.key === 'Enter') choose(active);
    else return;
    e.preventDefault();
  });
  o.trigger.addEventListener('keydown', (e) => {
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !pop.isOpen()) {
      e.preventDefault();
      pop.open();
      search.focus();
    }
  });
  list.addEventListener('pointermove', (e) => {
    const li = (e.target as Element).closest<HTMLElement>('[role=option]');
    if (li && Number(li.dataset.index) !== active) setActive(Number(li.dataset.index), false);
  });
  list.addEventListener('mousedown', (e) => e.preventDefault());
  list.addEventListener('click', (e) => {
    const li = (e.target as Element).closest<HTMLElement>('[role=option]');
    if (li) choose(Number(li.dataset.index));
  });

  return pop;
}

/* ---------------- calendar ---------------- */

export interface DateParts {
  year: number;
  month: number;
  day: number;
}

export interface CalendarOptions {
  trigger: HTMLButtonElement;
  pop: HTMLElement;
  value: () => DateParts;
  today: () => DateParts;
  zoneLabel: () => string;
  onPick: (d: DateParts) => void;
}

const DAY_MS = 86_400_000;
const MIN_YEAR = 1900;
const MAX_YEAR = 2100;
const titleFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' });
const labelFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

const toUtc = (d: DateParts) => Date.UTC(d.year, d.month - 1, d.day);
const fromUtc = (t: number): DateParts => {
  const d = new Date(t);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
};
const same = (a: DateParts, b: DateParts) => a.year === b.year && a.month === b.month && a.day === b.day;
const inRange = (d: DateParts) => d.year >= MIN_YEAR && d.year <= MAX_YEAR;

function addMonths(d: DateParts, n: number): DateParts {
  const first = new Date(Date.UTC(d.year, d.month - 1 + n, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return { year: first.getUTCFullYear(), month: first.getUTCMonth() + 1, day: Math.min(d.day, last) };
}

export function createCalendar(o: CalendarOptions) {
  const title = o.pop.querySelector<HTMLElement>('[data-cal-title]')!;
  const body = o.pop.querySelector<HTMLElement>('[data-cal-body]')!;
  const zone = o.pop.querySelector<HTMLElement>('[data-cal-zone]')!;
  const todayBtn = o.pop.querySelector<HTMLButtonElement>('[data-cal-today]')!;
  let focusDate: DateParts = o.value();

  function render() {
    const selected = o.value();
    const today = o.today();
    title.textContent = titleFormat.format(Date.UTC(focusDate.year, focusDate.month - 1, 1));
    zone.textContent = o.zoneLabel();
    const first = Date.UTC(focusDate.year, focusDate.month - 1, 1);
    const start = first - new Date(first).getUTCDay() * DAY_MS;
    const rows: HTMLTableRowElement[] = [];
    for (let w = 0; w < 6; w++) {
      const tr = document.createElement('tr');
      for (let i = 0; i < 7; i++) {
        const d = fromUtc(start + (w * 7 + i) * DAY_MS);
        const td = document.createElement('td');
        td.className = 'p-0.5';
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'cal-day';
        b.textContent = String(d.day);
        b.dataset.date = `${d.year}-${d.month}-${d.day}`;
        b.tabIndex = same(d, focusDate) ? 0 : -1;
        b.setAttribute('aria-label', labelFormat.format(toUtc(d)));
        b.setAttribute('aria-selected', String(same(d, selected)));
        if (same(d, today)) {
          b.dataset.today = '';
          b.setAttribute('aria-current', 'date');
        }
        if (d.month !== focusDate.month) b.dataset.outside = '';
        if (!inRange(d)) b.disabled = true;
        td.append(b);
        tr.append(td);
      }
      rows.push(tr);
    }
    body.replaceChildren(...rows);
  }

  function focusCell() {
    body.querySelector<HTMLButtonElement>('button[tabindex="0"]')?.focus();
  }

  function moveTo(d: DateParts) {
    if (!inRange(d)) return;
    focusDate = d;
    render();
    focusCell();
  }

  const pop = popover(o.trigger, o.pop, () => {
    focusDate = o.value();
    render();
    focusCell();
  });

  function pick(d: DateParts) {
    if (!inRange(d)) return;
    o.onPick(d);
    pop.close(true);
  }

  for (const b of o.pop.querySelectorAll<HTMLButtonElement>('[data-cal-step]')) {
    b.addEventListener('click', () => {
      const next = addMonths(focusDate, Number(b.dataset.calStep));
      if (!inRange(next)) return;
      focusDate = next;
      render();
    });
  }
  todayBtn.addEventListener('click', () => pick(o.today()));

  body.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('button[data-date]');
    if (!b) return;
    const [year, month, day] = b.dataset.date!.split('-').map(Number);
    pick({ year, month, day });
  });

  body.addEventListener('keydown', (e) => {
    const t = toUtc(focusDate);
    const weekday = new Date(t).getUTCDay();
    let next: DateParts | null = null;
    if (e.key === 'ArrowLeft') next = fromUtc(t - DAY_MS);
    else if (e.key === 'ArrowRight') next = fromUtc(t + DAY_MS);
    else if (e.key === 'ArrowUp') next = fromUtc(t - 7 * DAY_MS);
    else if (e.key === 'ArrowDown') next = fromUtc(t + 7 * DAY_MS);
    else if (e.key === 'Home') next = fromUtc(t - weekday * DAY_MS);
    else if (e.key === 'End') next = fromUtc(t + (6 - weekday) * DAY_MS);
    else if (e.key === 'PageUp') next = addMonths(focusDate, e.shiftKey ? -12 : -1);
    else if (e.key === 'PageDown') next = addMonths(focusDate, e.shiftKey ? 12 : 1);
    if (!next) return;
    e.preventDefault();
    moveTo(next);
  });

  return pop;
}
