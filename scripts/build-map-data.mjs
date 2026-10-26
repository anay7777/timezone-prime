// Builds public/data/timezones.topo.json from timezone-boundary-builder.
// Run once (or when a new boundary release ships): npm run map:data
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import mapshaper from 'mapshaper';

const RELEASE = '2026e';
const ZIP_URL = `https://github.com/evansiroky/timezone-boundary-builder/releases/download/${RELEASE}/timezones.geojson.zip`;
const CACHE = '.cache';
const ZIP = `${CACHE}/timezones.geojson.zip`;
const SOURCE = `${CACHE}/combined.json`;
const OUT = 'public/data/timezones.topo.json';

mkdirSync(CACHE, { recursive: true });
mkdirSync('public/data', { recursive: true });

if (!existsSync(SOURCE)) {
  if (!existsSync(ZIP)) {
    console.log(`Downloading ${ZIP_URL}`);
    const res = await fetch(ZIP_URL);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    writeFileSync(ZIP, Buffer.from(await res.arrayBuffer()));
  }
  console.log('Extracting');
  execFileSync('tar', ['-xf', ZIP, '-C', CACHE], { stdio: 'inherit' });
}

await mapshaper.runCommands(
  [
    `-i ${SOURCE} name=zones`,
    // Keep rings off the antimeridian and the pole so d3-geo never wraps them around the globe.
    '-clip bbox=-179.95,-60,179.95,84',
    '-simplify 0.7% weighted keep-shapes',
    '-filter-fields tzid',
    `-o ${OUT} format=topojson quantization=20000 force`,
  ].join(' '),
);

console.log(`Wrote ${OUT} (${(statSync(OUT).size / 1024).toFixed(0)} KB) from release ${RELEASE}`);
