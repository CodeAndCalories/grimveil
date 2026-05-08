/**
 * preview-map.js
 * Renders src/data/map_import_preview.json as a 1000×1000 PNG
 * (10×10 px per tile, 100×100 grid).
 *
 * Usage: node scripts/preview-map.js
 */

import sharp from 'sharp';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Paths ─────────────────────────────────────────────────────────────────────
const DATA_PATH = path.resolve(__dirname, '../src/data/map_import_preview.json');

// Save alongside the source image in reference/
const LOCAL_REF  = path.resolve(__dirname, '../reference');
const MAIN_REF   = path.resolve(__dirname, '../../../../../grimfell-phaser/reference');
const REF_DIR    = existsSync(LOCAL_REF) ? LOCAL_REF : MAIN_REF;
const OUT_PATH   = path.join(REF_DIR, 'map_preview_render.png');

// ── Render constants ──────────────────────────────────────────────────────────
const MAP_TILES  = 100;
const TILE_PX    = 10;
const IMG_PX     = MAP_TILES * TILE_PX;   // 1000

// ── Colour table (hex → [r, g, b]) ───────────────────────────────────────────
function hex(h) {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

const COLORS = {
  GRASS:    hex('#4a7c2f'),
  DGRASS:   hex('#2d4a1e'),
  WATER:    hex('#3d6b8a'),
  PATH:     hex('#8b7355'),
  FLOOR:    hex('#6b5a3e'),
  DFLOOR:   hex('#2a2520'),
  MOUNTAIN: hex('#7a7a6a'),
};

// ── Main ──────────────────────────────────────────────────────────────────────
function main() {
  if (!existsSync(DATA_PATH)) {
    console.error(`Data not found: ${DATA_PATH}`);
    process.exit(1);
  }

  const { tile_counts, overrides } = JSON.parse(readFileSync(DATA_PATH, 'utf8'));

  // Raw RGB buffer — pre-fill with GRASS
  const buf   = Buffer.alloc(IMG_PX * IMG_PX * 3);
  const [gr, gg, gb] = COLORS.GRASS;
  for (let i = 0; i < buf.length; i += 3) {
    buf[i] = gr; buf[i + 1] = gg; buf[i + 2] = gb;
  }

  // Paint each non-GRASS tile
  let painted = 0;
  for (const { x, y, tileName } of overrides) {
    const rgb = COLORS[tileName];
    if (!rgb) continue;
    const [r, g, b] = rgb;
    const px0 = x * TILE_PX;
    const py0 = y * TILE_PX;
    for (let dy = 0; dy < TILE_PX; dy++) {
      for (let dx = 0; dx < TILE_PX; dx++) {
        const i = ((py0 + dy) * IMG_PX + (px0 + dx)) * 3;
        buf[i] = r; buf[i + 1] = g; buf[i + 2] = b;
      }
    }
    painted++;
  }

  // Ensure output directory exists
  if (!existsSync(REF_DIR)) mkdirSync(REF_DIR, { recursive: true });

  // Write PNG via sharp
  return sharp(buf, { raw: { width: IMG_PX, height: IMG_PX, channels: 3 } })
    .png()
    .toFile(OUT_PATH)
    .then(() => {
      console.log(`\n═══ Tile counts ════════════════`);
      const all = { ...tile_counts };
      let total = 0;
      for (const [name, n] of Object.entries(all)) {
        const bar = '█'.repeat(Math.round(n / 20));
        console.log(`  ${name.padEnd(10)} ${String(n).padStart(5)}  ${bar}`);
        total += n;
      }
      console.log('────────────────────────────────');
      console.log(`  ${'TOTAL'.padEnd(10)} ${String(total).padStart(5)}`);
      console.log(`  ${'painted'.padEnd(10)} ${String(painted).padStart(5)}  (non-GRASS tiles)`);
      console.log(`\nOutput: ${OUT_PATH}`);
    });
}

main().catch(err => {
  console.error('Error:', err.message ?? err);
  process.exit(1);
});
