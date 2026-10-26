// Renders public/og.png, the 1200x630 social preview. Run: node scripts/build-og.mjs
import sharp from 'sharp';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#fafafa"/>
  <rect x="64" y="64" width="1072" height="502" rx="16" fill="#ffffff" stroke="#ebebeb" stroke-width="2"/>
  <g transform="translate(120 128)" fill="none" stroke="#171717" stroke-width="3">
    <circle cx="20" cy="20" r="17"/><path d="M20 3v34M3 20h34"/><path d="M20 3c5.4 4.7 8 10.3 8 17s-2.6 12.3-8 17"/>
  </g>
  <text x="176" y="158" font-family="Geist, Inter, Arial, sans-serif" font-size="30" font-weight="600" fill="#171717">Timezone Prime</text>
  <text x="120" y="318" font-family="Geist, Inter, Arial, sans-serif" font-size="76" font-weight="600" letter-spacing="-3" fill="#171717">Convert time across</text>
  <text x="120" y="404" font-family="Geist, Inter, Arial, sans-serif" font-size="76" font-weight="600" letter-spacing="-3" fill="#171717">any two zones</text>
  <text x="120" y="486" font-family="Geist, Inter, Arial, sans-serif" font-size="30" fill="#4d4d4d">Daylight saving, date changes and real zone boundaries.</text>
  <rect x="940" y="120" width="140" height="10" rx="5" fill="#0070f3"/>
  <rect x="980" y="146" width="100" height="10" rx="5" fill="#f5a623"/>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile('public/og.png');
console.log('Wrote public/og.png');
