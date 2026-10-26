import data from '../data/seo-keywords.json';

export interface PairKeywords {
  primary: string[];
  aliases: string[];
  fullNames: string[];
  places: string[];
  specificTimes: string[];
  questions: string[];
}

export interface PairSeo {
  slug: string;
  from: string;
  to: string;
  title: string;
  keywords: PairKeywords;
}

export interface ZoneSeo {
  label: string;
  name: string;
  keywords: string[];
}

export const generalKeywords: string[] = data.general;
export const zoneSeo: Record<string, ZoneSeo> = data.zones;

const pairSeoBySlug = new Map<string, PairSeo>(data.pairs.map((p) => [p.slug, p]));

export function pairSeo(slug: string): PairSeo | undefined {
  return pairSeoBySlug.get(slug);
}

/** Every keyword for a pair, in priority order. */
export function allPairKeywords(k: PairKeywords): string[] {
  return [...k.primary, ...k.aliases, ...k.fullNames, ...k.places, ...k.specificTimes, ...k.questions];
}

/** Search engines that still read meta keywords treat long lists as spam, so the tag gets the strongest terms only. */
export const META_KEYWORD_LIMIT = 30;

export function pairMetaKeywords(k: PairKeywords): string[] {
  return [...k.primary.slice(0, 12), ...k.aliases, ...k.fullNames.slice(0, 6), ...k.places.slice(0, 4)].slice(0, META_KEYWORD_LIMIT);
}

export function landingMetaKeywords(): string[] {
  return [...generalKeywords, ...Object.values(zoneSeo).map((z) => z.keywords[0])].slice(0, META_KEYWORD_LIMIT);
}

export function allZoneKeywords(): string[] {
  return Object.values(zoneSeo).flatMap((z) => z.keywords);
}

/** Minutes after midnight for a clock time written in a keyword, such as "9am", "10 pm" or "9:30 am". */
export function parseKeywordTime(keyword: string): number | null {
  if (/\bnoon\b/.test(keyword)) return 12 * 60;
  const m = keyword.match(/\b(\d{1,2})(?::(\d{2}))?\s?(am|pm)\b/);
  if (!m) return null;
  const h = Number(m[1]) % 12;
  return (m[3] === 'pm' ? h + 12 : h) * 60 + Number(m[2] ?? 0);
}

/** Distinct clock times named in the specific-time keywords, sorted through the day. */
export function keywordTimes(k: PairKeywords): number[] {
  const set = new Set<number>();
  for (const kw of k.specificTimes) {
    const t = parseKeywordTime(kw);
    if (t !== null) set.add(t);
  }
  return [...set].sort((a, b) => a - b);
}

const ABBRS = new Set(Object.keys(zoneSeo));
const UPPER_WORDS = new Set(['uae', 'dc', 'usa', ...ABBRS]);

export function titleCase(text: string): string {
  return text
    .split(' ')
    .map((w) => (UPPER_WORDS.has(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

/** Place names from keywords like "what time zone is arizona". */
export function zonePlaces(z: ZoneSeo): string[] {
  return z.keywords.flatMap((kw) => {
    const m = kw.match(/^what time zone is (.+)$/);
    return m ? [titleCase(m[1])] : [];
  });
}

/** City pairs from keywords like "new york to delhi time". */
export function pairPlaces(k: PairKeywords): { from: string; to: string }[] {
  return k.places.flatMap((kw) => {
    const m = kw.match(/^(.+?) to (.+?) time$/);
    return m && !m[1].endsWith(' time') && !ABBRS.has(m[1]) ? [{ from: titleCase(m[1]), to: titleCase(m[2]) }] : [];
  });
}

export type QuestionKind = 'ahead' | 'daylight' | 'time' | 'place';

/** Groups the question keywords so each becomes one FAQ entry. */
export function questionIntents(k: PairKeywords): { kind: QuestionKind; minutes?: number; place?: string }[] {
  const out: { kind: QuestionKind; minutes?: number; place?: string }[] = [];
  const seen = new Set<string>();
  const add = (key: string, item: (typeof out)[number]) => {
    if (seen.has(key)) return;
    seen.add(key);
    out.push(item);
  };
  for (const q of k.questions) {
    if (/ahead/.test(q)) add('ahead', { kind: 'ahead' });
    else if (/daylight saving/.test(q)) add('daylight', { kind: 'daylight' });
    else if (/^what time is it in /.test(q)) {
      const place = q.replace(/^what time is it in /, '').split(' ').slice(0, -1).join(' ');
      add(`place:${place}`, { kind: 'place', place: titleCase(place) });
    } else {
      const minutes = parseKeywordTime(q);
      if (minutes !== null) add(`time:${minutes}`, { kind: 'time', minutes });
    }
  }
  return out;
}
