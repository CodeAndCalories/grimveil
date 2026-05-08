/**
 * gen-collision-overrides.js
 * Builds the overworld map deterministically, finds every MOUNTAIN/WATER/WALL
 * tile inside a specified region that appears walkable in the painted background,
 * and merges walkable:true entries into collision_overrides.json.
 *
 * Usage:
 *   node scripts/gen-collision-overrides.js
 *
 * Adjust REGIONS below to target different areas of the map.
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Tile IDs (must match GameScene.js) ───────────────────────────────────────
const T = {
  GRASS:0, WATER:1, MOUNTAIN:2, PATH:3,
  SAND:4,  DGRASS:5, FLOOR:6, WALL:7, DFLOOR:8,
};
const WALKABLE = new Set([T.GRASS, T.PATH, T.SAND, T.DGRASS, T.FLOOR, T.DFLOOR]);

// ── RNG (identical to GameScene.js makeRng) ───────────────────────────────────
function makeRng(seed) {
  let s = seed >>> 0;
  return () => { s = Math.imul(s, 1664525) + 1013904223 >>> 0; return s / 4294967296; };
}

// ── Minimal buildOverworld (same logic as GameScene.js) ───────────────────────
function buildOverworld() {
  const w = 100, h = 100;
  const rng = makeRng(0xdeadbeef);
  const map = Array.from({ length: h }, () => new Array(w).fill(T.GRASS));

  const set = (x, y, t) => { if (x >= 0 && x < w && y >= 0 && y < h) map[y][x] = t; };
  const fill = (x0, y0, x1, y1, t) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, t);
  };

  // 1. North coast
  fill(0, 0, w - 1, 9, T.WATER);
  for (let x = 0; x < w; x++) {
    const shore = 10 + Math.floor(rng() * 4);
    for (let y = 10; y <= 16; y++) {
      if (y < shore)          set(x, y, T.WATER);
      else if (y < shore + 2) set(x, y, T.SAND);
    }
  }
  for (let bx = 18; bx < w - 18; bx += 20 + Math.floor(rng() * 10)) {
    for (let y = 13; y <= 15; y++)
      for (let dx = 0; dx < 5 && bx + dx < w; dx++)
        if (rng() < 0.55) set(bx + dx, y, T.WATER);
  }
  // 2. Graveyard
  for (let y = 14; y <= 35; y++)
    for (let x = 0; x <= 22; x++)
      if (map[y][x] === T.GRASS || map[y][x] === T.SAND)
        if (rng() < 0.78) map[y][x] = T.DGRASS;
  for (let y = 14; y <= 38; y++)
    for (let x = 18; x <= 30; x++)
      if (map[y][x] === T.GRASS && rng() < 0.42) map[y][x] = T.DGRASS;
  // 3. Sunken Grove
  for (let y = 36; y <= 65; y++) {
    for (let x = 0; x <= 28; x++) if (map[y][x] === T.GRASS && rng() < 0.70) map[y][x] = T.DGRASS;
    for (let x = 24; x <= 38; x++) if (map[y][x] === T.GRASS && rng() < 0.28) map[y][x] = T.DGRASS;
  }
  const clearing = (cx, cy, r) => {
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++)
        if (Math.abs(dx) + Math.abs(dy) <= r && map[cy + dy]?.[cx + dx] === T.DGRASS)
          set(cx + dx, cy + dy, T.GRASS);
  };
  clearing(10,44,3); clearing(18,52,4); clearing(6,58,3); clearing(14,62,2);
  // 4. Goblin camp
  for (let y = 18; y <= 26; y++)
    for (let x = 80; x <= 90; x++)
      if (map[y][x] === T.GRASS) map[y][x] = rng() < 0.35 ? T.GRASS : T.FLOOR;
  for (let x = 74; x <= 99; x++) { set(x,16,T.PATH); set(x,28,T.PATH); }
  for (let y = 16; y <= 28; y++) set(74,y,T.PATH);
  // 5. Shattered Quarry
  const qcx = 84, qcy = 43;
  for (let y = 28; y <= 58; y++)
    for (let x = 68; x <= 99; x++) {
      const d = Math.abs(x - qcx) + Math.abs(y - qcy);
      if (d >= 14 && rng() < 0.74) set(x, y, T.MOUNTAIN);
    }
  for (let y = 29; y <= 57; y++)
    for (let x = 69; x <= 98; x++) {
      const d = Math.abs(x - qcx) + Math.abs(y - qcy);
      if (d >= 9 && d <= 13 && map[y][x] !== T.MOUNTAIN) set(x, y, T.FLOOR);
    }
  for (let y = 30; y <= 56; y++)
    for (let x = 70; x <= 97; x++) {
      const d = Math.abs(x - qcx) + Math.abs(y - qcy);
      if (d >= 4 && d < 9 && map[y][x] !== T.MOUNTAIN) set(x, y, T.DFLOOR);
    }
  for (let y = 39; y <= 47; y++)
    for (let x = 80; x <= 88; x++)
      if (Math.abs(x - qcx) + Math.abs(y - qcy) < 4) set(x, y, T.DFLOOR);
  for (let y = 30; y <= 56; y++)
    for (let x = 70; x <= 97; x++) {
      const d = Math.abs(x - qcx) + Math.abs(y - qcy);
      if ((d === 9 || d === 13) && map[y][x] === T.FLOOR && rng() < 0.14) set(x, y, T.MOUNTAIN);
    }
  for (let y = 55; y <= 59; y++) { set(83,y,T.PATH); set(84,y,T.PATH); set(85,y,T.PATH); }
  for (let x = 64; x <= 99; x++) set(x, 59, T.PATH);
  // 6. Scourge Peak
  fill(79,72,99,99,T.MOUNTAIN);
  for (let x = 79; x <= 99; x++) {
    const cliffY = 68 + Math.floor(rng() * 4);
    for (let y = cliffY; y < 72; y++) if (rng() < 0.82) set(x,y,T.MOUNTAIN);
  }
  for (let y = 64; y <= 68; y++)
    for (let x = 79; x <= 99; x++)
      if (map[y][x] === T.GRASS && rng() < 0.28) set(x,y,T.MOUNTAIN);
  for (let x = 83; x <= 84; x++) for (let y = 68; y <= 71; y++) set(x,y,T.GRASS);
  set(82,72,T.MOUNTAIN); set(83,72,T.MOUNTAIN); set(84,72,T.MOUNTAIN); set(85,72,T.MOUNTAIN);
  for (const [px,py] of [[81,69],[82,68],[85,68],[86,69],[81,71],[86,71]]) set(px,py,T.MOUNTAIN);
  // 7. Outpost
  fill(39,61,62,76,T.FLOOR);
  for (let x = 37; x <= 64; x++) { set(x,59,T.PATH); set(x,77,T.PATH); }
  for (let y = 59; y <= 77; y++) { set(37,y,T.PATH); set(64,y,T.PATH); }
  set(50,77,T.FLOOR); set(51,77,T.FLOOR);
  // 8. Farm + pond
  for (let y = 68; y <= 90; y += 7)
    for (let x = 6; x <= 33; x++) if (map[y][x] === T.GRASS) set(x,y,T.PATH);
  for (let x = 6; x <= 33; x += 8)
    for (let y = 68; y <= 90; y++) if (map[y][x] === T.GRASS) set(x,y,T.PATH);
  fill(17,71,20,73,T.WATER);
  // 9. Pen
  for (let x = 34; x <= 46; x++) { set(x,82,T.PATH); set(x,92,T.PATH); }
  for (let y = 82; y <= 92; y++) { set(34,y,T.PATH); set(46,y,T.PATH); }
  set(40,82,T.GRASS); set(41,82,T.GRASS);
  // 10. Main roads
  for (let y = 17; y <= 99; y++) {
    if (map[y][50]!==T.WATER&&map[y][50]!==T.MOUNTAIN) set(50,y,T.PATH);
    if (map[y][51]!==T.WATER&&map[y][51]!==T.MOUNTAIN) set(51,y,T.PATH);
  }
  for (let x = 0; x <= 78; x++) {
    if (map[79][x]!==T.WATER&&map[79][x]!==T.MOUNTAIN) set(x,79,T.PATH);
    if (map[80][x]!==T.WATER&&map[80][x]!==T.MOUNTAIN) set(x,80,T.PATH);
  }
  for (let y = 77; y <= 79; y++) { set(50,y,T.PATH); set(51,y,T.PATH); }
  // 13c. Serenity Pond
  const pondTiles=[[56,91],[57,91],[58,91],[55,92],[56,92],[57,92],[58,92],[59,92],[55,93],[56,93],[57,93],[58,93],[59,93],[60,93],[56,94],[57,94],[58,94],[59,94],[57,95],[58,95]];
  for(const[px,py]of pondTiles)set(px,py,T.WATER);
  // (skipping remaining detail passes — tile type is set above for quarry region)
  // Extra MOUNTAIN scatter inside quarry (d4-5)
  for (let y = 38; y <= 48; y++)
    for (let x = 79; x <= 89; x++) {
      const dq = Math.abs(x - qcx) + Math.abs(y - qcy);
      if (dq >= 4 && dq <= 5 && map[y][x] === T.DFLOOR && rng() < 0.18) set(x, y, T.MOUNTAIN);
    }
  return map;
}

// ── Regions to scan for blocked-but-should-be-walkable tiles ─────────────────
// Add bounding boxes here; everything non-walkable inside will get walkable:true.
const REGIONS = [
  // Quarry outer approach — scattered MOUNTAIN tiles on painted-grass terrain
  { x0: 64, y0: 28, x1: 99, y1: 71, label: 'quarry approach' },
];

// ── Build map and collect blocked tiles ───────────────────────────────────────
console.log('Building overworld map…');
const map = buildOverworld();

const newEntries = [];
for (const { x0, y0, x1, y1, label } of REGIONS) {
  let count = 0;
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (!WALKABLE.has(map[ty][tx])) {
        newEntries.push({ x: tx, y: ty, walkable: true });
        count++;
      }
    }
  }
  console.log(`  ${label}: ${count} blocked tiles found`);
}

// ── Merge with existing collision_overrides.json ──────────────────────────────
const colPath = path.resolve(__dirname, '../src/data/collision_overrides.json');
const existing = JSON.parse(readFileSync(colPath, 'utf8'));
const existingSet = new Set(existing.overrides.map(e => `${e.x},${e.y}`));
const merged = [
  ...existing.overrides,
  ...newEntries.filter(e => !existingSet.has(`${e.x},${e.y}`)),
];
merged.sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x);
writeFileSync(colPath, JSON.stringify({ overrides: merged }, null, 2));
console.log(`\nDone — ${newEntries.length} new entries merged (${merged.length} total).`);
console.log(`Output: ${colPath}`);
