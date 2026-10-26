import type { Pair } from '../data/pairs';
import type { Zone } from '../data/zones';
import {
  clockChanges,
  differencePeriods,
  meetingFor,
  minutesLabel,
  quickRows,
  seasons,
  shiftLabel,
  yearStart,
  type Season,
} from './pair-content';
import { formatDuration, formatDurationShort, yearOffsets } from './time';
import { keywordTimes, pairPlaces, pairSeo, questionIntents } from './seo';

export interface Faq {
  q: string;
  a: string;
}

export interface DiffGroup {
  diff: number;
  days: number;
  toAbbrs: string[];
  fromAbbrs: string[];
}

export const zoneLabel = (z: Zone) => (z.abbr === 'UK' ? 'UK time' : z.abbr);
export const aliasText = (z: Zone) => (z.dstAbbr ? `${z.stdAbbr}/${z.dstAbbr}` : z.stdAbbr);

/** Everything a pair page says about A to B, computed for the year containing `now`. */
export function pairPageData(pair: Pair, now: number) {
  const { from: A, to: B } = pair;
  const label = zoneLabel;
  const year = new Date(now).getUTCFullYear();

  const yearPeriods = differencePeriods(A, B, yearStart(A.tz, year), yearStart(A.tz, year + 1));
  const twoYearPeriods = differencePeriods(A, B, yearStart(A.tz, year), yearStart(A.tz, year + 2));
  const seasonList = seasons(yearPeriods);

  const diffGroups: DiffGroup[] = [];
  for (const s of seasonList) {
    const g = diffGroups.find((d) => d.diff === s.diff);
    if (g) {
      g.days += s.days;
      if (!g.toAbbrs.includes(s.toAbbr)) g.toAbbrs.push(s.toAbbr);
      if (!g.fromAbbrs.includes(s.fromAbbr)) g.fromAbbrs.push(s.fromAbbr);
    } else diffGroups.push({ diff: s.diff, days: s.days, toAbbrs: [s.toAbbr], fromAbbrs: [s.fromAbbr] });
  }
  diffGroups.sort((a, b) => b.days - a.days);
  const tableGroups = diffGroups.slice(0, 2);
  const main = diffGroups[0];

  const rel = (d: number) => (d === 0 ? 'the same as' : d > 0 ? 'ahead of' : 'behind');
  const relSentence = (s: Pick<Season, 'diff' | 'fromAbbr' | 'toAbbr'>) =>
    s.diff === 0 ? `${s.toAbbr} and ${s.fromAbbr} show the same time` : `${s.toAbbr} is ${formatDuration(s.diff)} ${rel(s.diff)} ${s.fromAbbr}`;

  const groupSentence = (g: DiffGroup) =>
    g.diff === 0 ? `${B.name} and ${A.name} show the same time` : `${B.name} is ${formatDuration(g.diff)} ${rel(g.diff)} ${A.name}`;

  const daysText = (days: number) => {
    const d = Math.round(days);
    if (d >= 360) return 'all year';
    if (d >= 180) return `most of the year (${d} days in ${year})`;
    if (d >= 28) return `about ${Math.round(d / 7)} weeks in ${year}`;
    return `${d} days in ${year}`;
  };

  const differenceSummary =
    diffGroups.length === 1
      ? `${groupSentence(main)} all year.`
      : `${relSentence(seasonList[0])} for ${daysText(seasonList[0].days)}. ${diffGroups
          .slice(1)
          .map((g) => `The gap is ${formatDuration(g.diff)} for ${daysText(g.days)}`)
          .join('. ')}.`;

  const seo = pairSeo(pair.slug);
  const times = seo ? keywordTimes(seo.keywords) : [];
  const quick = quickRows(
    tableGroups.map((g) => ({ diff: g.diff, fromAbbr: '', toAbbr: '', days: g.days })),
    times.length ? times : undefined,
  );
  const meeting = meetingFor(main.diff);
  const changes = clockChanges([A, B], now, now + 548 * 24 * 3600 * 1000);

  const dstA = yearOffsets(A.tz, now).daylight !== null;
  const dstB = yearOffsets(B.tz, now).daylight !== null;
  const dstText = (dates: string) =>
    dstA && dstB
      ? `Both zones change their clocks, on ${changes.length ? dates : 'different dates'}, so the gap can shift during the year.`
      : dstA || dstB
        ? `${(dstA ? A : B).name} changes its clocks twice a year; ${(dstA ? B : A).name} does not.`
        : `Neither zone observes daylight saving time, so the difference never changes.`;
  const dstSummary = dstText('the dates listed below');

  const mainSeason = seasonList.find((s) => s.diff === main.diff)!;
  const seasonNote =
    diffGroups.length > 1
      ? ` while ${mainSeason.fromAbbr === mainSeason.toAbbr ? mainSeason.fromAbbr : `${mainSeason.fromAbbr} and ${mainSeason.toAbbr}`} apply`
      : '';
  const meetingText = meeting.overlapHours
    ? `Working days of 9 AM to 5 PM overlap from ${meeting.overlapFrom} ${mainSeason.fromAbbr}, which is ${meeting.overlapTo} ${mainSeason.toAbbr}${seasonNote}.`
    : `Working days of 9 AM to 5 PM do not overlap. The least disruptive slot is around ${meeting.compromiseFrom} ${mainSeason.fromAbbr}, which is ${meeting.compromiseTo} ${mainSeason.toAbbr}${seasonNote}.`;

  const title = `${label(A)} to ${label(B)} Converter: ${A.name} to ${B.name}`;
  const description = `Convert ${A.name} to ${B.name} for any date. ${groupSentence(main)}${
    diffGroups.length > 1 ? ` most of the year, ${formatDurationShort(diffGroups[1].diff)} at other times` : ''
  }. Daylight saving, hourly table and meeting times.`;

  const convertAt = (m: number) =>
    tableGroups
      .map((g) => {
        const text = `${minutesLabel(m)} ${g.fromAbbrs.join(' or ')} is ${minutesLabel(m + g.diff)}${shiftLabel(m + g.diff)} ${g.toAbbrs.join(' or ')}`;
        return tableGroups.length > 1 ? `${text} for ${daysText(g.days)}` : text;
      })
      .join('. ') + '.';

  const aheadAnswer =
    diffGroups.length === 1 && main.diff === 0
      ? `No. ${differenceSummary}`
      : main.diff > 0
        ? `Yes. ${differenceSummary}`
        : `No, ${label(B)} is behind ${label(A)}. ${differenceSummary}`;

  const intents = seo ? questionIntents(seo.keywords) : [];
  const intentFaqs = intents.flatMap((i): Faq[] => {
    if (i.kind === 'ahead') return [{ q: `Is ${label(B)} ahead of ${label(A)}, and by how many hours?`, a: aheadAnswer }];
    if (i.kind === 'time' && i.minutes !== undefined)
      return [{ q: `What is ${minutesLabel(i.minutes)} ${label(A)} in ${label(B)}?`, a: convertAt(i.minutes) }];
    if (i.kind === 'place' && i.place) {
      const isZone = i.place.toLowerCase() === B.slug;
      return [
        {
          q: isZone ? `How do I work out ${label(B)} from ${label(A)}?` : `How do I work out the time in ${i.place} from ${label(A)}?`,
          a: `${isZone ? '' : `${i.place} uses ${B.name}. `}${differenceSummary} Type any ${label(A)} time into the ${label(A)} to ${label(B)} converter to see the ${isZone ? label(B) : i.place} time for any date.`,
        },
      ];
    }
    return [];
  });

  const faqs: Faq[] = [
    { q: `What is the time difference between ${label(A)} and ${label(B)}?`, a: differenceSummary },
    ...intentFaqs,
    { q: `What is a good meeting time for ${label(A)} and ${label(B)}?`, a: meetingText },
    {
      q: `Does daylight saving time affect ${label(A)} to ${label(B)}?`,
      a: `${dstText('their own dates')} ${changes[0] ? `The next change is on ${changes[0].date} in ${changes[0].zone.name}.` : ''}`.trim(),
    },
    ...[A, B].filter((z) => z.note).map((z) => ({ q: `Which ${z.abbr} does the ${label(A)} to ${label(B)} converter use?`, a: z.note! })),
  ];

  return {
    seo,
    year,
    twoYearPeriods,
    tableGroups,
    daysText,
    differenceSummary,
    times,
    quick,
    changes,
    dstSummary,
    meetingText,
    title,
    description,
    faqs,
    citySample: seo ? pairPlaces(seo.keywords).slice(0, 3) : [],
  };
}
