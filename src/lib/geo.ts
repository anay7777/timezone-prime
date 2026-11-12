import { pairs, pairsBySource, type Pair } from '../data/pairs';
import type { Zone } from '../data/zones';
import { offsetsSummary, periodLabel } from './pair-content';
import { aliasText, pairPageData, zoneLabel } from './pair-page';
import { generalFaqs, zoneFaqs, zoneGlance } from './general-faqs';
import { pairSeo, pairSideNames, pairSidePlaces } from './seo';
import { siteName, siteUrl } from './site';
import { formatDurationShort } from './time';

export const pairUrl = (p: Pair) => `${siteUrl}/${p.slug}/`;
export const pairMarkdownPath = (p: Pair) => `/${p.slug}/index.md`;

const isoDate = (now: number) => new Date(now).toISOString().slice(0, 10);

export const list = (items: string[], conjunction = 'and') => {
  if (items.length < 2) return items.join('');
  return `${items.slice(0, -1).join(', ')} ${conjunction} ${items[items.length - 1]}`;
};

/**
 * Sentences naming the other ways people write each side of a pair, and the places on each side,
 * taken from the pair's keywords so every phrasing a search or AI answer might use appears once.
 */
export function pairSynonymText(p: Pair): string[] {
  const seo = pairSeo(p.slug);
  if (!seo) return [];
  const { from: A, to: B } = p;
  const names = pairSideNames(seo.keywords);
  const places = pairSidePlaces(seo.keywords);
  const alsoWritten = (z: Zone, other: string[]) => {
    const label = zoneLabel(z);
    const all = [...new Set([z.name, ...other])].filter((n) => n.toLowerCase() !== label.toLowerCase() && n !== z.abbr);
    return all.length ? `${label} is also written ${list(all, 'or')}` : '';
  };
  const nameParts = [alsoWritten(A, names.from), alsoWritten(B, names.to)].filter(Boolean);
  const out: string[] = [];
  if (nameParts.length) out.push(`${nameParts.join('; ')}.`);
  if (places.from.length && places.to.length)
    out.push(`The conversion covers ${list(places.from)} on ${zoneLabel(A)}, and ${list(places.to)} on ${zoneLabel(B)}.`);
  return out;
}

/** One-sentence answer for a pair, suitable for an index line or a snippet. */
export function pairAnswer(p: Pair, now: number): string {
  return pairPageData(p, now).differenceSummary;
}

/** Full Markdown version of a pair page: the same facts, without the interactive parts. */
export function pairMarkdown(p: Pair, now: number): string {
  const { from: A, to: B } = p;
  const d = pairPageData(p, now);
  const synonyms = pairSynonymText(p);
  const L = zoneLabel;
  const out: string[] = [];

  out.push(`# ${L(A)} to ${L(B)}: ${A.name} to ${B.name}`, '');
  out.push(`> ${d.differenceSummary}`, '');
  out.push(`Source: ${pairUrl(p)}  `, `Updated: ${isoDate(now)}  `, `Rules: IANA time zone database (${A.tz} and ${B.tz})`, '');

  out.push('## Key facts', '');
  out.push(`- **Time difference:** ${d.differenceSummary}`);
  out.push(`- **Meeting window:** ${d.meetingText}`);
  out.push(`- **Daylight saving:** ${d.dstSummary}`);
  if (d.changes[0]) out.push(`- **Next clock change:** ${d.changes[0].text} (${d.changes[0].zone.name}).`);
  out.push(`- **${A.name}:** ${aliasText(A)}, ${offsetsSummary(A, now)}. Used in ${A.places}.`);
  out.push(`- **${B.name}:** ${aliasText(B)}, ${offsetsSummary(B, now)}. Used in ${B.places}.`);
  out.push('');

  if (synonyms.length) out.push('## Also known as', '', synonyms.join(' '), '');

  out.push(`## ${L(A)} to ${L(B)} conversion table`, '');
  const head = d.tableGroups.map((g) => `${g.toAbbrs.join(' or ')} (${formatDurationShort(g.diff)} ${g.diff >= 0 ? 'ahead' : 'behind'}, ${d.daysText(g.days)})`);
  out.push(`| ${A.name} | ${head.join(' | ')} |`, `|${' --- |'.repeat(head.length + 1)}`);
  for (const r of d.quick) out.push(`| ${r.from} | ${r.to.join(' | ')} |`);
  out.push('');

  if (d.twoYearPeriods.length > 1) {
    out.push(`## How the gap changes in ${d.year} and ${d.year + 1}`, '');
    out.push(`| Dates | ${L(A)} | ${L(B)} | Difference |`, '| --- | --- | --- | --- |');
    for (const per of d.twoYearPeriods) {
      const diff = per.diff === 0 ? 'Same time' : `${per.toAbbr} ${formatDurationShort(per.diff)} ${per.diff > 0 ? 'ahead' : 'behind'}`;
      out.push(`| ${periodLabel(per)} | ${per.fromAbbr} | ${per.toAbbr} | ${diff} |`);
    }
    out.push('');
  }

  if (d.changes.length) {
    out.push('## Upcoming clock changes', '');
    for (const c of d.changes) out.push(`- ${c.zone.name}: ${c.text}`);
    out.push('');
  }

  out.push('## Questions and answers', '');
  for (const f of d.faqs) out.push(`### ${f.q}`, '', f.a, '');

  out.push('## About the two zones', '');
  for (const z of [A, B]) {
    out.push(`### ${z.name} (${aliasText(z)})`, '', z.about, '');
    if (z.cities.length) out.push(`Major cities: ${z.cities.join(', ')}.`, '');
    if (z.note) out.push(z.note, '');
  }

  out.push(`Interactive converter for any date and time: ${pairUrl(p)}`, '');
  return out.join('\n');
}

