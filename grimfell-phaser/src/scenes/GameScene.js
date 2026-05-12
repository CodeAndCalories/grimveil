import Phaser from 'phaser';
import ZONES_CFG     from '../data/zones.json';
import MONSTERS_DATA from '../data/monsters.json';
import ITEMS_DATA    from '../data/items.json';
import RDEFS         from '../data/resources.json';
import MAP_OVERRIDES        from '../data/map_overrides.json';
import MAP_IMPORT_PREVIEW   from '../data/map_import_preview.json';
import COLLISION_OVERRIDES  from '../data/collision_overrides.json';
import PLACED_OBJECTS_DATA  from '../data/placed_objects.json';
import { Player, SAVE_KEY }     from '../entities/Player.js';
import { attackMonster, monsterAttacksPlayer, killXP } from '../systems/CombatSystem.js';
import { gatherResource }       from '../systems/GatherSystem.js';
import { cookOne }              from '../systems/CookingSystem.js';
import { xpProg }               from '../shared/GameMath.js';

// ── Dev mode — true on `vite dev`, false on `vite build` ─────────────────────
const DEV_MODE = import.meta.env.DEV;

// ── Layout constants — exported so UIScene uses the same initial values ──────
export const TOP_H             = 40;
export const BOTTOM_H          = 180;
export const RIGHT_W           = 320;
export const JOURNAL_W         = 310;
export const GAP               = 6;
export const MARGIN            = 6;
export const BOTTOM_INFO_PCT   = 0.38;
export const BOTTOM_ACTION_PCT = 0.37;
export const BOTTOM_GEAR_PCT   = 0.25;
export const MINIMAP_SIZE      = 150;
export const ACTION_SLOT_SIZE  = 54;
export const GEAR_SLOT_SIZE    = 32;
export const INV_SLOT_SIZE     = 26;

// ── Map constants ─────────────────────────────────────────────────────────────
export const TILE_SIZE = 32;
export const MAP_W     = ZONES_CFG.overworld.size.w;  // 100
export const MAP_H     = ZONES_CFG.overworld.size.h;  // 100

// ── Tile types ────────────────────────────────────────────────────────────────
const T = {
  GRASS:0, WATER:1, MOUNTAIN:2, PATH:3,
  SAND:4,  DGRASS:5, FLOOR:6,  WALL:7, DFLOOR:8,
};
// Human-readable tile names — used by the dev editor HUD (index == tile value)
const T_NAMES = ['GRASS','WATER','MOUNTAIN','PATH','SAND','DGRASS','FLOOR','WALL','DFLOOR'];
const WALKABLE = new Set([T.GRASS, T.PATH, T.SAND, T.DGRASS, T.FLOOR, T.DFLOOR]);

// ── F2 Object Editor — placeable object definitions ───────────────────────────
const OBJ_TYPES = {
  '1': { type: 'fence_h', label: 'Fence H', blocking: true  },
  '2': { type: 'fence_v', label: 'Fence V', blocking: true  },
  '3': { type: 'wall',    label: 'Wall',    blocking: true  },
  '4': { type: 'barrel',  label: 'Barrel',  blocking: true  },
  '5': { type: 'sign',    label: 'Sign',    blocking: false },
};

// ── Tile colours ──────────────────────────────────────────────────────────────
const TC = {
  [T.GRASS]:0x4a8c48, [T.WATER]:0x1e5ea8, [T.MOUNTAIN]:0x7a6a58,
  [T.PATH]:0xc4a87e,  [T.SAND]:0xd4b882,  [T.DGRASS]:0x3a7038,
  [T.FLOOR]:0xb89060, [T.WALL]:0x2a2018,  [T.DFLOOR]:0x1e1428,
};
const TC_ALT = {
  [T.GRASS]:0x3a7a38, [T.WATER]:0x144e98, [T.MOUNTAIN]:0x6a5a48,
  [T.PATH]:0xb4986e,  [T.SAND]:0xc4a872,  [T.DGRASS]:0x2a6028,
  [T.FLOOR]:0xa07850, [T.WALL]:0x1a1008,  [T.DFLOOR]:0x140c1c,
};

// ── Interactable marker colours ───────────────────────────────────────────────
const IACT_COLORS = {
  bank:0xc9a84c, shop:0x3a8eee, campfire:0xff6a20,
  dungeon_entrance:0x8860c0, dungeon_exit:0x8860c0, alchemy:0x9060cc,
  paper_press:0x8b5e3c, library:0x6a7830,
};

// ── Monster type → spritesheet key (undefined = rectangle fallback) ───────────
const MOB_SPRITE_MAP = {
  chicken:         'chicken',
  rat:             'giant_rat',
  goblin:          'goblin1',
  skeleton:        'skeleton1',
  cow:             'cow1',
  training_dummy:  'dummy1',
  rockmite:        'rockmite',
  ghoul:           'ghoul',
  thornling:       'thornling',
  hollowfolk:      'hollowfolk',
};

// ── Fixed display size per mob type — avoids per-frame jitter from trimmed bounds ──
const MOB_DISPLAY_SIZE = {
  chicken:        [20, 20],
  cow:            [40, 40],
  // all others fall back to [TILE_SIZE, TILE_SIZE] at runtime
};

// ── Interactable type → sprite key (undefined = coloured rectangle fallback) ──
const IACT_SPRITE_MAP = {
  campfire:     'campfire_spr',
  bank:         'chest_spr',
  shop:         'starter_shop',
  alchemy:      'alchemy_table',
};

// ── Resource visual specs (spriteKey/sw/sh → image; no spriteKey → graphics) ──
const RES_VIS = {
  // Woodcutting tiers
  tree:            { shape:'tree', crown:0x1e7a0a, trunk:0x6b3a10, r:11, spriteKey:'tree_lv1',   sw:48, sh:48 },
  ashwood:         { shape:'tree', crown:0x2a4a20, trunk:0x4a2a10, r:12, spriteKey:'ashwood',    sw:56, sh:56 },
  grimoak:         { shape:'tree', crown:0x0a5206, trunk:0x3a2008, r:13, spriteKey:'grimoak',    sw:64, sh:64 },
  deadwood:        { shape:'tree', crown:0x2a2a2a, trunk:0x1a1a1a, r:13, spriteKey:'deadwood',   sw:64, sh:64 },
  veilwood:        { shape:'tree', crown:0x1a0a3a, trunk:0x0a0a1a, r:14, spriteKey:'veilwood',   sw:72, sh:72 },
  oak:             { shape:'tree', crown:0x0a5206, trunk:0x3a2008, r:13, spriteKey:'oak_tree',   sw:56, sh:56 },
  // Mining tiers
  copper_rock:     { shape:'rock', body:0x8a7040, shine:0xb09460,       spriteKey:'copperstone',   sw:32, sh:32 },
  grimsteel_rock:  { shape:'rock', body:0x3a4a5a, shine:0x5a7080,       spriteKey:'grimsteel_rock',sw:32, sh:32 },
  ashstone_rock:   { shape:'rock', body:0x5a4a3a, shine:0x8a7a6a,       spriteKey:'ashstone',      sw:32, sh:32 },
  veilmetal_rock:  { shape:'rock', body:0x2a1a4a, shine:0x6a4a9a,       spriteKey:'veilmetal',     sw:32, sh:32 },
  iron_rock:       { shape:'rock', body:0x58585e, shine:0x7a7a84,       spriteKey:'grey_rock',    sw:32, sh:32 },
  // Fishing
  fishing_spot:    { shape:'fish', body:0x1e5aa8 },
  trout_spot:      { shape:'fish', body:0x2a70c8 },
  saltfin_spot:        { shape:'fish', animSpriteKey:'saltfin_spot',        animKey:'saltfin_spot_anim',        sw:36, sh:36 },
  grimscale_bass_spot: { shape:'fish', animSpriteKey:'grimscale_bass_spot', animKey:'grimscale_bass_spot_anim', sw:40, sh:40 },
  // Foraging tiers
  herb_redroot:    { shape:'herb', color:0xc03828, spriteKey:'redroot_bush',  sw:28, sh:28 },
  herb_mooncap:    { shape:'herb', color:0xd4d490, spriteKey:'mooncap_bush',  sw:28, sh:28 },
  herb_stonecap:   { shape:'herb', color:0x8a9080, spriteKey:'stonecap_bush', sw:28, sh:28 },
  herb_veilbloom:  { shape:'herb', color:0x9040c8, spriteKey:'veilbloom_bush',sw:28, sh:28 },
  herb_bitterleaf: { shape:'herb', color:0x4cb840, spriteKey:'lush_bush',     sw:26, sh:26 },
  herb_ironleaf:   { shape:'herb', color:0x7090a8 },
};

// ── Ability definitions (Q/W/E/R — fixed slots) ──────────────────────────────
const ABILITY_DEFS = {
  Q: { name: 'Minor Heal',  cooldown: 7000,  activeDuration: 0     },
  W: { name: 'Iron Shield', cooldown: 35000, activeDuration: 8000  },
  E: { name: 'Enrage',      cooldown: 45000, activeDuration: 30000 },
  R: { name: 'Stun Strike', cooldown: 30000, activeDuration: 0     },
};

// ── Style abilities (T key — dynamic based on equipped weapon/combatStyle) ────
// Each entry: name, cooldown (ms), dmgMult, plus style-specific extras.
// Keyed by weaponCombatStyle value so lookup is O(1).
const STYLE_ABILITY_DEFS = {
  melee: {
    name: 'THRUST',     cooldown:  6000, dmgMult: 2.2,
  },
  archer: {
    name: 'QUICK SHOT', cooldown:  7000, dmgMult: 0.65, shots: 2,
  },
  magic: {
    name: 'ARC BURST',  cooldown:  8000, dmgMult: 1.0,
    splashMult: 0.6, splashRange: 3,
  },
  druidism: {
    name: 'ROOT SNARE', cooldown: 10000, dmgMult: 0.7,
    rootDuration: 3000,
  },
};

// ── Cooking recipes ───────────────────────────────────────────────────────────
const COOK_RECIPES = {
  raw_fish:      { reqLvl: 1,  result: 'cooked_fish',           xp: 30, baseBurnChance: 0.55, burnReductionPerLevel: 0.03, minBurnChance: 0.05 },
  saltfin_fish:  { reqLvl: 5,  result: 'saltfin_cooked',        xp: 40, baseBurnChance: 0.60, burnReductionPerLevel: 0.03, minBurnChance: 0.05 },
  grimscale_bass:{ reqLvl: 10, result: 'grimscale_bass_cooked', xp: 65, baseBurnChance: 0.70, burnReductionPerLevel: 0.02, minBurnChance: 0.08 },
  raw_trout:     { reqLvl: 20, result: 'cooked_trout',          xp: 70, baseBurnChance: 0.75, burnReductionPerLevel: 0.02, minBurnChance: 0.10 },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function cssHex(str) { return parseInt(str.replace('#', ''), 16); }

function makeRng(seed) {
  let s = seed >>> 0;
  return () => { s = Math.imul(s, 1664525) + 1013904223 >>> 0; return s / 4294967296; };
}

// ── Overworld map builder ─────────────────────────────────────────────────────
function buildOverworld() {
  const { w, h } = ZONES_CFG.overworld.size;   // 100 × 100
  const rng = makeRng(0xdeadbeef);
  const map = Array.from({ length: h }, () => new Array(w).fill(T.GRASS));

  const set = (x, y, t) => { if (x >= 0 && x < w && y >= 0 && y < h) map[y][x] = t; };
  const fill = (x0, y0, x1, y1, t) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, t);
  };

  // ── 1. NORTH: Whispering Coast ────────────────────────────────────────────
  // Deep water rows 0-9; irregular sand/water transition rows 10-16
  fill(0, 0, w - 1, 9, T.WATER);
  for (let x = 0; x < w; x++) {
    const shore = 10 + Math.floor(rng() * 4);   // coastline varies 10-13
    for (let y = 10; y <= 16; y++) {
      if (y < shore)         set(x, y, T.WATER);
      else if (y < shore + 2) set(x, y, T.SAND);
      // else leave as GRASS
    }
  }
  // A few shallow bays that push water further south
  for (let bx = 18; bx < w - 18; bx += 20 + Math.floor(rng() * 10)) {
    for (let y = 13; y <= 15; y++)
      for (let dx = 0; dx < 5 && bx + dx < w; dx++)
        if (rng() < 0.55) set(bx + dx, y, T.WATER);
  }

  // ── 2. FAR NORTHWEST: Desecrated Graveyard ───────────────────────────────
  // Dead dark grass x:0-22, y:14-35
  for (let y = 14; y <= 35; y++)
    for (let x = 0; x <= 22; x++)
      if (map[y][x] === T.GRASS || map[y][x] === T.SAND)
        if (rng() < 0.78) map[y][x] = T.DGRASS;
  // Bleed into surrounding area for natural edge
  for (let y = 14; y <= 38; y++)
    for (let x = 18; x <= 30; x++)
      if (map[y][x] === T.GRASS && rng() < 0.42) map[y][x] = T.DGRASS;

  // ── 3. WEST / NORTHWEST: Sunken Grove ────────────────────────────────────
  // Dense dark forest x:0-28, y:36-65; lighter fringe to x:38
  for (let y = 36; y <= 65; y++) {
    for (let x = 0; x <= 28; x++)
      if (map[y][x] === T.GRASS && rng() < 0.70) map[y][x] = T.DGRASS;
    for (let x = 24; x <= 38; x++)
      if (map[y][x] === T.GRASS && rng() < 0.28) map[y][x] = T.DGRASS;
  }
  // Small clearings punch breathing room through the grove
  const clearing = (cx, cy, r) => {
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++)
        if (Math.abs(dx) + Math.abs(dy) <= r && map[cy + dy]?.[cx + dx] === T.DGRASS)
          set(cx + dx, cy + dy, T.GRASS);
  };
  clearing(10, 44, 3);
  clearing(18, 52, 4);
  clearing(6,  58, 3);
  clearing(14, 62, 2);

  // ── 4. FAR NORTHEAST: Goblin Camp ────────────────────────────────────────
  // Camp floor cluster x:80-90, y:18-26; rough camp paths
  for (let y = 18; y <= 26; y++)
    for (let x = 80; x <= 90; x++)
      if (map[y][x] === T.GRASS) map[y][x] = rng() < 0.35 ? T.GRASS : T.FLOOR;
  for (let x = 74; x <= 99; x++) { set(x, 16, T.PATH); set(x, 28, T.PATH); }
  for (let y = 16; y <= 28; y++) { set(74, y, T.PATH); }

  // ── 5. EAST / NORTHEAST: Shattered Quarry ────────────────────────────────
  // Diamond-shaped pit centred at (84,43) with 3 carved tiers.
  // Manhattan distance drives tier assignment so shape is non-rectangular.
  const qcx = 84, qcy = 43;
  // Outer mountain ring: d >= 14 (irregular scatter)
  for (let y = 28; y <= 58; y++) {
    for (let x = 68; x <= 99; x++) {
      const d = Math.abs(x - qcx) + Math.abs(y - qcy);
      if (d >= 14 && rng() < 0.74) set(x, y, T.MOUNTAIN);
    }
  }
  // Tier 1 outer ledge (d 9–13): lighter FLOOR — widest walkable rim
  for (let y = 29; y <= 57; y++) {
    for (let x = 69; x <= 98; x++) {
      const d = Math.abs(x - qcx) + Math.abs(y - qcy);
      if (d >= 9 && d <= 13 && map[y][x] !== T.MOUNTAIN) set(x, y, T.FLOOR);
    }
  }
  // Tier 2 mid shelf (d 4–8): darker DFLOOR — carved interior
  for (let y = 30; y <= 56; y++) {
    for (let x = 70; x <= 97; x++) {
      const d = Math.abs(x - qcx) + Math.abs(y - qcy);
      if (d >= 4 && d < 9 && map[y][x] !== T.MOUNTAIN) set(x, y, T.DFLOOR);
    }
  }
  // Tier 3 pit bottom (d < 4): deepest centre point, always DFLOOR
  for (let y = 39; y <= 47; y++)
    for (let x = 80; x <= 88; x++)
      if (Math.abs(x - qcx) + Math.abs(y - qcy) < 4) set(x, y, T.DFLOOR);
  // Rock outcrops scattered along tier edges (d=9 and d=13 band)
  for (let y = 30; y <= 56; y++) {
    for (let x = 70; x <= 97; x++) {
      const d = Math.abs(x - qcx) + Math.abs(y - qcy);
      if ((d === 9 || d === 13) && map[y][x] === T.FLOOR && rng() < 0.14) set(x, y, T.MOUNTAIN);
    }
  }
  // South entrance ramp: force 3-wide clear passage at x=83–85, y=55–59
  for (let y = 55; y <= 59; y++) { set(83, y, T.PATH); set(84, y, T.PATH); set(85, y, T.PATH); }
  // Access road along south edge (includes old spur range)
  for (let x = 64; x <= 99; x++) set(x, 59, T.PATH);

  // ── 6. FAR SOUTHEAST: Scourge Peak ───────────────────────────────────────
  // Dense impassable mountain mass x:79-99, y:72-99
  fill(79, 72, 99, 99, T.MOUNTAIN);
  // Irregular cliff face: probabilistic scatter at y=67–72
  for (let x = 79; x <= 99; x++) {
    const cliffY = 68 + Math.floor(rng() * 4);  // cliff top varies y=68-71
    for (let y = cliffY; y < 72; y++)
      if (rng() < 0.82) set(x, y, T.MOUNTAIN);
  }
  // Extra jagged mountain fingers pushing further north y=64–68
  for (let y = 64; y <= 68; y++)
    for (let x = 79; x <= 99; x++)
      if (map[y][x] === T.GRASS && rng() < 0.28) set(x, y, T.MOUNTAIN);
  // Scourge Pass: narrow 2-wide visible approach corridor x=83–84, y=68–71
  // Player can see it leads somewhere, but the gate at y=72 is sealed
  for (let x = 83; x <= 84; x++)
    for (let y = 68; y <= 71; y++)
      set(x, y, T.GRASS);     // clear any scatter that landed in the corridor
  // Mountain gate sealing the pass entrance
  set(82, 72, T.MOUNTAIN); set(83, 72, T.MOUNTAIN);
  set(84, 72, T.MOUNTAIN); set(85, 72, T.MOUNTAIN);
  // Sentinel peaks framing the pass visually
  for (const [px, py] of [[81,69],[82,68],[85,68],[86,69],[81,71],[86,71]]) {
    set(px, py, T.MOUNTAIN);
  }

  // ── 7. CENTER: Grimfell Outpost ───────────────────────────────────────────
  // Outpost floor x:39-62, y:61-76
  fill(39, 61, 62, 76, T.FLOOR);
  // Surrounding road/wall ring
  for (let x = 37; x <= 64; x++) { set(x, 59, T.PATH); set(x, 77, T.PATH); }
  for (let y = 59; y <= 77; y++) { set(37, y, T.PATH); set(64, y, T.PATH); }
  // South gate opening on main road
  set(50, 77, T.FLOOR); set(51, 77, T.FLOOR);

  // ── 8. SOUTHWEST: Highfields Farm ────────────────────────────────────────
  // Field grid lines (sparse — gives visual structure without over-filling)
  for (let y = 68; y <= 90; y += 7)
    for (let x = 6; x <= 33; x++) if (map[y][x] === T.GRASS) set(x, y, T.PATH);
  for (let x = 6; x <= 33; x += 8)
    for (let y = 68; y <= 90; y++) if (map[y][x] === T.GRASS) set(x, y, T.PATH);

  // ── 8b. BEGINNER POND (Highfields Farm) ──────────────────────────────────
  // Small fishing pond x:17-20, y:71-73 — inside farm between field paths
  fill(17, 71, 20, 73, T.WATER);
  for (const [px, py] of [
    [16,71],[16,72],[16,73],            // west bank
    [21,71],[21,72],[21,73],            // east bank
    [17,70],[18,70],[19,70],[20,70],    // north bank
    [17,74],[18,74],[19,74],[20,74],    // south bank
  ]) { if (map[py]?.[px] !== T.WATER) set(px, py, T.SAND); }

  // ── 9. BEGINNER PEN — SW of outpost, near Highfields Farm ────────────────
  // Moved away from Scourge Peak; placed at x:34-46, y:82-92
  for (let x = 34; x <= 46; x++) { set(x, 82, T.PATH); set(x, 92, T.PATH); }
  for (let y = 82; y <= 92; y++) { set(34, y, T.PATH); set(46, y, T.PATH); }
  // South-facing gate so player can enter from E-W road
  set(40, 82, T.GRASS); set(41, 82, T.GRASS);

  // ── 10. MAIN ROADS ────────────────────────────────────────────────────────
  // N-S spine: coast → outpost → tutorial area (y 17-99, x 50-51)
  for (let y = 17; y <= 99; y++) {
    if (map[y][50] !== T.WATER && map[y][50] !== T.MOUNTAIN) set(50, y, T.PATH);
    if (map[y][51] !== T.WATER && map[y][51] !== T.MOUNTAIN) set(51, y, T.PATH);
  }
  // E-W artery: farm ↔ outpost ↔ pen (y 79-80, x 0-78)
  for (let x = 0; x <= 78; x++) {
    if (map[79][x] !== T.WATER && map[79][x] !== T.MOUNTAIN) set(x, 79, T.PATH);
    if (map[80][x] !== T.WATER && map[80][x] !== T.MOUNTAIN) set(x, 80, T.PATH);
  }
  // Short road spur north into outpost from E-W road
  for (let y = 77; y <= 79; y++) { set(50, y, T.PATH); set(51, y, T.PATH); }

  // ── 11. TUTORIAL AREA ─────────────────────────────────────────────────────
  // Widened arrival pad south of outpost; player spawns at (50,92)
  for (let x = 46; x <= 55; x++) set(x, 85, T.PATH);
  for (let x = 47; x <= 54; x++) set(x, 86, T.PATH);

  // ── 12. AMBIENT GRASS VARIATION ──────────────────────────────────────────
  // Light DGRASS flecks in open areas to break up flat greens
  for (let y = 62; y <= 99; y++)
    for (let x = 35; x <= 66; x++)
      if (map[y][x] === T.GRASS && rng() < 0.06) map[y][x] = T.DGRASS;

  // ── 13. DETAIL / LANDMARK PASS ───────────────────────────────────────────

  // 13a. Desecrated Graveyard — extend to reference bounds x:0-40, y:18-45
  //      and add looping dirt-path network
  // East extension (was only x:0-22)
  for (let y = 18; y <= 45; y++)
    for (let x = 23; x <= 40; x++)
      if (map[y][x] === T.GRASS && rng() < 0.68) map[y][x] = T.DGRASS;
  // South extension (graveyard undercut into grove transition zone)
  for (let y = 36; y <= 45; y++)
    for (let x = 0; x <= 22; x++)
      if (map[y][x] === T.GRASS && rng() < 0.60) map[y][x] = T.DGRASS;
  // Soft bleed on east face into open land
  for (let y = 18; y <= 45; y++)
    for (let x = 36; x <= 46; x++)
      if (map[y][x] === T.GRASS && rng() < 0.25) map[y][x] = T.DGRASS;
  // Dirt-path loop: outer perimeter ring inside graveyard bounds
  for (let x = 8; x <= 32; x++) { set(x, 22, T.PATH); set(x, 41, T.PATH); } // N / S
  for (let y = 22; y <= 41; y++) { set(7, y, T.PATH); set(32, y, T.PATH); }  // W / E
  // Inner cross — horizontal bar + N-S spine
  for (let x = 7; x <= 32; x++) set(x, 31, T.PATH);
  for (let y = 22; y <= 41; y++) set(19, y, T.PATH);

  // 13b. Sunken Grove — extend south to reference y:80 + Old Grotto clearing
  // Dense south extension x:0-35, y:65-80
  for (let y = 65; y <= 80; y++) {
    for (let x = 0; x <= 35; x++)
      if (map[y][x] === T.GRASS && rng() < 0.52) map[y][x] = T.DGRASS;
    for (let x = 30; x <= 42; x++)
      if (map[y][x] === T.GRASS && rng() < 0.16) map[y][x] = T.DGRASS;
  }
  // Denser east fringe of existing grove (x:28-38, y:45-65)
  for (let y = 45; y <= 65; y++)
    for (let x = 28; x <= 38; x++)
      if (map[y][x] === T.GRASS && rng() < 0.38) map[y][x] = T.DGRASS;
  // Old Grotto POI clearing at (20,55) — diamond r=5, DGRASS→GRASS
  for (let dy = -5; dy <= 5; dy++)
    for (let dx = -5; dx <= 5; dx++)
      if (Math.abs(dx) + Math.abs(dy) <= 5 && map[55 + dy]?.[20 + dx] === T.DGRASS)
        set(20 + dx, 55 + dy, T.GRASS);

  // 13c. Serenity Pond — small irregular pond near tutorial spawn (~57,93)
  const pondTiles = [
    [56,91],[57,91],[58,91],
    [55,92],[56,92],[57,92],[58,92],[59,92],
    [55,93],[56,93],[57,93],[58,93],[59,93],[60,93],
    [56,94],[57,94],[58,94],[59,94],
    [57,95],[58,95],
  ];
  const pondSet = new Set(pondTiles.map(([px,py]) => `${px},${py}`));
  for (const [px,py] of pondTiles) set(px, py, T.WATER);
  // Sand banks on all non-water cardinal neighbours
  for (const [px,py] of pondTiles) {
    for (const [ddx,ddy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nx = px+ddx, ny = py+ddy;
      if (!pondSet.has(`${nx},${ny}`) && nx >= 0 && nx < w && ny >= 0 && ny < h)
        if (map[ny][nx] === T.GRASS || map[ny][nx] === T.DGRASS) set(nx, ny, T.SAND);
    }
  }

  // 13d. Scourge Pass teaser — broken cobblestone road curving SE from E-W
  //      artery at (67,81) toward the mountain wall at x=79 — dead-ends visibly
  for (const [px,py,t] of /** @type {[number,number,number][]} */ ([
    [67,81,T.PATH],[68,81,T.PATH],
    [68,82,T.DFLOOR],[69,82,T.PATH],[70,82,T.PATH],
    [71,83,T.PATH],[72,83,T.DFLOOR],[73,83,T.PATH],
    [73,84,T.PATH],[74,84,T.DFLOOR],[75,84,T.PATH],
    [75,85,T.DFLOOR],[76,85,T.PATH],[77,85,T.PATH],
    [77,86,T.DFLOOR],[78,86,T.PATH],
    [78,87,T.DFLOOR],
  ])) {
    if (map[py]?.[px] !== T.MOUNTAIN) set(px, py, t);
  }

  // ── 14. TERRAIN DETAIL POLISH ─────────────────────────────────────────────

  // 14a. Shattered Quarry — north entrance, interior ramp lines, pit-edge texture
  // North entrance: 3-wide PATH ramp from goblin camp south road (y=28) into quarry
  for (let y = 28; y <= 33; y++) { set(83, y, T.PATH); set(84, y, T.PATH); set(85, y, T.PATH); }
  // Interior descent lines at tier 1→2 boundary (d=9) along the north/south axis,
  // making the step-down between ledge and inner floor visually obvious.
  for (let y = qcy - 9; y <= qcy - 4; y++)
    if (map[y][qcx] !== T.MOUNTAIN) set(qcx, y, T.PATH);
  for (let y = qcy + 4; y <= qcy + 9; y++)
    if (map[y][qcx] !== T.MOUNTAIN) set(qcx, y, T.PATH);
  // Extra MOUNTAIN scatter at tier 2/3 edge (d 4–5): carved-rock pit texture
  for (let y = 38; y <= 48; y++) {
    for (let x = 79; x <= 89; x++) {
      const dq = Math.abs(x - qcx) + Math.abs(y - qcy);
      if (dq >= 4 && dq <= 5 && map[y][x] === T.DFLOOR && rng() < 0.18) set(x, y, T.MOUNTAIN);
    }
  }

  // 14b. Desecrated Graveyard — ruin/crypt patches for grave atmosphere
  fill(8,  27, 9,  28, T.DFLOOR);          // crypt ruin A
  fill(14, 32, 15, 33, T.DFLOOR);          // tomb ruin B
  fill(25, 34, 26, 35, T.FLOOR);           // crumbled stone C
  set(30, 28, T.FLOOR); set(30, 29, T.FLOOR);           // ruin stub D
  set(3, 35, T.DFLOOR); set(4, 35, T.DFLOOR); set(3, 36, T.DFLOOR); // crypt E
  // Dead-earth patches (DFLOOR) across the deep inner graveyard
  for (let y = 24; y <= 38; y++)
    for (let x = 2; x <= 16; x++)
      if (map[y][x] === T.DGRASS && rng() < 0.16) set(x, y, T.DFLOOR);

  // 14c. Sunken Grove — trail spine, Old Grotto shrine, dead inner ground
  // N–S trail at x=19: continues the graveyard path spine (y=22–41) south into grove
  for (let y = 42; y <= 64; y++)
    if (map[y][19] !== T.MOUNTAIN && map[y][19] !== T.WATER && map[y][19] !== T.PATH)
      set(19, y, T.PATH);
  // E–W trail at y=55 through the Old Grotto clearing toward the grove edge
  for (let x = 19; x <= 36; x++)
    if (map[55][x] !== T.MOUNTAIN && map[55][x] !== T.WATER) set(x, 55, T.PATH);
  // Old Grotto shrine — three FLOOR tiles just north of the trail junction
  set(20, 53, T.FLOOR); set(21, 53, T.FLOOR); set(20, 54, T.FLOOR);
  // Dead-earth (DFLOOR) scatter in the innermost, darkest grove depths
  for (let y = 46; y <= 64; y++)
    for (let x = 0; x <= 7; x++)
      if (map[y][x] === T.DGRASS && rng() < 0.20) set(x, y, T.DFLOOR);

  // 14d. Highfields Farm — farmhouse footprint + break grid regularity
  fill(7, 83, 11, 86, T.FLOOR);  // barn/farmhouse structure (SW farm area)
  set(9, 82, T.GRASS);           // open gateway in the field path north of barn
  // Remove specific grid-path tiles to reduce perfect-grid feel
  for (const [gx, gy] of [[11,75],[12,75],[24,75],[14,85],[14,86],[22,83]]) {
    if (map[gy][gx] === T.PATH) set(gx, gy, T.GRASS);
  }

  // 14e. Scourge Pass — wider road junction, paved approach corridor, rubble
  set(66, 81, T.PATH); set(66, 82, T.PATH);    // widen road start near E-W artery
  // Dark stone paving in the visible pass corridor (currently bare GRASS)
  for (let y = 68; y <= 71; y++) { set(83, y, T.DFLOOR); set(84, y, T.DFLOOR); }
  // Rubble pile at the road's dead-end (just past the last cobblestone tile)
  set(77, 88, T.DFLOOR); set(78, 88, T.DFLOOR);

  // ── 15. WORLD POLISH PASS ─────────────────────────────────────────────────
  // All changes are additive — no PATH tiles removed, walkability preserved.

  // 15a. Road shoulder bleed — worn DGRASS beside main roads
  // N-S spine (x 50-51): inner shoulder x=49,52 at 30 %; outer x=48,53 at 10 %
  for (let y = 18; y <= 98; y++) {
    if (map[y][49] === T.GRASS && rng() < 0.30) set(49, y, T.DGRASS);
    if (map[y][52] === T.GRASS && rng() < 0.30) set(52, y, T.DGRASS);
    if (map[y][48] === T.GRASS && rng() < 0.10) set(48, y, T.DGRASS);
    if (map[y][53] === T.GRASS && rng() < 0.10) set(53, y, T.DGRASS);
  }
  // E-W artery (y 79-80): worn shoulders at y=78, 81
  for (let x = 5; x <= 76; x++) {
    if (map[78][x] === T.GRASS && rng() < 0.25) set(x, 78, T.DGRASS);
    if (map[81][x] === T.GRASS && rng() < 0.25) set(x, 81, T.DGRASS);
  }
  // Outpost perimeter — worn approach zone outside the ring road
  for (let x = 36; x <= 65; x++) {
    if (map[58][x] === T.GRASS && rng() < 0.32) set(x, 58, T.DGRASS); // north
    if (map[78][x] === T.GRASS && rng() < 0.32) set(x, 78, T.DGRASS); // south
  }
  // Farm field inner shoulder wear (1 tile east of each V-path)
  for (let y = 69; y <= 89; y++) {
    if (map[y][7]  === T.GRASS && rng() < 0.18) set(7,  y, T.DGRASS);
    if (map[y][13] === T.GRASS && rng() < 0.18) set(13, y, T.DGRASS);
    if (map[y][21] === T.GRASS && rng() < 0.18) set(21, y, T.DGRASS);
    if (map[y][29] === T.GRASS && rng() < 0.18) set(29, y, T.DGRASS);
  }

  // 15b. Ambient grass variation — extends step-12 coverage to other zones
  // North half of map (above step-12's y:62-99 range)
  for (let y = 17; y <= 61; y++)
    for (let x = 33; x <= 99; x++)
      if (map[y][x] === T.GRASS && rng() < 0.03) set(x, y, T.DGRASS);
  // East side (right of step-12's x:35-66 range)
  for (let y = 62; y <= 99; y++)
    for (let x = 67; x <= 99; x++)
      if (map[y][x] === T.GRASS && rng() < 0.03) set(x, y, T.DGRASS);

  // 15c. Water-body shore irregularity — organic overgrown edges
  // Serenity Pond (x:55-60, y:91-95): convert some sand bank tiles to DGRASS
  for (const [sx, sy] of [[54,91],[61,93],[60,94],[54,92],[55,90],[60,92]]) {
    if (map[sy]?.[sx] === T.SAND  || map[sy]?.[sx] === T.GRASS) set(sx, sy, T.DGRASS);
  }
  for (let x = 53; x <= 62; x++)
    if (map[90][x] === T.GRASS && rng() < 0.45) set(x, 90, T.DGRASS);
  // Farm fishing pond (x:17-20, y:71-73): overgrown west and east banks
  for (const [sx, sy] of [[15,71],[15,72],[15,73],[22,71],[22,72],[22,73]]) {
    if (map[sy]?.[sx] === T.GRASS) set(sx, sy, T.DGRASS);
  }

  // 15d. Outpost interior worn stone — DFLOOR accent tiles near inner walls
  for (let x = 39; x <= 62; x++) {
    if (map[62][x] === T.FLOOR && rng() < 0.20) set(x, 62, T.DFLOOR);  // N wall row
    if (map[75][x] === T.FLOOR && rng() < 0.20) set(x, 75, T.DFLOOR);  // S wall row
  }
  for (let y = 62; y <= 75; y++) {
    if (map[y][40] === T.FLOOR && rng() < 0.16) set(40, y, T.DFLOOR);  // W inner edge
    if (map[y][61] === T.FLOOR && rng() < 0.16) set(61, y, T.DFLOOR);  // E inner edge
  }
  // Worn corner aprons outside gate entries
  for (const [ox, oy] of [
    [38,58],[39,58],[62,58],[63,58],   // north entry
    [38,78],[39,78],[62,78],[63,78],   // south entry
  ]) { if (map[oy][ox] === T.GRASS) set(ox, oy, T.DGRASS); }

  // 15e. Quarry cracked rim — DFLOOR patches in tier-1 outer band (d 10–12)
  for (let y = 30; y <= 56; y++) {
    for (let x = 70; x <= 97; x++) {
      const dq = Math.abs(x - qcx) + Math.abs(y - qcy);
      if (dq >= 10 && dq <= 12 && map[y][x] === T.FLOOR && rng() < 0.12)
        set(x, y, T.DFLOOR);
    }
  }

  // 15f. Scourge Pass — ravine/crevice tease using terrain tiles only.
  //      The existing teaser road (step 13d) ends at x=78,y=87 with rubble.
  //      Here we turn one rubble tile into a bridge plank and open a dark
  //      crevice to its south, so the blocked pass reads as a dangerous drop
  //      rather than a flat wall.  Mountain ring at x=79+ stays the blocker.

  // Bridge plank: narrow one-tile PATH stub crossing toward the cliff face.
  // Overrides the DFLOOR rubble placed at (77,88) in step 14e.
  set(77, 88, T.PATH);

  // Dark crevice — DFLOOR void expanding south of the bridge approach.
  // DFLOOR is the darkest walkable tile (dungeon floor, near-black).
  // Players can enter but cannot pass the mountain wall beyond x=78.
  for (const [rx, ry] of [
    [75,88],                               // west ravine lip beside bridge
    [75,89],[76,89],[77,89],[78,89],       // ravine north edge
    [74,90],[75,90],[76,90],[77,90],       // ravine main floor
    [74,91],[75,91],[76,91],[77,91],       // ravine south
    [75,92],[76,92],                       // ravine deepest pocket
  ]) { if (map[ry]?.[rx] !== T.MOUNTAIN) set(rx, ry, T.DFLOOR); }

  // Narrow the approach channel with MOUNTAIN fingers to funnel attention
  // toward the bridge rather than the open grass around it.
  for (const [mx, my] of [
    [74,87],[73,88],[73,89],  // west finger
    [79,87],[79,88],          // east finger (redundant with mountain fill, safe)
  ]) { if (map[my]?.[mx] === T.GRASS || map[my]?.[mx] === T.DGRASS) set(mx, my, T.MOUNTAIN); }

  return map;
}

