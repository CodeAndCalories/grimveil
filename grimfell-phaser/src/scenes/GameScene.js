import Phaser from 'phaser';
import ZONES_CFG     from '../data/zones.json';
import MONSTERS_DATA from '../data/monsters.json';
import ITEMS_DATA    from '../data/items.json';
import RDEFS                     from '../data/resources.json';
import { Player, SAVE_KEY }     from '../entities/Player.js';
import { attackMonster, monsterAttacksPlayer, killXP } from '../systems/CombatSystem.js';
import { gatherResource }       from '../systems/GatherSystem.js';
import { cookOne }              from '../systems/CookingSystem.js';
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

// ── Monster type → spritesheet key (undefined = rectangle fallback) ───────────
const MOB_SPRITE_MAP = {
  chicken:         'chicken',
  rat:             'giant_rat',
  goblin:          'goblin1',
  skeleton:        'skeleton1',
  cow:             'cow1',
  training_dummy:  'dummy1',
};

// ── Interactable type → sprite key (undefined = coloured rectangle fallback) ──
const IACT_SPRITE_MAP = {
  campfire: 'campfire_spr',
  bank:     'chest_spr',
  shop:     'starter_shop',
};

// ── Resource visual specs (spriteKey/sw/sh → image; no spriteKey → graphics) ──
const RES_VIS = {
  tree:            { shape:'tree', crown:0x1e7a0a, trunk:0x6b3a10, r:11, spriteKey:'oak_tree',  sw:48, sh:48 },
  oak:             { shape:'tree', crown:0x0a5206, trunk:0x3a2008, r:13, spriteKey:'oak_tree',  sw:56, sh:56 },
  copper_rock:     { shape:'rock', body:0x8a7040, shine:0xb09460,       spriteKey:'grey_rock', sw:32, sh:32 },
  iron_rock:       { shape:'rock', body:0x58585e, shine:0x7a7a84,       spriteKey:'grey_rock', sw:32, sh:32 },
  fishing_spot:    { shape:'fish', body:0x1e5aa8 },
  trout_spot:      { shape:'fish', body:0x2a70c8 },
  herb_bitterleaf: { shape:'herb', color:0x4cb840, spriteKey:'lush_bush', sw:26, sh:26 },
  herb_mooncap:    { shape:'herb', color:0xd4d490, spriteKey:'lush_bush', sw:26, sh:26 },
  herb_redroot:    { shape:'herb', color:0xc03828, spriteKey:'lush_bush', sw:26, sh:26 },
};

// ── Ability definitions ───────────────────────────────────────────────────────
const ABILITY_DEFS = {
  Q: { name: 'Minor Heal',  cooldown: 7000,  activeDuration: 0     },
  W: { name: 'Iron Shield', cooldown: 35000, activeDuration: 8000  },
  E: { name: 'Enrage',      cooldown: 45000, activeDuration: 30000 },
  R: { name: 'Stun Strike', cooldown: 30000, activeDuration: 0     },
};