const intro = (now: number) => [
  `# ${siteName}`,
  '',
  `> ${siteName} (${siteUrl}) is a free time zone converter. It converts a time between any two time zones using the IANA time zone database, applies daylight saving time for the exact date chosen, and shows working-hour overlap, an hour-by-hour table and real zone boundaries on a world map. No sign-up is needed and conversions run in the browser.`,
  '',
  `Facts below were generated from the IANA rules on ${isoDate(now)}. Time differences that depend on daylight saving are given for ${new Date(now).getUTCFullYear()}.`,
  '',
  'Conventions: EST, CST, MST and PST mean US Eastern, Central, Mountain and Pacific Time and follow daylight saving (EDT, CDT, MDT, PDT in summer). IST means India Standard Time. CST never means China Standard Time here. GST means Gulf Standard Time. "UK time" is GMT in winter and BST in summer.',
  '',
];

/** The short index at /llms.txt. */
export function llmsIndex(now: number): string {
  const out = intro(now);
  out.push('## Main pages', '');
  out.push(`- [Time zone converter](${siteUrl}/): convert any two zones, with daylight saving, a day ribbon of working hours and a world time zone map.`);
  out.push(`- [Time zone FAQ](${siteUrl}/faq/): answers on time differences, daylight saving, meeting times and which time zone a city, state or country is in.`);
  out.push(`- [Time zone widgets](${siteUrl}/widgets/): free embeddable clocks and converters.`);
  out.push(`- [About](${siteUrl}/about/): how the conversions work and where the data comes from.`);
  out.push(`- [Full facts for every page](${siteUrl}/llms-full.txt): all conversion tables and answers in one file.`);
  out.push('');

  for (const { zone, pairs: list } of pairsBySource()) {
    out.push(`## From ${zone.name} (${aliasText(zone)})`, '');
    for (const p of list) {
      out.push(`- [${zoneLabel(p.from)} to ${zoneLabel(p.to)}](${pairUrl(p)}): ${pairAnswer(p, now)} Markdown: ${siteUrl}${pairMarkdownPath(p)}`);
    }
    out.push('');
  }

  out.push('## Time zones', '');
  for (const { zone, places } of zoneGlance()) {
    const where = places.length ? ` Places: ${places.join(', ')}.` : '';
    out.push(`- ${zone.name} (${aliasText(zone)}): ${offsetsSummary(zone, now)}. IANA ${zone.tz}.${where}`);
  }
  out.push('');
  return out.join('\n');
}

/** Everything at /llms-full.txt: general answers, zone answers and every pair page in Markdown. */
export function llmsFull(now: number): string {
  const out = intro(now);
  out.push('## General questions', '');
  for (const f of generalFaqs) out.push(`### ${f.q}`, '', f.a, '');
  out.push('## Which time zone is it in?', '');
  for (const f of zoneFaqs(now)) out.push(`### ${f.q}`, '', f.a, '');
  out.push('## Time zones', '');
  for (const { zone } of zoneGlance()) {
    out.push(`### ${zone.name} (${aliasText(zone)})`, '', `${zone.about} Offset: ${offsetsSummary(zone, now)}. IANA zone: ${zone.tz}. Used in ${zone.places}.`, '');
    if (zone.note) out.push(zone.note, '');
  }
  const body = pairs.map((p) => pairMarkdown(p, now).replace(/^(#+) /gm, '##$1 '));
  return [...out, '## Conversions', '', ...body].join('\n');
}