// ── BFS with caller-supplied walkable predicate (8-directional) ──────────────
// Diagonal steps require both cardinal neighbours to also be walkable so the
// player never clips through a 1-tile corner gap between two walls.
const DIRS8 = [[0,-1],[0,1],[-1,0],[1,0],[-1,-1],[1,-1],[-1,1],[1,1]];

function bfsWithFn(sx, sy, ex, ey, walkFn) {
  if (sx === ex && sy === ey) return [];
  if (!walkFn(ex, ey)) return null;
  const visited = new Map();
  visited.set(`${sx},${sy}`, null);
  const queue = [[sx, sy]];
  while (queue.length > 0) {
    const [cx, cy] = queue.shift();
    if (cx === ex && cy === ey) {
      const path = [];
      let key = `${ex},${ey}`;
      while (visited.get(key) !== null) {
        const [px, py] = key.split(',').map(Number);
        path.unshift({ x: px, y: py });
        key = visited.get(key);
      }
      return path;
    }
    for (const [dx, dy] of DIRS8) {
      const nx = cx + dx, ny = cy + dy, key = `${nx},${ny}`;
      if (visited.has(key) || !walkFn(nx, ny)) continue;
      // Diagonal corner-cut guard: both cardinal intermediates must be clear
      if (dx !== 0 && dy !== 0 && (!walkFn(cx + dx, cy) || !walkFn(cx, cy + dy))) continue;
      visited.set(key, `${cx},${cy}`);
      queue.push([nx, ny]);
    }
  }
  return null;
}

let _nextMonId = 1;

// ════════════════════════════════════════════════════════════════════════════
//  SCENE
// ════════════════════════════════════════════════════════════════════════════
export default class GameScene extends Phaser.Scene {
  constructor() { super({ key: 'GameScene' }); }

