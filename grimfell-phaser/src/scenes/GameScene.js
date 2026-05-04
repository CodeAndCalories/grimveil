import Phaser from 'phaser';
import ZONES_CFG     from '../data/zones.json';
import MONSTERS_DATA from '../data/monsters.json';
import RDEFS                     from '../data/resources.json';
import { Player, SAVE_KEY }     from '../entities/Player.js';
import { attackMonster, monsterAttacksPlayer, killXP } from '../systems/CombatSystem.js';
import { gatherResource }       from '../systems/GatherSystem.js';
import { xpProg }               from '../shared/GameMath.js';

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
export const MAP_W     = ZONES_CFG.overworld.size.w;  // 42
export const MAP_H     = ZONES_CFG.overworld.size.h;  // 30

// ── Tile types ────────────────────────────────────────────────────────────────
const T = {
  GRASS:0, WATER:1, MOUNTAIN:2, PATH:3,
  SAND:4,  DGRASS:5, FLOOR:6,  WALL:7, DFLOOR:8,
};
const WALKABLE = new Set([T.GRASS, T.PATH, T.SAND, T.DGRASS, T.FLOOR, T.DFLOOR]);

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
  dungeon_entrance:0x8860c0, dungeon_exit:0x8860c0,
};

// ── Resource visual specs ─────────────────────────────────────────────────────
const RES_VIS = {
  tree:         { shape:'tree', crown:0x1e7a0a, trunk:0x6b3a10, r:11 },
  oak:          { shape:'tree', crown:0x0a5206, trunk:0x3a2008, r:13 },
  copper_rock:  { shape:'rock', body:0x8a7040, shine:0xb09460 },
  iron_rock:    { shape:'rock', body:0x58585e, shine:0x7a7a84 },
  fishing_spot: { shape:'fish', body:0x1e5aa8 },
  trout_spot:   { shape:'fish', body:0x2a70c8 },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function cssHex(str) { return parseInt(str.replace('#', ''), 16); }

function makeRng(seed) {
  let s = seed >>> 0;
  return () => { s = Math.imul(s, 1664525) + 1013904223 >>> 0; return s / 4294967296; };
}

// ── Overworld map builder ─────────────────────────────────────────────────────
function buildOverworld() {
  const { w, h } = ZONES_CFG.overworld.size;
  const rng = makeRng(0xdeadbeef);
  const map  = Array.from({ length: h }, () => new Array(w).fill(T.GRASS));

  for (let y = h - 4; y < h; y++) for (let x = 0; x < w; x++) map[y][x] = T.WATER;
  for (let x = 0; x < w; x++) { map[h-5][x] = T.SAND; map[h-6][x] = T.SAND; }
  for (let y = 0; y < h - 6; y++) for (let x = w - 9; x < w; x++) map[y][x] = T.MOUNTAIN;
  for (const [my, mx] of [
    [6,30],[6,31],[7,29],[7,30],[8,28],[8,29],[9,28],[10,28],
    [10,29],[11,28],[12,28],[13,28],[14,27],[15,28],[16,28],
  ]) { if (my < h && mx < w) map[my][mx] = T.MOUNTAIN; }
  for (let y = 0; y < 11; y++) for (let x = 0; x < w - 10; x++) if (rng() < 0.42) map[y][x] = T.DGRASS;
  for (let y = 11; y < 17; y++) for (let x = 14; x < 29; x++) map[y][x] = T.FLOOR;
  for (let x = 13; x < 30; x++) { map[17][x] = T.PATH; map[10][x] = T.PATH; map[13][x] = T.PATH; }
  for (let x = 0; x < w - 9; x++) { map[18][x] = T.PATH; map[19][x] = T.PATH; }
  for (let y = 0; y < h - 4; y++) { map[y][20] = T.PATH; map[y][21] = T.PATH; }
  for (let y = 24; y < 27; y++) for (let x = 18; x < 25; x++) map[y][x] = T.FLOOR;
  for (let penX = 12; penX <= 16; penX++) { map[20][penX] = T.PATH; map[22][penX] = T.PATH; }
  for (let penY = 20; penY <= 22; penY++) { map[penY][12] = T.PATH; map[penY][16] = T.PATH; }
  map[20][14] = T.GRASS;
  return map;
}

// ── BFS with caller-supplied walkable predicate ───────────────────────────────
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
    for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
      const nx = cx + dx, ny = cy + dy, key = `${nx},${ny}`;
      if (!visited.has(key) && walkFn(nx, ny)) {
        visited.set(key, `${cx},${cy}`);
        queue.push([nx, ny]);
      }
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

  create() {
    // ── Player data — try to restore from localStorage first ──────────────
    this.playerData = new Player();
    const rawSave = localStorage.getItem(SAVE_KEY);
    if (rawSave) {
      try {
        Player.fromJSON(JSON.parse(rawSave), this.playerData);
      } catch (e) {
        console.warn('[save] Could not parse save — starting fresh:', e);
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

    // ── Gather state ───────────────────────────────────────────────────────
    this.isGathering    = false;
    this.gatherTarget   = null;   // resource object being gathered
    this.gatherTimer    = 0;      // elapsed ms in current gather cycle
    this.gatherDuration = 0;      // total ms for one gather (from RDEFS)

    this.map  = buildOverworld();
    this.mapW = MAP_W;
    this.mapH = MAP_H;

    this.pendingAction = null;

    // ── Gather progress bar (hidden until gathering starts) ───────────────
    // Background rect (dark, slightly larger) + white fill rect (left-anchored)
    this.gatherBarBg   = this.add.rectangle(0, 0, 34, 6, 0x111111)
                           .setDepth(13).setVisible(false);
    this.gatherBarFill = this.add.rectangle(0, 0, 1, 4, 0xffffff)
                           .setOrigin(0, 0.5).setDepth(14).setVisible(false);

    // ── Graphics layers ───────────────────────────────────────────────────
    this.tilesGfx     = this.add.graphics().setDepth(0);
    this.gridGfx      = this.add.graphics().setDepth(1);
    this.iactGfx      = this.add.graphics().setDepth(2);
    this.resourcesGfx = this.add.graphics().setDepth(3);
    this.clickGfx     = this.add.graphics().setDepth(5);
    this.iactTexts    = [];

    // ── World data ────────────────────────────────────────────────────────
    this._buildInteractables();
    this._buildResources();
    this._buildMonsters();

    // ── Static draws ──────────────────────────────────────────────────────
    this._drawMap();
    this._drawGrid();
    this._drawInteractables();
    this._drawResources();

    // ── Player sprite — use saved position if available, else zone default ─
    const spawn      = ZONES_CFG.overworld.playerStart;
    this.playerTileX = this.playerData.x ?? spawn.x;
    this.playerTileY = this.playerData.y ?? spawn.y;

    this.playerSprite = this.add.rectangle(
      this.playerTileX * TILE_SIZE + TILE_SIZE / 2,
      this.playerTileY * TILE_SIZE + TILE_SIZE / 2,
      20, 28, 0xffffff
    ).setDepth(10);
    // Keep 'this.player' alias so nothing else breaks
    this.player = this.playerSprite;

    this.playerOutline = this.add.graphics().setDepth(11);
    this._drawPlayerOutline();

    // ── Movement state ────────────────────────────────────────────────────
    this.path       = [];
    this.moving     = false;
    this.arrowDelay = 0;

    // ── Camera ────────────────────────────────────────────────────────────
    this._updateViewport();
    this.cameras.main.setBounds(0, 0, this.mapW * TILE_SIZE, this.mapH * TILE_SIZE);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(1.5);

    // ── Input ─────────────────────────────────────────────────────────────
    this.cursors = this.input.keyboard.createCursorKeys();

    this.input.on('pointerdown', (pointer) => {
      const { width, height } = this.scale;
      const { TOP_H: dTH, BOTTOM_H: dBH, RIGHT_W: dRW } = this._dyn;
      if (pointer.x < MARGIN + JOURNAL_W + GAP || pointer.x > MARGIN + JOURNAL_W + GAP + (width - dRW - JOURNAL_W - GAP * 2 - MARGIN * 3)) return;
      if (pointer.y < dTH + MARGIN || pointer.y > height - dBH - MARGIN) return;

      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const tx = Math.floor(world.x / TILE_SIZE);
      const ty = Math.floor(world.y / TILE_SIZE);
      if (tx < 0 || tx >= this.mapW || ty < 0 || ty >= this.mapH) return;

      this._flashTile(tx, ty);

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
        // Already fighting this monster and standing next to it: let the auto-attack
        // timer tick on its own — re-clicking must NOT reset the timer.
        if (
          this.inCombat &&
          this.combatTarget?.id === mon.id &&
          this._isAdjacentTo(mon.x, mon.y)
        ) return;

        // New target (or need to walk closer): stop previous combat, path to monster
        this._stopCombat();
        const route = this._pathAdj(tx, ty);
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
      const iact = this.interactables.find(i => i.x === tx && i.y === ty);
      if (iact) {
        const route = this._pathAdj(tx, ty);
        if (route !== null) {
          if (route.length === 0) { /* already adjacent — no action needed */ }
          else { this._stopCombat(); this._stopGathering();
                 this.path = route; this.moving = true;
                 this.pendingAction = { type: 'interact', tx, ty, label: iact.label }; }
        }
        return;
      }

      // Plain tile walk — cancel combat and gathering
      if (!this._isWalkable(tx, ty)) return;
      this._stopCombat(); this._stopGathering();
      const route = bfsWithFn(
        this.playerTileX, this.playerTileY, tx, ty,
        (x, y) => this._isWalkable(x, y)
      );
      if (route && route.length > 0) {
        this.path = route; this.moving = true; this.pendingAction = null;
      }
    });

    this.scale.on('resize', () => this._updateViewport());

    // ── Save / load wiring ────────────────────────────────────────────────
    this.game.events.on('ui-save', () => this._saveGame());
    this.time.addEvent({ delay: 60000, loop: true, callback: () => this._saveGame() });
    // Save on page unload — catches browser refresh before auto-save fires
    this._boundSave = () => this._saveGame();
    window.addEventListener('beforeunload', this._boundSave);

    // UIScene runs create() AFTER GameScene, so a direct emit here is missed.
    // Instead, respond to ui-ready so UIScene pulls state once its listener is live.
    this.game.events.once('ui-ready', () => this._emitPlayerUpdate());
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
      for (const [x, y] of coords) this.resources.push({ type, x, y, depleted: false });
    }
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
        const wx = x * TILE_SIZE + TILE_SIZE / 2;
        const wy = y * TILE_SIZE + TILE_SIZE / 2;
        mon.spriteBg = this.add.rectangle(wx, wy, 26, 30, cssHex(def.col2 ?? def.col)).setDepth(6);
        mon.sprite   = this.add.rectangle(wx, wy, 24, 28, cssHex(def.col)).setDepth(7);
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

  // ── Draw helpers ──────────────────────────────────────────────────────────

  _drawMap() {
    const g = this.tilesGfx; g.clear();
    for (let y = 0; y < this.mapH; y++) {
      for (let x = 0; x < this.mapW; x++) {
        const t = this.map[y][x];
        g.fillStyle((x + y) % 2 === 0 ? TC[t] : TC_ALT[t], 1);
        g.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  _drawGrid() {
    const g = this.gridGfx; g.clear();
    g.lineStyle(1, 0x000000, 0.08);
    for (let x = 0; x <= this.mapW; x++)
      g.lineBetween(x * TILE_SIZE, 0, x * TILE_SIZE, this.mapH * TILE_SIZE);
    for (let y = 0; y <= this.mapH; y++)
      g.lineBetween(0, y * TILE_SIZE, this.mapW * TILE_SIZE, y * TILE_SIZE);
  }

  _drawInteractables() {
    const g = this.iactGfx; g.clear();
    this.iactTexts.forEach(t => t.destroy()); this.iactTexts = [];
    for (const iact of this.interactables) {
      const px = iact.x * TILE_SIZE, py = iact.y * TILE_SIZE;
      const col = IACT_COLORS[iact.type] ?? 0xffffff, sz = 22, off = (TILE_SIZE - sz) / 2;
      g.fillStyle(col, 0.85); g.fillRect(px + off, py + off, sz, sz);
      g.lineStyle(1, 0x000000, 0.6); g.strokeRect(px + off, py + off, sz, sz);
      this.iactTexts.push(
        this.add.text(px + TILE_SIZE / 2, py - 2, iact.label,
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
        g.lineStyle(1, vis.body, 0.30); g.strokeCircle(cx, cy, 14);
        g.lineStyle(1, vis.body, 0.55); g.strokeCircle(cx, cy, 9);
        g.fillStyle(vis.body, 0.9);     g.fillCircle(cx, cy, 5);
        g.fillStyle(0xffffff, 0.4);     g.fillCircle(cx-1, cy-1, 2);
      }
    }
  }

  _updateMonsterSprite(mon) {
    const wx = mon.x * TILE_SIZE + TILE_SIZE / 2;
    const wy = mon.y * TILE_SIZE + TILE_SIZE / 2;
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

    // Flash red then restore to white
    this.player.setFillStyle(0xff2222);
    this.time.delayedCall(600, () => this.player.setFillStyle(0xffffff));

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

  // ── Walkable / path helpers ───────────────────────────────────────────────

  _isWalkable(tx, ty) {
    if (tx < 0 || tx >= this.mapW || ty < 0 || ty >= this.mapH) return false;
    if (!WALKABLE.has(this.map[ty][tx])) return false;
    if (this.resources.some(r => r.x === tx && r.y === ty && !r.depleted)) return false;
    if (this.monsters.some(m => m.x === tx && m.y === ty && m.state !== 'dead')) return false;
    if (this.interactables.some(i => i.x === tx && i.y === ty)) return false;
    return true;
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

  // ── Misc helpers ──────────────────────────────────────────────────────────

  _flashTile(tx, ty) {
    this.clickGfx.clear();
    this.clickGfx.fillStyle(0xffffff, 0.22);
    this.clickGfx.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    this.time.delayedCall(200, () => this.clickGfx.clear());
  }

  _drawPlayerOutline() {
    this.playerOutline.clear();
    this.playerOutline.lineStyle(1, 0xc9a84c, 0.75);
    this.playerOutline.strokeRect(this.player.x - 11, this.player.y - 15, 22, 30);
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

  // Emit current player state to UIScene via game.events
  _emitPlayerUpdate() {
    const pd = this.playerData;
    this.game.events.emit('player-update', {
      hp:        pd.hp,
      maxHp:     pd.maxHp,
      coins:     pd.countItem('coins'),
      zone:      'Overworld',
      playerTileX: this.playerTileX,
      playerTileY: this.playerTileY,
      inventory: [...pd.inventory],        // [{item, qty}] — copy so UIScene gets a stable ref
      gear:      { ...pd.gear },           // {slot: itemKey | null}
      skills:    Object.fromEntries(
        Object.entries(pd.skills).map(([k, v]) => [k, {
          level:  v.level,
          xpFrac: xpProg(v),
        }])
      ),
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  //  UPDATE
  // ════════════════════════════════════════════════════════════════════════

  update(_time, delta) {
    // ── Arrow-key movement ─────────────────────────────────────────────────
    this.arrowDelay -= delta;
    if (this.arrowDelay <= 0 && !this.moving) {
      let dx = 0, dy = 0;
      if      (this.cursors.up.isDown)    dy = -1;
      else if (this.cursors.down.isDown)  dy =  1;
      else if (this.cursors.left.isDown)  dx = -1;
      else if (this.cursors.right.isDown) dx =  1;
      if (dx !== 0 || dy !== 0) {
        const nx = this.playerTileX + dx, ny = this.playerTileY + dy;
        if (this._isWalkable(nx, ny)) {
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

      if (dist <= step) {
        this.player.x = tgtX; this.player.y = tgtY;
        this.playerTileX = tgt.x; this.playerTileY = tgt.y;
        this.path.shift();
        if (this.path.length === 0) {
          this.moving = false;
          // ── Fire pending action on arrival ──────────────────────────────
          if (this.pendingAction) {
            const { type, tx, ty, monId } = this.pendingAction;
            if (type === 'combat') {
              const mon = this.monsters.find(m => m.id === monId && m.state !== 'dead');
              if (mon && this._isAdjacentTo(mon.x, mon.y)) this._startCombat(mon);
            } else if (type === 'gather' && this._isAdjacentTo(tx, ty)) {
              const res = this.resources.find(r => r.x === tx && r.y === ty && !r.depleted);
              if (res) this._startGathering(res);
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

      // Abort if monster died or player walked away
      if (mon.state === 'dead' || !this._isAdjacentTo(mon.x, mon.y)) {
        this._stopCombat();
      } else {
        const def = MONSTERS_DATA[mon.type];

        // Player attacks
        this.playerAtkTimer -= delta;
        if (this.playerAtkTimer <= 0) {
          this.playerAtkTimer = 2400;
          const r = attackMonster(
            this.playerData, mon, MONSTERS_DATA, t => this.playerData.eqBonus(t)
          );
          if (r.hit) {
            // Flash monster white briefly
            const origCol = cssHex(def.col);
            mon.sprite.setFillStyle(0xffffff);
            this.time.delayedCall(120, () => mon.sprite.setFillStyle(origCol));
            this._updateMonsterSprite(mon);
            this._floatText(
              mon.sprite.x, mon.sprite.y - 20,
              `-${r.dmg}`, '#ff8844', 900
            );
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
          if (r.killed) { this._onMonsterDeath(mon); return; }
        }

        // Monster attacks — immortal targets (training dummy) never fight back
        if (!def.immortal) this.monAtkTimer -= delta;
        if (!def.immortal && this.monAtkTimer <= 0) {
          this.monAtkTimer = def.spd;
          const r = monsterAttacksPlayer(
            mon, this.playerData, MONSTERS_DATA, t => this.playerData.eqBonus(t)
          );
          if (r.hit) {
            // Flash player red briefly
            this.player.setFillStyle(0xff2222);
            this.time.delayedCall(120, () => this.player.setFillStyle(0xffffff));
            this._floatText(
              this.player.x, this.player.y - 20,
              `-${r.dmg}`, '#ff4444', 900
            );
            this._emitPlayerUpdate();
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

    // ── Monster wander (idle only — skip aggro, immortal, dead) ───────────
    for (const mon of this.monsters) {
      if (mon.immortal || mon.state !== 'idle') continue;
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
        mon.x = nx; mon.y = ny;
        this._updateMonsterSprite(mon);
      }
    }

    // ── Sync player outline ────────────────────────────────────────────────
    this._drawPlayerOutline();
  }
}