// ── Cooking recipes ───────────────────────────────────────────────────────────
const COOK_RECIPES = {
  raw_fish:  { reqLvl: 1,  result: 'cooked_fish',  xp: 30, baseBurnChance: 0.55, burnReductionPerLevel: 0.03, minBurnChance: 0.05 },
  raw_trout: { reqLvl: 20, result: 'cooked_trout', xp: 70, baseBurnChance: 0.75, burnReductionPerLevel: 0.02, minBurnChance: 0.10 },
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

  preload() {
    this.load.spritesheet('male_sprites',   'assets/sprites/male_player_sprites_clean_10col.png',   { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('female_sprites', 'assets/sprites/female_player_sprites_clean_10col.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('chicken',    'assets/sprites/chicken.png',   { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('giant_rat',  'assets/sprites/giant_rat.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('goblin1',    'assets/sprites/goblin1.png',   { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('skeleton1',  'assets/sprites/skeleton1.png',  { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('cow1',       'assets/sprites/cow1.png',       { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('dummy1',     'assets/sprites/dummy1.png',     { frameWidth: 96, frameHeight: 96 });
    this.load.image('starter_shop', 'assets/sprites/starter_shop.png');
    this.load.on('filecomplete-spritesheet-cow1', () => {
      const img = this.textures.get('cow1').getSourceImage();
      console.log('[cow1] loaded texture size:', img.width + 'x' + img.height);
    });
    this.load.image('oak_tree',     'assets/sprites/Nature/Oak_Tree_Type_A.png');
    this.load.image('grey_rock',    'assets/sprites/Nature/Grey_Rock_Type_A.png');
    this.load.image('lush_bush',    'assets/sprites/Nature/Lush_Bush_Type_B.png');
    this.load.image('campfire_spr', 'assets/sprites/Props_and_Loot/Campfire_Type_A.png');
    this.load.image('chest_spr',    'assets/sprites/Village_and_Camp/Wooden_Chest_Type_A.png');
    this.load.image('coin_spr',     'assets/sprites/Village_and_Camp/Gold_Coin_Type_A.png');
  }

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
      // One-time migration: grant starter weapons if none present
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
    };
    this.stunNextAttack   = false;
    this.abilityGfx       = this.add.graphics().setDepth(12);
    this._abilityEmitTimer = 0;

    // ── Cook state ────────────────────────────────────────────────────────
    this._isCooking     = false;

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

    // ── World data ────────────────────────────────────────────────────────
    this._buildInteractables();
    this._buildResources();
    this._buildMonsters();

    // ── Static draws ──────────────────────────────────────────────────────
    this._drawMap();
    this._drawGrid();
    this._drawInteractables();
    this._drawResources();

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

    // ── Input ─────────────────────────────────────────────────────────────
    this.cursors = this.input.keyboard.createCursorKeys();

    // Ability hotkeys — fire once per keypress (keydown, not held)
    this.input.keyboard.on('keydown-Q', () => this._useAbility('Q'));
    this.input.keyboard.on('keydown-W', () => this._useAbility('W'));
    this.input.keyboard.on('keydown-E', () => this._useAbility('E'));
    this.input.keyboard.on('keydown-R', () => this._useAbility('R'));

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
          } else {
            this._stopCombat(); this._stopGathering();
            this.path = route; this.moving = true;
            this.pendingAction = { type: 'interact', tx: iact.x, ty: iact.y, iactType: iact.type };
          }
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
      const result = this.playerData.equip(itemKey);
      if (result) {
        this._emitPlayerUpdate();
        this._floatText(this.player.x, this.player.y - 44, `Equipped ${result.name}`, '#e8c060', 1400);
      }
    });

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

    // UIScene runs create() AFTER GameScene, so a direct emit here is missed.
    // Instead, respond to ui-ready so UIScene pulls state once its listener is live.
    this.game.events.once('ui-ready', () => {
      this._emitPlayerUpdate();
      // Deferred emit — fires next tick after UIScene.create() fully completes
      this.time.delayedCall(0, () => this._emitPlayerUpdate());
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
        }
        this.resources.push(res);
      }
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
        const wx = Math.round(x * TILE_SIZE + TILE_SIZE / 2);
        const wy = Math.round(y * TILE_SIZE + TILE_SIZE / 2);
        const _monTex = MOB_SPRITE_MAP[type];
        mon.hasSprite = !!_monTex && this.textures.exists(_monTex);
        mon.facing    = 'down';
        if (mon.hasSprite) {
          const _frame = this.textures.get(_monTex).get(0);
          const _fh    = (_frame && _frame.realHeight > 0) ? _frame.realHeight : 96;
          // Nearest-neighbor filter prevents frame bleed on AI-rescaled sheets
          this.textures.get(_monTex).setFilter(Phaser.Textures.FilterMode.NEAREST);
          mon.spriteBg = this.add.rectangle(wx, wy, 1, 1, 0x000000, 0).setDepth(6);
          mon.sprite   = this.add.sprite(wx, wy, _monTex, 0)
            .setDepth(7).setOrigin(0.5, 0.5).setScale(TILE_SIZE / _fh);
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
    this.iactImages.forEach(i => i.destroy()); this.iactImages = [];
    for (const iact of this.interactables) {
      const px = iact.x * TILE_SIZE, py = iact.y * TILE_SIZE;
      const iSprKey = IACT_SPRITE_MAP[iact.type];
      if (iSprKey && this.textures.exists(iSprKey)) {
        const iSprW = iact.type === 'shop' ? TILE_SIZE * 2 : TILE_SIZE;
        const iSprH = iact.type === 'shop' ? TILE_SIZE * 2 : TILE_SIZE;
        const iSprX = iact.type === 'shop' ? px + TILE_SIZE : px + TILE_SIZE / 2;
        const iSprY = iact.type === 'shop' ? py + TILE_SIZE : py + TILE_SIZE / 2;
        this.iactImages.push(
          this.add.image(iSprX, iSprY, iSprKey)
            .setDisplaySize(iSprW, iSprH).setDepth(2)
        );
      } else if (iact.type !== 'shop') {
        const col = IACT_COLORS[iact.type] ?? 0xaaaaaa, sz = 22, off = (TILE_SIZE - sz) / 2;
        g.fillStyle(col, 0.85); g.fillRect(px + off, py + off, sz, sz);
        g.lineStyle(1, 0x000000, 0.6); g.strokeRect(px + off, py + off, sz, sz);
      }
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
    if (this._isCooking) return;

    // Find first cookable item in inventory
    const cookableKey = Object.keys(COOK_RECIPES).find(k => this.playerData.countItem(k) > 0);
    if (!cookableKey) {
      this._floatText(this.player.x, this.player.y - 40, 'Nothing to cook!', '#ff8844', 1400);
      return;
    }

    this._isCooking = true;
    this._floatText(this.player.x, this.player.y - 44, 'Cooking...', '#ffcc44', 1000);

    this.time.delayedCall(1000, () => {
      this._isCooking = false;

      // Re-check item still in inventory
      if (!this.playerData.countItem(cookableKey)) return;

      const res = cookOne(this.playerData, cookableKey, COOK_RECIPES);
      if (res.blocked) {
        this._floatText(this.player.x, this.player.y - 40, res.blocked, '#ff6644', 1400);
        return;
      }

      this.playerData.removeItem(cookableKey, 1);
      this.playerData.addItem(res.result, 1);
      if (res.xp > 0) {
        const xpRes = this.playerData.giveXP('cooking', res.xp);
        if (xpRes.leveledUp) {
          this._floatText(this.player.x, this.player.y - 58, 'COOKING LV UP!', '#f0c050', 2200);
        }
      }

      const resultName = ITEMS_DATA[res.result]?.name ?? res.result;
      const label  = res.burned ? `Burnt! (${resultName})` : `Cooked: ${resultName}`;
      const color  = res.burned ? '#ff4444' : '#ffcc44';
      this._floatText(this.player.x, this.player.y - 44, label, color, 1400);
      if (res.xp > 0) {
        this._floatText(this.player.x, this.player.y - 58, `+${res.xp} Cooking XP`, '#44cc88', 1200);
      }

      this.game.events.emit('chat-log', {
        text: res.burned ? `🔥 Burnt the ${ITEMS_DATA[cookableKey]?.name ?? cookableKey}!`
                         : `🍳 Cooked ${resultName} (+${res.xp} XP)`,
        cat: 'system',
      });
      this._emitPlayerUpdate();
    });
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
    if (!WALKABLE.has(this.map[ty][tx])) return false;
    if (this.resources.some(r => r.x === tx && r.y === ty && !r.depleted)) return false;
    if (this.monsters.some(m => m.x === tx && m.y === ty && m.state !== 'dead')) return false;
    if (this.interactables.some(i => this._iactFootprint(i).some(t => t.x === tx && t.y === ty))) return false;
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

  // ── Misc helpers ──────────────────────────────────────────────────────────

  _flashTile(tx, ty) {
    this.clickGfx.clear();
    this.clickGfx.fillStyle(0xffffff, 0.22);
    this.clickGfx.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    this.time.delayedCall(200, () => this.clickGfx.clear());
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
        this._emitPlayerUpdate();
        break;
      }
      case 'W': {
        ab.activeUntil   = now + def.activeDuration;
        ab.cooldownUntil = now + def.cooldown;
        this._floatText(this.player.x, this.player.y - 44, 'IRON SHIELD!', '#4488ff', 1400);
        break;
      }
      case 'E': {
        ab.activeUntil   = now + def.activeDuration;
        ab.cooldownUntil = now + def.cooldown;
        this._floatText(this.player.x, this.player.y - 44, 'ENRAGE!', '#ff4422', 1400);
        break;
      }
      case 'R': {
        this.stunNextAttack = true;
        ab.activeUntil   = now + 999999;  // stays "ready" until the stun lands
        ab.cooldownUntil = now + def.cooldown;
        this._floatText(this.player.x, this.player.y - 44, 'STUN READY!', '#ffdd22', 1400);
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
    this.game.events.emit('ability-update', state);
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
      bank:      [...pd.bank],             // 400-slot bank array
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


    // ── Ability visual effects (shield ring, rage aura) ───────────────────
    const nowVis = this.time.now;
    this.abilityGfx.clear();
    if (nowVis < this.abilities.W.activeUntil) {
      this.abilityGfx.lineStyle(3, 0x4488ff, 0.85);
      this.abilityGfx.strokeCircle(this.player.x, this.player.y, 22);
      this.abilityGfx.lineStyle(2, 0x88ccff, 0.35);
      this.abilityGfx.strokeCircle(this.player.x, this.player.y, 27);
    }
    if (nowVis < this.abilities.E.activeUntil) {
      this.abilityGfx.lineStyle(2, 0xff4422, 0.80);
      this.abilityGfx.strokeCircle(this.player.x, this.player.y, 24);
      this.abilityGfx.lineStyle(1, 0xff8844, 0.40);
      this.abilityGfx.strokeCircle(this.player.x, this.player.y, 30);
    }

    // ── Throttled ability-update emit (keeps cooldown countdowns fresh) ───
    this._abilityEmitTimer -= delta;
    if (this._abilityEmitTimer <= 0) {
      this._abilityEmitTimer = 250;
      this._emitAbilityUpdate();
    }
  }
}