  preload() {
    this.load.spritesheet('male_sprites',   'assets/sprites/male_player_sprites_clean_10col.png',   { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('female_sprites', 'assets/sprites/female_player_sprites_clean_10col.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('chicken',    'assets/sprites/chicken.png',   { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('giant_rat',  'assets/sprites/giant_rat.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('ghoul',      'assets/sprites/ghoul.png',     { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('thornling',  'assets/sprites/thornling.png',  { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('hollowfolk', 'assets/sprites/hollowfolk.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('goblin1',    'assets/sprites/goblin1.png',   { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('skeleton1',  'assets/sprites/skeleton1.png',  { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('cow1',       'assets/sprites/cow1.png',       { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('dummy1',     'assets/sprites/dummy1.png',     { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('rockmite',   'assets/sprites/rockmite.png',   { frameWidth: 96, frameHeight: 96 });
    this.load.image('starter_shop', 'assets/sprites/starter_shop.png');
    this.load.on('filecomplete-spritesheet-cow1', () => {
      const img = this.textures.get('cow1').getSourceImage();
      console.log('[cow1] loaded texture size:', img.width + 'x' + img.height);
    });
    this.load.image('oak_tree',       'assets/sprites/Nature/Oak_Tree_Type_A.png');
    this.load.image('grey_rock',      'assets/sprites/Nature/Grey_Rock_Type_A.png');
    this.load.image('lush_bush',      'assets/sprites/Nature/Lush_Bush_Type_B.png');
    // Tiered resource sprites
    this.load.image('tree_lv1',       'assets/sprites/Nature/tree_lv1.png');
    this.load.image('ashwood',        'assets/sprites/Nature/ashwood.png');
    this.load.image('grimoak',        'assets/sprites/Nature/grimoak_128x128.png');
    this.load.image('deadwood',       'assets/sprites/Nature/deadwood_128x128.png');
    this.load.image('veilwood',       'assets/sprites/Nature/veilwood_128x128.png');
    this.load.image('copperstone',    'assets/sprites/Nature/copperstone_64x64.png');
    this.load.image('grimsteel_rock', 'assets/sprites/Nature/grimsteel_rock_64x64.png');
    this.load.image('ashstone',       'assets/sprites/Nature/ashstone_64x64.png');
    this.load.image('veilmetal',      'assets/sprites/Nature/veilmetal_64x64.png');
    this.load.image('redroot_bush',   'assets/sprites/Nature/redroot_bush_64x64.png');
    this.load.image('mooncap_bush',   'assets/sprites/Nature/mooncap_bush_64x64.png');
    this.load.image('stonecap_bush',  'assets/sprites/Nature/stonecap_bush_64x64.png');
    this.load.image('veilbloom_bush', 'assets/sprites/Nature/veilbloom_bush_64x64.png');
    // Item sprites (keyed as item_<id> — available for future UI integration)
    this.load.image('item_log',           'assets/items/log_32x32.png');
    this.load.image('item_ashwood_log',   'assets/items/ashwood_log_32x32.png');
    this.load.image('item_grimoak_log',   'assets/items/grimoak_log_32x32.png');
    this.load.image('item_deadwood_log',  'assets/items/deadwoodlog_32x32.png');
    this.load.image('item_veilwood_log',  'assets/items/veilwood_log_32x32.png');
    this.load.image('item_copperstone_ore','assets/items/copperstone_ore_32x32.png');
    this.load.image('item_grimsteel_ore', 'assets/items/grimsteel_ore_32x32.png');
    this.load.image('item_ashstone_ore',  'assets/items/ashstone_ore_32x32.png');
    this.load.image('item_veilstone_ore', 'assets/items/veilstone_ore_32x32.png');
    this.load.image('item_redroot',       'assets/items/redroot_herb_32x32.png');
    this.load.image('item_mooncap',       'assets/items/mooncap_shroom_32x32.png');
    this.load.image('item_stonecap',      'assets/items/stonecap_moss_32x32.png');
    this.load.image('item_veilbloom',     'assets/items/veilbloom_petal_32x32.png');
    this.load.image('item_raw_fish',           'assets/items/fish_32x32.png');
    this.load.image('item_saltfin_fish',       'assets/items/saltfin_fish_32x32.png');
    this.load.image('item_saltfin_cooked',     'assets/items/saltfin_cooked_32x32.png');
    this.load.image('item_grimscale_bass',     'assets/items/grimscale_bass_32x32.png');
    this.load.image('item_grimscale_bass_cooked', 'assets/items/grimscale_bass_cooked_32x32.png');
    this.load.image('item_cooked_fish',           'assets/items/cooked_fish_32x32.png');
    this.load.image('item_grim_ashes',            'assets/items/grim_ashes_32x32.png');
    this.load.image('item_gold_coin',             'assets/items/gold_coin_32x32.png');
    this.load.image('item_minor_healing_potion',  'assets/items/minor_healing_potion_32x32.png');
    this.load.image('item_focus_potion',          'assets/items/focus_potion_32x32.png');
    this.load.image('item_veil_elixir',           'assets/items/veil_elixir_32x32.png');
    this.load.image('item_paper_pages',           'assets/items/paper_pages_32x32.png');
    // Weapon icons
    this.load.image('item_rusty_sword',     'assets/items/rusty_sword_32x32.png');
    this.load.image('item_training_bow',    'assets/items/training_bow_32x32.png');
    this.load.image('item_cracked_staff',   'assets/items/cracked_staff_32x32.png');
    this.load.image('item_twig_totem',      'assets/items/twig_totem_32x32.png');
    this.load.image('item_grimsteel_sword', 'assets/items/grimsteel_sword_32x32.png');
    this.load.image('item_shortbow',        'assets/items/shortbow_32x32.png');
    this.load.image('item_apprentice_staff','assets/items/apprentice_staff_32x32.png');
    this.load.image('item_grimoak_totem',   'assets/items/grimoak_totem_32x32.png');
    this.load.image('campfire_spr', 'assets/sprites/Props_and_Loot/Campfire_Type_A.png');
    this.load.spritesheet('bonfire',       'assets/sprites/bonfire.png',       { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('saltfin_spot',        'assets/sprites/saltfin_spot.png',        { frameWidth: 48, frameHeight: 48 });
    this.load.spritesheet('grimscale_bass_spot', 'assets/sprites/grimscale_bass_spot.png', { frameWidth: 64, frameHeight: 64 });
    this.load.image('chest_spr',    'assets/sprites/Village_and_Camp/Wooden_Chest_Type_A.png');
    this.load.image('coin_spr',     'assets/sprites/Village_and_Camp/Gold_Coin_Type_A.png');
    // Cainos "Pixel Art Top Down - Basic" sheets — functional visual pass
    this.load.image('cainos_plant',  'assets/tilesets/cainos/Texture/TX Plant.png');
    this.load.image('cainos_props',  'assets/tilesets/cainos/Texture/TX Props.png');
    this.load.image('cainos_struct', 'assets/tilesets/cainos/Texture/TX Struct.png');
    this.load.image('cainos_wall',   'assets/tilesets/cainos/Texture/TX Tileset Wall.png');
    // Terrain texture sheets (16×16 frames, kept as alpha-blended fallbacks)
    this.load.spritesheet('cainos_grass', 'assets/tilesets/cainos/Texture/TX Tileset Grass.png',
      { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('cainos_stone', 'assets/tilesets/cainos/Texture/TX Tileset Stone Ground.png',
      { frameWidth: 16, frameHeight: 16 });
    // Sakpix terrain sheets — high-quality replacements (loaded as plain images,
    // cropped at runtime with texture.add() so no uniform grid is assumed).
    this.load.image('sakpix_grass',  'assets/tilesets/sakpix/sak_grass.png');
    this.load.image('sakpix_water',  'assets/tilesets/sakpix/sak_water.png');
    this.load.image('sakpix_rocks',  'assets/tilesets/sakpix/sak_rocks.png');
    this.load.image('sakpix_beach',  'assets/tilesets/sakpix/sak_beach.png');
    // Ability slot PNG icons
    this.load.image('ability_minor_heal',  'assets/icons/abilities/minor_heal.png');
    this.load.image('ability_shield',      'assets/icons/abilities/sheild.png');
    // Cache-bust: public/ assets aren't Vite-fingerprinted; ?v= forces a fresh fetch
    if (this.textures.exists('ability_enrage')) this.textures.remove('ability_enrage');
    this.load.image('ability_enrage',      'assets/icons/abilities/enrage.png?v=2');
    this.load.image('ability_stun_strike', 'assets/icons/abilities/stun_strike.png');
    this.load.image('ability_thrust',      'assets/icons/abilities/thrust.png');
    this.load.image('ability_quick_shot',  'assets/icons/abilities/quick_shot.png');
    this.load.image('ability_arc_burst',   'assets/icons/abilities/arc_burst.png');
    this.load.image('ability_root_snare',  'assets/icons/abilities/root_snare.png');
    this.load.image('mapbg',         'assets/grimfell_map_bg.png');
    this.load.image('alchemy_table',      'assets/sprites/alchemy_table.png');
    this.load.image('paper_press_broken', 'assets/sprites/paper_press_broken.png');
    this.load.image('paper_press_fixed',  'assets/sprites/paper_press_fixed.png');
    this.load.image('old_library',        'assets/sprites/old_library.png');
    // Tilemap alignment layer
    this.load.spritesheet('gf_tileset', 'assets/maps/tileset.png', { frameWidth: 32, frameHeight: 32 });
    this.load.json('gf_mapdata', 'assets/maps/grimfell_map.json');
  }

  create() {
    // ── Player data — restore from localStorage; migrate v4→v5 if needed ──
    this.playerData = new Player();
    const rawSave    = localStorage.getItem(SAVE_KEY);
    const legacySave = !rawSave ? localStorage.getItem('grimfell_v4') : null;
    const saveBlob   = rawSave ?? legacySave;

    if (saveBlob) {
      try {
        Player.fromJSON(JSON.parse(saveBlob), this.playerData);
        if (legacySave) {
          // v4→v5: preserve inventory/bank/skills/gear/XP/coins; only reset position
          const spawn = ZONES_CFG.overworld.playerStart;
          this.playerData.x = spawn.x;
          this.playerData.y = spawn.y;
          console.info('[save] Migrated grimfell_v4 → grimfell_v5; position reset to new spawn');
        }
      } catch (e) {
        console.warn('[save] Could not parse save — starting fresh:', e);
      }
      // One-time: grant starter weapons if player has none at all
      const STARTERS = ['rusty_sword', 'training_bow', 'cracked_staff', 'twig_totem'];
      const hasAny = STARTERS.some(k =>
        this.playerData.inventory.some(s => s && s.item === k) ||
        Object.values(this.playerData.gear).includes(k)
      );
      if (!hasAny) {
        STARTERS.forEach(k => this.playerData.addItem(k, 1));
        this._emitPlayerUpdate();
      }
    }

    // ── Dynamic layout (updated by UIScene panel editor) ──────────────────
    this._dyn = { TOP_H, BOTTOM_H, RIGHT_W };
    this.game.events.on('layout-update', (vals) => {
      if (vals.panels?.game) {
        // Panel-editor mode: set viewport directly from the 'game' panel rect
        const g = vals.panels.game;
        this.cameras.main.setViewport(g.x, g.y, g.w, g.h);
      } else {
        Object.assign(this._dyn, vals);
        this._updateViewport();
      }
    });

    // ── Combat state ───────────────────────────────────────────────────────
    this.combatTarget   = null;
    this.inCombat       = false;
    this.playerAtkTimer = 0;
    this.monAtkTimer    = 0;

    // ── Ability state ─────────────────────────────────────────────────────
    this.abilities = {
      Q: { cooldownUntil: 0, activeUntil: 0 },
      W: { cooldownUntil: 0, activeUntil: 0 },
      E: { cooldownUntil: 0, activeUntil: 0 },
      R: { cooldownUntil: 0, activeUntil: 0 },
      T: { cooldownUntil: 0, activeUntil: 0 },  // style-specific ability
    };
    this.stunNextAttack   = false;
    this.abilityGfx       = this.add.graphics().setDepth(12);
    this._abilityEmitTimer = 0;

    // ── Cook state ────────────────────────────────────────────────────────
    this._isCooking     = false;
    this._cookAllQueue  = null;   // { itemKey, remaining } while Cook All is running
    this._cookAllTimer  = null;

    // ── Gather state ───────────────────────────────────────────────────────
    this.isGathering    = false;
    this.gatherTarget   = null;   // resource object being gathered
    this.gatherTimer    = 0;      // elapsed ms in current gather cycle
    this.gatherDuration = 0;      // total ms for one gather (from RDEFS)

    this.map  = buildOverworld();
    console.log(`[map] buildOverworld: ${MAP_W * MAP_H} tiles`);

    // ── Layer 2: imported terrain preview (src/data/map_import_preview.json) ─
    // Generated by scripts/image-to-map.js from the reference PNG.
    // Applied after buildOverworld so the procedural base is always the foundation.
    // If the file is empty or its overrides array is absent the loop is a no-op.
    let _importApplied = 0;
    // TEMPORARILY DISABLED — uncomment to re-enable image-sampled terrain layer
    // for (const { x, y, tileId } of (MAP_IMPORT_PREVIEW?.overrides ?? [])) {
    //   if (x >= 0 && x < MAP_W && y >= 0 && y < MAP_H && tileId >= 0 && tileId <= 8) {
    //     this.map[y][x] = tileId;
    //     _importApplied++;
    //   }
    // }
    console.log(`[map] import preview: ${_importApplied} overrides applied (disabled)`);

    // ── Layer 3: manual editor overrides (src/data/map_overrides.json) ───────
    // Always applied last — manual editor fixes win over everything above.
    // Paste output from the in-game editor (P key) directly into that file.
    let _manualApplied = 0;
    for (const { x, y, tileId } of (MAP_OVERRIDES?.overrides ?? [])) {
      if (x >= 0 && x < MAP_W && y >= 0 && y < MAP_H && tileId >= 0 && tileId <= 8) {
        this.map[y][x] = tileId;
        _manualApplied++;
      }
    }
    console.log(`[map] manual overrides: ${_manualApplied} overrides applied`);

    // ── Collision overrides (src/data/collision_overrides.json) ────────────────
    // Walkability fixes independent of visual tile data.
    //   walkable:true  → force-open a normally blocked tile type (e.g. WATER)
    //   walkable:false → force-block a normally walkable tile type
    // Visual tile rendering is unaffected.
    this._collisionMap = new Map(
      (COLLISION_OVERRIDES?.overrides ?? []).map(({ x, y, walkable }) => [`${x},${y}`, walkable])
    );
    console.log(`[map] collision overrides: ${this._collisionMap.size} entries`);

    this.mapW = MAP_W;
    this.mapH = MAP_H;

    this.pendingAction = null;

    // ── Gather progress bar (hidden until gathering starts) ───────────────
    // Background rect (dark, slightly larger) + white fill rect (left-anchored)
    this.gatherBarBg   = this.add.rectangle(0, 0, 34, 6, 0x111111)
                           .setDepth(13).setVisible(false);
    this.gatherBarFill = this.add.rectangle(0, 0, 1, 4, 0xffffff)
                           .setOrigin(0, 0.5).setDepth(14).setVisible(false);

    // ── Concept art background (depth -1 — below all tile rendering) ─────
    const bg = this.add.image(0, 0, 'mapbg');
    bg.setOrigin(0, 0);
    bg.setDepth(-2);
    bg.setDisplaySize(MAP_W * TILE_SIZE, MAP_H * TILE_SIZE);

    // ── Tilemap alignment layer (depth 0.45, alpha 0.45) ─────────────────
    this._buildTilemapLayer();

    // ── Graphics layers ───────────────────────────────────────────────────
    this.tilesGfx     = this.add.graphics().setDepth(0);
    this.gridGfx      = this.add.graphics().setDepth(1);
    this.blockedGfx   = this.add.graphics().setDepth(1.5); // debug blocked-tile overlay (B key)
    this.iactGfx      = this.add.graphics().setDepth(2);
    this.resourcesGfx = this.add.graphics().setDepth(3);
    this.clickGfx     = this.add.graphics().setDepth(5);
    this.iactTexts    = [];
    this.iactImages   = [];

    // ── Training dummy animation — must be registered before _buildMonsters ─
    if (this.textures.exists('dummy1') && !this.anims.exists('training_dummy_idle')) {
      this.anims.create({
        key: 'training_dummy_idle',
        frames: this.anims.generateFrameNumbers('dummy1', { start: 0, end: 5 }),
        frameRate: 6,
        repeat: -1,
      });
      console.log('[dummy] training_dummy_idle registered, exists:', this.anims.exists('training_dummy_idle'));
    }

    // ── Bonfire animation ─────────────────────────────────────────────────
    if (this.textures.exists('bonfire') && !this.anims.exists('bonfire_anim')) {
      this.anims.create({
        key: 'bonfire_anim',
        frames: this.anims.generateFrameNumbers('bonfire', { start: 0, end: 5 }),
        frameRate: 8,
        repeat: -1,
      });
    }
    if (this.textures.exists('grimscale_bass_spot') && !this.anims.exists('grimscale_bass_spot_anim')) {
      this.anims.create({
        key: 'grimscale_bass_spot_anim',
        frames: [
          { key: 'grimscale_bass_spot', frame: 0 },
          { key: 'grimscale_bass_spot', frame: 1 },
          { key: 'grimscale_bass_spot', frame: 2 },
          { key: 'grimscale_bass_spot', frame: 2 },
          { key: 'grimscale_bass_spot', frame: 3 },
          { key: 'grimscale_bass_spot', frame: 0 },
        ],
        frameRate: 5,
        repeat: -1,
      });
    }
    if (this.textures.exists('saltfin_spot') && !this.anims.exists('saltfin_spot_anim')) {
      this.anims.create({
        key: 'saltfin_spot_anim',
        frames: [
          { key: 'saltfin_spot', frame: 0 },
          { key: 'saltfin_spot', frame: 1 },
          { key: 'saltfin_spot', frame: 2 },
          { key: 'saltfin_spot', frame: 2 },
          { key: 'saltfin_spot', frame: 3 },
          { key: 'saltfin_spot', frame: 0 },
        ],
        frameRate: 5,
        repeat: -1,
      });
    }

    // ── World data ────────────────────────────────────────────────────────
    this._buildInteractables();
    this._buildResources();
    this._buildMonsters();

    // ── Static draws ──────────────────────────────────────────────────────
    this._drawMap();
    this._drawGrid();
    this._drawInteractables();
    this._drawResources();
    this._drawTextureTiles();
    const USE_OLD_DECOR = false;
    if (USE_OLD_DECOR) {
      this._buildCainosDecor();
      this._buildQuarryDecor();
      this._buildOutpostClutter();
      this._buildOutpostIdentity();
    }

    // ── Player animations (both genders, prefixed keys) ───────────────────
    const DIRS = [['down', 0, 9], ['left', 10, 19], ['right', 20, 29], ['up', 30, 39]];
    for (const gender of ['male', 'female']) {
      const texKey = gender + '_sprites';
      for (const [dir, start, end] of DIRS) {
        const key = `${gender}_walk_${dir}`;
        if (!this.anims.exists(key)) {
          this.anims.create({
            key,
            frames: this.anims.generateFrameNumbers(texKey, { start, end }),
            frameRate: 8,
            repeat: -1,
          });
        }
      }
    }

    // ── Mob animations ────────────────────────────────────────────────────
    const MOB_ANIM_DIRS = [['down',0,9],['left',10,19],['right',20,29],['up',30,39]];

    // thornling + hollowfolk: frameRate 8 (registered before generic loop so loop skips them)
    for (const mtype of ['thornling', 'hollowfolk']) {
      if (!this.textures.exists(mtype)) continue;
      for (const [dir, start, end] of MOB_ANIM_DIRS) {
        const key = `${mtype}_walk_${dir}`;
        if (!this.anims.exists(key)) {
          this.anims.create({ key, frames: this.anims.generateFrameNumbers(mtype, { start, end }), frameRate: 8, repeat: -1 });
        }
      }
    }
    for (const [mtype, mtexKey] of Object.entries(MOB_SPRITE_MAP)) {
      if (!this.textures.exists(mtexKey)) continue;
      if (mtype === 'training_dummy') continue;  // single idle anim, handled below
      for (const [dir, start, end] of MOB_ANIM_DIRS) {
        const key = `${mtype}_walk_${dir}`;
        if (!this.anims.exists(key)) {
          this.anims.create({
            key,
            frames: this.anims.generateFrameNumbers(mtexKey, { start, end }),
            frameRate: 6,
            repeat: -1,
          });
        }
      }
    }
    // Training dummy — 6-frame idle wobble, no directional variants
    if (this.textures.exists('dummy1') && !this.anims.exists('training_dummy_idle')) {
      this.anims.create({
        key: 'training_dummy_idle',
        frames: this.anims.generateFrameNumbers('dummy1', { start: 0, end: 5 }),
        frameRate: 6,
        repeat: -1,
      });
    }

    // ── Player sprite — use saved position if available, else zone default ─
    const spawn      = ZONES_CFG.overworld.playerStart;
    this.playerTileX = this.playerData.x ?? spawn.x;
    this.playerTileY = this.playerData.y ?? spawn.y;
    this._playerFacing = 'down';

    const _gender  = this.playerData.appearance?.gender ?? 'male';
    const _texKey  = _gender + '_sprites';
    this.playerSprite = this.add.sprite(
      this.playerTileX * TILE_SIZE + TILE_SIZE / 2,
      this.playerTileY * TILE_SIZE + TILE_SIZE / 2,
      _texKey, 0
    ).setDepth(10).setScale(TILE_SIZE / 96);
    // Alias must be set before any method that references this.player
    this.player = this.playerSprite;
    this._setPlayerIdle();


    // ── Movement state ────────────────────────────────────────────────────
    this.path       = [];
    this.moving     = false;
    this.arrowDelay = 0;

    // ── Camera ────────────────────────────────────────────────────────────
    this._updateViewport();
    this.cameras.main.setBounds(0, 0, this.mapW * TILE_SIZE, this.mapH * TILE_SIZE);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(1.5);

    // ── Zoom controls ─────────────────────────────────────────────────────
    // +/= or numpad+ → zoom in   |   - or numpad- → zoom out
    // Mouse wheel zooms only when the pointer is inside the world viewport.
    const ZOOM_MIN  = 0.85, ZOOM_MAX = 3.0, ZOOM_STEP = 0.1;
    const _applyZoom = (delta) => {
      this.cameras.main.setZoom(
        Phaser.Math.Clamp(this.cameras.main.zoom + delta, ZOOM_MIN, ZOOM_MAX)
      );
    };
    this.input.keyboard.on('keydown', (e) => {
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      if (e.key === '=' || e.key === '+' || e.code === 'Equal' || e.code === 'NumpadAdd')
        _applyZoom(+ZOOM_STEP);
      else if (e.key === '-' || e.code === 'Minus' || e.code === 'NumpadSubtract')
        _applyZoom(-ZOOM_STEP);
    });
    this.input.on('wheel', (pointer, _o, _dx, dy) => {
      const cam = this.cameras.main;
      if (pointer.x < cam.x || pointer.x > cam.x + cam.width ||
          pointer.y < cam.y || pointer.y > cam.y + cam.height) return;
      _applyZoom(dy > 0 ? -ZOOM_STEP : +ZOOM_STEP);
    });

    // ── Input ─────────────────────────────────────────────────────────────
    this.cursors = this.input.keyboard.createCursorKeys();

    // Ability hotkeys — fire once per keypress (keydown, not held)
    this.input.keyboard.on('keydown-Q', () => this._useAbility('Q'));
    this.input.keyboard.on('keydown-W', () => this._useAbility('W'));
    this.input.keyboard.on('keydown-E', () => this._useAbility('E'));
    this.input.keyboard.on('keydown-R', () => this._useAbility('R'));
    this.input.keyboard.on('keydown-T', () => this._useStyleAbility());

    // Quickbar slot clicks from UIScene — identical path to keyboard hotkeys
    this.game.events.on('use-ability', (key) => {
      if (key === 'T') this._useStyleAbility();
      else             this._useAbility(key);
    });

    // Weapon quickbar — keys 1–5 (editor mode keeps its own keydown handler for 1-9)
    this.input.keyboard.on('keydown', (e) => {
      if (this._editorMode) return;
      const slot = '12345'.indexOf(e.key);
      if (slot >= 0) this._useHotbarSlot(slot);
    });

    // Weapon quickbar events from UIScene
    this.game.events.on('assign-hotbar', ({ slot, itemKey }) => {
      this.playerData.hotbar[slot] = itemKey;
      this._emitPlayerUpdate();
      const name = ITEMS_DATA[itemKey]?.name ?? itemKey;
      this._floatText(this.player.x, this.player.y - 44, `Slot ${slot + 1}: ${name}`, '#c9a84c', 1200);
    });
    this.game.events.on('use-hotbar', (slotIdx) => {
      this._useHotbarSlot(slotIdx);
    });

    this.input.keyboard.on('keydown-TAB', (e) => {
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return;
      e.preventDefault();
      if (this._editorMode) return;
      this._tabReacquireTarget();
    });

    // B/C — collision editor (dev only)
    this._showBlocked      = false;
    this._collisionEditMode = false;
    if (DEV_MODE) {
      this.input.keyboard.on('keydown-B', () => {
        this._showBlocked       = !this._showBlocked;
        this._collisionEditMode = this._showBlocked;
        // Disable tile editor if it was active — its HUD will be replaced by collision HUD
        if (this._collisionEditMode && this._editorMode) {
          this._editorMode = false;
        }
        this.editorCursorGfx.clear();
        this._drawBlockedOverlay();
        this._drawGrid();
        this.game.events.emit('editor-hud-visible', this._collisionEditMode);
        if (this._collisionEditMode) {
          this.game.events.emit('editor-hud-update', {
            lines: ['COLLISION EDIT', 'L-click: force-block', 'R-click: remove block', 'C: export to console', 'B: exit'],
            tileColor: 0xcc2222,
          });
        }
      });

      // C key — export collision overrides to console (copy → collision_overrides.json)
      this.input.keyboard.on('keydown-C', () => {
        if (!this._collisionEditMode) return;
        const overrides = [];
        this._collisionMap.forEach((walkable, key) => {
          const [x, y] = key.split(',').map(Number);
          overrides.push({ x, y, walkable });
        });
        overrides.sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x);
        console.log(JSON.stringify({ overrides }, null, 2));
        this._floatText(this.player.x, this.player.y - 44,
          `${overrides.length} collision entries — see console`, '#44cc88', 2500);
      });
    }

    // ── Dev tile editor ───────────────────────────────────────────────────────
    // F2 toggles editor mode.  Not wired to save/load or any gameplay system.
    this._editorMode       = false;
    this._editorTile       = T.GRASS;       // legacy — kept for safety, not used by F2 obj mode
    this.editorOverrides   = new Map();      // legacy tile overrides (unused when mapbg active)
    this._editorOrigMap    = this.map.map(r => [...r]); // legacy snapshot
    this._editorCursorTile = { x: -1, y: -1 };
    this.editorTilesGfx    = this.add.graphics().setDepth(0.6); // legacy (skipped when mapbg active)
    this.editorCursorGfx   = this.add.graphics().setDepth(16);
    // ── F2 Object Editor state ────────────────────────────────────────────────
    this._objEditorType    = '1';            // selected key into OBJ_TYPES
    this.placedObjects     = [];             // { type, x, y, blocking }
    this.placedObjGfx      = this.add.graphics().setDepth(3.5);
    this._loadPlacedObjects();
    // The visible HUD panel is rendered in UIScene (which always draws on top of
    // GameScene regardless of depth).  GameScene just emits events; UIScene renders.

    // Suppress browser context menu in editor or collision edit mode
    this.game.canvas.addEventListener('contextmenu', (e) => {
      if (this._editorMode || this._collisionEditMode) e.preventDefault();
    });

    if (DEV_MODE) {
      this.input.keyboard.on('keydown-F2', () => {
        this._editorMode = !this._editorMode;
        this.editorCursorGfx.clear();
        this.game.events.emit('editor-hud-visible', this._editorMode);
        if (this._editorMode) {
          this._stopCombat(); this._stopGathering();
          this.path = []; this.moving = false; this.pendingAction = null;
          this._updateEditorHUD();
        } else {
          console.log('[editor] OFF');
        }
        this._drawGrid(); // show grid in editor mode, clear it in normal mode
      });
    }

    // ── Dev helpers (only active in Vite dev server, stripped from production) ──
    if (DEV_MODE) {
      // F9 — give a test food bundle for mana/cooking testing
      this.input.keyboard.on('keydown-F9', () => {
        const BUNDLE = [
          ['cooked_fish',           5],
          ['saltfin_cooked',        5],
          ['grimscale_bass_cooked', 5],
        ];
        for (const [key, qty] of BUNDLE) {
          for (let i = 0; i < qty; i++) this.playerData.addItem(key, 1);
        }
        this._emitPlayerUpdate();
        this._floatText(this.player.x, this.player.y - 44, '[DEV] Food bundle added', '#ff44ff', 1800);
        console.log('[DEV] F9 food bundle granted:', BUNDLE.map(([k, q]) => `${q}× ${k}`).join(', '));
      });

      // window.gfGiveItem("cooked_fish", 5)  — console helper
      window.gfGiveItem = (itemKey, qty = 1) => {
        if (!ITEMS_DATA[itemKey]) { console.warn('[DEV] Unknown item:', itemKey); return; }
        for (let i = 0; i < qty; i++) this.playerData.addItem(itemKey, 1);
        this._emitPlayerUpdate();
        console.log(`[DEV] Gave ${qty}× ${itemKey}`);
      };
    }

    // F2 Object Editor — number keys 1-5 select object type, P exports.
    this.input.keyboard.on('keydown', (e) => {
      if (!this._editorMode) return;
      if (OBJ_TYPES[e.key]) {
        this._objEditorType = e.key;
        this._updateEditorHUD();
        this._floatText(this.player.x, this.player.y - 40, `Selected ${OBJ_TYPES[e.key].label}`, '#44ddff', 1000);
      }
      if (e.key === 'p' || e.key === 'P') {
        if (this.placedObjects.length === 0) {
          console.log('[obj-editor] No placed objects to export.');
          this._floatText(this.player.x, this.player.y - 40, 'Nothing to export', '#ff8844', 1200);
          return;
        }
        const sorted = [...this.placedObjects]
          .map(({ type, x, y, blocking }) => ({ type, x, y, blocking }))
          .sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x);
        console.log('[obj-editor] placed_objects.json:\n' + JSON.stringify({ objects: sorted }, null, 2));
        this._floatText(this.player.x, this.player.y - 40,
          `${sorted.length} object${sorted.length !== 1 ? 's' : ''} exported`, '#44dd88', 1400);
      }
    });

    // Pointermove: cursor highlight + drag-paint (left) / drag-revert (right).
    // Shift held → 3×3 brush outline and paint area.
    this.input.on('pointermove', (pointer) => {
      if (!this._editorMode) {
        this.editorCursorGfx.clear();
        // ── Collision edit mode cursor ────────────────────────────────────────
        if (this._collisionEditMode) {
          const _cw = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
          const _ctx = Math.floor(_cw.x / TILE_SIZE), _cty = Math.floor(_cw.y / TILE_SIZE);
          if (_ctx >= 0 && _ctx < this.mapW && _cty >= 0 && _cty < this.mapH) {
            this.editorCursorGfx.lineStyle(2, 0xff3333, 0.95);
            this.editorCursorGfx.strokeRect(_ctx * TILE_SIZE, _cty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          }
          return; // skip hover labels while editing collision
        }
        // ── Hover labels ─────────────────────────────────────────────────────
        if (this._worldMapOpen) { this.game.events.emit('hover-world', null); return; }
        const { width, height } = this.scale;
        const { TOP_H: _hTH, BOTTOM_H: _hBH, RIGHT_W: _hRW } = this._dyn;
        const inView = pointer.x >= MARGIN + JOURNAL_W + GAP
          && pointer.x <= MARGIN + JOURNAL_W + GAP + (width - _hRW - JOURNAL_W - GAP * 2 - MARGIN * 3)
          && pointer.y >= _hTH + MARGIN
          && pointer.y <= height - _hBH - MARGIN;
        if (!inView) { this.game.events.emit('hover-world', null); return; }
        const _hw = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const _htx = Math.floor(_hw.x / TILE_SIZE);
        const _hty = Math.floor(_hw.y / TILE_SIZE);
        let _htext = null;
        if (_htx >= 0 && _htx < this.mapW && _hty >= 0 && _hty < this.mapH) {
          const _hres = this.resources.find(r => r.x === _htx && r.y === _hty && !r.depleted);
          if (_hres) {
            const _hd = RDEFS[_hres.type];
            const _hsk = _hd.skill.charAt(0).toUpperCase() + _hd.skill.slice(1);
            _htext = `${_hd.label}\n${_hsk} Lv. ${_hd.lvlReq}`;
          } else {
            const _hmon = this.monsters.find(m => m.x === _htx && m.y === _hty && m.state !== 'dead');
            if (_hmon) {
              const _hdef = MONSTERS_DATA[_hmon.type];
              _htext = `${_hdef.label}\nCombat Lv. ${_hdef.level}`;
            } else {
              const _HINTS = { bank:'Store your items', shop:'Buy & sell gear', campfire:'Cook food', alchemy:'Brew potions', dungeon_entrance:'Enter the dungeon', dungeon_exit:'Return to surface', paper_press:'Press logs into paper', library:'Browse forgotten knowledge' };
              const _hiact = this.interactables.find(i => this._iactFootprint(i).some(t => t.x === _htx && t.y === _hty));
              if (_hiact) {
                const _hh = _HINTS[_hiact.type];
                _htext = _hh ? `${_hiact.label}\n${_hh}` : _hiact.label;
              }
            }
          }
        }
        this.game.events.emit('hover-world', _htext ? { text: _htext, sx: pointer.x, sy: pointer.y } : null);
        return;
      }
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const tx = Math.floor(world.x / TILE_SIZE);
      const ty = Math.floor(world.y / TILE_SIZE);
      this.editorCursorGfx.clear();
      // Track cursor tile and refresh HUD only when it moves to a new tile
      const _curMoved = this._editorCursorTile.x !== tx || this._editorCursorTile.y !== ty;
      this._editorCursorTile.x = tx;
      this._editorCursorTile.y = ty;
      if (_curMoved) this._updateEditorHUD();
      if (tx >= 0 && tx < this.mapW && ty >= 0 && ty < this.mapH) {
        const isRight = pointer.rightButtonDown();
        const outline = isRight ? 0x4488ff : 0x44ddff;
        this.editorCursorGfx.lineStyle(2, outline, 0.9);
        this.editorCursorGfx.strokeRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        if (pointer.isDown) {
          if (isRight) this._removeObject(tx, ty);
          else         this._placeObject(tx, ty);
        }
      }
    });

    this.input.on('pointerdown', (pointer) => {
      if (this._worldMapOpen) return;   // world map overlay is active — ignore all game clicks

      // ── Collision edit mode: left=force-block, right=remove override ──────
      if (this._collisionEditMode) {
        const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const tx = Math.floor(world.x / TILE_SIZE);
        const ty = Math.floor(world.y / TILE_SIZE);
        if (tx >= 0 && tx < this.mapW && ty >= 0 && ty < this.mapH) {
          const key = `${tx},${ty}`;
          if (pointer.rightButtonDown()) {
            const colOvr = this._collisionMap.get(key);
            if (colOvr === false) {
              // force-blocked override → remove it (tile goes back to natural state)
              this._collisionMap.delete(key);
            } else if (colOvr === true) {
              // already force-walkable → remove that override (back to natural blocked)
              this._collisionMap.delete(key);
            } else {
              // naturally blocked tile (MOUNTAIN etc.) with no override → force-open it
              this._collisionMap.set(key, true);
            }
          } else {
            this._collisionMap.set(key, false); // force-block regardless of tile type
          }
          this._drawBlockedOverlay();
        }
        return;
      }

      // ── Object editor: place / remove, skip all gameplay logic ─────────────
      if (this._editorMode) {
        const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const tx = Math.floor(world.x / TILE_SIZE);
        const ty = Math.floor(world.y / TILE_SIZE);
        if (tx >= 0 && tx < this.mapW && ty >= 0 && ty < this.mapH) {
          if (pointer.rightButtonDown()) this._removeObject(tx, ty);
          else                           this._placeObject(tx, ty);
        }
        return;
      }

      const { width, height } = this.scale;
      const { TOP_H: dTH, BOTTOM_H: dBH, RIGHT_W: dRW } = this._dyn;
      if (pointer.x < MARGIN + JOURNAL_W + GAP || pointer.x > MARGIN + JOURNAL_W + GAP + (width - dRW - JOURNAL_W - GAP * 2 - MARGIN * 3)) return;
      if (pointer.y < dTH + MARGIN || pointer.y > height - dBH - MARGIN) return;

      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const tx = Math.floor(world.x / TILE_SIZE);
      const ty = Math.floor(world.y / TILE_SIZE);
      if (tx < 0 || tx >= this.mapW || ty < 0 || ty >= this.mapH) return;

      this._flashTile(tx, ty);

      // Snap to nearest tile centre so the new BFS starts from where the
      // player visually is, not the last-completed tile behind them.
      this._snapToNearestTile();

      // Resource click
      const res = this.resources.find(r => r.x === tx && r.y === ty && !r.depleted);
      if (res) {
        this._stopGathering();  // cancel any current gather before re-targeting
        const route = this._pathAdj(tx, ty);
        if (route !== null) {
          if (route.length === 0) {
            this._startGathering(res);  // already adjacent — start immediately
          } else {
            this._stopCombat();
            this.path = route; this.moving = true;
            this.pendingAction = { type: 'gather', tx: res.x, ty: res.y, label: res.type };
          }
        }
        return;
      }

      // Monster click — start combat or path toward monster
      const mon = this.monsters.find(m => m.x === tx && m.y === ty && m.state !== 'dead');
      if (mon) {
        // Already fighting this monster and within range: let the auto-attack
        // timer tick on its own — re-clicking must NOT reset the timer.
        if (
          this.inCombat &&
          this.combatTarget?.id === mon.id &&
          this._isInCombatRange(mon.x, mon.y)
        ) return;

        // New target (or need to walk closer): stop previous combat, path to range
        this._stopCombat();
        const route = this._pathToRange(tx, ty);
        if (route !== null) {
          if (route.length === 0) {
            this._startCombat(mon);
          } else {
            this.path = route; this.moving = true;
            this.pendingAction = { type: 'combat', tx, ty, monId: mon.id };
          }
        }
        return;
      }

      // Interactable click
      const iact = this.interactables.find(i => this._iactFootprint(i).some(t => t.x === tx && t.y === ty));
      if (iact) {
        const route = this._pathAdjFootprint(this._iactFootprint(iact));
        if (route !== null) {
          if (route.length === 0) {
            if (iact.type === 'shop') this.game.events.emit('open-shop');
            else if (iact.type === 'bank') this.game.events.emit('open-bank');
            else if (iact.type === 'campfire') this._cookAtCampfire();
            else if (iact.type === 'alchemy')     this.game.events.emit('open-alchemy');
            else if (iact.type === 'paper_press') this.game.events.emit('open-paper-press');
            else if (iact.type === 'library')     this.game.events.emit('open-library');
          } else {
            this._stopCombat(); this._stopGathering();
            this.path = route; this.moving = true;
            this.pendingAction = { type: 'interact', tx: iact.x, ty: iact.y, iactType: iact.type };
          }
        }
        return;
      }

      // Plain tile walk
      let destX = tx, destY = ty;
      let route = this._isWalkable(tx, ty)
        ? bfsWithFn(this.playerTileX, this.playerTileY, tx, ty, (x, y) => this._isWalkable(x, y))
        : null;

      // Blocked or unreachable — find nearest walkable tile to the click
      if (route === null) {
        const alt = this._findNearestWalkable(tx, ty);
        if (alt) { destX = alt.x; destY = alt.y; route = alt.route; }
      }

      if (route && route.length > 0) {
        this._stopCombat(); this._stopGathering();
        this.path = route; this.moving = true; this.pendingAction = null;
        this._showDestMarker(destX, destY);
      }
    });

    this.scale.on('resize', () => this._updateViewport());

    // ── Save / load wiring ────────────────────────────────────────────────
    this.game.events.on('ui-save', () => this._saveGame());
    this.game.events.on('buy-item', ({ itemKey, price }) => {
      const coins = this.playerData.countItem('coins');
      if (coins < price) {
        this._floatText(this.player.x, this.player.y - 44, 'Not enough coins!', '#ff6644', 1400);
        return;
      }
      this.playerData.removeItem('coins', price);
      this.playerData.addItem(itemKey, 1);
      const name = ITEMS_DATA[itemKey]?.name ?? itemKey;
      this._floatText(this.player.x, this.player.y - 44, `Purchased ${name}`, '#f0d050', 1600);
      this._emitPlayerUpdate();
    });
    this.game.events.on('equip-item', (itemKey) => {
      const def = ITEMS_DATA[itemKey];
      // Cooked food — restores mana (focus), not HP
      if (def?.mana) {
        const pd = this.playerData;
        if ((pd.mana ?? 0) >= (pd.maxMana ?? 25)) {
          this._floatText(this.player.x, this.player.y - 44, 'Mana is full.', '#4488cc', 1200);
          return;
        }
        const before   = pd.mana ?? 0;
        pd.mana        = Math.min(pd.maxMana ?? 25, before + def.mana);
        const restored = pd.mana - before;
        if (def.freeAbility) pd.freeAbility = true;
        pd.removeItem(itemKey, 1);
        this._emitPlayerUpdate();
        this._floatText(this.player.x, this.player.y - 44, `+${restored} Mana`, '#4488ff', 1200);
        this._floatText(this.player.x, this.player.y - 58, def.name, '#88aadd', 900);
        if (def.freeAbility) this._floatText(this.player.x, this.player.y - 72, 'Next ability FREE!', '#aa66ff', 1600);
        return;
      }
      // Consumable — item has a heal value (potions, herbs)
      if (def?.heal) {
        this.playerData.removeItem(itemKey, 1);
        this.playerData.heal(def.heal);
        this._emitPlayerUpdate();
        this._floatText(this.player.x, this.player.y - 44,
          `+${def.heal} HP`, '#44cc88', 1200);
        this._floatText(this.player.x, this.player.y - 58,
          def.name, '#88ddaa', 900);
        return;
      }
      // Level requirement check
      if (def?.reqSkill && def?.reqLevel > 1) {
        const playerLv = this.playerData.skills[def.reqSkill]?.level ?? 1;
        if (playerLv < def.reqLevel) {
          this._floatText(this.player.x, this.player.y - 44,
            `Need ${def.reqSkill} Lv. ${def.reqLevel}`, '#ff6644', 1600);
          return;
        }
      }
      const result = this.playerData.equip(itemKey);
      if (result) {
        this._emitPlayerUpdate();
        this._emitAbilityUpdate();  // refresh T slot immediately when weapon changes
        this._floatText(this.player.x, this.player.y - 44, `Equipped ${result.name}`, '#e8c060', 1400);
      }
    });

    // Alchemy crafting — remove ingredients, add potion
    const ALCH_XP = {
      minor_healing_potion: 35,
      focus_potion:         45,
      veil_elixir:          70,
    };
    const ALCH_NAMES = {
      minor_healing_potion: 'Minor Healing Potion',
      focus_potion:         'Focus Potion',
      veil_elixir:          'Veil Elixir',
    };
    this.game.events.on('alch-craft', ({ recipe }) => {
      if (recipe === 'minor_healing_potion') {
        const pd = this.playerData;
        if (pd.countItem('redroot') < 1 || pd.countItem('mooncap') < 1) {
          this._floatText(this.player.x, this.player.y - 44, 'Missing ingredients', '#ff6644', 1400);
          return;
        }
        if (!pd.addItem('minor_healing_potion', 1)) {
          this._floatText(this.player.x, this.player.y - 44, 'Inventory full!', '#ff6644', 1400);
          return;
        }
        pd.removeItem('redroot', 1);
        pd.removeItem('mooncap', 1);
        const xpAmt  = ALCH_XP[recipe];
        const alchXp = pd.giveXP('alchemy', xpAmt);
        this._emitPlayerUpdate();
        this._floatText(this.player.x, this.player.y - 44, `Brewed ${ALCH_NAMES[recipe]}!`, '#aa88ff', 1600);
        this._floatText(this.player.x, this.player.y - 60, `+${xpAmt} Alchemy XP`, '#cc88ff', 1200);
        if (alchXp.leveledUp) {
          this._floatText(this.player.x, this.player.y - 74, 'ALCHEMY LV UP!', '#f0c050', 2200);
        }
        this.game.events.emit('chat-log', { text: `⚗️ Brewed a ${ALCH_NAMES[recipe]}! (+${xpAmt} Alchemy XP)`, cat: 'system' });
      }
      if (recipe === 'focus_potion') {
        const pd = this.playerData;
        if ((pd.skills.alchemy?.level ?? 1) < 5) {
          this._floatText(this.player.x, this.player.y - 44, 'Need Alchemy Lv. 5', '#ff6644', 1400);
          return;
        }
        if (pd.countItem('mooncap') < 1 || pd.countItem('stonecap') < 1) {
          this._floatText(this.player.x, this.player.y - 44, 'Missing ingredients', '#ff6644', 1400);
          return;
        }
        if (!pd.addItem('focus_potion', 1)) {
          this._floatText(this.player.x, this.player.y - 44, 'Inventory full!', '#ff6644', 1400);
          return;
        }
        pd.removeItem('mooncap', 1);
        pd.removeItem('stonecap', 1);
        const xpAmt  = ALCH_XP[recipe];
        const alchXp = pd.giveXP('alchemy', xpAmt);
        this._emitPlayerUpdate();
        this._floatText(this.player.x, this.player.y - 44, `Brewed ${ALCH_NAMES[recipe]}!`, '#aa88ff', 1600);
        this._floatText(this.player.x, this.player.y - 60, `+${xpAmt} Alchemy XP`, '#cc88ff', 1200);
        if (alchXp.leveledUp) this._floatText(this.player.x, this.player.y - 74, 'ALCHEMY LV UP!', '#f0c050', 2200);
        this.game.events.emit('chat-log', { text: `⚗️ Brewed a ${ALCH_NAMES[recipe]}! (+${xpAmt} Alchemy XP)`, cat: 'system' });
      }
      if (recipe === 'veil_elixir') {
        const pd = this.playerData;
        if ((pd.skills.alchemy?.level ?? 1) < 15) {
          this._floatText(this.player.x, this.player.y - 44, 'Need Alchemy Lv. 15', '#ff6644', 1400);
          return;
        }
        if (pd.countItem('veilbloom') < 1 || pd.countItem('mooncap') < 1 || pd.countItem('stonecap') < 1) {
          this._floatText(this.player.x, this.player.y - 44, 'Missing ingredients', '#ff6644', 1400);
          return;
        }
        if (!pd.addItem('veil_elixir', 1)) {
          this._floatText(this.player.x, this.player.y - 44, 'Inventory full!', '#ff6644', 1400);
          return;
        }
        pd.removeItem('veilbloom', 1);
        pd.removeItem('mooncap', 1);
        pd.removeItem('stonecap', 1);
        const xpAmt  = ALCH_XP[recipe];
        const alchXp = pd.giveXP('alchemy', xpAmt);
        this._emitPlayerUpdate();
        this._floatText(this.player.x, this.player.y - 44, `Brewed ${ALCH_NAMES[recipe]}!`, '#aa88ff', 1600);
        this._floatText(this.player.x, this.player.y - 60, `+${xpAmt} Alchemy XP`, '#cc88ff', 1200);
        if (alchXp.leveledUp) this._floatText(this.player.x, this.player.y - 74, 'ALCHEMY LV UP!', '#f0c050', 2200);
        this.game.events.emit('chat-log', { text: `⚗️ Brewed a ${ALCH_NAMES[recipe]}! (+${xpAmt} Alchemy XP)`, cat: 'system' });
      }
    });

    // ── Paper Press — repair and convert ──────────────────────────────────
    const PRESS_RECIPES = [
      { logKey: 'log',         logName: 'Log',         pagesOut: 4  },
      { logKey: 'ashwood_log', logName: 'Ashwood Log', pagesOut: 6  },
      { logKey: 'grimoak_log', logName: 'Grimoak Log', pagesOut: 8  },
      { logKey: 'deadwood_log',logName: 'Deadwood Log',pagesOut: 10 },
    ];
    this.game.events.on('paper-press-repair', () => {
      const pd = this.playerData;
      if (pd.countItem('log') < 10) {
        this._floatText(this.player.x, this.player.y - 44, 'Need 10 Logs to repair!', '#ff6644', 1600);
        return;
      }
      for (let i = 0; i < 10; i++) pd.removeItem('log', 1);
      pd.paperPressRepaired = true;
      this._saveGame();
      this._emitPlayerUpdate();
      this._drawInteractables();
      this._floatText(this.player.x, this.player.y - 44, 'The Paper Press hums back to life.', '#c8a060', 2000);
      this.game.events.emit('chat-log', { text: '🗜 Paper Press repaired!', cat: 'system' });
    });
    this.game.events.on('paper-press-convert', ({ logKey }) => {
      const pd  = this.playerData;
      const rec = PRESS_RECIPES.find(r => r.logKey === logKey);
      if (!rec || !pd.paperPressRepaired) return;
      const qty = pd.countItem(logKey);
      if (qty < 1) return;
      const pages = qty * rec.pagesOut;
      for (let i = 0; i < qty; i++) pd.removeItem(logKey, 1);
      pd.addItem('paper_pages', pages);
      this._emitPlayerUpdate();
      this._floatText(this.player.x, this.player.y - 44,
        `Pressed ${qty} ${rec.logName} → ${pages} Paper Pages`, '#c8a060', 1800);
    });

    // ── Campfire cook — called from UIScene cooking menu ─────────────────
    this.game.events.on('campfire-cook', ({ itemKey, qty = 1 }) => {
      if (!COOK_RECIPES[itemKey]) return;
      // Cancel any running queue first (prevents double-start)
      this._cancelCookQueue();
      if (qty <= 1) {
        this._doOneCook(itemKey);
      } else {
        // Start timed Cook All queue — one fish every 1000 ms
        this._cookAllQueue = { itemKey, remaining: qty, total: qty };
        this.game.events.emit('cook-queue-status', { itemKey, remaining: qty, total: qty });
        this._cookAllTimer = this.time.addEvent({
          delay: 1000, loop: true,
          callback: this._cookAllTick, callbackScope: this,
        });
      }
    });

    this.game.events.on('campfire-cancel-queue', () => this._cancelCookQueue());

    // ── Bank deposit ──────────────────────────────────────────────────────
    this.game.events.on('bank-deposit', ({ invIdx, page }) => {
      const pd   = this.playerData;
      const item = pd.inventory[invIdx] ?? null;
      if (!item) return;
      const def       = ITEMS_DATA[item.item];
      const stackable = !!(def?.stackable);
      const itemName  = def?.name ?? item.item;

      // For stackable items, merge into any existing bank stack first
      if (stackable) {
        const existing = pd.bank.find(s => s && s.item === item.item);
        if (existing) {
          existing.qty += item.qty;
          pd.inventory[invIdx] = null;
          while (pd.inventory.length > 0 && pd.inventory[pd.inventory.length - 1] === null) pd.inventory.pop();
          this._floatText(this.player.x, this.player.y - 44, `Deposited ${itemName}`, '#c9a84c', 1400);
          this._emitPlayerUpdate();
          return;
        }
      }

      // Find first free slot on current page, then anywhere
      const pageStart = (page ?? 0) * 50;
      let target = -1;
      for (let i = pageStart; i < pageStart + 50; i++) {
        if (pd.bank[i] === null) { target = i; break; }
      }
      if (target < 0) target = pd.bank.indexOf(null);
      if (target < 0) {
        this._floatText(this.player.x, this.player.y - 44, 'Bank is full!', '#ff6644', 1400);
        return;
      }
      pd.bank[target]      = { item: item.item, qty: item.qty };
      pd.inventory[invIdx] = null;
      while (pd.inventory.length > 0 && pd.inventory[pd.inventory.length - 1] === null) pd.inventory.pop();
      this._floatText(this.player.x, this.player.y - 44, `Deposited ${itemName}`, '#c9a84c', 1400);
      this._emitPlayerUpdate();
    });

    // ── Bank withdraw ─────────────────────────────────────────────────────
    this.game.events.on('bank-withdraw', ({ bankIdx }) => {
      const pd   = this.playerData;
      const item = pd.bank[bankIdx] ?? null;
      if (!item) return;
      const def       = ITEMS_DATA[item.item];
      const stackable = !!(def?.stackable);
      const itemName  = def?.name ?? item.item;

      // For stackable items, merge into existing inventory stack
      if (stackable) {
        const existing = pd.inventory.find(s => s && s.item === item.item);
        if (existing) {
          existing.qty += item.qty;
          pd.bank[bankIdx] = null;
          this._floatText(this.player.x, this.player.y - 44, `Withdrew ${itemName}`, '#44cc88', 1400);
          this._emitPlayerUpdate();
          return;
        }
      }

      const nonNull = pd.inventory.filter(Boolean).length;
      if (nonNull >= 28) {
        this._floatText(this.player.x, this.player.y - 44, 'Inventory full!', '#ff6644', 1400);
        return;
      }
      const nullIdx = pd.inventory.indexOf(null);
      if (nullIdx >= 0) {
        pd.inventory[nullIdx] = { item: item.item, qty: item.qty };
      } else {
        pd.inventory.push({ item: item.item, qty: item.qty });
      }
      pd.bank[bankIdx] = null;
      this._floatText(this.player.x, this.player.y - 44, `Withdrew ${itemName}`, '#44cc88', 1400);
      this._emitPlayerUpdate();
    });

    this.time.addEvent({ delay: 60000, loop: true, callback: () => this._saveGame() });
    // Save on page unload — catches browser refresh before auto-save fires
    this._boundSave = () => this._saveGame();
    window.addEventListener('beforeunload', this._boundSave);

    // World-map input gate — UIScene raises this flag when its overlay is open
    // so pointer events don't route the player while the map is visible.
    this._worldMapOpen = false;
    this.game.events.on('world-map-opened', () => { this._worldMapOpen = true;  });
    this.game.events.on('world-map-closed', () => { this._worldMapOpen = false; });
    // Respond to on-demand map-data requests — persistent so HMR / scene restarts
    // don't break the handoff the way a once('ui-ready') push would.
    this.game.events.on('request-map-data', () => {
      this.game.events.emit('map-data', {
        tiles:         this.map,
        interactables: this.interactables,
        resources:     this.resources,
      });
    });

    // UIScene runs create() AFTER GameScene, so a direct emit here is missed.
    // Instead, respond to ui-ready so UIScene pulls state once its listener is live.
    this.game.events.once('ui-ready', () => {
      this._emitPlayerUpdate();
      // Deferred emit — fires next tick after UIScene.create() fully completes
      this.time.delayedCall(0, () => this._emitPlayerUpdate());
      // Push static map data to UIScene — tile grid and interactables never change
      this.game.events.emit('map-data', {
        tiles:         this.map,
        interactables: this.interactables,
        resources:     this.resources,
      });
    });
  }

  // ── Save ─────────────────────────────────────────────────────────────────

  _saveGame() {
    // Sync tile position into playerData before serialising
    this.playerData.x = this.playerTileX;
    this.playerData.y = this.playerTileY;
    try {
      const saveData = this.playerData.toJSON();
      localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
      this.game.events.emit('save-complete');
    } catch (e) {
      console.warn('[save] Save failed:', e);
    }
  }

  // ── World builders ────────────────────────────────────────────────────────

  _buildInteractables() {
    this.interactables = ZONES_CFG.overworld.interactables.map(ia => ({ ...ia }));
  }

  _buildResources() {
    this.resources = [];
    for (const [type, coords] of Object.entries(ZONES_CFG.overworld.resources)) {
      const vis = RES_VIS[type];
      for (const [x, y] of coords) {
        const res = { type, x, y, depleted: false, image: null };
        if (vis?.spriteKey && this.textures.exists(vis.spriteKey)) {
          res.image = this.add.image(
            x * TILE_SIZE + TILE_SIZE / 2,
            y * TILE_SIZE + TILE_SIZE / 2,
            vis.spriteKey
          ).setDisplaySize(vis.sw ?? TILE_SIZE, vis.sh ?? TILE_SIZE).setDepth(3);
        } else if (vis?.animSpriteKey && this.textures.exists(vis.animSpriteKey)) {
          // Animated via setFrame timer — position never shifts between frames
          const img = this.add.image(
            x * TILE_SIZE + TILE_SIZE / 2,
            y * TILE_SIZE + TILE_SIZE / 2,
            vis.animSpriteKey, 0
          ).setDisplaySize(vis.sw ?? TILE_SIZE, vis.sh ?? TILE_SIZE).setDepth(3);
          const _frames = [0, 1, 2, 2, 3, 0];
          let _fi = 0;
          res._animTimer = this.time.addEvent({
            delay: 200, loop: true,
            callback: () => { if (!res.depleted) { _fi = (_fi + 1) % _frames.length; img.setFrame(_frames[_fi]); } },
          });
          res.image = img;
        }
        this.resources.push(res);
      }
    }
  }

  // ── Tilemap visual layer (alignment testing only — alpha 0.45) ───────────
  _buildTilemapLayer() {
    const mapData = this.cache.json.get('gf_mapdata');
    if (!mapData) { console.warn('[tilemap] gf_mapdata not found in cache'); return; }
    if (!this.textures.exists('gf_tileset')) { console.warn('[tilemap] gf_tileset texture not found'); return; }

    const tilesetTexture = this.textures.get('gf_tileset');
    const tilesetImg     = tilesetTexture.getSourceImage();
    const tileSize       = 32;
    const tilesetCols    = 30;

    const offscreen    = document.createElement('canvas');
    offscreen.width    = 3200;
    offscreen.height   = 3200;
    const ctx          = offscreen.getContext('2d');

    mapData.map.forEach((row, rowIndex) => {
      row.forEach((tileIndex, colIndex) => {
        const srcX = (tileIndex % tilesetCols) * tileSize;
        const srcY = Math.floor(tileIndex / tilesetCols) * tileSize;
        ctx.drawImage(tilesetImg, srcX, srcY, tileSize, tileSize,
          colIndex * tileSize, rowIndex * tileSize, tileSize, tileSize);
      });
    });

    this.textures.addCanvas('tilemapTex', offscreen);
    const tilemapImg = this.add.image(0, 0, 'tilemapTex');
    tilemapImg.setOrigin(0, 0);
    tilemapImg.setDepth(-1);
    tilemapImg.setAlpha(0.45);
    this.tilemapLayer = tilemapImg;
  }

  _buildMonsters() {
    this.monsters = [];
    for (const { type, spawns } of ZONES_CFG.overworld.monsters) {
      const def = MONSTERS_DATA[type];
      if (!def) continue;
      for (const [x, y] of spawns) {
        const mon = {
          id: _nextMonId++, type, x, y,
          spawnX: x, spawnY: y,
          hp: def.maxHp, maxHp: def.maxHp,
          state: 'idle',
          immortal: !!def.immortal,
          wanderTimer: 1500 + Math.random() * 2000,
          // CombatSystem expects these methods on the monster object
          takeDamage(amt) { this.hp = Math.max(0, this.hp - amt); },
          die()           { this.hp = 0; this.state = 'dead'; },
          reset()         {
            this.x = this.spawnX; this.y = this.spawnY;
            this.hp = this.maxHp; this.state = 'idle';
          },
        };
        const wx = Math.round(x * TILE_SIZE + TILE_SIZE / 2);
        const wy = Math.round(y * TILE_SIZE + TILE_SIZE / 2);
        const _monTex = MOB_SPRITE_MAP[type];
        mon.hasSprite = !!_monTex && this.textures.exists(_monTex);
        mon.facing    = 'down';
        if (mon.hasSprite) {
          // Nearest-neighbor filter prevents frame bleed on AI-rescaled sheets
          this.textures.get(_monTex).setFilter(Phaser.Textures.FilterMode.NEAREST);
          const [_dw, _dh] = MOB_DISPLAY_SIZE[type] ?? [TILE_SIZE, TILE_SIZE];
          mon.spriteBg = this.add.rectangle(wx, wy, 1, 1, 0x000000, 0).setDepth(6);
          mon.sprite   = this.add.sprite(wx, wy, _monTex, 0)
            .setDepth(7).setOrigin(0.5, 0.5).setDisplaySize(_dw, _dh);
          if (type === 'training_dummy') {
            console.log('[dummy] spawn play, anim exists:', this.anims.exists('training_dummy_idle'));
            if (this.anims.exists('training_dummy_idle')) mon.sprite.play('training_dummy_idle');
          }
        } else {
          console.log(`[mob fallback] type="${type}" id=${mon.id} tex="${_monTex ?? 'unmapped'}" texExists=${this.textures.exists(_monTex ?? '')}`);
          mon.spriteBg = this.add.rectangle(wx, wy, 26, 30, cssHex(def.col2 ?? def.col)).setDepth(6);
          mon.sprite   = this.add.rectangle(wx, wy, 24, 28, cssHex(def.col)).setDepth(7);
        }
        mon.hpBg     = this.add.rectangle(wx, wy - 22, 28, 5, 0x440000).setDepth(8);
        mon.hpFill   = this.add.rectangle(wx - 13, wy - 22, 26, 3, 0x22cc44)
                         .setOrigin(0, 0.5).setDepth(9);
        mon.lvlText  = this.add.text(wx, wy - 32, `Lv${def.level}`, {
          fontFamily: '"Press Start 2P", monospace', fontSize: '5px',
          color: '#ffffff', stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5, 1).setDepth(9);
        this.monsters.push(mon);
      }
    }
  }

  // ── Cainos functional decor ───────────────────────────────────────────────
  // Every sprite here clarifies a specific area: pen, outpost, pond, tutorial.
  // Depth 4 → above terrain/resources (0-3), below player/mobs (7-10).
  // No pathfinding, collision, or gameplay impact.
  _buildCainosDecor() {
    const ok = ['cainos_plant','cainos_props','cainos_struct']
      .every(k => this.textures.exists(k));
    if (!ok) return;

    const TS = TILE_SIZE;
    // ── Register named crop frames (idempotent — guards with .has()) ────────

    // TX Plant.png: grass tufts at bottom (y≈394) and a medium bush
    const plant = this.textures.get('cainos_plant');
    for (const [n, x, y, w, h] of [
      ['cai_tuft_a',   8,   394, 17, 9 ],
      ['cai_tuft_b',  41,   394, 16, 10],
      ['cai_tuft_c',  73,   394, 15, 10],
      ['cai_bush_md', 156,  190, 38, 32],
    ]) if (!plant.has(n)) plant.add(n, 0, x, y, w, h);

    // TX Props.png: thin fence posts (two variants)
    const props = this.textures.get('cainos_props');
    for (const [n, x, y, w, h] of [
      ['cai_post_a', 29, 166,  9, 53],
      ['cai_post_b', 57, 166,  9, 53],
    ]) if (!props.has(n)) props.add(n, 0, x, y, w, h);

    // TX Struct.png: stone arch gate + two wall-panel pillar variants
    const struct = this.textures.get('cainos_struct');
    for (const [n, x, y, w, h] of [
      ['cai_arch',   408, 27,  80, 64],   // stone doorway arch (top-right of sheet)
      ['cai_wall_a',  32, 32,  64, 96],   // clean stone wall panel
      ['cai_wall_b', 128, 32,  65, 96],   // second stone wall panel variant
    ]) if (!struct.has(n)) struct.add(n, 0, x, y, w, h);

    // Helper: place one sprite at tile-centre position
    const place = (tx, ty, key, frame, dw, dh, depth = 4) =>
      this.add.image(tx * TS + TS / 2, ty * TS + TS / 2, key, frame)
        .setDisplaySize(dw, dh).setDepth(depth);

    // ── A. PEN FENCE POSTS ──────────────────────────────────────────────────
    // Alternating post variants (a/b) along each PATH border of the pen.
    // Pen: x:34-46, y:82-92.  Gateway gap at x=40,41 on north border already
    // cleared to GRASS in terrain — skip those positions.
    const post = (i) => i % 2 === 0 ? 'cai_post_a' : 'cai_post_b';
    [34,36,38,42,44,46].forEach((x, i)  => place(x, 82, 'cainos_props', post(i),   8, 40)); // N
    [34,36,38,40,42,44,46].forEach((x, i) => place(x, 92, 'cainos_props', post(i), 8, 40)); // S
    [84, 87, 90].forEach((y, i)          => place(34, y,  'cainos_props', post(i),  8, 40)); // W
    [84, 87, 90].forEach((y, i)          => place(46, y,  'cainos_props', post(i+1),8, 40)); // E

    // ── B. OUTPOST SOUTH GATE ARCH ──────────────────────────────────────────
    // Gate tiles: (50,77) and (51,77).  Centre the arch between them.
    this.add.image((50 * TS + TS / 2 + 51 * TS + TS / 2) / 2, 77 * TS + TS / 2,
      'cainos_struct', 'cai_arch').setDisplaySize(80, 64).setDepth(4);

    // ── C. OUTPOST CORNER PILLARS ───────────────────────────────────────────
    // Stone wall-panel at the 4 corners of the outpost PATH ring.
    // Displayed at 1 × 1.5 tiles to read as corner tower/pillar.
    [[37,59,'cai_wall_a'],[64,59,'cai_wall_b'],
     [37,77,'cai_wall_a'],[64,77,'cai_wall_b']]
      .forEach(([cx, cy, f]) => place(cx, cy, 'cainos_struct', f, 32, 48));

    // ── D. POND EDGE GRASS TUFTS ────────────────────────────────────────────
    // Tiny reed/grass sprites on the sand bank tiles that ring the farm pond
    // (x:17-20, y:71-73 is the water; sand banks are the outer ring).
    const tufts = ['cai_tuft_a','cai_tuft_b','cai_tuft_c'];
    [[17,70],[18,70],[19,70],[20,70],   // north bank
     [17,74],[18,74],[19,74],[20,74],   // south bank
     [16,71],[16,72],[16,73],           // west bank
     [21,71],[21,72],[21,73]]           // east bank
      .forEach(([x,y], i) => place(x, y, 'cainos_plant', tufts[i % 3], 18, 12, 3.5));

    // ── E. TUTORIAL PATH FLANKING BUSHES ────────────────────────────────────
    // Two bushes just outside the tutorial arrival path (y=85, x=46-55) to
    // visually frame the corridor that leads the player north toward the outpost.
    // Placed on GRASS tiles (45,85) and (56,85), not on the PATH itself.
    place(45, 85, 'cainos_plant', 'cai_bush_md', 28, 22);
    place(56, 85, 'cainos_plant', 'cai_bush_md', 28, 22);
  }

  // ── Quarry Cainos decor ───────────────────────────────────────────────────
  // Visual-only sprites that reinforce the layered pit structure.
  // Centre (84,43), tier1=FLOOR d9-13, tier2=DFLOOR d4-8, pit d<4.
  // All positions verified against copper_rock / iron_rock resource tiles.
  _buildQuarryDecor() {
    if (!this.textures.exists('cainos_wall') || !this.textures.exists('cainos_props')) return;

    const TS = TILE_SIZE;

    // ── Crop frames from TX Tileset Wall.png (512×512) ───────────────────
    const wall = this.textures.get('cainos_wall');
    for (const [n, x, y, w, h] of [
      ['cai_cliff_h',   32,  192, 128, 64],  // wide horizontal stone ledge wall
      ['cai_cliff_v',  192,  192,  32, 64],  // narrow stone wall section
      ['cai_cliff_sq',  32,  288,  64, 64],  // square stone corner block A
      ['cai_cliff_sq2',128,  288,  64, 64],  // square stone corner block B
    ]) if (!wall.has(n)) wall.add(n, 0, x, y, w, h);

    // ── Crop frames from TX Props.png (512×512) ──────────────────────────
    const props = this.textures.get('cainos_props');
    for (const [n, x, y, w, h] of [
      ['cai_rock',    3,   430, 57, 42],   // large boulder
      ['cai_rock_md', 130, 484, 27, 22],   // medium rock chunk
      ['cai_peb_a',   68,  487, 24, 19],   // small pebble cluster A
      ['cai_peb_b',   100, 487, 24, 19],   // small pebble cluster B
      ['cai_peb_c',   10,  492, 11, 10],   // tiny pebble
    ]) if (!props.has(n)) props.add(n, 0, x, y, w, h);

    const place = (tx, ty, key, frame, dw, dh) =>
      this.add.image(tx * TS + TS / 2, ty * TS + TS / 2, key, frame)
        .setDisplaySize(dw, dh).setDepth(4);

    // ── A. Cliff ledge walls at tier 1/2 boundary (d ≈ 10–12) ────────────
    // Wide horizontal stone walls on N and S faces of quarry rim
    place(82, 35, 'cainos_wall', 'cai_cliff_h',   64, 32);  // N face left
    place(86, 35, 'cainos_wall', 'cai_cliff_h',   64, 32);  // N face right
    place(82, 51, 'cainos_wall', 'cai_cliff_h',   64, 32);  // S face left
    place(86, 51, 'cainos_wall', 'cai_cliff_h',   64, 32);  // S face right
    // Square corner blocks at the 4 diagonal quadrant edges
    place(90, 37, 'cainos_wall', 'cai_cliff_sq',  32, 32);  // NE corner
    place(78, 37, 'cainos_wall', 'cai_cliff_sq2', 32, 32);  // NW corner
    place(90, 49, 'cainos_wall', 'cai_cliff_sq',  32, 32);  // SE corner
    place(78, 49, 'cainos_wall', 'cai_cliff_sq2', 32, 32);  // SW corner
    // Narrow vertical sections on E and W equatorial faces
    place(92, 43, 'cainos_wall', 'cai_cliff_v',   22, 44);  // East
    place(76, 43, 'cainos_wall', 'cai_cliff_v',   22, 44);  // West

    // ── B. Large boulders in tier 2 (d 6–8, all clear of resource tiles) ─
    place(87, 39, 'cainos_props', 'cai_rock',    48, 36);
    place(81, 47, 'cainos_props', 'cai_rock',    48, 36);
    place(90, 45, 'cainos_props', 'cai_rock',    40, 30);
    place(78, 42, 'cainos_props', 'cai_rock',    40, 30);

    // ── C. Medium debris chunks on tier 1 & 2 (d 6–8) ───────────────────
    place(86, 39, 'cainos_props', 'cai_rock_md', 22, 18);
    place(82, 47, 'cainos_props', 'cai_rock_md', 22, 18);
    place(88, 41, 'cainos_props', 'cai_rock_md', 22, 18);
    place(80, 45, 'cainos_props', 'cai_rock_md', 22, 18);

    // ── D. Pebble scatter across quarry floor (tier 1/2) ─────────────────
    const pA = 'cai_peb_a', pB = 'cai_peb_b';
    [[85,37,pA],[86,37,pB],[83,45,pA],[87,44,pB],
     [80,39,pA],[89,41,pB],[85,49,pA],[82,41,pB]]
      .forEach(([x,y,fr]) => place(x, y, 'cainos_props', fr, 18, 13));

    // ── E. Tiny pebbles in the pit bottom (tier 3, d<4) ──────────────────
    [[83,43],[85,43],[84,41],[84,45]]
      .forEach(([x,y]) => place(x, y, 'cainos_props', 'cai_peb_c', 12, 10));
  }

  // ── Outpost building clutter ─────────────────────────────────────────────
  // Visual-only props (crates, barrels, pots) inside Grimfell Outpost floor.
  // All depth 4 — non-blocking, purely atmospheric.
  _buildOutpostClutter() {
    if (!this.textures.exists('cainos_props')) return;
    const TS = TILE_SIZE;
    const props = this.textures.get('cainos_props');
    // Bounding boxes measured from TX Props.png (512×512)
    for (const [n, x, y, ww, hh] of [
      ['cai_crate',  292, 19, 56, 41],   // wooden crate / storage box
      ['cai_barrel', 445, 21, 37, 72],   // tall barrel
      ['cai_pot',    453,118, 22, 37],   // small clay pot
    ]) if (!props.has(n)) props.add(n, 0, x, y, ww, hh);

    const pl = (tx, ty, frame, dw, dh) =>
      this.add.image(tx * TS + TS/2, ty * TS + TS/2, 'cainos_props', frame)
        .setDisplaySize(dw, dh).setDepth(4);

    // ── Crates near bank (42,65) ────────────────────────────────────────
    pl(41, 63, 'cai_crate',  30, 22);
    pl(43, 63, 'cai_crate',  28, 20);
    // ── Barrel + pot near shop (54,65) ──────────────────────────────────
    pl(56, 63, 'cai_barrel', 16, 32);
    pl(58, 64, 'cai_pot',    14, 22);
    // ── Camp supplies near campfire (49,67) ─────────────────────────────
    pl(47, 68, 'cai_crate',  28, 20);
    pl(51, 68, 'cai_barrel', 16, 32);
    // ── Wall-side storage ────────────────────────────────────────────────
    pl(40, 68, 'cai_pot',    14, 22);
    pl(61, 68, 'cai_crate',  30, 22);
  }

  // ── Outpost identity pass ────────────────────────────────────────────────
  // Transforms Grimfell Outpost from a flat rectangle into a fortified
  // settlement with wall segmentation, gate framing, building silhouettes,
  // and deliberately zoned interior clutter.
  //
  // Outpost layout reference:
  //   Floor  x:39-62, y:61-76  (FLOOR tiles)
  //   N wall y=59, W wall x=37, E wall x=64, S wall y=77  (PATH ring)
  //   N-S road at x=50-51 passes through the entire outpost vertically.
  //   Interactables: Bank(42,65) Shop(54-55,65-66) Campfire(49,67) Alchemy(54,68) Dungeon(50,78)
  //
  // All sprites: depth 4, non-blocking, purely visual.
  _buildOutpostIdentity() {
    if (!this.textures.exists('cainos_struct') || !this.textures.exists('cainos_props')) return;

    const TS = TILE_SIZE;
    const struct = this.textures.get('cainos_struct');
    const props  = this.textures.get('cainos_props');

    // ── New frame crops from TX Struct.png ──────────────────────────────────
    for (const [n, x, y, w, h] of [
      ['cai_arch2',     416, 128, 64, 64],   // second arch variant (below first)
      ['cai_wall_c',    224,  32, 65, 96],   // third clean stone wall panel
      ['cai_wall_crk',   32, 160, 64, 96],   // weathered / cracked wall panel A
      ['cai_wall_crk2', 128, 160, 65, 96],   // cracked wall panel B
      ['cai_wall_crk3', 224, 160, 65, 96],   // cracked wall panel C
    ]) if (!struct.has(n)) struct.add(n, 0, x, y, w, h);

    // Re-register props that may not have been defined yet (idempotent guard)
    for (const [n, x, y, w, h] of [
      ['cai_post_a',  29, 166,  9, 53],
      ['cai_post_b',  57, 166,  9, 53],
      ['cai_crate',  292,  19, 56, 41],
      ['cai_barrel', 445,  21, 37, 72],
      ['cai_pot',    453, 118, 22, 37],
    ]) if (!props.has(n)) props.add(n, 0, x, y, w, h);

    const place = (tx, ty, key, frame, dw, dh) =>
      this.add.image(tx * TS + TS / 2, ty * TS + TS / 2, key, frame)
        .setDisplaySize(dw, dh).setDepth(4);

    // ── 1. NORTH WALL SEGMENTATION ──────────────────────────────────────────
    // Stone wall panels between NW corner (37,59) and the N gate (x 50-51),
    // then between the gate and NE corner (64,59).  Gate flanked by posts.
    place(41, 59, 'cainos_struct', 'cai_wall_a',    32, 48);  // NW quarter panel
    place(46, 59, 'cainos_struct', 'cai_wall_b',    32, 48);  // NW panel 2
    place(55, 59, 'cainos_struct', 'cai_wall_a',    32, 48);  // NE panel 1
    place(60, 59, 'cainos_struct', 'cai_wall_c',    32, 48);  // NE corner panel
    place(48, 59, 'cainos_props',  'cai_post_a',    10, 44);  // gate west post
    place(53, 59, 'cainos_props',  'cai_post_b',    10, 44);  // gate east post
    // Arch over north gate (second variant, slightly smaller than south)
    this.add.image((50 * TS + TS / 2 + 51 * TS + TS / 2) / 2, 59 * TS + TS / 2,
      'cainos_struct', 'cai_arch2').setDisplaySize(64, 52).setDepth(4);

    // ── 2. SOUTH WALL SEGMENTATION ──────────────────────────────────────────
    // Mirrors north wall layout.  South gate already has arch from _buildCainosDecor.
    place(41, 77, 'cainos_struct', 'cai_wall_crk',  32, 48);  // SW panel (weathered)
    place(46, 77, 'cainos_struct', 'cai_wall_crk2', 32, 48);  // SW panel 2
    place(55, 77, 'cainos_struct', 'cai_wall_crk3', 32, 48);  // SE panel 1
    place(60, 77, 'cainos_struct', 'cai_wall_crk2', 32, 48);  // SE corner panel
    place(48, 77, 'cainos_props',  'cai_post_b',    10, 44);  // gate west post
    place(53, 77, 'cainos_props',  'cai_post_a',    10, 44);  // gate east post

    // ── 3. EAST & WEST WALL POSTS ────────────────────────────────────────────
    // Alternating posts along both vertical walls to break flat lines.
    [62, 66, 70, 74].forEach((y, i) => {
      place(37, y, 'cainos_props', i % 2 === 0 ? 'cai_post_a' : 'cai_post_b', 8, 40);
      place(64, y, 'cainos_props', i % 2 === 1 ? 'cai_post_a' : 'cai_post_b', 8, 40);
    });

    // ── 4. BANK BUILDING SILHOUETTE (42,65) ──────────────────────────────────
    // Weathered stone panels north of bank give it an anchored "building" feel.
    // Positioned at y=62, one row above the existing crates at y=63.
    place(41, 62, 'cainos_struct', 'cai_wall_crk',  32, 48);
    place(43, 62, 'cainos_struct', 'cai_wall_crk2', 32, 48);

    // ── 5. SHOP BUILDING SILHOUETTE (54-55,65-66) ────────────────────────────
    // Matching panels north of shop, also at y=62 above existing barrel at y=63.
    place(56, 62, 'cainos_struct', 'cai_wall_crk',  32, 48);
    place(58, 62, 'cainos_struct', 'cai_wall_crk3', 32, 48);

    // ── 6. STORAGE ZONE (N section y:61-64) ─────────────────────────────────
    // Heavy supply stacks near N gate inside both corners — first thing seen
    // when entering from north.
    place(39, 62, 'cainos_props', 'cai_crate',  28, 22);
    place(39, 64, 'cainos_props', 'cai_barrel', 14, 32);
    place(62, 62, 'cainos_props', 'cai_crate',  28, 22);
    place(62, 64, 'cainos_props', 'cai_barrel', 14, 32);

    // ── 7. CAMPFIRE / COMMON AREA (centre y:67-70) ───────────────────────────
    // Log-seat style crates flank the campfire (49,67) to make it a gathering point.
    // Pots placed south of campfire suggest cook-fire supplies.
    place(46, 67, 'cainos_props', 'cai_crate',  22, 16);  // seat west
    place(52, 67, 'cainos_props', 'cai_crate',  22, 16);  // seat east
    place(49, 69, 'cainos_props', 'cai_pot',    14, 20);  // pot S-W campfire
    place(51, 70, 'cainos_props', 'cai_pot',    14, 20);  // pot S-E campfire

    // ── 8. SOUTH REST ZONE (y:73-76) ─────────────────────────────────────────
    // Lighter, quieter corner storage — travellers' supplies near south exit.
    place(39, 73, 'cainos_props', 'cai_pot',    14, 22);
    place(39, 75, 'cainos_props', 'cai_crate',  24, 18);
    place(62, 73, 'cainos_props', 'cai_pot',    14, 22);
    place(62, 75, 'cainos_props', 'cai_crate',  24, 18);

    // ── 9. SOUTH ENTRANCE APPROACH ───────────────────────────────────────────
    // Bushes framing the road between the E-W artery (y=79) and south gate
    // (y=77).  Placed on GRASS/DGRASS tiles at y=78 — separate from the
    // tutorial bushes which are further south at y=85.
    if (this.textures.exists('cainos_plant')) {
      const plant = this.textures.get('cainos_plant');
      if (!plant.has('cai_bush_md')) plant.add('cai_bush_md', 0, 156, 190, 38, 32);
      place(48, 78, 'cainos_plant', 'cai_bush_md', 22, 16);
      place(53, 78, 'cainos_plant', 'cai_bush_md', 22, 16);
    }
  }

  // ── Terrain texture overlay ──────────────────────────────────────────────
  // Renders Sakpix terrain tiles (alpha-blended over the base colour layer at
  // depth 0), so the colour rects always act as a graceful fallback.
  //
  // Crop coordinates were measured pixel-by-pixel from each showcase sheet.
  // Tile variant uses (tx*7 + ty*13) deterministic hash — stable across loads.
  //
  // Priority: Sakpix → Cainos (legacy grass/stone) → base colour only.
  _drawTextureTiles() {
    if (this.textures.exists('mapbg')) return;

    const TS = TILE_SIZE;

    // ── Sakpix texture existence flags ──────────────────────────────────────
    const SAK_G = this.textures.exists('sakpix_grass');
    const SAK_W = this.textures.exists('sakpix_water');
    const SAK_R = this.textures.exists('sakpix_rocks');
    const SAK_B = this.textures.exists('sakpix_beach');
    const cG    = this.textures.exists('cainos_grass');
    const cS    = this.textures.exists('cainos_stone');
    if (!SAK_G && !SAK_W && !SAK_R && !SAK_B && !cG && !cS) return;

    // Nearest-neighbour filter on every sheet (keeps pixel art crisp when
    // tiles are scaled from their native ~200 px down to our 32 px game size).
    ['sakpix_grass','sakpix_water','sakpix_rocks','sakpix_beach',
     'cainos_grass','cainos_stone'].forEach(k => {
      if (this.textures.exists(k))
        this.textures.get(k).setFilter(Phaser.Textures.FilterMode.NEAREST);
    });

    // ── Named crop frames (idempotent .has() guards) ─────────────────────────
    // Coordinates measured from pixel transitions between showcase background
    // and tile content areas.  Each crop is ONE complete tile graphic.
    //
    // sak_grass (1672×941):
    //   Row 1 y=110 h=208 — 6 green grass variants
    //   Row 2 y=350 h=203 — 3 earthy dirt variants (PATH fallback)
    if (SAK_G) {
      const g = this.textures.get('sakpix_grass');
      for (const [n,x,y,w,h] of [
        ['sak_g1',  69, 110, 212, 208],
        ['sak_g2', 327, 110, 214, 208],
        ['sak_g3', 587, 110, 220, 208],
        ['sak_g4', 857, 110, 217, 208],
        ['sak_g5',1125, 110, 217, 208],
        ['sak_g6',1394, 110, 207, 208],
        ['sak_d1',  69, 350, 212, 203],
        ['sak_d2', 327, 350, 214, 203],
        ['sak_d3', 587, 350, 220, 203],
      ]) if (!g.has(n)) g.add(n, 0, x, y, w, h);
    }

    // sak_water (1535×1024):
    //   Row 1 y=114 h=228 — 4 sparkle-water variants
    //   Row 3 y=720 h=253 — calmer/deeper water
    if (SAK_W) {
      const wt = this.textures.get('sakpix_water');
      for (const [n,x,y,w,h] of [
        ['sak_w1',  34, 114, 240, 228],
        ['sak_w2', 317, 114, 259, 228],
        ['sak_w3', 620, 114, 263, 228],
        ['sak_w4', 926, 114, 268, 228],
        ['sak_w5',  34, 720, 240, 253],
      ]) if (!wt.has(n)) wt.add(n, 0, x, y, w, h);
    }

    // sak_rocks (1535×1024):
    //   Row 5 y=758 h=183 — 3 flat cracked-stone tiles
    //   (MOUNTAIN at higher alpha, FLOOR/DFLOOR progressively more transparent
    //    so the warm/dark base colour bleeds through for correct tone)
    if (SAK_R) {
      const r = this.textures.get('sakpix_rocks');
      for (const [n,x,y,w,h] of [
        ['sak_r1',  55, 758, 180, 183],
        ['sak_r2', 274, 758, 191, 183],
        ['sak_r3', 500, 758, 190, 183],
      ]) if (!r.has(n)) r.add(n, 0, x, y, w, h);
    }

    // sak_beach (1535×1024):
    //   Row 1 y=125 h=182 — pure sandy tiles for SAND terrain
    if (SAK_B) {
      const b = this.textures.get('sakpix_beach');
      for (const [n,x,y,w,h] of [
        ['sak_s1',  27, 125, 172, 182],
        ['sak_s2', 640, 125, 173, 182],
      ]) if (!b.has(n)) b.add(n, 0, x, y, w, h);
    }

    // ── Tile-type → [texKey, frameNames[], blendAlpha] ──────────────────────
    // Sakpix preferred; Cainos 16×16 indices used as secondary fallback.
    const TEX = {
      [T.GRASS]:    SAK_G ? ['sakpix_grass', ['sak_g1','sak_g2','sak_g3','sak_g4'],           0.82]
                  : cG   ? ['cainos_grass',  [29,43,56,90,120,127],                           0.35] : null,

      [T.DGRASS]:   SAK_G ? ['sakpix_grass', ['sak_g3','sak_g4','sak_g5','sak_g6'],           0.87]
                  : cG   ? ['cainos_grass',  [29,43,56,90,120,127],                           0.48] : null,

      // PATH uses plain earthy dirt tiles from the Sakpix Grass & Dirt sheet
      // (row 2: sandy/cobbled dirt, no decorative routing edges).
      // Cainos olive-hued dirt frames serve as secondary fallback.
      [T.PATH]:     SAK_G ? ['sakpix_grass',  ['sak_d1','sak_d2','sak_d3'],                   0.68]
                  : cG   ? ['cainos_grass',  [133,144,162,175,211,234],                       0.60] : null,

      [T.WATER]:    SAK_W ? ['sakpix_water', ['sak_w1','sak_w2','sak_w3','sak_w4'],           0.88] : null,

      [T.SAND]:     SAK_B ? ['sakpix_beach', ['sak_s1','sak_s2'],                             0.85] : null,

      [T.MOUNTAIN]: SAK_R ? ['sakpix_rocks', ['sak_r1','sak_r2','sak_r3'],                   0.72]
                  : cS   ? ['cainos_stone',  [80,85,86,87,112,117],                           0.55] : null,

      [T.FLOOR]:    SAK_R ? ['sakpix_rocks', ['sak_r1','sak_r2','sak_r3'],                   0.58]
                  : cS   ? ['cainos_stone',  [17,18,19,33,34,35],                             0.50] : null,

      [T.DFLOOR]:   SAK_R ? ['sakpix_rocks', ['sak_r1','sak_r2','sak_r3'],                   0.40]
                  : cS   ? ['cainos_stone',  [85,86,87,117,118,119],                          0.30] : null,
      // T.WALL keeps base colour only (tile is extremely rare).
    };

    for (let ty = 0; ty < this.mapH; ty++) {
      for (let tx = 0; tx < this.mapW; tx++) {
        const cfg = TEX[this.map[ty][tx]];
        if (!cfg) continue;
        const [key, frames, alpha] = cfg;
        const frame = frames[((tx * 7 + ty * 13) >>> 0) % frames.length];
        this.add.image(tx * TS + TS / 2, ty * TS + TS / 2, key, frame)
          .setDisplaySize(TS, TS)
          .setAlpha(alpha)
          .setDepth(0.5);
      }
    }
  }

  // ── Draw helpers ──────────────────────────────────────────────────────────

  _drawMap() {
    const g = this.tilesGfx; g.clear();
    if (this.textures.exists('mapbg')) return;
    for (let y = 0; y < this.mapH; y++) {
      for (let x = 0; x < this.mapW; x++) {
        const t = this.map[y][x];
        g.fillStyle((x + y) % 2 === 0 ? TC[t] : TC_ALT[t], 1);
        g.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  _drawBlockedOverlay() {
    const g = this.blockedGfx; g.clear();
    if (!this._showBlocked) return;
    for (let ty = 0; ty < this.mapH; ty++) {
      for (let tx = 0; tx < this.mapW; tx++) {
        const colOvr = this._collisionMap?.get(`${tx},${ty}`);
        if (colOvr === false) {
          // Force-blocked override — bright red, R-click removes override
          g.fillStyle(0xff2222, 0.50);
          g.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        } else if (colOvr === true) {
          // Force-walkable override on a naturally-blocked tile — blue-green, R-click removes it
          g.fillStyle(0x22ccaa, 0.35);
          g.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        } else if (!WALKABLE.has(this.map[ty][tx])) {
          // Naturally blocked (MOUNTAIN/WATER/WALL) — dim orange, R-click adds walkable:true
          g.fillStyle(0xcc6600, 0.28);
          g.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
      }
    }
  }

  _drawGrid() {
    const g = this.gridGfx; g.clear();
    if (!this._editorMode) return;
    g.lineStyle(1, 0x000000, 0.08);
    for (let x = 0; x <= this.mapW; x++)
      g.lineBetween(x * TILE_SIZE, 0, x * TILE_SIZE, this.mapH * TILE_SIZE);
    for (let y = 0; y <= this.mapH; y++)
      g.lineBetween(0, y * TILE_SIZE, this.mapW * TILE_SIZE, y * TILE_SIZE);
  }

  _drawInteractables() {
    const g = this.iactGfx; g.clear();
    this.iactTexts.forEach(t => t.destroy()); this.iactTexts = [];
    this.iactImages.forEach(i => i.destroy()); this.iactImages = [];
    for (const iact of this.interactables) {
      const px = iact.x * TILE_SIZE, py = iact.y * TILE_SIZE;
      // Campfire: static first frame of bonfire sheet
      if (iact.type === 'campfire' && this.textures.exists('bonfire')) {
        this.iactImages.push(
          this.add.image(px + TILE_SIZE / 2, py + TILE_SIZE / 2, 'bonfire', 0)
            .setDisplaySize(48, 48).setDepth(2)
        );
      } else if (iact.type === 'paper_press') {
        const sKey = this.playerData.paperPressRepaired ? 'paper_press_fixed' : 'paper_press_broken';
        if (this.textures.exists(sKey)) {
          this.iactImages.push(
            this.add.image(px + TILE_SIZE / 2, py + TILE_SIZE / 2, sKey)
              .setDisplaySize(48, 48).setDepth(2)
          );
        } else {
          const col = IACT_COLORS.paper_press, sz = 22, off = (TILE_SIZE - sz) / 2;
          g.fillStyle(col, 0.85); g.fillRect(px + off, py + off, sz, sz);
          g.lineStyle(1, 0x000000, 0.6); g.strokeRect(px + off, py + off, sz, sz);
        }
      } else if (iact.type === 'library') {
        if (this.textures.exists('old_library')) {
          this.iactImages.push(
            this.add.image(px + TILE_SIZE * 1.5, py + TILE_SIZE * 1.5, 'old_library')
              .setDisplaySize(96, 96).setDepth(2)
          );
        } else {
          const col = IACT_COLORS.library;
          g.fillStyle(col, 0.80);   g.fillRect(px, py, TILE_SIZE * 3, TILE_SIZE * 3);
          g.lineStyle(2, 0x000000, 0.55); g.strokeRect(px, py, TILE_SIZE * 3, TILE_SIZE * 3);
        }
      } else {
      const iSprKey = IACT_SPRITE_MAP[iact.type];
      if (iSprKey && this.textures.exists(iSprKey)) {
        const isAlchemy = iact.type === 'alchemy';
        const iSprW = iact.type === 'shop' ? TILE_SIZE * 2 : isAlchemy ? 64 : TILE_SIZE;
        const iSprH = iact.type === 'shop' ? TILE_SIZE * 2 : isAlchemy ? 64 : TILE_SIZE;
        const iSprX = iact.type === 'shop' ? px + TILE_SIZE : px + TILE_SIZE / 2;
        const iSprY = iact.type === 'shop' ? py + TILE_SIZE : py + TILE_SIZE / 2;
        this.iactImages.push(
          this.add.image(iSprX, iSprY, iSprKey)
            .setDisplaySize(iSprW, iSprH).setDepth(isAlchemy ? 3 : 2)
        );
      } else if (iact.type !== 'shop') {
        const col = IACT_COLORS[iact.type] ?? 0xaaaaaa, sz = 22, off = (TILE_SIZE - sz) / 2;
        g.fillStyle(col, 0.85); g.fillRect(px + off, py + off, sz, sz);
        g.lineStyle(1, 0x000000, 0.6); g.strokeRect(px + off, py + off, sz, sz);
      }
      } // end campfire else

      // Label — centred over the footprint
      const labelCx = iact.type === 'library'
        ? px + TILE_SIZE * 1.5
        : px + TILE_SIZE / 2;
      const labelCy = iact.type === 'library' ? py - 2 : py - 2;
      this.iactTexts.push(
        this.add.text(labelCx, labelCy, iact.label,
          { fontFamily: '"Press Start 2P", monospace', fontSize: '5px',
            color: '#ffffff', stroke: '#000000', strokeThickness: 2 })
          .setOrigin(0.5, 1).setDepth(4)
      );
    }
  }

  _drawResources() {
    const g = this.resourcesGfx; g.clear();
    for (const res of this.resources) {
      const vis = RES_VIS[res.type]; if (!vis) continue;
      const cx = res.x * TILE_SIZE + TILE_SIZE / 2;
      const cy = res.y * TILE_SIZE + TILE_SIZE / 2;
      // Sprite resources: toggle visibility, draw depletion stub on graphics layer
      if (res.image) {
        res.image.setVisible(!res.depleted);
        if (res.depleted) { g.fillStyle(0x888888, 0.3); g.fillCircle(cx, cy, 8); }
        continue;
      }
      if (res.depleted) { g.fillStyle(0x888888, 0.3); g.fillCircle(cx, cy, 8); continue; }
      if (vis.shape === 'tree') {
        g.fillStyle(0x000000, 0.18); g.fillEllipse(cx+2, cy+vis.r-2, vis.r*1.4, vis.r*0.7);
        g.fillStyle(vis.trunk,  1);  g.fillRect(cx-4, cy+vis.r-8, 8, 10);
        g.fillStyle(0x000000, 0.22); g.fillCircle(cx+1, cy-3, vis.r);
        g.fillStyle(vis.crown,  1);  g.fillCircle(cx, cy-4, vis.r);
        g.fillStyle(0xffffff, 0.10); g.fillCircle(cx-vis.r*0.3, cy-4-vis.r*0.3, vis.r*0.45);
      } else if (vis.shape === 'rock') {
        g.fillStyle(0x000000, 0.2);  g.fillEllipse(cx+2, cy+6, 28, 12);
        g.fillStyle(vis.body,   1);  g.fillEllipse(cx, cy, 28, 20);
        g.fillStyle(vis.shine,  1);  g.fillEllipse(cx-5, cy-5, 12, 8);
        g.lineStyle(1, 0x000000, 0.3); g.strokeEllipse(cx, cy, 28, 20);
      } else if (vis.shape === 'fish') {
        // Ripple rings — flat ellipses on water surface
        g.lineStyle(1, 0x88ccff, 0.25); g.strokeEllipse(cx, cy, 30, 11);
        g.lineStyle(1, 0x88ccff, 0.50); g.strokeEllipse(cx, cy, 18,  7);
        g.lineStyle(1, 0xaaddff, 0.80); g.strokeEllipse(cx, cy,  8,  3);
        // Bubbles floating above
        g.fillStyle(0xffffff, 0.55); g.fillCircle(cx - 3, cy - 5, 2);
        g.fillStyle(0xffffff, 0.40); g.fillCircle(cx + 4, cy - 7, 1.5);
        g.fillStyle(0xffffff, 0.25); g.fillCircle(cx,     cy - 9, 1);
      } else if (vis.shape === 'herb') {
        g.fillStyle(0x000000, 0.15);
        g.fillEllipse(cx + 1, cy + 9, 18, 6);
        g.fillStyle(0x2a5010, 1);
        g.fillRect(cx - 1, cy + 2, 2, 8);
        g.fillStyle(vis.color, 1);
        g.fillEllipse(cx - 6, cy,     10, 7);
        g.fillEllipse(cx + 6, cy,     10, 7);
        g.fillEllipse(cx,     cy - 6,  8, 11);
        g.lineStyle(1, 0x000000, 0.18);
        g.lineBetween(cx, cy - 10, cx, cy + 1);
        g.fillStyle(0xffffff, 0.20);
        g.fillCircle(cx - 1, cy - 7, 2);
      }
    }
  }

  _updateMonsterSprite(mon) {
    const wx = Math.round(mon.x * TILE_SIZE + TILE_SIZE / 2);
    const wy = Math.round(mon.y * TILE_SIZE + TILE_SIZE / 2);
    mon.sprite.setPosition(wx, wy);
    mon.spriteBg.setPosition(wx, wy);
    mon.hpBg.setPosition(wx, wy - 22);
    mon.hpFill.setPosition(wx - 13, wy - 22);
    // HP bar width + color (green → yellow → red as HP falls)
    const frac  = mon.hp / mon.maxHp;
    const hpCol = frac > 0.5 ? 0x22cc44 : frac > 0.25 ? 0xcccc22 : 0xcc2222;
    mon.hpFill.setFillStyle(hpCol);
    mon.hpFill.width = Math.max(1, 26 * frac);
    mon.lvlText.setPosition(wx, wy - 32);
  }

  _monsterChaseStep(mon) {
    const pdx = this.playerTileX - mon.x;
    const pdy = this.playerTileY - mon.y;
    // Try primary axis (larger distance) then secondary
    const steps = Math.abs(pdx) >= Math.abs(pdy)
      ? [[Math.sign(pdx), 0], [0, Math.sign(pdy)]]
      : [[0, Math.sign(pdy)], [Math.sign(pdx), 0]];
    for (const [sx, sy] of steps) {
      if (sx === 0 && sy === 0) continue;
      const nx = mon.x + sx, ny = mon.y + sy;
      if (
        nx >= 0 && nx < this.mapW && ny >= 0 && ny < this.mapH &&
        WALKABLE.has(this.map[ny][nx]) &&
        !this.resources.some(r => r.x === nx && r.y === ny && !r.depleted) &&
        !this.monsters.some(m => m !== mon && m.x === nx && m.y === ny && m.state !== 'dead') &&
        !this.interactables.some(i => this._iactFootprint(i).some(t => t.x === nx && t.y === ny))
      ) {
        mon.facing = sx !== 0 ? (sx > 0 ? 'right' : 'left') : (sy > 0 ? 'down' : 'up');
        if (mon.hasSprite) {
          const MOB_IDLE = { down: 0, left: 10, right: 20, up: 30 };
          mon.sprite.setFrame(MOB_IDLE[mon.facing] ?? 0);
        }
        mon.x = nx; mon.y = ny;
        this._updateMonsterSprite(mon);
        return;
      }
    }
  }

  // ── Combat ────────────────────────────────────────────────────────────────

  _startCombat(mon) {
    this._stopGathering();      // gathering and combat are mutually exclusive
    this.combatTarget   = mon;
    this.inCombat       = true;
    mon.state           = 'aggro';
    this.playerAtkTimer = 0;  // both timers at 0 → both fire on the very first update tick
    this.monAtkTimer    = 0;
  }

  _stopCombat() {
    if (this.combatTarget && this.combatTarget.state === 'aggro')
      this.combatTarget.state = 'idle';
    this.combatTarget   = null;
    this.inCombat       = false;
    this.playerAtkTimer = 0;
    this.monAtkTimer    = 0;
  }

  // TAB — pick (or cycle to) the nearest hostile within 8 tiles, then engage
  _tabReacquireTarget() {
    const px = this.playerTileX, py = this.playerTileY;
    const RANGE = 8;
    const candidates = this.monsters
      .filter(m => m.state !== 'dead' &&
        Math.max(Math.abs(m.x - px), Math.abs(m.y - py)) <= RANGE)
      .sort((a, b) =>
        Math.max(Math.abs(a.x - px), Math.abs(a.y - py)) -
        Math.max(Math.abs(b.x - px), Math.abs(b.y - py)));

    if (candidates.length === 0) {
      this._floatText(this.player.x, this.player.y - 44, 'No targets nearby', '#888888', 800);
      return;
    }

    // Determine next candidate BEFORE clearing combatTarget
    let next = candidates[0];
    if (this.combatTarget && this.combatTarget.state !== 'dead') {
      const idx = candidates.indexOf(this.combatTarget);
      if (idx >= 0) next = candidates[(idx + 1) % candidates.length];
    }

    this._floatText(next.sprite.x, next.sprite.y - 28, '◀ TARGET', '#ffcc44', 900);

    // Identical pre-work to click-to-attack.
    this._stopCombat();
    this._stopGathering();

    // Use the same _pathToRange → _startCombat path as the click handler.
    // _pathToRange returns [] when already in range, so no separate isInCombatRange
    // check is needed — this matches the click code structure exactly.
    const route = this._pathToRange(next.x, next.y);
    if (route !== null) {
      if (route.length === 0) {
        this._startCombat(next);          // in range — full engagement now
      } else {
        // Pre-assign combatTarget so T-slot abilities immediately see the target
        // during the walk phase.  inCombat stays false until _startCombat fires on
        // arrival, so the combat update loop won't abort the assignment prematurely.
        this.combatTarget  = next;
        this.path          = route;
        this.moving        = true;
        this.pendingAction = { type: 'combat', tx: next.x, ty: next.y, monId: next.id };
      }
    }
  }

  // ── Gathering ─────────────────────────────────────────────────────────────

  _startGathering(res) {
    const d = RDEFS[res.type];
    if (!d) return;
    // Check skill level requirement before committing
    const skillLv = this.playerData.skills[d.skill]?.level ?? 0;
    if (skillLv < d.lvlReq) {
      this._floatText(this.player.x, this.player.y - 40,
        `Need ${d.skill} Lv.${d.lvlReq}`, '#ff6644', 1600);
      return;
    }
    this.isGathering    = true;
    this.gatherTarget   = res;
    this.gatherTimer    = 0;
    this.gatherDuration = d.time;   // ms per gather cycle (resources.json)
    this.gatherBarBg.setVisible(true);
    this.gatherBarFill.setVisible(true);
    this._updateGatherBar();
  }

  _stopGathering() {
    this.isGathering  = false;
    this.gatherTarget = null;
    this.gatherTimer  = 0;
    this.gatherBarBg.setVisible(false);
    this.gatherBarFill.setVisible(false);
  }

  // ── Cooking ───────────────────────────────────────────────────────────────

  _cookAtCampfire() {
    this.game.events.emit('open-cookfire');
  }

  _doOneCook(itemKey) {
    if (!this.playerData.countItem(itemKey)) return;
    const res = cookOne(this.playerData, itemKey, COOK_RECIPES);
    if (res.blocked) return;
    this.playerData.removeItem(itemKey, 1);
    this.playerData.addItem(res.result, 1);
    if (res.xp > 0) {
      const xpRes = this.playerData.giveXP('cooking', res.xp);
      if (xpRes.leveledUp)
        this._floatText(this.player.x, this.player.y - 58, 'COOKING LV UP!', '#f0c050', 2200);
    }
    const resultName = ITEMS_DATA[res.result]?.name ?? res.result;
    this._floatText(this.player.x, this.player.y - 44,
      res.burned ? `Burnt! (${resultName})` : `Cooked: ${resultName}`,
      res.burned ? '#ff4444' : '#ffcc44', 1100);
    if (res.xp > 0)
      this._floatText(this.player.x, this.player.y - 60, `+${res.xp} Cooking XP`, '#44cc88', 1000);
    this.game.events.emit('chat-log', {
      text: res.burned
        ? `🔥 Burnt ${ITEMS_DATA[itemKey]?.name ?? itemKey}!`
        : `🍳 Cooked ${resultName} (+${res.xp} XP)`,
      cat: 'system',
    });
    this._emitPlayerUpdate();
  }

  _cookAllTick() {
    if (!this._cookAllQueue) { this._cancelCookQueue(); return; }
    const { itemKey } = this._cookAllQueue;
    if (this._cookAllQueue.remaining <= 0 || !this.playerData.countItem(itemKey)) {
      this._cancelCookQueue(); return;
    }
    this._doOneCook(itemKey);
    this._cookAllQueue.remaining--;
    const rem = this._cookAllQueue.remaining;
    if (rem <= 0 || !this.playerData.countItem(itemKey)) {
      this._cancelCookQueue();
    } else {
      this.game.events.emit('cook-queue-status', { itemKey, remaining: rem, total: this._cookAllQueue.total });
    }
  }

  _cancelCookQueue() {
    if (this._cookAllTimer) { this._cookAllTimer.remove(false); this._cookAllTimer = null; }
    this._cookAllQueue = null;
    this.game.events.emit('cook-queue-status', null);
  }

  // Reposition + resize the progress bar to sit above the player
  _updateGatherBar() {
    const bx = this.player.x;
    const by = this.player.y - 24;
    this.gatherBarBg.setPosition(bx, by);
    this.gatherBarFill.setPosition(bx - 16, by);  // left-anchored, 32px range
    const frac = this.gatherDuration > 0
      ? Math.min(1, this.gatherTimer / this.gatherDuration)
      : 0;
    this.gatherBarFill.width = Math.max(1, 32 * frac);
  }

  _handleMonsterLoot(loot) {
    let yOff = 56;
    for (const { item, qty } of loot) {
      this.playerData.addItem(item, qty);
      const def = (ITEMS_DATA ?? {})[item];
      const label = def ? `+${qty > 1 ? qty + ' ' : ''}${def.name}` : `+${item}`;
      const color = item === 'coins' ? '#f0d050' : '#88dd88';
      this._floatText(this.player.x, this.player.y - yOff, label, color, 1300);
      yOff += 14;
    }
  }

  _onMonsterDeath(mon) {
    mon.state = 'dead';
    this._stopCombat();

    // Award XP — main skill depends on equipped weapon's combatStyle
    let leveledUp = false;
    for (const { skill, amt } of killXP(MONSTERS_DATA, mon.type, this.playerData.weaponCombatStyle)) {
      const res = this.playerData.giveXP(skill, amt);
      if (res.leveledUp) {
        leveledUp = true;
        this._floatText(
          this.player.x, this.player.y - 40,
          `${skill.toUpperCase()} LV UP!`, '#f0c050', 2200
        );
      }
    }
    if (!leveledUp) {
      const totalXP = killXP(MONSTERS_DATA, mon.type, this.playerData.weaponCombatStyle).reduce((s, e) => s + e.amt, 0);
      this._floatText(this.player.x, this.player.y - 32, `+${totalXP} XP`, '#44cc88', 1200);
    }

    // Hide all monster Phaser objects
    [mon.sprite, mon.spriteBg, mon.hpBg, mon.hpFill, mon.lvlText]
      .forEach(o => o.setVisible(false));

    // Respawn after 60 seconds
    this.time.delayedCall(60000, () => {
      if (mon.state !== 'dead') return;
      mon.hp = MONSTERS_DATA[mon.type].maxHp;
      mon.x  = mon.spawnX;  mon.y = mon.spawnY;
      mon.state = 'idle';
      this._updateMonsterSprite(mon);
      [mon.sprite, mon.spriteBg, mon.hpBg, mon.hpFill, mon.lvlText]
        .forEach(o => o.setVisible(true));
    });

    this._emitPlayerUpdate();
    this.game.events.emit('monster-killed', { type: mon.type, id: mon.id });
  }

  _onPlayerDeath() {
    this._stopCombat();
    this.path = []; this.moving = false; this.pendingAction = null;

    // Flash red then restore
    this.player.setTintFill(0xff2222);
    this.time.delayedCall(600, () => this.player.clearTint());

    // Respawn at town with full HP
    this.playerData.hp = this.playerData.maxHp;
    const spawn = ZONES_CFG.overworld.playerStart;
    this.playerTileX = spawn.x; this.playerTileY = spawn.y;
    this.player.setPosition(
      spawn.x * TILE_SIZE + TILE_SIZE / 2,
      spawn.y * TILE_SIZE + TILE_SIZE / 2
    );

    this._floatText(this.player.x, this.player.y - 44, 'YOU DIED', '#ff2222', 1800);
    this._emitPlayerUpdate();
  }

  // Floating damage / level-up text that fades and rises
  _floatText(x, y, msg, color, duration = 1000) {
    const t = this.add.text(x, y, msg, {
      fontFamily: '"Press Start 2P", monospace', fontSize: '7px',
      color, stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(15);
    this.tweens.add({
      targets: t, y: y - 28, alpha: 0, duration,
      ease: 'Power2', onComplete: () => t.destroy(),
    });
  }

  // ── Skill gather visual FX ───────────────────────────────────────────────
  // event: 'tick' = mid-gather pulse, 'success' = gather completed burst
  _skillFx(res, event) {
    const d = RDEFS[res.type]; if (!d) return;
    const skill = d.skill;
    const cx = res.x * TILE_SIZE + TILE_SIZE / 2;
    const cy = res.y * TILE_SIZE + TILE_SIZE / 2;

    if (skill === 'woodcutting') {
      if (event === 'tick') {
        // Jitter tree sprite left/right
        if (res.image && !res.depleted) {
          this.tweens.killTweensOf(res.image);
          const ox = res.image.x;
          this.tweens.add({ targets: res.image, x: ox + (Math.random() > 0.5 ? 2 : -2),
            duration: 55, yoyo: true, onComplete: () => res.image?.setX(ox) });
        }
        // Falling leaf
        const leaf = this.add.rectangle(
          cx + (Math.random() * 14 - 7), cy - 8, 3, 3, 0x2a8a14, 0.85
        ).setDepth(4);
        this.tweens.add({ targets: leaf,
          x: leaf.x + (Math.random() * 16 - 8), y: leaf.y + 18 + Math.random() * 8,
          alpha: 0, angle: 60, duration: 560 + Math.random() * 180,
          onComplete: () => leaf.destroy() });
      } else {
        // Wood chip burst (4 pieces)
        for (let i = 0; i < 4; i++) {
          const chip = this.add.rectangle(
            cx + (Math.random() * 8 - 4), cy + 2, 4, 3, 0x8a5018, 0.90
          ).setDepth(4);
          const a = (i / 4) * Math.PI * 2;
          this.tweens.add({ targets: chip,
            x: chip.x + Math.cos(a) * (12 + Math.random() * 8),
            y: chip.y + Math.sin(a) * (8 + Math.random() * 5) - 4,
            alpha: 0, duration: 380 + Math.random() * 120, ease: 'Power2',
            onComplete: () => chip.destroy() });
        }
      }

    } else if (skill === 'mining') {
      if (event === 'tick') {
        // White hit flash on rock surface
        const flash = this.add.graphics({ x: cx, y: cy }).setDepth(4);
        flash.fillStyle(0xffffff, 0.42); flash.fillEllipse(0, 0, 24, 16);
        this.tweens.add({ targets: flash, alpha: 0, duration: 200,
          onComplete: () => flash.destroy() });
        // 2 debris flecks
        for (let i = 0; i < 2; i++) {
          const dot = this.add.rectangle(
            cx + (Math.random() * 10 - 5), cy + (Math.random() * 6 - 3), 3, 3, 0x909090, 0.85
          ).setDepth(4);
          this.tweens.add({ targets: dot,
            x: dot.x + (Math.random() * 14 - 7), y: dot.y - 8 - Math.random() * 6,
            alpha: 0, duration: 350, onComplete: () => dot.destroy() });
        }
        // Nudge rock sprite upward
        if (res.image && !res.depleted) {
          this.tweens.killTweensOf(res.image);
          const oy = res.image.y;
          this.tweens.add({ targets: res.image, y: oy - 2,
            duration: 50, yoyo: true, onComplete: () => res.image?.setY(oy) });
        }
      } else {
        // Stone shard burst (5 shards)
        for (let i = 0; i < 5; i++) {
          const shard = this.add.rectangle(
            cx + (Math.random() * 10 - 5), cy,
            3 + Math.floor(Math.random() * 2), 3, 0x707070, 0.90
          ).setDepth(4);
          const a = Math.random() * Math.PI * 2;
          this.tweens.add({ targets: shard,
            x: shard.x + Math.cos(a) * (14 + Math.random() * 8),
            y: shard.y + Math.sin(a) * (10 + Math.random() * 6) - 3,
            alpha: 0, duration: 370 + Math.random() * 130, ease: 'Power2',
            onComplete: () => shard.destroy() });
        }
      }

    } else if (skill === 'fishing') {
      if (event === 'tick') {
        // Expanding water ripple ring
        const ring = this.add.graphics({ x: cx, y: cy }).setDepth(4);
        ring.lineStyle(1, 0x88ccff, 0.65); ring.strokeEllipse(0, 0, 14, 6);
        this.tweens.add({ targets: ring, scaleX: 2.8, scaleY: 2.8, alpha: 0,
          duration: 750, ease: 'Sine.easeOut', onComplete: () => ring.destroy() });
      } else {
        // Splash drops (5 drops arc upward)
        for (let i = 0; i < 5; i++) {
          const drop = this.add.rectangle(
            cx + (Math.random() * 8 - 4), cy, 2, 4, 0x55aaff, 0.85
          ).setDepth(4);
          const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI;
          this.tweens.add({ targets: drop,
            x: drop.x + Math.cos(a) * (8 + Math.random() * 8),
            y: drop.y + Math.sin(a) * (12 + Math.random() * 8),
            alpha: 0, duration: 420 + Math.random() * 180, ease: 'Power1',
            onComplete: () => drop.destroy() });
        }
      }

    } else if (skill === 'foraging') {
      if (event === 'tick') {
        // Soft green glow pulse expanding from herb
        const glow = this.add.graphics({ x: cx, y: cy - 4 }).setDepth(4);
        glow.fillStyle(0x88ff44, 0.26); glow.fillCircle(0, 0, 11);
        this.tweens.add({ targets: glow, alpha: 0, scaleX: 1.6, scaleY: 1.6,
          duration: 530, ease: 'Sine.easeOut', onComplete: () => glow.destroy() });
      } else {
        // Pollen sparkle burst (5 dots)
        for (let i = 0; i < 5; i++) {
          const spark = this.add.rectangle(
            cx + (Math.random() * 8 - 4), cy - 4, 2, 2, 0xccff44, 0.90
          ).setDepth(4);
          const a = Math.random() * Math.PI * 2;
          this.tweens.add({ targets: spark,
            x: spark.x + Math.cos(a) * (10 + Math.random() * 8),
            y: spark.y + Math.sin(a) * (10 + Math.random() * 8) - 6,
            alpha: 0, duration: 480 + Math.random() * 200, ease: 'Power1',
            onComplete: () => spark.destroy() });
        }
      }
    }
  }

  // ── Walkable / path helpers ───────────────────────────────────────────────

  _iactFootprint(iact) {
    if (iact.type === 'shop') {
      return [
        { x: iact.x,     y: iact.y     },
        { x: iact.x + 1, y: iact.y     },
        { x: iact.x,     y: iact.y + 1 },
        { x: iact.x + 1, y: iact.y + 1 },
      ];
    }
    if (iact.type === 'library') {
      const tiles = [];
      for (let dy = 0; dy < 3; dy++)
        for (let dx = 0; dx < 3; dx++)
          tiles.push({ x: iact.x + dx, y: iact.y + dy });
      return tiles;
    }
    return [{ x: iact.x, y: iact.y }];
  }

  _pathAdjFootprint(tiles) {
    const px = this.playerTileX, py = this.playerTileY;
    for (const { x, y } of tiles)
      for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]])
        if (px === x + dx && py === y + dy) return [];
    let best = null, bestDist = Infinity;
    for (const { x, y } of tiles) {
      for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
        const ax = x + dx, ay = y + dy;
        if (!this._isWalkable(ax, ay)) continue;
        const d = Math.abs(ax - px) + Math.abs(ay - py);
        if (d < bestDist) { bestDist = d; best = [ax, ay]; }
      }
    }
    if (!best) return null;
    if (best[0] === px && best[1] === py) return [];
    return bfsWithFn(px, py, best[0], best[1], (x, y) => this._isWalkable(x, y));
  }

  _isAdjacentToIact(iact) {
    return this._iactFootprint(iact).some(({ x, y }) =>
      Math.abs(this.playerTileX - x) + Math.abs(this.playerTileY - y) === 1
    );
  }

  _isWalkable(tx, ty) {
    if (tx < 0 || tx >= this.mapW || ty < 0 || ty >= this.mapH) return false;
    // Collision overrides take precedence over tile type
    const colOvr = this._collisionMap?.get(`${tx},${ty}`);
    if (colOvr === false) return false;                                   // force-blocked
    if (colOvr !== true && !WALKABLE.has(this.map[ty][tx])) return false; // tile-type blocked (no override)
    if (this.resources.some(r => r.x === tx && r.y === ty && !r.depleted)) return false;
    if (this.monsters.some(m => m.x === tx && m.y === ty && m.state !== 'dead')) return false;
    if (this.interactables.some(i => this._iactFootprint(i).some(t => t.x === tx && t.y === ty))) return false;
    if (this.placedObjects?.some(o => o.blocking && o.x === tx && o.y === ty)) return false;
    return true;
  }

  // Search a radius-8 ring around a blocked/unreachable click target for the
  // nearest walkable tile that has a valid path from the player.
  _findNearestWalkable(clickX, clickY, maxR = 8) {
    const candidates = [];
    for (let dy = -maxR; dy <= maxR; dy++) {
      for (let dx = -maxR; dx <= maxR; dx++) {
        const cx = clickX + dx, cy = clickY + dy;
        if (cx < 0 || cx >= this.mapW || cy < 0 || cy >= this.mapH) continue;
        if (!this._isWalkable(cx, cy)) continue;
        candidates.push({ x: cx, y: cy, d2: dx * dx + dy * dy });
      }
    }
    candidates.sort((a, b) => a.d2 - b.d2);
    for (const c of candidates) {
      const route = bfsWithFn(
        this.playerTileX, this.playerTileY, c.x, c.y,
        (x, y) => this._isWalkable(x, y)
      );
      if (route !== null) return { x: c.x, y: c.y, route };
    }
    return null;
  }

  _pathAdj(tx, ty) {
    const px = this.playerTileX, py = this.playerTileY;
    for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]])
      if (px === tx + dx && py === ty + dy) return [];
    let best = null, bestDist = Infinity;
    for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
      const ax = tx + dx, ay = ty + dy;
      if (!this._isWalkable(ax, ay)) continue;
      const d = Math.abs(ax - px) + Math.abs(ay - py);
      if (d < bestDist) { bestDist = d; best = [ax, ay]; }
    }
    if (!best) return null;
    if (best[0] === px && best[1] === py) return [];
    return bfsWithFn(px, py, best[0], best[1], (x, y) => this._isWalkable(x, y));
  }

  _isAdjacentTo(tx, ty) {
    return Math.abs(this.playerTileX - tx) + Math.abs(this.playerTileY - ty) === 1;
  }

  _combatRange() {
    const RANGES = { melee: 1, archer: 5, magic: 4, druidism: 3 };
    return RANGES[this.playerData.weaponCombatStyle] ?? 1;
  }

  _isInCombatRange(tx, ty) {
    const adx = Math.abs(this.playerTileX - tx);
    const ady = Math.abs(this.playerTileY - ty);
    const range = this._combatRange();
    if (range === 1) return adx + ady === 1;   // melee: cardinal adjacent only
    return Math.max(adx, ady) <= range;         // ranged: Chebyshev distance
  }

  _pathToRange(tx, ty) {
    if (this._isInCombatRange(tx, ty)) return [];
    const range = this._combatRange();
    const px = this.playerTileX, py = this.playerTileY;
    const candidates = [];
    if (range === 1) {
      for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
        const cx = tx + dx, cy = ty + dy;
        if (this._isWalkable(cx, cy)) candidates.push([cx, cy]);
      }
    } else {
      for (let dy = -range; dy <= range; dy++) {
        for (let dx = -range; dx <= range; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) > range) continue;
          const cx = tx + dx, cy = ty + dy;
          if (cx === tx && cy === ty) continue;
          if (this._isWalkable(cx, cy)) candidates.push([cx, cy]);
        }
      }
    }
    if (candidates.length === 0) return null;
    candidates.sort((a, b) =>
      (Math.abs(a[0]-px) + Math.abs(a[1]-py)) - (Math.abs(b[0]-px) + Math.abs(b[1]-py))
    );
    const [bx, by] = candidates[0];
    if (bx === px && by === py) return [];
    return bfsWithFn(px, py, bx, by, (x, y) => this._isWalkable(x, y));
  }

  // ── Dev editor helpers ────────────────────────────────────────────────────

  // forceTile: override tile id (used by revert so it can call this same path).
  // recordOverride: false when reverting so the key is removed, not re-added.
  _editorPaintTile(tx, ty, forceTile = null, recordOverride = true) {
    const t = forceTile ?? this._editorTile;
    if (forceTile === null && this.map[ty][tx] === t) return;  // no-op for normal paint
    this.map[ty][tx] = t;
    if (recordOverride) this.editorOverrides.set(`${tx},${ty}`, t);

    const TS = TILE_SIZE;

    // ── Layer 1: base colour rect (depth 0.6) — background tint, same as _drawMap ──
    const col = (tx + ty) % 2 === 0 ? TC[t] : TC_ALT[t];
    this.editorTilesGfx.fillStyle(col, 1);
    this.editorTilesGfx.fillRect(tx * TS, ty * TS, TS, TS);

    // ── Layer 2: texture image (depth 0.7) — matches _drawTextureTiles exactly ──
    // Same Sakpix/Cainos priority, same frames, same alpha, same hash formula.
    const SAK_G = this.textures.exists('sakpix_grass');
    const SAK_W = this.textures.exists('sakpix_water');
    const SAK_R = this.textures.exists('sakpix_rocks');
    const SAK_B = this.textures.exists('sakpix_beach');
    const cG    = this.textures.exists('cainos_grass');
    const cS    = this.textures.exists('cainos_stone');
    const TEX = {
      [T.GRASS]:    SAK_G ? ['sakpix_grass', ['sak_g1','sak_g2','sak_g3','sak_g4'],           0.82]
                  : cG   ? ['cainos_grass',  [29,43,56,90,120,127],                           0.35] : null,
      [T.DGRASS]:   SAK_G ? ['sakpix_grass', ['sak_g3','sak_g4','sak_g5','sak_g6'],           0.87]
                  : cG   ? ['cainos_grass',  [29,43,56,90,120,127],                           0.48] : null,
      [T.PATH]:     SAK_G ? ['sakpix_grass',  ['sak_d1','sak_d2','sak_d3'],                   0.68]
                  : cG   ? ['cainos_grass',  [133,144,162,175,211,234],                       0.60] : null,
      [T.WATER]:    SAK_W ? ['sakpix_water', ['sak_w1','sak_w2','sak_w3','sak_w4'],           0.88] : null,
      [T.SAND]:     SAK_B ? ['sakpix_beach', ['sak_s1','sak_s2'],                             0.85] : null,
      [T.MOUNTAIN]: SAK_R ? ['sakpix_rocks', ['sak_r1','sak_r2','sak_r3'],                   0.72]
                  : cS   ? ['cainos_stone',  [80,85,86,87,112,117],                           0.55] : null,
      [T.FLOOR]:    SAK_R ? ['sakpix_rocks', ['sak_r1','sak_r2','sak_r3'],                   0.58]
                  : cS   ? ['cainos_stone',  [17,18,19,33,34,35],                             0.50] : null,
      [T.DFLOOR]:   SAK_R ? ['sakpix_rocks', ['sak_r1','sak_r2','sak_r3'],                   0.40]
                  : cS   ? ['cainos_stone',  [85,86,87,117,118,119],                          0.30] : null,
    };
    const cfg = TEX[t];
    if (cfg) {
      const [key, frames, alpha] = cfg;
      const frame = frames[((tx * 7 + ty * 13) >>> 0) % frames.length];
      // Reuse existing editor image if one was already placed here; otherwise create.
      if (!this._editorImageMap) this._editorImageMap = new Map();
      const imgKey = `${tx},${ty}`;
      let img = this._editorImageMap.get(imgKey);
      if (img && img.active) {
        img.setTexture(key, frame).setAlpha(alpha);
      } else {
        img = this.add.image(tx * TS + TS / 2, ty * TS + TS / 2, key, frame)
          .setDisplaySize(TS, TS).setAlpha(alpha).setDepth(0.7);
        this._editorImageMap.set(imgKey, img);
      }
    } else {
      // Tile type has no texture — destroy any stale texture image so the base colour shows
      if (this._editorImageMap) {
        const old = this._editorImageMap.get(`${tx},${ty}`);
        if (old && old.active) { old.destroy(); this._editorImageMap.delete(`${tx},${ty}`); }
      }
    }
  }

  // Right-click revert: restore tile to its pre-session (generated) value.
  _editorRevertTile(tx, ty) {
    if (!this._editorOrigMap) return;
    const origTile = this._editorOrigMap[ty][tx];
    const key      = `${tx},${ty}`;
    if (this.map[ty][tx] === origTile && !this.editorOverrides.has(key)) return;
    this.editorOverrides.delete(key);
    // Repaint using the original tile type without recording a new override.
    this._editorPaintTile(tx, ty, origTile, false);
  }

  // ── Placed-object system ──────────────────────────────────────────────────

  _loadPlacedObjects() {
    this.placedObjects = [];
    for (const { type, x, y, blocking } of (PLACED_OBJECTS_DATA?.objects ?? [])) {
      if (x >= 0 && x < this.mapW && y >= 0 && y < this.mapH)
        this.placedObjects.push({ type, x, y, blocking: !!blocking });
    }
    this._renderPlacedObjects();
  }

  _renderPlacedObjects() {
    const g  = this.placedObjGfx;
    const TS = TILE_SIZE;
    g.clear();
    for (const o of this.placedObjects) {
      const ox = o.x * TS, oy = o.y * TS;
      switch (o.type) {
        case 'fence_h':
          g.fillStyle(0x8B5e3c, 1);
          g.fillRect(ox + 2, oy + TS / 2 - 3, TS - 4, 6);
          break;
        case 'fence_v':
          g.fillStyle(0x8B5e3c, 1);
          g.fillRect(ox + TS / 2 - 3, oy + 2, 6, TS - 4);
          break;
        case 'wall':
          g.fillStyle(0x4a4a4a, 1);
          g.fillRect(ox + 1, oy + 1, TS - 2, TS - 2);
          g.lineStyle(1, 0x6a6a6a, 0.7);
          g.strokeRect(ox + 1, oy + 1, TS - 2, TS - 2);
          break;
        case 'barrel':
          g.fillStyle(0x6B3a1f, 1);
          g.fillRect(ox + 6, oy + 5, TS - 12, TS - 10);
          g.lineStyle(1, 0x4a2810, 0.8);
          g.strokeRect(ox + 6, oy + 5, TS - 12, TS - 10);
          break;
        case 'sign':
          g.fillStyle(0x8B7355, 1);
          g.fillRect(ox + TS / 2 - 2, oy + TS / 2, 4, TS / 2 - 2); // post
          g.fillRect(ox + 6, oy + 4, TS - 12, TS / 2 - 4);           // board
          break;
        default:
          g.fillStyle(0xdd44ff, 0.7);
          g.fillRect(ox + 4, oy + 4, TS - 8, TS - 8);
      }
    }
  }

  _placeObject(tx, ty) {
    const def = OBJ_TYPES[this._objEditorType];
    if (!def) return;
    const idx = this.placedObjects.findIndex(o => o.x === tx && o.y === ty);
    if (idx >= 0) this.placedObjects.splice(idx, 1);
    this.placedObjects.push({ type: def.type, x: tx, y: ty, blocking: def.blocking });
    this._renderPlacedObjects();
  }

  _removeObject(tx, ty) {
    const before = this.placedObjects.length;
    this.placedObjects = this.placedObjects.filter(o => !(o.x === tx && o.y === ty));
    if (this.placedObjects.length !== before) this._renderPlacedObjects();
  }

  _updateEditorHUD() {
    if (!this._editorMode) return;
    const obj = OBJ_TYPES[this._objEditorType];
    const cx  = this._editorCursorTile?.x ?? -1;
    const cy  = this._editorCursorTile?.y ?? -1;
    const cur = (cx >= 0 && cx < this.mapW && cy >= 0 && cy < this.mapH)
      ? `${cx}, ${cy}` : '--';
    this.game.events.emit('editor-hud-update', {
      lines: [
        'F2 OBJECT EDITOR',
        `[${this._objEditorType}] ${obj?.label ?? '?'}`,
        `Tile: ${cur}`,
        '',
        '1 Fence H  2 Fence V',
        '3 Wall     4 Barrel',
        '5 Sign',
        '',
        'Left=Place  Right=Remove',
        'P=Export  F2=Close',
        'B=Collision (separate)',
      ].join('\n'),
      tileColor: 0x44ddff,
    });
  }

  // ── Misc helpers ──────────────────────────────────────────────────────────

  // Snap the player to the nearest tile centre before starting a new path.
  // When a click arrives mid-step, playerTileX/Y still holds the LAST completed
  // tile, not where the sprite visually is.  Without this, every re-click while
  // moving causes the sprite to visually backtrack to the previous tile first.
  //
  // Strategy: measure pixel distance to the current tile centre vs the next
  // tile in the queue.  Whichever is closer becomes the new logical origin; we
  // update both the tile coordinates and the sprite pixel position so the new
  // BFS starts from exactly the right place with no gap.
  _snapToNearestTile() {
    if (!this.moving || this.path.length === 0) return;
    const nxt    = this.path[0];
    const curPxX = this.playerTileX * TILE_SIZE + TILE_SIZE / 2;
    const curPxY = this.playerTileY * TILE_SIZE + TILE_SIZE / 2;
    const nxtPxX = nxt.x * TILE_SIZE + TILE_SIZE / 2;
    const nxtPxY = nxt.y * TILE_SIZE + TILE_SIZE / 2;
    const dCur   = Math.hypot(this.player.x - curPxX, this.player.y - curPxY);
    const dNxt   = Math.hypot(this.player.x - nxtPxX, this.player.y - nxtPxY);
    if (dNxt <= dCur) {
      this.playerTileX = nxt.x;
      this.playerTileY = nxt.y;
      this.player.x    = nxtPxX;
      this.player.y    = nxtPxY;
    } else {
      this.player.x = curPxX;
      this.player.y = curPxY;
    }
    this.path   = [];
    this.moving = false;
  }

  _flashTile(tx, ty) {
    this.clickGfx.clear();
    this.clickGfx.fillStyle(0xffffff, 0.22);
    this.clickGfx.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    this.time.delayedCall(200, () => this.clickGfx.clear());
  }

  _showDestMarker(tx, ty) {
    const cx = tx * TILE_SIZE + TILE_SIZE / 2;
    const cy = ty * TILE_SIZE + TILE_SIZE / 2;
    const r  = TILE_SIZE * 0.36;
    const g  = this.add.graphics().setDepth(5);
    g.lineStyle(1.5, 0xd4b060, 0.88);
    g.strokeCircle(cx, cy, r);
    g.fillStyle(0xd4b060, 0.45);
    g.fillCircle(cx, cy, 2.5);
    this.tweens.add({
      targets: g, alpha: 0, duration: 600,
      ease: 'Power2', onComplete: () => g.destroy(),
    });
  }

  _setPlayerIdle() {
    const IDLE_FRAMES = { down: 0, left: 10, right: 20, up: 30 };
    this.player.stop();
    this.player.setFrame(IDLE_FRAMES[this._playerFacing] ?? 0);
  }

  _updateViewport() {
    const { width, height } = this.scale;
    const { TOP_H: dTH, BOTTOM_H: dBH, RIGHT_W: dRW } = this._dyn ?? { TOP_H, BOTTOM_H, RIGHT_W };
    this.cameras.main.setViewport(
      MARGIN + JOURNAL_W + GAP,
      dTH + MARGIN,
      width  - dRW - JOURNAL_W - GAP * 2 - MARGIN * 3,
      height - dTH - dBH - MARGIN * 3
    );
  }

  // ── Attack VFX ───────────────────────────────────────────────────────────

  _spawnAttackVFX(style, fromX, fromY, toX, toY) {
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const dist  = Math.hypot(toX - fromX, toY - fromY);

    if (style === 'melee') {
      // Slash arc centred on target, oriented toward player
      const g = this.add.graphics().setDepth(14);
      g.x = toX; g.y = toY;
      g.lineStyle(3, 0xffffff, 0.95);
      g.beginPath(); g.arc(0, 0, 14, angle - 0.85, angle + 0.85); g.strokePath();
      g.lineStyle(2, 0xffcc44, 0.70);
      g.beginPath(); g.arc(0, 0, 9,  angle - 1.10, angle + 1.10); g.strokePath();
      this.tweens.add({
        targets: g, alpha: 0, scaleX: 1.5, scaleY: 1.5,
        duration: 200, ease: 'Power2',
        onComplete: () => g.destroy(),
      });
      return;
    }

    // Projectile styles
    const CFG = {
      archer:   { color: 0xffe888, glow: 0xffaa22, r: 2,  isArrow: true  },
      archer2:  { color: 0xffaa22, glow: 0xff6600, r: 2,  isArrow: true  },  // shot 2 — amber
      magic:    { color: 0xbb66ff, glow: 0x6622cc, r: 5,  isArrow: false },
      druidism: { color: 0x44ee44, glow: 0x226622, r: 4,  isArrow: false },
    };
    const cfg = CFG[style] ?? CFG.magic;
    const g   = this.add.graphics().setDepth(14);
    g.x = fromX; g.y = fromY;

    const redraw = () => {
      g.clear();
      if (cfg.isArrow) {
        // Arrow: shaft + tip dot in direction of travel
        const cos = Math.cos(angle), sin = Math.sin(angle);
        g.lineStyle(2, cfg.color, 1);
        g.beginPath();
        g.moveTo(-10 * cos, -10 * sin);
        g.lineTo(  5 * cos,   5 * sin);
        g.strokePath();
        g.fillStyle(cfg.color, 1); g.fillCircle(5 * cos, 5 * sin, 2.5);
      } else {
        // Orb with glowing trail
        const cos = Math.cos(angle), sin = Math.sin(angle);
        g.fillStyle(cfg.glow, 0.45); g.fillCircle(-5 * cos, -5 * sin, cfg.r * 0.75);
        g.fillStyle(cfg.color, 1);   g.fillCircle(0, 0, cfg.r);
        g.fillStyle(0xffffff, 0.55); g.fillCircle(-cfg.r * 0.3, -cfg.r * 0.3, cfg.r * 0.35);
      }
    };
    redraw();

    const travelMs = Phaser.Math.Clamp(dist * 1.1, 90, 280);
    this.tweens.add({
      targets: g, x: toX, y: toY,
      duration: travelMs, ease: 'Linear',
      onComplete: () => {
        // Impact burst
        g.clear();
        g.fillStyle(cfg.color, 0.85); g.fillCircle(0, 0, cfg.r * 2.2);
        g.fillStyle(0xffffff, 0.40);  g.fillCircle(0, 0, cfg.r * 0.9);
        this.tweens.add({
          targets: g, alpha: 0, scaleX: 2.2, scaleY: 2.2,
          duration: 140, ease: 'Power2',
          onComplete: () => g.destroy(),
        });
      },
    });
  }

  // ── Ability activation ────────────────────────────────────────────────────

  _useAbility(key) {
    const ab  = this.abilities[key];
    const def = ABILITY_DEFS[key];
    const now = this.time.now;
    if (now < ab.cooldownUntil) return;   // still on cooldown

    switch (key) {
      case 'Q': {
        if (this.playerData.hp >= this.playerData.maxHp) {
          this._floatText(this.player.x, this.player.y - 40, 'Full HP', '#44cc88', 1200);
          return;   // full HP — no cooldown consumed
        }
        const heal = Math.floor(this.playerData.maxHp * 0.25);
        this.playerData.hp = Math.min(this.playerData.maxHp, this.playerData.hp + heal);
        ab.cooldownUntil = now + def.cooldown;
        this._floatText(this.player.x, this.player.y - 44, 'MINOR HEAL!', '#44ff88', 1400);
        this._floatText(this.player.x, this.player.y - 28, `+${heal} HP`, '#44cc88', 1000);
        this._spawnHealVFX(this.player.x, this.player.y);
        this._emitPlayerUpdate();
        break;
      }
      case 'W': {
        const curMana = this.playerData.mana ?? 0;
        const hasFree = this.playerData.freeAbility ?? false;
        if (curMana >= 10 || hasFree) {
          // Empowered: consume 10 mana (free if veil elixir active), shield lasts twice as long
          if (!hasFree) this.playerData.mana = curMana - 10;
          this.playerData.freeAbility = false;
          ab.activeUntil   = now + def.activeDuration * 2;  // 16 s
          ab.cooldownUntil = now + def.cooldown;
          this._floatText(this.player.x, this.player.y - 44, 'EMPOWERED SHIELD!', '#44aaff', 1600);
          if (!hasFree) this._floatText(this.player.x, this.player.y - 62, '-10 Mana', '#3377cc', 1100);
          else          this._floatText(this.player.x, this.player.y - 62, 'FREE (Veil)', '#aa66ff', 1100);
          this._spawnShieldActivateVFX(this.player.x, this.player.y);
          this._emitPlayerUpdate();  // refresh MP bar
        } else {
          ab.activeUntil   = now + def.activeDuration;       // 8 s normal
          ab.cooldownUntil = now + def.cooldown;
          this._floatText(this.player.x, this.player.y - 44, 'IRON SHIELD!', '#4488ff', 1400);
          this._spawnShieldActivateVFX(this.player.x, this.player.y);
        }
        break;
      }
      case 'E': {
        ab.activeUntil   = now + def.activeDuration;
        ab.cooldownUntil = now + def.cooldown;
        this._floatText(this.player.x, this.player.y - 44, 'ENRAGE!', '#ff4422', 1400);
        this._spawnEnrageActivateVFX(this.player.x, this.player.y);
        break;
      }
      case 'R': {
        this.stunNextAttack = true;
        ab.activeUntil   = now + 999999;  // stays "ready" until the stun lands
        ab.cooldownUntil = now + def.cooldown;
        this._floatText(this.player.x, this.player.y - 44, 'STUN READY!', '#ffdd22', 1400);
        this._spawnStunReadyVFX(this.player.x, this.player.y);
        break;
      }
    }
    this._emitAbilityUpdate();
  }

  _emitAbilityUpdate() {
    const now   = this.time.now;
    const state = {};
    for (const key of ['Q', 'W', 'E', 'R']) {
      const ab = this.abilities[key];
      state[key] = {
        cooldownRemaining: Math.max(0, ab.cooldownUntil - now),
        isActive: key === 'R'
          ? this.stunNextAttack
          : now < ab.activeUntil,
      };
    }
    // T slot: dynamic — reflects the ability for the currently equipped style.
    const style = this.playerData.weaponCombatStyle;
    const tDef  = STYLE_ABILITY_DEFS[style];
    const abT   = this.abilities.T;
    state.T = {
      cooldownRemaining: Math.max(0, abT.cooldownUntil - now),
      cooldownTotal:     tDef?.cooldown ?? 0,
      isActive:    false,
      unlocked:    !!tDef,
      abilityName: tDef?.name ?? '',
      style,
    };
    this.game.events.emit('ability-update', state);
  }

  // ── Style ability (T key) ─────────────────────────────────────────────────

  _useStyleAbility() {
    const style = this.playerData.weaponCombatStyle;
    const def   = STYLE_ABILITY_DEFS[style];
    if (!def) return;   // no ability defined for this style — T slot locked

    const ab  = this.abilities.T;
    const now = this.time.now;
    if (now < ab.cooldownUntil) {
      const secs = Math.ceil((ab.cooldownUntil - now) / 1000);
      this._floatText(this.player.x, this.player.y - 44, `${secs}s`, '#888888', 700);
      return;
    }

    // Must have an active combat target in range
    const mon = this.combatTarget;
    if (!mon || mon.state === 'dead') {
      this._floatText(this.player.x, this.player.y - 44, 'No target!', '#ff8844', 900);
      return;
    }
    if (!this._isInCombatRange(mon.x, mon.y)) {
      this._floatText(this.player.x, this.player.y - 44, 'Out of range', '#ff8844', 900);
      return;
    }

    ab.cooldownUntil = now + def.cooldown;

    switch (style) {
      case 'melee':    this._abilityThrust(mon, def);    break;
      case 'archer':   this._abilityQuickShot(mon, def); break;
      case 'magic':    this._abilityArcBurst(mon, def);  break;
      case 'druidism': this._abilityRootSnare(mon, def); break;
    }
    this._emitAbilityUpdate();
  }

  // ── Weapon quickbar (keys 1–5 / slot clicks) ─────────────────────────────

  _useHotbarSlot(slotIdx) {
    const itemKey = this.playerData.hotbar[slotIdx];
    if (!itemKey) return;

    // Already equipped — silent confirm, no redundant equip
    if (this.playerData.gear.weapon === itemKey) return;

    // In inventory: equip via the same path as normal inventory click
    if (this.playerData.inventory.some(s => s && s.item === itemKey)) {
      const result = this.playerData.equip(itemKey);
      if (result) {
        this._emitPlayerUpdate();
        this._emitAbilityUpdate();
        this._floatText(this.player.x, this.player.y - 44, `Equipped ${result.name}`, '#e8c060', 1400);
      }
      return;
    }

    // Weapon gone (sold/lost/used) — clear the stale slot
    this.playerData.hotbar[slotIdx] = null;
    this._emitPlayerUpdate();
    this._floatText(this.player.x, this.player.y - 44, 'Weapon not found', '#cc4444', 1000);
  }

  // THRUST — 220 % melee damage, single adjacent target
  _abilityThrust(mon, def) {
    const r = attackMonster(
      this.playerData, mon, MONSTERS_DATA, t => this.playerData.eqBonus(t), def.dmgMult
    );
    if (r.hit) {
      this._spawnThrustVFX(this.player.x, this.player.y, mon.sprite.x, mon.sprite.y);
      this._floatText(mon.sprite.x, mon.sprite.y - 28, `-${r.dmg}`, '#ff8822', 1100);
      this._floatText(this.player.x, this.player.y - 44, 'THRUST!', '#ff6600', 1200);
      if (mon.hasSprite) {
        mon.sprite.setTint(0xff8822);
        this.time.delayedCall(130, () => { if (mon.sprite?.active) mon.sprite.clearTint(); });
      }
      this._updateMonsterSprite(mon);
    } else {
      this._floatText(mon.sprite.x, mon.sprite.y - 20, 'miss', '#888888', 700);
    }
    if (r.killed) { this._handleMonsterLoot(r.loot); this._onMonsterDeath(mon); }
  }

  // QUICK SHOT — shot 1 fires immediately; shot 2 is delayed 250ms and colour-distinct
  _abilityQuickShot(mon, def) {
    this._floatText(this.player.x, this.player.y - 44, 'QUICK SHOT!', '#ffe888', 1200);
    const msx = mon.sprite.x, msy = mon.sprite.y;

    // Shot 1 — fires immediately (bright yellow)
    const r1 = attackMonster(
      this.playerData, mon, MONSTERS_DATA, t => this.playerData.eqBonus(t), def.dmgMult
    );
    if (r1.hit) {
      this._spawnAttackVFX('archer', this.player.x, this.player.y, msx, msy);
      this._floatText(msx, msy - 18, `-${r1.dmg}`, '#ffe888', 900);
      this._updateMonsterSprite(mon);
    }
    if (r1.killed) { this._handleMonsterLoot(r1.loot); this._onMonsterDeath(mon); return; }

    // Shot 2 — 250ms later, amber colour so it reads as a distinct second strike
    if ((def.shots ?? 2) >= 2) {
      this.time.delayedCall(250, () => {
        if (mon.state === 'dead') return;
        const r2 = attackMonster(
          this.playerData, mon, MONSTERS_DATA, t => this.playerData.eqBonus(t), def.dmgMult
        );
        if (r2.hit) {
          this._spawnAttackVFX('archer2', this.player.x, this.player.y, msx, msy);
          this._floatText(msx, msy - 34, `-${r2.dmg}`, '#ffaa00', 900);
          this._updateMonsterSprite(mon);
        }
        if (r2.killed) { this._handleMonsterLoot(r2.loot); this._onMonsterDeath(mon); }
      });
    }
  }

  // ARC BURST — magic hit + 40 % splash to nearby; bonus hit if no splash targets
  _abilityArcBurst(mon, def) {
    const r = attackMonster(
      this.playerData, mon, MONSTERS_DATA, t => this.playerData.eqBonus(t), def.dmgMult
    );
    this._spawnAttackVFX('magic', this.player.x, this.player.y, mon.sprite.x, mon.sprite.y);
    this._spawnArcBurstVFX(mon.sprite.x, mon.sprite.y);
    if (!r.hit) {
      this._floatText(mon.sprite.x, mon.sprite.y - 20, 'miss', '#888888', 700);
      return;
    }
    this._floatText(mon.sprite.x, mon.sprite.y - 24, `-${r.dmg}`, '#bb66ff', 1000);
    this._updateMonsterSprite(mon);
    if (r.killed) { this._handleMonsterLoot(r.loot); this._onMonsterDeath(mon); return; }

    const nearby = this.monsters.filter(m =>
      m !== mon && m.state !== 'dead' &&
      Math.abs(m.x - mon.x) + Math.abs(m.y - mon.y) <= (def.splashRange ?? 3)
    );
    this._floatText(this.player.x, this.player.y - 44, 'ARC BURST!', '#bb66ff', 1300);
    if (nearby.length > 0) {
      nearby.forEach(target => {
        const sr = attackMonster(
          this.playerData, target, MONSTERS_DATA, t => this.playerData.eqBonus(t), def.splashMult
        );
        if (sr.hit) {
          this._floatText(target.sprite.x, target.sprite.y - 20, `-${sr.dmg}`, '#9944cc', 900);
          this._updateMonsterSprite(target);
          if (sr.killed) { this._handleMonsterLoot(sr.loot); this._onMonsterDeath(target); }
        }
      });
    } else {
      // No splash targets — bonus single-target hit (60 % extra); make it obvious
      if (mon.state !== 'dead') {
        const br = attackMonster(
          this.playerData, mon, MONSTERS_DATA, t => this.playerData.eqBonus(t), def.splashMult
        );
        if (br.hit) {
          this._floatText(mon.sprite.x, mon.sprite.y - 40, `BONUS!`, '#dd44ff', 1100);
          this._floatText(mon.sprite.x, mon.sprite.y - 52, `-${br.dmg}`, '#dd44ff', 1100);
          this._spawnArcBurstVFX(mon.sprite.x, mon.sprite.y);
          this._updateMonsterSprite(mon);
          if (br.killed) { this._handleMonsterLoot(br.loot); this._onMonsterDeath(mon); }
        }
      }
    }
  }

  // ROOT SNARE — 70 % damage + 3 s root with persistent green ring
  _abilityRootSnare(mon, def) {
    const rootDur = def.rootDuration ?? 3000;
    const r = attackMonster(
      this.playerData, mon, MONSTERS_DATA, t => this.playerData.eqBonus(t), def.dmgMult
    );
    this._spawnRootVFX(mon.sprite.x, mon.sprite.y);
    this._spawnAttackVFX('druidism', this.player.x, this.player.y, mon.sprite.x, mon.sprite.y);
    this._floatText(this.player.x, this.player.y - 44, 'ROOT SNARE!', '#44ee44', 1200);
    if (r.hit) {
      this._floatText(mon.sprite.x, mon.sprite.y - 24, `-${r.dmg}`, '#44ee44', 1000);
      this._updateMonsterSprite(mon);
      mon.stunnedUntil = this.time.now + rootDur;
      this._floatText(mon.sprite.x, mon.sprite.y - 40, 'ROOTED!', '#66ff66', 1800);
      this._spawnRootRingVFX(mon, rootDur);
      if (r.killed) { this._handleMonsterLoot(r.loot); this._onMonsterDeath(mon); return; }
    } else {
      this._floatText(mon.sprite.x, mon.sprite.y - 20, 'miss', '#888888', 700);
    }
  }

  // ── Style ability VFX ─────────────────────────────────────────────────────

  _spawnThrustVFX(fromX, fromY, toX, toY) {
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const dist  = Math.hypot(toX - fromX, toY - fromY);

    // Speed line from player toward target
    const line = this.add.graphics().setDepth(14);
    line.lineStyle(3, 0xffcc22, 0.80);
    line.beginPath();
    line.moveTo(fromX + Math.cos(angle) * 10, fromY + Math.sin(angle) * 10);
    line.lineTo(fromX + Math.cos(angle) * dist * 0.58, fromY + Math.sin(angle) * dist * 0.58);
    line.strokePath();
    line.lineStyle(1, 0xffffff, 0.50);
    line.beginPath();
    line.moveTo(fromX + Math.cos(angle) * 10, fromY + Math.sin(angle) * 10);
    line.lineTo(fromX + Math.cos(angle) * dist * 0.52, fromY + Math.sin(angle) * dist * 0.52);
    line.strokePath();
    this.tweens.add({
      targets: line, alpha: 0, duration: 180, ease: 'Power2', onComplete: () => line.destroy(),
    });

    // Impact arcs at target — layered for weight
    const g = this.add.graphics().setDepth(14);
    g.x = toX; g.y = toY;
    // White core arc
    g.lineStyle(4, 0xffffff, 0.92);
    g.beginPath(); g.arc(0, 0, 18, angle - 0.65, angle + 0.65); g.strokePath();
    // Orange main arc
    g.lineStyle(3, 0xff7700, 0.90);
    g.beginPath(); g.arc(0, 0, 23, angle - 0.45, angle + 0.45); g.strokePath();
    // Gold tight inner arc
    g.lineStyle(2, 0xffcc22, 0.75);
    g.beginPath(); g.arc(0, 0, 12, angle - 0.90, angle + 0.90); g.strokePath();
    // Three small spark lines radiating from impact point
    for (let i = -1; i <= 1; i++) {
      const sa = angle + i * 0.65;
      g.lineStyle(1, 0xffffff, 0.80);
      g.beginPath();
      g.moveTo(Math.cos(sa) * 12, Math.sin(sa) * 12);
      g.lineTo(Math.cos(sa) * 24, Math.sin(sa) * 24);
      g.strokePath();
    }
    this.tweens.add({
      targets: g, alpha: 0, scaleX: 1.8, scaleY: 1.8,
      duration: 220, ease: 'Power2', onComplete: () => g.destroy(),
    });
  }

  _spawnArcBurstVFX(cx, cy) {
    // Inner bright flash
    const flash = this.add.graphics().setDepth(14);
    flash.x = cx; flash.y = cy;
    flash.fillStyle(0xee88ff, 0.65);
    flash.fillCircle(0, 0, 10);
    flash.fillStyle(0xffffff, 0.40);
    flash.fillCircle(0, 0, 5);
    this.tweens.add({
      targets: flash, alpha: 0, scaleX: 2.6, scaleY: 2.6,
      duration: 240, ease: 'Power2', onComplete: () => flash.destroy(),
    });

    // Primary expanding ring
    const r1 = this.add.graphics().setDepth(14);
    r1.x = cx; r1.y = cy;
    r1.lineStyle(3, 0xcc66ff, 0.92);
    r1.strokeCircle(0, 0, 14);
    this.tweens.add({
      targets: r1, alpha: 0, scaleX: 3.6, scaleY: 3.6,
      duration: 430, ease: 'Power2', onComplete: () => r1.destroy(),
    });

    // Lagging secondary ring
    const r2 = this.add.graphics().setDepth(13);
    r2.x = cx; r2.y = cy;
    r2.lineStyle(1, 0x884499, 0.60);
    r2.strokeCircle(0, 0, 8);
    this.tweens.add({
      targets: r2, alpha: 0, scaleX: 5.2, scaleY: 5.2,
      duration: 600, ease: 'Power2', onComplete: () => r2.destroy(),
    });

    // Filled wave
    const fill = this.add.graphics().setDepth(13);
    fill.x = cx; fill.y = cy;
    fill.fillStyle(0x9922bb, 0.17);
    fill.fillCircle(0, 0, 20);
    this.tweens.add({
      targets: fill, alpha: 0, scaleX: 3.2, scaleY: 3.2,
      duration: 380, ease: 'Power2', onComplete: () => fill.destroy(),
    });

    // 4 rotating energy arcs flying outward
    for (let i = 0; i < 4; i++) {
      const startA = (i / 4) * Math.PI * 2;
      this.time.delayedCall(i * 28, () => {
        const arc = this.add.graphics().setDepth(14);
        arc.x = cx; arc.y = cy;
        arc.lineStyle(2, 0xcc44ff, 0.80);
        arc.beginPath();
        arc.arc(0, 0, 16, startA, startA + 0.9);
        arc.strokePath();
        this.tweens.add({
          targets: arc, alpha: 0, scaleX: 2.6, scaleY: 2.6, rotation: 0.5,
          duration: 360, ease: 'Power2', onComplete: () => arc.destroy(),
        });
      });
    }
  }

  _spawnRootVFX(cx, cy) {
    const g = this.add.graphics().setDepth(14);
    g.x = cx; g.y = cy;
    g.fillStyle(0x33aa44, 0.22); g.fillCircle(0, 0, 18);
    g.lineStyle(3, 0x44dd44, 0.90); g.strokeCircle(0, 0, 14);
    g.lineStyle(1, 0x226622, 0.70); g.strokeCircle(0, 0,  8);
    this.tweens.add({
      targets: g, alpha: 0, duration: 650, ease: 'Power2',
      onComplete: () => g.destroy(),
    });
  }

  // Persistent green root ring that follows the monster for the full root duration
  _spawnRootRingVFX(mon, duration) {
    if (mon.rootRingGfx) { mon.rootRingGfx.destroy(); mon.rootRingGfx = null; }
    const g = this.add.graphics().setDepth(13);
    mon.rootRingGfx = g;

    const redraw = () => {
      if (!g.active || !mon.sprite?.active) return;
      g.clear();
      g.x = mon.sprite.x;
      g.y = mon.sprite.y;
      const pulse = 0.65 + 0.35 * Math.sin(this.time.now / 200);
      g.lineStyle(3, 0x44dd44, pulse);
      g.strokeCircle(0, 0, 15);
      g.lineStyle(1, 0x88ff88, pulse * 0.55);
      g.strokeCircle(0, 0, 21);
      // Four outward spikes to make it unmistakably "rooted"
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 2) {
        const cos = Math.cos(a + Math.PI / 4), sin = Math.sin(a + Math.PI / 4);
        g.lineStyle(2, 0x22cc22, 0.85);
        g.beginPath(); g.moveTo(cos * 15, sin * 15); g.lineTo(cos * 23, sin * 23); g.strokePath();
      }
    };

    redraw();
    const timer = this.time.addEvent({ delay: 60, loop: true, callback: redraw });

    this.time.delayedCall(duration, () => {
      timer.destroy();
      if (g.active) this.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() });
      if (mon.rootRingGfx === g) mon.rootRingGfx = null;
    });
  }

  // ── Q / W / E / R activation VFX ─────────────────────────────────────────

  _spawnHealVFX(x, y) {
    // Pulse ring — green outer, gold inner
    const ring = this.add.graphics().setDepth(14);
    ring.x = x; ring.y = y;
    ring.lineStyle(2, 0x44ff88, 0.90);
    ring.strokeCircle(0, 0, 14);
    this.tweens.add({
      targets: ring, alpha: 0, scaleX: 2.4, scaleY: 2.4,
      duration: 500, ease: 'Power2', onComplete: () => ring.destroy(),
    });
    const gold = this.add.graphics().setDepth(14);
    gold.x = x; gold.y = y;
    gold.lineStyle(1, 0xffcc44, 0.55);
    gold.strokeCircle(0, 0, 8);
    this.tweens.add({
      targets: gold, alpha: 0, scaleX: 1.9, scaleY: 1.9,
      duration: 400, delay: 55, ease: 'Power2', onComplete: () => gold.destroy(),
    });
    // 5 green motes rising from around the player
    for (let i = 0; i < 5; i++) {
      const a  = (i / 5) * Math.PI * 2;
      const ox = Math.cos(a) * 12, oy = Math.sin(a) * 12;
      this.time.delayedCall(i * 55, () => {
        const g = this.add.graphics().setDepth(14);
        g.x = x + ox; g.y = y + oy;
        g.fillStyle(i % 2 === 0 ? 0x44ff88 : 0xaaffaa, 0.90);
        g.fillCircle(0, 0, 2.5);
        this.tweens.add({
          targets: g, y: g.y - 20, alpha: 0,
          duration: 560, ease: 'Power1', onComplete: () => g.destroy(),
        });
      });
    }
  }

  _spawnShieldActivateVFX(x, y) {
    // Expanding dome oval + arc lines
    const g = this.add.graphics().setDepth(14);
    g.x = x; g.y = y;
    g.fillStyle(0x2266cc, 0.18);
    g.fillEllipse(0, 0, 54, 44);
    g.lineStyle(2, 0x44aaff, 0.92);
    g.strokeEllipse(0, 0, 54, 44);
    // Three curved arc lines across the shield face
    for (let i = 0; i < 3; i++) {
      const startA = (-Math.PI / 2) + (i - 1) * 0.68;
      g.lineStyle(1, 0x88ddff, 0.72 - i * 0.10);
      g.beginPath();
      g.arc(0, 0, 24 - i * 6, startA, startA + 1.1);
      g.strokePath();
    }
    this.tweens.add({
      targets: g, alpha: 0, scaleX: 1.75, scaleY: 1.75,
      duration: 380, ease: 'Power2', onComplete: () => g.destroy(),
    });
    // 6 sparkle motes at shield edge
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      this.time.delayedCall(i * 32, () => {
        const s = this.add.graphics().setDepth(14);
        s.x = x + Math.cos(a) * 22; s.y = y + Math.sin(a) * 17;
        s.fillStyle(0xaaddff, 0.88);
        s.fillCircle(0, 0, 2);
        this.tweens.add({
          targets: s, alpha: 0, duration: 360, ease: 'Power2', onComplete: () => s.destroy(),
        });
      });
    }
  }

  _spawnEnrageActivateVFX(x, y) {
    // Central burst flash
    const flash = this.add.graphics().setDepth(14);
    flash.x = x; flash.y = y;
    flash.fillStyle(0xff4422, 0.55);
    flash.fillCircle(0, 0, 16);
    flash.fillStyle(0xffaa44, 0.70);
    flash.fillCircle(0, 0, 8);
    this.tweens.add({
      targets: flash, alpha: 0, scaleX: 3.6, scaleY: 3.6,
      duration: 300, ease: 'Power2', onComplete: () => flash.destroy(),
    });
    // 8 outward shard rays — alternating long/short, red/orange
    for (let i = 0; i < 8; i++) {
      const a   = (i / 8) * Math.PI * 2;
      const len = i % 2 === 0 ? 22 : 14;
      this.time.delayedCall(i * 14, () => {
        const s = this.add.graphics().setDepth(14);
        s.x = x; s.y = y;
        s.lineStyle(i % 2 === 0 ? 2 : 1, i % 2 === 0 ? 0xff4422 : 0xff8844, 0.90);
        s.beginPath();
        s.moveTo(Math.cos(a) * 6, Math.sin(a) * 6);
        s.lineTo(Math.cos(a) * len, Math.sin(a) * len);
        s.strokePath();
        this.tweens.add({
          targets: s, alpha: 0, scaleX: 1.6, scaleY: 1.6,
          duration: 280, ease: 'Power2', onComplete: () => s.destroy(),
        });
      });
    }
  }

  _spawnStunReadyVFX(x, y) {
    const g = this.add.graphics().setDepth(14);
    g.x = x; g.y = y;
    g.lineStyle(3, 0xffdd22, 0.92);
    g.strokeCircle(0, 0, 18);
    g.lineStyle(1, 0xffffff, 0.58);
    g.strokeCircle(0, 0, 12);
    this.tweens.add({
      targets: g, alpha: 0, scaleX: 2.4, scaleY: 2.4,
      duration: 380, ease: 'Power2', onComplete: () => g.destroy(),
    });
  }

  _spawnStunImpactVFX(x, y) {
    // Central white/yellow flash
    const g = this.add.graphics().setDepth(14);
    g.x = x; g.y = y;
    g.fillStyle(0xffffff, 0.92);
    g.fillCircle(0, 0, 6);
    g.fillStyle(0xffdd22, 0.85);
    g.fillCircle(0, 0, 4);
    // 8 jagged starburst lines — alternating long/short
    for (let i = 0; i < 8; i++) {
      const a   = (i / 8) * Math.PI * 2;
      const len = i % 2 === 0 ? 20 : 12;
      g.lineStyle(i % 2 === 0 ? 2 : 1, i % 2 === 0 ? 0xffffff : 0xffdd22, 0.90);
      g.beginPath();
      g.moveTo(Math.cos(a) * 5, Math.sin(a) * 5);
      g.lineTo(Math.cos(a) * len, Math.sin(a) * len);
      g.strokePath();
    }
    this.tweens.add({
      targets: g, alpha: 0, scaleX: 1.9, scaleY: 1.9,
      duration: 320, ease: 'Power2', onComplete: () => g.destroy(),
    });
    // 4 small electric sparks orbiting the impact
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 8;
      this.time.delayedCall(i * 38, () => {
        const s = this.add.graphics().setDepth(14);
        s.x = x + Math.cos(a) * 14; s.y = y + Math.sin(a) * 14;
        s.fillStyle(0xffee44, 0.90);
        s.fillCircle(0, 0, 2.5);
        this.tweens.add({
          targets: s, alpha: 0, duration: 260, ease: 'Power2', onComplete: () => s.destroy(),
        });
      });
    }
  }

  // Emit current player state to UIScene via game.events
  _emitPlayerUpdate() {
    const pd = this.playerData;
    this.game.events.emit('player-update', {
      hp:        pd.hp,
      maxHp:     pd.maxHp,
      mana:      pd.mana    ?? 0,
      maxMana:   pd.maxMana ?? 25,
      coins:     pd.countItem('coins'),
      zone:      'Overworld',
      playerTileX: this.playerTileX,
      playerTileY: this.playerTileY,
      inventory: [...pd.inventory],        // [{item, qty}] — copy so UIScene gets a stable ref
      bank:      [...pd.bank],             // 400-slot bank array
      gear:      { ...pd.gear },           // {slot: itemKey | null}
      hotbar:    [...pd.hotbar],           // [itemKey|null] × 5
      skills:    Object.fromEntries(
        Object.entries(pd.skills).map(([k, v]) => [k, {
          level:  v.level,
          xpFrac: xpProg(v),
        }])
      ),
      paperPressRepaired: pd.paperPressRepaired ?? false,
      freeAbility:        pd.freeAbility        ?? false,
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  //  UPDATE
  // ════════════════════════════════════════════════════════════════════════

  update(_time, delta) {
    // ── Arrow-key movement (8-directional) ────────────────────────────────
    // All four keys are sampled independently so diagonals work naturally.
    this.arrowDelay -= delta;
    if (this.arrowDelay <= 0 && !this.moving) {
      let dx = 0, dy = 0;
      if (this.cursors.up.isDown)    dy -= 1;
      if (this.cursors.down.isDown)  dy += 1;
      if (this.cursors.left.isDown)  dx -= 1;
      if (this.cursors.right.isDown) dx += 1;
      if (dx !== 0 || dy !== 0) {
        const nx = this.playerTileX + dx, ny = this.playerTileY + dy;
        // For diagonal steps apply the same corner-cut guard as BFS
        const diagonal = dx !== 0 && dy !== 0;
        const canMove  = this._isWalkable(nx, ny) &&
          (!diagonal || (this._isWalkable(this.playerTileX + dx, this.playerTileY) &&
                         this._isWalkable(this.playerTileX, this.playerTileY + dy)));
        if (canMove) {
          this.path = [{ x: nx, y: ny }];
          this.moving = true; this.arrowDelay = 150;
          this._stopCombat(); this._stopGathering(); this.pendingAction = null;
        }
      }
    }

    // ── Smooth movement along path ─────────────────────────────────────────
    if (this.moving && this.path.length > 0) {
      const tgt   = this.path[0];
      const tgtX  = tgt.x * TILE_SIZE + TILE_SIZE / 2;
      const tgtY  = tgt.y * TILE_SIZE + TILE_SIZE / 2;
      const dx    = tgtX - this.player.x, dy = tgtY - this.player.y;
      const dist  = Math.sqrt(dx * dx + dy * dy);
      const step  = 200 * delta / 1000;

      // ── Direction + walk animation ────────────────────────────────────
      this._playerFacing = Math.abs(dx) >= Math.abs(dy)
        ? (dx > 0 ? 'right' : 'left')
        : (dy > 0 ? 'down'  : 'up');
      this.player.play((this.playerData.appearance?.gender ?? 'male') + '_walk_' + this._playerFacing, true);

      if (dist <= step) {
        this.player.x = tgtX; this.player.y = tgtY;
        this.playerTileX = tgt.x; this.playerTileY = tgt.y;
        this.path.shift();
        if (this.path.length === 0) {
          this.moving = false;
          this._setPlayerIdle();
          // ── Fire pending action on arrival ──────────────────────────────
          if (this.pendingAction) {
            const { type, tx, ty, monId } = this.pendingAction;
            if (type === 'combat') {
              const mon = this.monsters.find(m => m.id === monId && m.state !== 'dead');
              if (mon && this._isInCombatRange(mon.x, mon.y)) this._startCombat(mon);
            } else if (type === 'gather' && this._isAdjacentTo(tx, ty)) {
              const res = this.resources.find(r => r.x === tx && r.y === ty && !r.depleted);
              if (res) this._startGathering(res);
            } else if (type === 'interact') {
              const { iactType } = this.pendingAction;
              const targetIact = this.interactables.find(i => i.type === iactType);
              if (targetIact && this._isAdjacentToIact(targetIact)) {
                if (iactType === 'shop') this.game.events.emit('open-shop');
                else if (iactType === 'bank') this.game.events.emit('open-bank');
                else if (iactType === 'campfire') this._cookAtCampfire();
                else if (iactType === 'alchemy')     this.game.events.emit('open-alchemy');
                else if (iactType === 'paper_press') this.game.events.emit('open-paper-press');
                else if (iactType === 'library')     this.game.events.emit('open-library');
              }
            }
            this.pendingAction = null;
          }
          this._emitPlayerUpdate();
        }
      } else {
        this.player.x += (dx / dist) * step;
        this.player.y += (dy / dist) * step;
      }
    }

    // ── Auto combat ────────────────────────────────────────────────────────
    if (this.inCombat && this.combatTarget) {
      const mon = this.combatTarget;

      // Abort if monster died or player walked out of combat range
      if (mon.state === 'dead' || !this._isInCombatRange(mon.x, mon.y)) {
        this._stopCombat();
      } else {
        const def = MONSTERS_DATA[mon.type];

        // Player attacks
        this.playerAtkTimer -= delta;
        if (this.playerAtkTimer <= 0) {
          this.playerAtkTimer = 2400;
          const enraged  = this.time.now < this.abilities.E.activeUntil;
          const dmgMult  = enraged ? 1.5 : 1;
          const r = attackMonster(
            this.playerData, mon, MONSTERS_DATA, t => this.playerData.eqBonus(t), dmgMult
          );
          if (r.hit) {
            this._spawnAttackVFX(
              this.playerData.weaponCombatStyle,
              this.player.x, this.player.y,
              mon.sprite.x, mon.sprite.y
            );
            // Flash monster — tint for sprites, fillStyle for rectangles
            const origCol = cssHex(def.col);
            if (mon.hasSprite) {
              mon.sprite.setTint(0xffffff);
              this.time.delayedCall(120, () => mon.sprite.clearTint());
            } else {
              mon.sprite.setFillStyle(0xffffff);
              this.time.delayedCall(120, () => mon.sprite.setFillStyle(origCol));
            }
            this._updateMonsterSprite(mon);
            this._floatText(
              mon.sprite.x, mon.sprite.y - 20,
              `-${r.dmg}`, enraged ? '#ff6622' : '#ff8844', 900
            );
            // Stun Strike — consume the flag and stun the monster
            if (this.stunNextAttack) {
              this.stunNextAttack = false;
              this.abilities.R.activeUntil = 0;
              mon.stunnedUntil = this.time.now + 5000;
              this.monAtkTimer = Math.max(this.monAtkTimer, def.spd); // reset mon timer
              if (mon.hasSprite) {
                mon.sprite.setTint(0xffdd22);
                this.time.delayedCall(200, () => mon.sprite.clearTint());
              } else {
                mon.sprite.setFillStyle(0xffdd22);
                this.time.delayedCall(200, () => mon.sprite.setFillStyle(origCol));
              }
              this._floatText(mon.sprite.x, mon.sprite.y - 32, 'STUN!', '#ffdd22', 1200);
              this._spawnStunImpactVFX(mon.sprite.x, mon.sprite.y);
              this._emitAbilityUpdate();
            }
            // Immortal targets (training dummy) never call _onMonsterDeath,
            // so grant melee XP directly on each hit instead.
            if (def.immortal) {
              const style = this.playerData.weaponCombatStyle;
              this.playerData.giveXP(style, 1);
              this._emitPlayerUpdate();
            }
          } else {
            this._floatText(mon.sprite.x, mon.sprite.y - 20, 'miss', '#888888', 700);
          }
          if (r.killed) { this._handleMonsterLoot(r.loot); this._onMonsterDeath(mon); return; }
        }

        // Monster attacks — immortal targets (training dummy) never fight back
        if (!def.immortal) this.monAtkTimer -= delta;
        if (!def.immortal && this.monAtkTimer <= 0) {
          this.monAtkTimer = def.spd;
          // Stunned: cannot move or attack this tick
          if (this.time.now < (mon.stunnedUntil ?? 0)) { return; }
          // All monsters are melee — must be cardinally adjacent to attack
          const monAdjDist = Math.abs(mon.x - this.playerTileX) + Math.abs(mon.y - this.playerTileY);
          if (monAdjDist !== 1) {
            this._monsterChaseStep(mon);
            return;
          }
          const shielded = this.time.now < this.abilities.W.activeUntil;
          const r = monsterAttacksPlayer(
            mon, this.playerData, MONSTERS_DATA, t => this.playerData.eqBonus(t),
            shielded ? () => 0 : null
          );
          if (r.hit) {
            if (shielded) {
              // Show shield block feedback instead of damage
              this._floatText(this.player.x, this.player.y - 20, 'BLOCKED', '#4488ff', 800);
            } else {
              // Flash player red briefly
              this.player.setTint(0xff4444);
              this.time.delayedCall(120, () => this.player.clearTint());
              this._floatText(
                this.player.x, this.player.y - 20,
                `-${r.dmg}`, '#ff4444', 900
              );
              this._emitPlayerUpdate();
            }
          }
          if (r.died) { this._onPlayerDeath(); return; }
        }
      }
    }

    // ── Gather tick ────────────────────────────────────────────────────────
    if (this.isGathering && this.gatherTarget) {
      const res = this.gatherTarget;

      // Cancel: resource depleted or player walked out of adjacency
      if (res.depleted || !this._isAdjacentTo(res.x, res.y)) {
        this._stopGathering();
      } else {
        this.gatherTimer += delta;
        this._updateGatherBar();

        // Per-tick visual FX — fires at most once per ~700 ms
        { const _fn = this.time.now; if (!res._fxMs || _fn - res._fxMs >= 700) { res._fxMs = _fn; this._skillFx(res, 'tick'); } }

        if (this.gatherTimer >= this.gatherDuration) {
          this.gatherTimer = 0;  // reset for next cycle (continuous gather)

          const result = gatherResource(this.playerData, res, RDEFS);

          if (result.blocked) {
            // Level requirement not met (shouldn't happen, but be safe)
            this._floatText(this.player.x, this.player.y - 40,
              result.blocked, '#ff6644', 1500);
            this._stopGathering();
          } else {
            // Try to add item; stop if inventory full
            const added = this.playerData.addItem(result.item, result.qty);
            if (!added) {
              this._floatText(this.player.x, this.player.y - 40,
                'Inventory full!', '#ff6644', 1500);
              this._stopGathering();
            } else {
              // Award XP
              const xpRes = this.playerData.giveXP(result.skill, result.xp);
              this._floatText(
                this.player.x, this.player.y - 34,
                `+${result.xp} ${result.skill.slice(0, 4).toUpperCase()} XP`, '#44cc88', 1000
              );
              if (xpRes.leveledUp) {
                this._floatText(
                  this.player.x, this.player.y - 50,
                  `${result.skill.toUpperCase()} LV UP!`, '#f0c050', 2200
                );
              }
              this._skillFx(res, 'success');

              // Deplete resource if rolled
              if (result.depleted) {
                res.depleted = true;
                this._drawResources();
                this.time.delayedCall(RDEFS[res.type].respawn, () => {
                  res.depleted = false;
                  this._drawResources();
                });
                this._stopGathering();
              }
              // Otherwise: gatherTimer is already 0, next cycle begins automatically
            }
            this._emitPlayerUpdate();
          }
        }
      }
    }

    // ── Monster wander (idle only — skip aggro, immortal, dead, stunned) ───
    for (const mon of this.monsters) {
      if (mon.immortal || mon.state !== 'idle') continue;
      if (this.time.now < (mon.stunnedUntil ?? 0)) continue;
      mon.wanderTimer -= delta;
      if (mon.wanderTimer > 0) continue;
      mon.wanderTimer = 2500 + Math.random() * 1500;
      const DIRS = [[0,-1],[0,1],[-1,0],[1,0]];
      const [dx, dy] = DIRS[Math.floor(Math.random() * 4)];
      const nx = mon.x + dx, ny = mon.y + dy;
      if (
        nx >= 0 && nx < this.mapW && ny >= 0 && ny < this.mapH &&
        WALKABLE.has(this.map[ny][nx]) &&
        Math.abs(nx - mon.spawnX) + Math.abs(ny - mon.spawnY) <= 5 &&
        !this.resources.some(r => r.x === nx && r.y === ny && !r.depleted) &&
        !this.monsters.some(m => m !== mon && m.x === nx && m.y === ny && m.state !== 'dead') &&
        !this.interactables.some(i => i.x === nx && i.y === ny)
      ) {
        if (mon.hasSprite) {
          mon.facing = dx !== 0 ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
          const MOB_IDLE = { down: 0, left: 10, right: 20, up: 30 };
          mon.sprite.setFrame(MOB_IDLE[mon.facing] ?? 0);
        }
        mon.x = nx; mon.y = ny;
        this._updateMonsterSprite(mon);
      }
    }


    // ── Ability visual effects (shield dome, rage aura) ───────────────────
    const nowVis = this.time.now;
    this.abilityGfx.clear();
    if (nowVis < this.abilities.W.activeUntil) {
      const px = this.player.x, py = this.player.y;
      const pulse = 0.65 + 0.25 * Math.sin(nowVis / 290);
      // Semi-transparent dome fill
      this.abilityGfx.fillStyle(0x1144aa, 0.10 * pulse);
      this.abilityGfx.fillEllipse(px, py, 52, 44);
      // Main shield outline
      this.abilityGfx.lineStyle(2, 0x44aaff, 0.82 * pulse);
      this.abilityGfx.strokeEllipse(px, py, 52, 44);
      // Outer glow ring
      this.abilityGfx.lineStyle(1, 0x88ddff, 0.28 * pulse);
      this.abilityGfx.strokeEllipse(px, py, 64, 54);
      // Two curved arc lines across the dome face
      for (let i = 0; i < 2; i++) {
        const startA = (-Math.PI / 2) + (i - 0.5) * 0.85;
        this.abilityGfx.lineStyle(1, 0x66ccff, 0.48 * pulse);
        this.abilityGfx.beginPath();
        this.abilityGfx.arc(px, py, 22 - i * 7, startA, startA + 1.2);
        this.abilityGfx.strokePath();
      }
    }
    if (nowVis < this.abilities.E.activeUntil) {
      const px  = this.player.x, py = this.player.y;
      const t   = nowVis / 1000;
      const pulse = 0.60 + 0.40 * Math.sin(t * 3.8);
      // Inner core fill
      this.abilityGfx.fillStyle(0xff4422, 0.08 * pulse);
      this.abilityGfx.fillCircle(px, py, 22);
      // Pulsing main ring
      this.abilityGfx.lineStyle(2, 0xff4422, 0.82 * pulse);
      this.abilityGfx.strokeCircle(px, py, 22);
      // Outer faint ring
      this.abilityGfx.lineStyle(1, 0xff8844, 0.32 * pulse);
      this.abilityGfx.strokeCircle(px, py, 29 + Math.sin(t * 2.2) * 2);
      // 4 rotating arc segments — flame-like rotation
      const rot = t * 1.3;
      for (let i = 0; i < 4; i++) {
        const a   = rot + (i / 4) * Math.PI * 2;
        const rr  = 19 + Math.sin(t * 2.6 + i) * 2;
        const col = i % 2 === 0 ? 0xff4422 : 0xff8844;
        this.abilityGfx.lineStyle(2, col, 0.55 * pulse);
        this.abilityGfx.beginPath();
        this.abilityGfx.arc(px, py, rr, a, a + 0.75);
        this.abilityGfx.strokePath();
      }
    }

    // ── Throttled ability-update emit (keeps cooldown countdowns fresh) ───
    this._abilityEmitTimer -= delta;
    if (this._abilityEmitTimer <= 0) {
      this._abilityEmitTimer = 250;
      this._emitAbilityUpdate();
    }
  }
}
