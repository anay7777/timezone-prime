import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson';
import type { Topology, GeometryCollection } from 'topojson-specification';
import { zoneByTz } from '../data/zones';
import { formatDate, formatOffset, formatTime, offsetMinutes, zoneName } from '../lib/time';
import { PICK_EVENT, STATE_EVENT, abbreviation, placeName, type ConverterState, type Side } from './converter';

type ZoneFeature = Feature<Polygon | MultiPolygon, { tzid: string }>;

const WIDTH = 960;
const SVG_NS = 'http://www.w3.org/2000/svg';

interface Signature {
  name: string;
  offsets: string;
}

const signatureCache = new Map<string, Signature>();

function signature(tz: string, year: number): Signature {
  const key = `${tz}|${year}`;
  let s = signatureCache.get(key);
  if (!s) {
    const offsets: number[] = [];
    for (let m = 0; m < 12; m++) {
      offsets.push(offsetMinutes(tz, Date.UTC(year, m, 1, 12)), offsetMinutes(tz, Date.UTC(year, m, 15, 12)));
    }
    s = { name: zoneName(tz, Date.UTC(year, 0, 15), 'longGeneric'), offsets: offsets.join(',') };
    signatureCache.set(key, s);
  }
  return s;
}

function safeOffset(tz: string, instant: number): number | null {
  try {
    return offsetMinutes(tz, instant);
  } catch {
    return null;
  }
}

/** Same zone: the same rules all year and, unless it is a fixed Etc offset, the same zone name. */
function sameZone(featureTz: string, tz: string, year: number): boolean {
  if (featureTz === tz) return true;
  if (safeOffset(featureTz, Date.UTC(year, 0, 1)) === null) return false;
  const a = signature(featureTz, year);
  const b = signature(tz, year);
  if (a.offsets !== b.offsets) return false;
  return tz.startsWith('Etc/') || tz === 'UTC' || a.name === b.name;
}

