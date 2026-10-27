// Builds the logo and every favicon from src/assets/logo-source.jpg. Run: node scripts/build-icons.mjs
// The source has a checkerboard baked in instead of transparency, so the light, colourless
// pixels connected to the image edge are treated as background and cleared.
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';

const { data, info } = await sharp('src/assets/logo-source.jpg').removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;
const px = (i) => [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]];
const isBackdrop = (i) => {
  const [r, g, b] = px(i);
  const lo = Math.min(r, g, b);
  return lo >= 196 && Math.max(r, g, b) - lo <= 22;
};

const bg = new Uint8Array(W * H);
const stack = [];
for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
while (stack.length) {
  const i = stack.pop();
  if (bg[i] || !isBackdrop(i)) continue;
  bg[i] = 1;
  const x = i % W;
  if (x > 0) stack.push(i - 1);
  if (x < W - 1) stack.push(i + 1);
  if (i >= W) stack.push(i - W);
  if (i < W * (H - 1)) stack.push(i + W);
}

// distance (in px, capped) from each kept pixel to the cleared background, for a soft edge
const near = new Uint8Array(W * H).fill(255);
for (let i = 0; i < W * H; i++) if (bg[i]) near[i] = 0;
for (let pass = 0; pass < 3; pass++) {
  for (let i = 0; i < W * H; i++) {
    if (near[i] === 0) continue;
    const x = i % W;
    const n = Math.min(
      x > 0 ? near[i - 1] : 255,
      x < W - 1 ? near[i + 1] : 255,
      i >= W ? near[i - W] : 255,
      i < W * (H - 1) ? near[i + W] : 255,
    );
    if (n + 1 < near[i]) near[i] = n + 1;
  }
}

const rgba = Buffer.alloc(W * H * 4);
let minX = W, minY = H, maxX = 0, maxY = 0;
for (let i = 0; i < W * H; i++) {
  const [r, g, b] = px(i);
  let a = 255;
  if (bg[i]) a = 0;
  else if (near[i] <= 2) {
    // light fringe pixels next to the backdrop are partly backdrop, so fade them
    const lo = Math.min(r, g, b);
    a = Math.round(255 * Math.min(1, Math.max(0, (238 - lo) / 70)));
  }
  rgba.set([r, g, b, a], i * 4);
  if (a > 24) {
    const x = i % W, y = (i / W) | 0;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
}

const crop = { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
const side = Math.max(crop.width, crop.height);
const master = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
  .extract(crop)
  .extend({
    top: Math.floor((side - crop.height) / 2),
    bottom: Math.ceil((side - crop.height) / 2),
    left: Math.floor((side - crop.width) / 2),
    right: Math.ceil((side - crop.width) / 2),
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toBuffer();

const icon = (size) => sharp(master).resize(size, size, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toBuffer();
/** Icon on a solid tile, for platforms that do not keep transparency (iOS home screen, Android masks). */
const tile = async (size, pad) =>
  sharp({ create: { width: size, height: size, channels: 4, background: '#000519' } })
    .composite([{ input: await icon(Math.round(size * (1 - pad * 2))), gravity: 'center' }])
    .png({ compressionLevel: 9, palette: true, quality: 90, effort: 10 })
    .toBuffer();

writeFileSync('src/assets/logo.png', await icon(256));
writeFileSync('public/favicon-32.png', await icon(32));
writeFileSync('public/favicon-48.png', await icon(48));
writeFileSync('public/apple-touch-icon.png', await tile(180, 0.08));
writeFileSync('public/icon-192.png', await tile(192, 0.1));
writeFileSync('public/icon-512.png', await tile(512, 0.1));

// favicon.ico with 16, 32 and 48 px PNG frames
const frames = await Promise.all([16, 32, 48].map(async (s) => ({ s, png: await icon(s) })));
const header = Buffer.alloc(6 + frames.length * 16);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(frames.length, 4);
let offset = header.length;
frames.forEach(({ s, png }, k) => {
  const e = 6 + k * 16;
  header.writeUInt8(s, e);
  header.writeUInt8(s, e + 1);
  header.writeUInt16LE(1, e + 4);
  header.writeUInt16LE(32, e + 6);
  header.writeUInt32LE(png.length, e + 8);
  header.writeUInt32LE(offset, e + 12);
  offset += png.length;
});
writeFileSync('public/favicon.ico', Buffer.concat([header, ...frames.map((f) => f.png)]));

console.log('Wrote src/assets/logo.png, favicon.ico, favicon-32/48, apple-touch-icon, icon-192/512');
