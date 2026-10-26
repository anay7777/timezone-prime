import { zoneBySlug, zones, type Zone } from './zones';

const groups: Record<string, string[]> = {
  ist: ['est', 'pst', 'cst', 'mst', 'utc', 'gmt', 'uk', 'cet', 'aest', 'jst', 'sgt', 'gst', 'pkt'],
  est: ['pst', 'cst', 'mst', 'utc', 'gmt', 'uk', 'cet', 'aest', 'jst', 'sgt', 'gst'],
  pst: ['cst', 'mst', 'utc', 'gmt', 'uk', 'cet', 'aest', 'jst', 'sgt'],
  cst: ['mst', 'utc', 'uk', 'cet'],
  mst: ['utc'],
  utc: ['uk', 'cet', 'aest', 'jst', 'sgt', 'gst', 'pkt'],
  uk: ['cet', 'aest', 'gst'],
  cet: ['aest'],
  gst: ['pkt'],
};

export interface Pair {
  slug: string;
  from: Zone;
  to: Zone;
}

function makePair(a: string, b: string): Pair {
  const from = zoneBySlug.get(a);
  const to = zoneBySlug.get(b);
  if (!from || !to) throw new Error(`Unknown zone in pair ${a}-${b}`);
  return { slug: `${a}-to-${b}`, from, to };
}

export const pairs: Pair[] = Object.entries(groups).flatMap(([a, list]) =>
  list.flatMap((b) => [makePair(a, b), makePair(b, a)]),
);

export const pairBySlug = new Map(pairs.map((p) => [p.slug, p]));

export function pairPath(from: Zone, to: Zone): string | null {
  const slug = `${from.slug}-to-${to.slug}`;
  return pairBySlug.has(slug) ? `/${slug}/` : null;
}

/** Pairs grouped by source zone, in catalog order. */
export function pairsBySource(): { zone: Zone; pairs: Pair[] }[] {
  const map = new Map<string, Pair[]>();
  for (const p of pairs) {
    const list = map.get(p.from.slug) ?? [];
    list.push(p);
    map.set(p.from.slug, list);
  }
  const order = (slug: string) => zones.findIndex((z) => z.slug === slug);
  return zones
    .filter((z) => map.has(z.slug))
    .map((zone) => ({ zone, pairs: map.get(zone.slug)!.sort((a, b) => order(a.to.slug) - order(b.to.slug)) }));
}
