export interface Zone {
  slug: string;
  /** Abbreviation used in URLs and headings. */
  abbr: string;
  /** Abbreviations shown for standard and daylight time. */
  stdAbbr: string;
  dstAbbr?: string;
  /** Name used in headings, e.g. "Eastern Time". */
  name: string;
  /** IANA identifier used for every calculation. */
  tz: string;
  city: { name: string; lat: number; lon: number };
  places: string;
  cities: string[];
  about: string;
  /** Clarifies abbreviations people often confuse. */
  note?: string;
}

export const zones: Zone[] = [
  {
    slug: 'ist',
    abbr: 'IST',
    stdAbbr: 'IST',
    name: 'India Standard Time',
    tz: 'Asia/Kolkata',
    city: { name: 'New Delhi', lat: 28.61, lon: 77.21 },
    places: 'India',
    cities: ['Mumbai', 'Delhi', 'Bengaluru', 'Hyderabad', 'Chennai', 'Kolkata'],
    about:
      'India Standard Time is UTC+5:30 all year. The whole country keeps a single clock, and India has not observed daylight saving time since the 1940s, so IST never changes.',
    note: 'IST can also stand for Irish Standard Time or Israel Standard Time. On this site IST always means India Standard Time (Asia/Kolkata).',
  },
  {
    slug: 'est',
    abbr: 'EST',
    stdAbbr: 'EST',
    dstAbbr: 'EDT',
    name: 'Eastern Time',
    tz: 'America/New_York',
    city: { name: 'New York', lat: 40.71, lon: -74.01 },
    places: 'the eastern United States and Canada',
    cities: ['New York', 'Toronto', 'Washington, D.C.', 'Atlanta', 'Miami', 'Boston'],
    about:
      'Eastern Time follows the clock in New York. It is Eastern Standard Time (EST, UTC\u22125) in winter and Eastern Daylight Time (EDT, UTC\u22124) from the second Sunday in March to the first Sunday in November.',
    note: 'People often write EST all year round. Strictly, EST is only the winter offset; in summer the eastern US is on EDT. The converter follows the real New York clock for the date you pick.',
  },
  {
    slug: 'cst',
    abbr: 'CST',
    stdAbbr: 'CST',
    dstAbbr: 'CDT',
    name: 'Central Time',
    tz: 'America/Chicago',
    city: { name: 'Chicago', lat: 41.88, lon: -87.63 },
    places: 'the central United States and parts of Canada',
    cities: ['Chicago', 'Houston', 'Dallas', 'Minneapolis', 'Winnipeg', 'New Orleans'],
    about:
      'Central Time follows the clock in Chicago: Central Standard Time (CST, UTC\u22126) in winter and Central Daylight Time (CDT, UTC\u22125) during US daylight saving time.',
    note: 'CST is also used for China Standard Time (UTC+8) and Cuba Standard Time. Here CST means US Central Time (America/Chicago).',
  },
  {
    slug: 'mst',
    abbr: 'MST',
    stdAbbr: 'MST',
    dstAbbr: 'MDT',
    name: 'Mountain Time',
    tz: 'America/Denver',
    city: { name: 'Denver', lat: 39.74, lon: -104.99 },
    places: 'the mountain states of the US and parts of Canada',
    cities: ['Denver', 'Salt Lake City', 'Albuquerque', 'Calgary', 'Edmonton', 'Boise'],
    about:
      'Mountain Time follows the clock in Denver: Mountain Standard Time (MST, UTC\u22127) in winter and Mountain Daylight Time (MDT, UTC\u22126) during US daylight saving time.',
    note: 'Most of Arizona stays on MST all year and does not switch to MDT. For Phoenix, pick America/Phoenix in the converter.',
  },
  {
    slug: 'pst',
    abbr: 'PST',
    stdAbbr: 'PST',
    dstAbbr: 'PDT',
    name: 'Pacific Time',
    tz: 'America/Los_Angeles',
    city: { name: 'Los Angeles', lat: 34.05, lon: -118.24 },
    places: 'the US West Coast and British Columbia',
    cities: ['Los Angeles', 'San Francisco', 'Seattle', 'Vancouver', 'Las Vegas', 'Portland'],
    about:
      'Pacific Time follows the clock in Los Angeles: Pacific Standard Time (PST, UTC\u22128) in winter and Pacific Daylight Time (PDT, UTC\u22127) during US daylight saving time.',
    note: 'PST is often used loosely for Pacific Time all year. In summer the correct abbreviation is PDT; the converter uses whichever applies on your date.',
  },
  {
    slug: 'utc',
    abbr: 'UTC',
    stdAbbr: 'UTC',
    name: 'Coordinated Universal Time',
    tz: 'Etc/UTC',
    city: { name: 'Greenwich meridian', lat: 51.48, lon: 0 },
    places: 'no single country; it is the world reference clock',
    cities: [],
    about:
      'Coordinated Universal Time is the reference every time zone is measured from. It never changes for daylight saving time. Servers, aviation, logs and APIs use it because it is unambiguous.',
  },
  {
    slug: 'gmt',
    abbr: 'GMT',
    stdAbbr: 'GMT',
    name: 'Greenwich Mean Time',
    tz: 'Etc/GMT',
    city: { name: 'Greenwich', lat: 51.48, lon: 0 },
    places: 'Iceland and much of West Africa keep this offset all year',
    cities: ['Reykjavík', 'Accra', 'Dakar', 'Abidjan'],
    about:
      'Greenwich Mean Time is UTC+0 and, for everyday purposes, the same clock as UTC. It does not shift for daylight saving time.',
    note: 'The UK uses GMT only in winter and British Summer Time (BST, UTC+1) in summer. For London time, use the UK time pages.',
  },
  {
    slug: 'uk',
    abbr: 'UK',
    stdAbbr: 'GMT',
    dstAbbr: 'BST',
    name: 'UK time',
    tz: 'Europe/London',
    city: { name: 'London', lat: 51.51, lon: -0.13 },
    places: 'the United Kingdom',
    cities: ['London', 'Manchester', 'Birmingham', 'Edinburgh', 'Glasgow', 'Belfast'],
    about:
      'UK time is Greenwich Mean Time (GMT, UTC+0) in winter and British Summer Time (BST, UTC+1) from the last Sunday in March to the last Sunday in October.',
  },
  {
    slug: 'cet',
    abbr: 'CET',
    stdAbbr: 'CET',
    dstAbbr: 'CEST',
    name: 'Central European Time',
    tz: 'Europe/Berlin',
    city: { name: 'Berlin', lat: 52.52, lon: 13.4 },
    places: 'most of continental Europe',
    cities: ['Berlin', 'Paris', 'Madrid', 'Rome', 'Amsterdam', 'Warsaw'],
    about:
      'Central European Time is UTC+1 in winter and Central European Summer Time (CEST, UTC+2) from the last Sunday in March to the last Sunday in October.',
  },
  {
    slug: 'aest',
    abbr: 'AEST',
    stdAbbr: 'AEST',
    dstAbbr: 'AEDT',
    name: 'Australian Eastern Time',
    tz: 'Australia/Sydney',
    city: { name: 'Sydney', lat: -33.87, lon: 151.21 },
    places: 'New South Wales, Victoria, Tasmania and the ACT',
    cities: ['Sydney', 'Melbourne', 'Canberra', 'Hobart'],
    about:
      'Australian Eastern Time follows the clock in Sydney: AEST (UTC+10) in the southern winter and AEDT (UTC+11) from the first Sunday in October to the first Sunday in April.',
    note: 'Queensland, including Brisbane, stays on AEST all year. For Brisbane, pick Australia/Brisbane in the converter.',
  },
  {
    slug: 'jst',
    abbr: 'JST',
    stdAbbr: 'JST',
    name: 'Japan Standard Time',
    tz: 'Asia/Tokyo',
    city: { name: 'Tokyo', lat: 35.68, lon: 139.69 },
    places: 'Japan',
    cities: ['Tokyo', 'Osaka', 'Yokohama', 'Nagoya', 'Sapporo'],
    about: 'Japan Standard Time is UTC+9 all year. Japan does not observe daylight saving time.',
  },
  {
    slug: 'sgt',
    abbr: 'SGT',
    stdAbbr: 'SGT',
    name: 'Singapore Time',
    tz: 'Asia/Singapore',
    city: { name: 'Singapore', lat: 1.35, lon: 103.82 },
    places: 'Singapore',
    cities: ['Singapore'],
    about:
      'Singapore Time is UTC+8 all year with no daylight saving time. Malaysia, the Philippines, Hong Kong and China keep the same clock under their own zone names.',
  },
  {
    slug: 'gst',
    abbr: 'GST',
    stdAbbr: 'GST',
    name: 'Gulf Standard Time',
    tz: 'Asia/Dubai',
    city: { name: 'Dubai', lat: 25.2, lon: 55.27 },
    places: 'the United Arab Emirates and Oman',
    cities: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Muscat'],
    about: 'Gulf Standard Time is UTC+4 all year. The UAE and Oman do not observe daylight saving time.',
    note: 'GST can also mean South Georgia Time (UTC\u22122). Here GST means Gulf Standard Time (Asia/Dubai).',
  },
  {
    slug: 'pkt',
    abbr: 'PKT',
    stdAbbr: 'PKT',
    name: 'Pakistan Standard Time',
    tz: 'Asia/Karachi',
    city: { name: 'Karachi', lat: 24.86, lon: 67.01 },
    places: 'Pakistan',
    cities: ['Karachi', 'Lahore', 'Islamabad', 'Faisalabad'],
    about:
      'Pakistan Standard Time is UTC+5 all year. Pakistan last observed daylight saving time in 2009, so PKT is a fixed offset.',
  },
];

export const zoneBySlug = new Map(zones.map((z) => [z.slug, z]));
export const zoneByTz = new Map(zones.map((z) => [z.tz, z]));
