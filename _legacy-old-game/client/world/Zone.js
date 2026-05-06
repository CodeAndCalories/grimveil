import { T } from '../../shared/constants.js';
import {
  P, ZONES_CFG,
  resources, monsters, IACTS,
  setZone, setMap, setResources, setMonsters,
  uid, updateCam, snapCam,
} from '../core/state.js';
import { Monster } from '../entities/Monster.js';
import { chat } from '../ui/chat.js';
import { renderSkills, renderInv, renderEquip, updateHP } from '../ui/sidebar.js';

export class Zone {
  constructor(name, width, height, tiles, resources, monsters, interactables) {
    this.name         = name;
    this.width        = width;
    this.height       = height;
    this.tiles        = tiles;          // 2D array [y][x] of tile type ints
    this.resources    = resources;      // [{id, type, x, y, zone, depleted}]
    this.monsters     = monsters;       // [{type, x, y}] spawn specs
    this.interactables = interactables; // [{id, type, x, y, zone, label}] — all zones
  }
}

function buildAllInteractables() {
  const result = [];
  for (const [zoneName, cfg] of Object.entries(ZONES_CFG)) {
    for (const ia of cfg.interactables) {
      result.push({ id: uid(), ...ia, zone: zoneName });
    }
  }
  return result;
}

export function buildOverworld() {
  const cfg = ZONES_CFG.overworld;
  const w = cfg.size.w, h = cfg.size.h;

  const tiles = [];
  for (let y = 0; y < h; y++) { tiles[y] = []; for (let x = 0; x < w; x++) tiles[y][x] = T.GRASS; }

  for (let y = h - 4; y < h; y++) for (let x = 0; x < w; x++) tiles[y][x] = T.WATER;
  for (let x = 0; x < w; x++) { tiles[h - 5][x] = T.SAND; tiles[h - 6][x] = T.SAND; }

  for (let y = 0; y < h - 6; y++) for (let x = w - 9; x < w; x++) tiles[y][x] = T.MOUNTAIN;
  [[6,30],[6,31],[7,29],[7,30],[8,28],[8,29],[9,28],[10,28],[10,29],
   [11,28],[12,28],[13,28],[14,27],[15,28],[16,28]].forEach(([y, x]) => {
    if (y < h && x < w) tiles[y][x] = T.MOUNTAIN;
  });

  for (let y = 0; y < 11; y++) for (let x = 0; x < w - 10; x++)
    if (Math.random() < 0.42) tiles[y][x] = T.DGRASS;

  // Town floor + border paths
  for (let y = 11; y < 17; y++) for (let x = 14; x < 29; x++) tiles[y][x] = T.FLOOR;
  for (let x = 13; x < 30; x++) { tiles[17][x] = T.PATH; tiles[10][x] = T.PATH; }
  // Market street — horizontal road through town at y=13
  for (let x = 13; x < 30; x++) tiles[13][x] = T.PATH;

  for (let x = 0; x < w - 9; x++) { tiles[18][x] = T.PATH; tiles[19][x] = T.PATH; }
  for (let y = 0; y < h - 4; y++) { tiles[y][20] = T.PATH; tiles[y][21] = T.PATH; }

  for (let y = 24; y < 27; y++) for (let x = 18; x < 25; x++) tiles[y][x] = T.FLOOR;

  // Chicken pen — PATH fence border, gap at [14,20] (north entrance)
  for (let penX = 12; penX <= 16; penX++) { tiles[20][penX] = T.PATH; tiles[22][penX] = T.PATH; }
  for (let penY = 20; penY <= 22; penY++) { tiles[penY][12] = T.PATH; tiles[penY][16] = T.PATH; }
  tiles[20][14] = T.GRASS; // entrance gap

  const res = [];
  for (const [type, coords] of Object.entries(cfg.resources)) {
    for (const [x, y] of coords) {
      if (y < h && x < w
          && tiles[y][x] !== T.WATER && tiles[y][x] !== T.MOUNTAIN
          && tiles[y][x] !== T.FLOOR && tiles[y][x] !== T.PATH) {
        res.push({ id: uid(), type, x, y, zone: 'overworld', depleted: false });
      }
    }
  }

  const monSpecs = [];
  for (const { type, spawns } of cfg.monsters) {
    for (const [x, y] of spawns) monSpecs.push({ type, x, y });
  }

  return new Zone('overworld', w, h, tiles, res, monSpecs, buildAllInteractables());
}

export function buildDungeon() {
  const cfg = ZONES_CFG.dungeon;
  const dw = cfg.size.w, dh = cfg.size.h;

  const tiles = [];
  for (let y = 0; y < dh; y++) { tiles[y] = []; for (let x = 0; x < dw; x++) tiles[y][x] = T.WALL; }
  for (let y = 1; y < dh - 1; y++) for (let x = 1; x < dw - 1; x++) tiles[y][x] = T.DFLOOR;
  for (let x = 0; x < dw; x++) tiles[10][x] = T.WALL;
  tiles[10][12] = T.DFLOOR; tiles[10][13] = T.DFLOOR;

  const monSpecs = [];
  for (const { type, spawns } of cfg.monsters) {
    for (const [x, y] of spawns) monSpecs.push({ type, x, y });
  }

  return new Zone('dungeon', dw, dh, tiles, [], monSpecs, buildAllInteractables());
}

export function spawnMon(type, x, y, zone = 'overworld') {
  monsters.push(Monster.spawn(type, x, y, zone));
}

export function applyZone(zone) {
  setZone(zone.name);
  setMap(zone.tiles);
  setResources([...resources.filter(r => r.zone !== zone.name), ...zone.resources]);
  setMonsters(monsters.filter(m => m.zone !== zone.name));
  zone.monsters.forEach(spec => spawnMon(spec.type, spec.x, spec.y, zone.name));
  IACTS.length = 0;
  zone.interactables.forEach(ia => IACTS.push(ia));
}

export function buildZone(zoneName) {
  applyZone(zoneName === 'overworld' ? buildOverworld() : buildDungeon());
}

export function changeZone(zoneName, px, py) {
  applyZone(zoneName === 'overworld' ? buildOverworld() : buildDungeon());
  P.x = px; P.y = py; P.path = []; P.action = null;
  updateCam(); snapCam();
  chat(`Entered: ${zoneName === 'dungeon' ? '🕯️ The Dungeon' : '🌍 Overworld'}`, 'sys');
  renderSkills(); renderInv(); renderEquip(); updateHP();
}