export function initMap() {
  const found = document.querySelector<HTMLElement>('[data-map]');
  if (!found || found.dataset.ready) return;
  const root: HTMLElement = found;
  root.dataset.ready = 'true';

  const canvas = root.querySelector<HTMLElement>('[data-map-canvas]')!;
  const status = root.querySelector<HTMLElement>('[data-map-status]')!;
  const tooltip = root.querySelector<HTMLElement>('[data-map-tooltip]')!;
  const controls = root.querySelector<HTMLElement>('[data-map-controls]')!;
  const hint = root.querySelector<HTMLElement>('[data-map-hint]');
  const section = root.closest('section')!;
  const info = section.querySelector<HTMLElement>('[data-map-info]')!;
  const legend = { from: section.querySelector<HTMLElement>('[data-legend=from]'), to: section.querySelector<HTMLElement>('[data-legend=to]') };

  if (matchMedia('(pointer: coarse)').matches && hint) hint.textContent = 'Use two fingers to pan and zoom, or the buttons.';

  let state: ConverterState = {
    from: root.dataset.from!,
    to: root.dataset.to!,
    instant: Date.now(),
    hour12: true,
  };
  let draw: ((s: ConverterState) => void) | null = null;

  document.addEventListener(STATE_EVENT, (e) => {
    state = (e as CustomEvent<ConverterState>).detail;
    draw?.(state);
  });

  status.textContent = 'Loading map…';
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    load().catch((err) => {
      console.error(err);
      status.textContent = 'The map could not be loaded. The converter above still works.';
    });
  };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          start();
        }
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(root);
  } else {
    start();
  }

  async function load() {
    const [geo, zoomMod, selection, topojson, res] = await Promise.all([
      import('d3-geo'),
      import('d3-zoom'),
      import('d3-selection'),
      import('topojson-client'),
      fetch('/data/timezones.topo.json'),
    ]);
    if (!res.ok) throw new Error(`Map data request failed: ${res.status}`);
    const topo = (await res.json()) as Topology<{ zones: GeometryCollection<{ tzid: string }> }>;
    const collection = topojson.feature(topo, topo.objects.zones) as unknown as FeatureCollection<Polygon | MultiPolygon, { tzid: string }>;
    const features = (collection.features as ZoneFeature[]).filter((f) => f.geometry);
    for (const f of features) {
      const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      for (const rings of polys) {
        if (geo.geoArea({ type: 'Polygon', coordinates: rings }) > 2 * Math.PI) for (const ring of rings) ring.reverse();
      }
    }

    const frame: Feature<Geometry> = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'MultiPoint',
        coordinates: Array.from({ length: 73 }, (_, i) => -180 + i * 5).flatMap((lon) => [
          [lon, -57],
          [lon, 83],
        ]),
      },
    };
    const projection = geo.geoEqualEarth().fitWidth(WIDTH, frame);
    const path = geo.geoPath(projection);
    const [[, y0], [, y1]] = path.bounds(frame);
    const height = Math.round(y1 - y0);
    projection.translate([projection.translate()[0], projection.translate()[1] - y0]);

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${WIDTH} ${height}`);
    svg.setAttribute('class', 'block h-full w-full');
    svg.setAttribute('role', 'img');

    const world = document.createElementNS(SVG_NS, 'g');
    const sphere = document.createElementNS(SVG_NS, 'path');
    sphere.setAttribute('d', path({ type: 'Sphere' }) ?? '');
    sphere.setAttribute('class', 'tz-sphere');
    const graticule = document.createElementNS(SVG_NS, 'path');
    graticule.setAttribute('d', path(geo.geoGraticule10()) ?? '');
    graticule.setAttribute('class', 'tz-graticule');
    world.append(sphere, graticule);

    const zoneGroup = document.createElementNS(SVG_NS, 'g');
    const paths = features.map((f) => {
      const p = document.createElementNS(SVG_NS, 'path');
      p.setAttribute('d', path(f) ?? '');
      p.setAttribute('class', 'tz-zone');
      p.dataset.tz = f.properties.tzid;
      zoneGroup.append(p);
      return p;
    });
    world.append(zoneGroup);

    const markers = document.createElementNS(SVG_NS, 'g');
    markers.setAttribute('class', 'tz-markers');
    svg.append(world, markers);

    status.remove();
    canvas.style.aspectRatio = `${WIDTH} / ${height}`;
    canvas.append(svg);
    controls.hidden = false;

    const areaByIndex = features.map((f) => geo.geoArea(f));

    function anchorFor(tz: string, matches: number[]): [number, number] | null {
      const zone = zoneByTz.get(tz);
      if (zone) return [zone.city.lon, zone.city.lat];
      const exact = features.findIndex((f) => f.properties.tzid === tz);
      const pick = exact >= 0 ? exact : matches.sort((a, b) => areaByIndex[b] - areaByIndex[a])[0];
      if (pick === undefined) return null;
      return geo.geoCentroid(features[pick]) as [number, number];
    }

    let transform = zoomMod.zoomIdentity;
    let pinned: string | null = null;
    let currentAnchors: { side: Side; lonlat: [number, number]; label: string; time: string }[] = [];

    let labelScale = 1;
    const measure = () => {
      const w = svg.getBoundingClientRect().width;
      labelScale = w > 0 ? Math.min(2.6, Math.max(1, WIDTH / w)) : 1;
    };
    measure();
    new ResizeObserver(() => {
      measure();
      placeMarkers();
    }).observe(svg);

    function placeMarkers() {
      markers.replaceChildren();
      const placed: [number, number][] = [];
      for (const a of currentAnchors) {
        const xy = projection(a.lonlat);
        if (!xy) continue;
        const [x, y] = transform.apply(xy);
        if (x < -20 || x > WIDTH + 20 || y < -20 || y > height + 20) continue;
        const g = document.createElementNS(SVG_NS, 'g');
        g.setAttribute('class', `tz-marker tz-marker-${a.side}`);
        const near = placed.some(([px, py]) => Math.abs(px - x) < 90 * labelScale && Math.abs(py - y) < 34 * labelScale);
        placed.push([x, y]);
        const dy = near ? 30 : 0;
        const anchorEnd = x > WIDTH - 140 * labelScale;
        g.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${labelScale.toFixed(3)})`);
        const dot = document.createElementNS(SVG_NS, 'circle');
        dot.setAttribute('r', '4.5');
        const name = document.createElementNS(SVG_NS, 'text');
        name.setAttribute('x', anchorEnd ? '-10' : '10');
        name.setAttribute('y', String(-2 + dy));
        name.setAttribute('text-anchor', anchorEnd ? 'end' : 'start');
        name.setAttribute('class', 'tz-label-name');
        name.textContent = a.label;
        const time = document.createElementNS(SVG_NS, 'text');
        time.setAttribute('x', anchorEnd ? '-10' : '10');
        time.setAttribute('y', String(12 + dy));
        time.setAttribute('text-anchor', anchorEnd ? 'end' : 'start');
        time.setAttribute('class', 'tz-label-time');
        time.textContent = a.time;
        g.append(dot, name, time);
        markers.append(g);
      }
    }

    draw = (s: ConverterState) => {
      const year = new Date(s.instant).getUTCFullYear();
      const off = { from: offsetMinutes(s.from, s.instant), to: offsetMinutes(s.to, s.instant) };
      const matches: Record<Side, number[]> = { from: [], to: [] };
      const sameOffset: Record<Side, number> = { from: 0, to: 0 };
      paths.forEach((p, i) => {
        const tz = features[i].properties.tzid;
        const fo = safeOffset(tz, s.instant);
        let cls = 'tz-zone';
        if (sameZone(tz, s.from, year)) {
          cls += ' is-from';
          matches.from.push(i);
        } else if (sameZone(tz, s.to, year)) {
          cls += ' is-to';
          matches.to.push(i);
        } else if (fo === off.from) {
          cls += ' is-from-offset';
          sameOffset.from++;
        } else if (fo === off.to) {
          cls += ' is-to-offset';
          sameOffset.to++;
        }
        if (pinned === tz) cls += ' is-pinned';
        p.setAttribute('class', cls);
      });

      currentAnchors = (['from', 'to'] as Side[])
        .map((side) => {
          const tz = s[side];
          const lonlat = anchorFor(tz, [...matches[side]]);
          return lonlat ? { side, lonlat, label: placeName(tz), time: `${formatTime(s.instant, tz, s.hour12)} ${abbreviation(tz, s.instant)}` } : null;
        })
        .filter((a): a is NonNullable<typeof a> => a !== null);
      placeMarkers();

      for (const side of ['from', 'to'] as Side[]) {
        const el = legend[side];
        if (el) el.textContent = `${placeName(s[side])}: ${zoneName(s[side], s.instant, 'longGeneric')}`;
      }
      svg.setAttribute('aria-label', `World time zone map. ${zoneName(s.from, s.instant, 'long')} covers ${matches.from.length} highlighted zone areas; ${zoneName(s.to, s.instant, 'long')} covers ${matches.to.length}, in a second colour.`);
      if (pinned) showInfo(pinned);
    };
    draw(state);

    function describe(tz: string) {
      const offset = offsetMinutes(tz, state.instant);
      return {
        name: `${placeName(tz)}, ${zoneName(tz, state.instant, 'long')}`,
        time: `${formatTime(state.instant, tz, state.hour12)} on ${formatDate(state.instant, tz)}, ${formatOffset(offset)}`,
      };
    }

    function showTooltip(tz: string, clientX: number, clientY: number) {
      const d = describe(tz);
      tooltip.replaceChildren();
      const n = document.createElement('p');
      n.className = 'font-medium text-ink';
      n.textContent = d.name;
      const t = document.createElement('p');
      t.className = 'mt-0.5 tabular text-muted';
      t.textContent = d.time;
      tooltip.append(n, t);
      tooltip.classList.remove('hidden');
      const box = root.getBoundingClientRect();
      const tw = tooltip.offsetWidth;
      const th = tooltip.offsetHeight;
      let x = clientX - box.left + 14;
      let y = clientY - box.top + 14;
      if (x + tw > box.width - 8) x = clientX - box.left - tw - 14;
      if (y + th > box.height - 8) y = clientY - box.top - th - 14;
      tooltip.style.transform = `translate(${Math.max(8, x)}px, ${Math.max(8, y)}px)`;
    }

    function hideTooltip() {
      tooltip.classList.add('hidden');
    }

    function showInfo(tz: string) {
      const d = describe(tz);
      info.querySelector('[data-info-name]')!.textContent = d.name;
      info.querySelector('[data-info-time]')!.textContent = d.time;
      info.querySelector('[data-info-tz]')!.textContent = tz;
      info.dataset.tz = tz;
      info.classList.remove('hidden');
    }

    function pin(tz: string | null) {
      pinned = tz;
      for (const p of paths) p.classList.toggle('is-pinned', p.dataset.tz === tz);
      if (tz) showInfo(tz);
      else info.classList.add('hidden');
    }

    let lastHover: SVGPathElement | null = null;
    zoneGroup.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      const target = (e.target as Element).closest<SVGPathElement>('path[data-tz]');
      if (!target) return hideTooltip();
      if (lastHover !== target) {
        lastHover?.classList.remove('is-hover');
        target.classList.add('is-hover');
        lastHover = target;
      }
      showTooltip(target.dataset.tz!, e.clientX, e.clientY);
    });
    zoneGroup.addEventListener('pointerleave', () => {
      lastHover?.classList.remove('is-hover');
      lastHover = null;
      hideTooltip();
    });
    zoneGroup.addEventListener('click', (e) => {
      const target = (e.target as Element).closest<SVGPathElement>('path[data-tz]');
      if (target) pin(target.dataset.tz!);
    });

    info.querySelectorAll<HTMLButtonElement>('[data-info-set]').forEach((b) =>
      b.addEventListener('click', () => {
        const tz = info.dataset.tz;
        if (!tz) return;
        document.dispatchEvent(new CustomEvent(PICK_EVENT, { detail: { tz, side: b.dataset.infoSet as Side } }));
      }),
    );
    info.querySelector('[data-info-close]')?.addEventListener('click', () => pin(null));

    const zoom = zoomMod
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 12])
      .translateExtent([
        [0, 0],
        [WIDTH, height],
      ])
      .extent([
        [0, 0],
        [WIDTH, height],
      ])
      .clickDistance(4)
      .filter((event: Event) => {
        if (event.type === 'wheel') return (event as WheelEvent).ctrlKey || (event as WheelEvent).metaKey;
        if (event.type === 'touchstart') return (event as TouchEvent).touches.length > 1;
        return !(event as MouseEvent).button;
      })
      .on('zoom', (event: { transform: typeof transform }) => {
        transform = event.transform;
        world.setAttribute('transform', transform.toString());
        hideTooltip();
        placeMarkers();
      });
    const svgSel = selection.select(svg as SVGSVGElement);
    svgSel.call(zoom);

    if (canvas.getBoundingClientRect().width < 640 && currentAnchors.length) {
      const pts = currentAnchors.map((a) => projection(a.lonlat)).filter((p): p is [number, number] => p !== null);
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      const span = Math.max(Math.max(...xs) - Math.min(...xs), (Math.max(...ys) - Math.min(...ys)) * 2.1, 1);
      const k = Math.min(2.4, Math.max(1, (WIDTH * 0.7) / span));
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      zoom.transform(svgSel, zoomMod.zoomIdentity.translate(WIDTH / 2, height / 2).scale(k).translate(-cx, -cy));
    }

    controls.addEventListener('click', (e) => {
      const b = (e.target as Element).closest<HTMLButtonElement>('[data-zoom]');
      if (!b) return;
      if (b.dataset.zoom === 'in') zoom.scaleBy(svgSel, 1.6);
      else if (b.dataset.zoom === 'out') zoom.scaleBy(svgSel, 1 / 1.6);
      else zoom.transform(svgSel, zoomMod.zoomIdentity);
    });

    canvas.addEventListener('keydown', (e) => {
      const step = 60 / transform.k;
      const keys: Record<string, () => void> = {
        '+': () => zoom.scaleBy(svgSel, 1.6),
        '=': () => zoom.scaleBy(svgSel, 1.6),
        '-': () => zoom.scaleBy(svgSel, 1 / 1.6),
        '0': () => zoom.transform(svgSel, zoomMod.zoomIdentity),
        ArrowLeft: () => zoom.translateBy(svgSel, step, 0),
        ArrowRight: () => zoom.translateBy(svgSel, -step, 0),
        ArrowUp: () => zoom.translateBy(svgSel, 0, step),
        ArrowDown: () => zoom.translateBy(svgSel, 0, -step),
        Escape: () => pin(null),
      };
      const fn = keys[e.key];
      if (fn) {
        e.preventDefault();
        fn();
      }
    });
  }
}
