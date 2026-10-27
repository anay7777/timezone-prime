// Renders public/og.png, the 1200x630 social preview, in the brand style. Run after build-icons: node scripts/build-og.mjs
import sharp from 'sharp';

const W = 1200;
const H = 630;
const NAVY = '#000519';
// TTF copies of Poppins (OFL), because the image renderer cannot read WOFF
const font = (weight) => `scripts/fonts/poppins-latin-${weight}-normal.ttf`;

/** Pango text as an RGBA buffer; `spacing` is letter spacing in 1/1024 pt. */
const text = (markup, weight, size, spacing = 0) =>
  sharp({
    text: {
      text: `<span letter_spacing="${spacing}">${markup}</span>`,
      font: `Poppins ${size}`,
      fontfile: font(weight),
      rgba: true,
      dpi: 72,
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true });

/** Text filled with a vertical gradient, like the wordmark. */
async function gradientText(word, weight, size, spacing, stops) {
  const { data: mask, info } = await text(`<span foreground="#ffffff">${word}</span>`, weight, size, spacing);
  const grad = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${info.width}" height="${info.height}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">${stops
      .map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`)
      .join('')}</linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`,
  );
  const data = await sharp(grad).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  return { data, info };
}

const wmSize = 44;
const wmSpacing = Math.round(-0.03 * wmSize * 1024);
const timezone = await gradientText('Timezone', 700, wmSize, wmSpacing, [
  [0, '#e7e7ea'],
  [0.25, '#fafafa'],
  [0.75, '#f1f1f2'],
  [1, '#c6c7ca'],
]);
const prime = await gradientText('Prime', 700, wmSize, wmSpacing, [
  [0, '#36c5fa'],
  [0.5, '#16b1f6'],
  [1, '#0576bb'],
]);
const head1 = await text('<span foreground="#fafafa">Convert time across</span>', 600, 76, Math.round(-0.03 * 76 * 1024));
const head2 = await text(
  '<span foreground="#fafafa">any two </span><span foreground="#16b1f6">zones</span>',
  600,
  76,
  Math.round(-0.03 * 76 * 1024),
);
const sub = await text('<span foreground="#a1a9bf">Daylight saving, date changes and real zone boundaries.</span>', 400, 28);
const logo = await sharp('src/assets/logo.png').resize(64, 64).toBuffer();

const backdrop = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <radialGradient id="glow" cx="0.85" cy="0.1" r="0.7">
      <stop offset="0" stop-color="#0b3557" stop-opacity="0.9"/>
      <stop offset="1" stop-color="${NAVY}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${NAVY}"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect x="96" y="510" width="180" height="10" rx="5" fill="#16b1f6"/>
  <rect x="96" y="534" width="120" height="10" rx="5" fill="#f5a524"/>
</svg>`);

const left = 96;
await sharp(backdrop)
  .composite([
    { input: logo, left, top: 76 },
    { input: timezone.data, left: left + 80, top: 108 - Math.round(timezone.info.height / 2) },
    { input: prime.data, left: left + 80 + timezone.info.width, top: 108 - Math.round(prime.info.height / 2) },
    { input: head1.data, left, top: 210 },
    { input: head2.data, left, top: 300 },
    { input: sub.data, left, top: 420 },
  ])
  .png()
  .toFile('public/og.png');
console.log('Wrote public/og.png');
