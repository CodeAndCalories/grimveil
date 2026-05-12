// BFS flood-fill from image edges to remove white/light halo from ashstone_64x64.png.
// White ring: R>185, G>165, B>145 (near-achromatic light). Dark rock content stays intact.
const sharp = require('../node_modules/sharp');
const path  = require('path');

const FILE      = path.join(__dirname, '../public/assets/sprites/Nature/ashstone_64x64.png');
const THRESHOLD = { r: 185, g: 165, b: 145 };  // minimum to count as background

function isLight(r, g, b) {
  return r >= THRESHOLD.r && g >= THRESHOLD.g && b >= THRESHOLD.b;
}

sharp(FILE).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  .then(({ data, info }) => {
    const { width, height, channels } = info;
    const visited = new Uint8Array(width * height);
    const queue   = [];

    const tryEnqueue = (x, y) => {
      if (x < 0 || x >= width || y < 0 || y >= height) return;
      const pos = y * width + x;
      if (visited[pos]) return;
      visited[pos] = 1;
      const i = pos * channels;
      const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
      // Seed from transparent edge pixels, or spread to light pixels
      if (a === 0 || isLight(r, g, b)) queue.push(x, y);
    };

    // Seed from all image border pixels
    for (let x = 0; x < width;  x++) { tryEnqueue(x, 0); tryEnqueue(x, height-1); }
    for (let y = 0; y < height; y++) { tryEnqueue(0, y); tryEnqueue(width-1, y); }

    // BFS — only make opaque light pixels transparent
    let removed = 0;
    let qi = 0;
    while (qi < queue.length) {
      const x = queue[qi++], y = queue[qi++];
      const i = (y * width + x) * channels;
      if (data[i+3] > 0 && isLight(data[i], data[i+1], data[i+2])) {
        data[i+3] = 0;
        removed++;
      }
      tryEnqueue(x-1, y); tryEnqueue(x+1, y);
      tryEnqueue(x, y-1); tryEnqueue(x, y+1);
    }

    console.log(`Removed ${removed} background pixels`);

    return sharp(Buffer.from(data), { raw: { width, height, channels } })
      .png().toFile(FILE);
  })
  .then(out => {
    console.log(`Saved: ${FILE}`);
    console.log(`Output: ${out.width}x${out.height} (${out.size} bytes)`);
    return sharp(FILE).metadata();
  })
  .then(meta => {
    const ok = meta.width === 64 && meta.height === 64;
    console.log(`Verify: ${meta.width}x${meta.height} — ${ok ? 'OK' : 'MISMATCH'}`);
    if (!ok) process.exit(1);
  })
  .catch(err => { console.error(err); process.exit(1); });
