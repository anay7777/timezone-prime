import { pairsBySource } from '../data/pairs';
import { zoneBySlug } from '../data/zones';
import type { Faq } from './pair-page';
import { zonePlaces, zoneSeo } from './seo';

/** The zones in the keyword file, with the places that use them and a pair page to link to. */
export function zoneGlance() {
  const firstPair = new Map(pairsBySource().map((g) => [g.zone.slug, g.pairs[0]]));
  return Object.entries(zoneSeo).flatMap(([slug, z]) => {
    const zone = zoneBySlug.get(slug);
    return zone ? [{ zone, places: zonePlaces(z), pair: firstPair.get(slug) }] : [];
  });
}

const usZones = ['est', 'cst', 'mst', 'pst'].flatMap((s) => zoneGlance().filter((g) => g.zone.slug === s));

export const generalFaqs: Faq[] = [
  {
    q: 'What is my time zone?',
    a: 'Your device reports its time zone to the browser, and the converter home page shows it under the main heading as "Your time zone". To see how your time compares with somewhere else, pick your zone under From and the other place under To.',
  },
  {
    q: 'What are the time zones in the USA?',
    a: `The contiguous United States uses four main zones: ${usZones
      .map((g) => `${g.zone.name} (${g.zone.stdAbbr}/${g.zone.dstAbbr}), used in ${g.places.filter((p) => p !== 'Toronto').slice(0, 3).join(', ')}`)
      .join('; ')}. Alaska and Hawaii have their own zones. Most of Arizona stays on Mountain Standard Time all year, and a few Indiana counties use Central Time while the rest of the state is on Eastern. The map on the converter page draws the real boundaries.`,
  },
  {
    q: 'Is the time zone converter free?',
    a: "Yes. There's no account to create and no limit on how many conversions you run. Everything is worked out in your browser.",
  },
  {
    q: 'Does it account for daylight saving time?',
    a: "Yes, for every date. The offset comes from the rules in force on the date you pick, not from today's offset, so a conversion for next March or last November uses the clocks that apply on that day.",
  },
  {
    q: 'What is the difference between UTC and GMT?',
    a: 'For converting times there is none: both have a zero offset. UTC is the time standard kept by atomic clocks. GMT is the name of the time zone the UK uses in winter, and that Iceland and several West African countries use all year. In summer the UK is not on GMT but on BST, one hour ahead.',
  },
  {
    q: 'How many time zones are there?',
    a: 'In theory there are 24 one-hour bands. In practice about 38 different offsets are in use, from UTC-12 to UTC+14, including the half-hour and 45-minute ones. The IANA database splits these into several hundred named zones, because places that share an offset today may have had different rules in the past or may change their clocks on different dates.',
  },
  {
    q: 'Why does the time difference between two cities change during the year?',
    a: 'Because at least one of them observes daylight saving time, or both do but switch on different dates. New York and London, for example, are five hours apart for most of the year and four hours apart for a few weeks in March and around the start of November.',
  },
  {
    q: 'Can I convert a time in the past or the future?',
    a: "Yes. Pick a date with the calendar or the day arrows and the converter applies the rules for that date. Future dates use the rules that are currently scheduled. If a government changes them later, the result updates once your browser's time zone data does.",
  },
  {
    q: 'What does "Next day" mean under the second clock?',
    a: 'It means the second zone has already reached the following calendar date at the moment you are converting. "Previous day" means it is still on the day before. This happens often between Asia or Australia and the Americas.',
  },
  {
    q: 'Does the converter work without JavaScript?',
    a: 'The live converter and the map need JavaScript. The pages for each pair still show their reference tables, the periods when the gap changes and the upcoming clock change dates without it.',
  },
];

export function faqPageJsonLd(faqs: Faq[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
}
