/**
 * image-to-map.js
 * Samples grimfell_terrain_map.png (100×100 tile grid inside a 12px border)
 * and writes a map_import_preview.json to src/data/.
 *
 * Usage: node scripts/image-to-map.js
 */

import sharp from 'sharp';
import { writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Image geometry ────────────────────────────────────────────────────────────
const BORDER    = 12;          // decorative border px on each side
const MAP_TILES = 100;         // 100×100 tile grid
const INNER_PX  = 1230;        // 1254 - 2*12 = 1230 inner pixels
const TILE_PX   = INNER_PX / MAP_TILES;  // 12.3 px per tile

// ── Image path resolution — tries worktree-local first, falls back to main repo
const LOCAL_IMG    = path.resolve(__dirname, '../reference/grimfell_terrain_map.png');
const MAIN_REPO    = path.resolve(__dirname, '../../../../../grimfell-phaser/reference/grimfell_terrain_map.png');
const IMG_PATH     = existsSync(LOCAL_IMG) ? LOCAL_IMG : MAIN_REPO;

// ── Output path ───────────────────────────────────────────────────────────────
const OUT_PATH = path.resolve(__dirname, '../src/data/map_import_preview.json');

// ── Color → tile classifier ───────────────────────────────────────────────────
// Evaluated top-to-bottom; first match wins.
function classify(r, g, b) {
  const span = Math.max(r, g, b) - Math.min(r, g, b);

  // WATER: blue-green (rivers, coast, ponds)
  if (r < 120 && b > 80 && b > r + 20)
    return { tileId: 1, tileName: 'WATER' };

  // DFLOOR: very dark near-black (quarry pit, dungeon floor)
  if (r < 45 && g < 50 && b < 50 && span <= 15)
    return { tileId: 8, tileName: 'DFLOOR' };

  // DGRASS: dark forest green (Sunken Grove, graveyard)
  if (g > r && g < 70 && b < 45)
    return { tileId: 5, tileName: 'DGRASS' };

  // MOUNTAIN: true cliff/peak gray only — raised threshold to avoid rock decoration reads
  if (r > 160 && g > 150 && b > 120 && span <= 40)
    return { tileId: 2, tileName: 'MOUNTAIN' };

  // PATH: clearly sandy road — raised threshold to cut false road reads
  if (r > 120 && g > 110 && b < 80 && (r - b) > 50)
    return { tileId: 3, tileName: 'PATH' };

  // FLOOR: warm brown outpost/dungeon floor
  if (r > 60 && g > 60 && b > 35 && (r - b) >= 15 && (r - b) <= 35)
    return { tileId: 6, tileName: 'FLOOR' };

  // Default
  return { tileId: 0, tileName: 'GRASS' };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!existsSync(IMG_PATH)) {
    console.error(`Image not found at:\n  ${LOCAL_IMG}\n  ${MAIN_REPO}`);
    process.exit(1);
  }

  console.log(`Reading: ${IMG_PATH}`);

  const { data, info } = await sharp(IMG_PATH)
    .raw()
    .toBuffer({ resolveWithObject: true });

  console.log(`Image size: ${info.width}×${info.height}, channels: ${info.channels}`);

  const ch       = info.channels;
  const W        = info.width;
  const overrides = [];
  const counts   = { GRASS: 0, WATER: 0, MOUNTAIN: 0, PATH: 0, FLOOR: 0, DGRASS: 0, DFLOOR: 0 };

  for (let ty = 0; ty < MAP_TILES; ty++) {
    for (let tx = 0; tx < MAP_TILES; tx++) {
      // Centre pixel of this tile cell
      const px = Math.round(BORDER + (tx + 0.5) * TILE_PX);
      const py = Math.round(BORDER + (ty + 0.5) * TILE_PX);

      const i = (py * W + px) * ch;
      const r = data[i], g = data[i + 1], b = data[i + 2];

      const { tileId, tileName } = classify(r, g, b);
      counts[tileName] = (counts[tileName] ?? 0) + 1;

      if (tileId !== 0) {
        overrides.push({ x: tx, y: ty, tileId, tileName });
      }
    }
  }

  // Sort by y then x (matches map_overrides.json convention)
  overrides.sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x);

  const output = {
    zone:           'overworld',
    generated_from: 'grimfell_terrain_map.png',
    tile_counts:    counts,
    overrides,
  };

  writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log('\n═══ Tile counts ═══════════════');
  let nonGrass = 0;
  for (const [name, n] of Object.entries(counts)) {
    const bar = '█'.repeat(Math.round(n / 20));
    console.log(`  ${name.padEnd(10)} ${String(n).padStart(5)}  ${bar}`);
    if (name !== 'GRASS') nonGrass += n;
  }
  console.log('───────────────────────────────');
  console.log(`  ${'TOTAL'.padEnd(10)} ${String(MAP_TILES * MAP_TILES).padStart(5)}`);
  console.log(`  ${'non-GRASS'.padEnd(10)} ${String(nonGrass).padStart(5)}`);
  console.log(`\nOutput: ${OUT_PATH}`);
}

main().catch(err => {
  console.error('Error:', err.message ?? err);
  process.exit(1);
});
