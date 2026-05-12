// BFS flood-fill background removal for item icon PNGs.
// Seeds from all image border pixels; spreads to near-white neighbors (R>195,G>185,B>175).
const sharp = require('../node_modules/sharp');
const path  = require('path');

const FILES = [
  'log_32x32.png',
  'cooked_fish_32x32.png',
  'redroot_herb_32x32.png',
  'stonecap_moss_32x32.png',
];
const DIR = path.join(__dirname, '../public/assets/items/');

function isBg(r, g, b) {
  return r >= 195 && g >= 185 && b >= 175;
}

async function processFile(filename) {
  const filepath = DIR + filename;
  const { data, info } = await sharp(filepath)
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  const transpBefore = [...Array(width * height).keys()]
    .filter(i => data[i * channels + 3] < 10).length;

  const visited = new Uint8Array(width * height);
  const queue   = [];

  const tryEnqueue = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const pos = y * width + x;
    if (visited[pos]) return;
    visited[pos] = 1;
    const i = pos * channels;
    const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
    if (a === 0 || isBg(r, g, b)) queue.push(x, y);
  };

  for (let x = 0; x < width;  x++) { tryEnqueue(x, 0); tryEnqueue(x, height-1); }
  for (let y = 0; y < height; y++) { tryEnqueue(0, y); tryEnqueue(width-1, y); }

  let qi = 0, removed = 0;
  while (qi < queue.length) {
    const x = queue[qi++], y = queue[qi++];
    const i = (y * width + x) * channels;
    if (data[i+3] > 0 && isBg(data[i], data[i+1], data[i+2])) {
      data[i+3] = 0;
      removed++;
    }
    tryEnqueue(x-1, y); tryEnqueue(x+1, y);
    tryEnqueue(x, y-1); tryEnqueue(x, y+1);
  }

  await sharp(Buffer.from(data), { raw: { width, height, channels } })
    .png().toFile(filepath);

  const meta = await sharp(filepath).metadata();
  const transpAfter = transpBefore + removed;
  console.log(`${filename}`);
  console.log(`  transparent: ${transpBefore} → ${transpAfter}  (+${removed} removed)  ${meta.width}x${meta.height} ${meta.hasAlpha?'RGBA':'RGB'}`);
}

(async () => {
  for (const f of FILES) await processFile(f);
  console.log('\nDone.');
})().catch(err => { console.error(err); process.exit(1); });
