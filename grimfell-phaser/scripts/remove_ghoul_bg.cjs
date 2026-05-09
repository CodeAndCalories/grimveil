// BFS flood-fill from frame corners to remove dark-navy background from ghoul.png.
// Background center: ~(25,32,52). Tolerance 30 keeps artwork pixels safe.
const sharp = require('../node_modules/sharp');
const path  = require('path');

const FILE       = path.join(__dirname, '../public/assets/sprites/ghoul.png');
const FRAME_W    = 96, FRAME_H = 96;
const COLS       = 10, ROWS = 4;
const TOLERANCE  = 30;
const BG         = [25, 32, 52];

function dist(r, g, b) {
  return Math.sqrt((r-BG[0])**2 + (g-BG[1])**2 + (b-BG[2])**2);
}

sharp(FILE).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  .then(({ data, info }) => {
    const { width, height, channels } = info;
    const visited = new Uint8Array(width * height);
    const queue   = [];

    const idx  = (x, y) => (y * width + x) * channels;
    const isOk = (x, y) => x >= 0 && x < width && y >= 0 && y < height;

    const tryEnqueue = (x, y) => {
      if (!isOk(x, y)) return;
      const pos = y * width + x;
      if (visited[pos]) return;
      visited[pos] = 1;
      const i = pos * channels;
      const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
      if (a === 0 || dist(r, g, b) >= TOLERANCE) return;
      queue.push(x, y);
    };

    // Seed: all 4 corners of every frame cell + full image border
    for (let fr = 0; fr < ROWS; fr++) {
      for (let fc = 0; fc < COLS; fc++) {
        const x0 = fc * FRAME_W, y0 = fr * FRAME_H;
        const x1 = x0 + FRAME_W - 1, y1 = y0 + FRAME_H - 1;
        tryEnqueue(x0, y0); tryEnqueue(x1, y0);
        tryEnqueue(x0, y1); tryEnqueue(x1, y1);
      }
    }
    // Full image border
    for (let x = 0; x < width;  x++) { tryEnqueue(x, 0); tryEnqueue(x, height-1); }
    for (let y = 0; y < height; y++) { tryEnqueue(0, y); tryEnqueue(width-1, y); }

    // BFS
    let removed = 0;
    let qi = 0;
    while (qi < queue.length) {
      const x = queue[qi++], y = queue[qi++];
      const i = idx(x, y);
      data[i+3] = 0; // transparent
      removed++;
      tryEnqueue(x-1, y); tryEnqueue(x+1, y);
      tryEnqueue(x, y-1); tryEnqueue(x, y+1);
    }

    console.log(`Removed ${removed} background pixels`);

    return sharp(Buffer.from(data), { raw: { width, height, channels } })
      .png()
      .toFile(FILE);
  })
  .then(out => {
    console.log(`Saved: ${FILE}`);
    console.log(`Output: ${out.width}x${out.height} (${out.size} bytes)`);
    return sharp(FILE).metadata();
  })
  .then(meta => {
    console.log(`Verify: ${meta.width}x${meta.height} ${meta.hasAlpha ? 'RGBA' : 'RGB'}`);
    if (meta.width === 960 && meta.height === 384) console.log('DIMENSIONS OK');
    else { console.error('DIMENSION MISMATCH'); process.exit(1); }
  })
  .catch(err => { console.error(err); process.exit(1); });
