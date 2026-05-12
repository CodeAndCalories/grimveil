import Phaser from 'phaser';
import {
  TOP_H as _TOP_H0, BOTTOM_H as _BOTTOM_H0, RIGHT_W as _RIGHT_W0,
  GAP, MARGIN, MAP_W, MAP_H, JOURNAL_W,
  BOTTOM_INFO_PCT as _INFO_PCT0, BOTTOM_ACTION_PCT as _ACTION_PCT0, BOTTOM_GEAR_PCT as _GEAR_PCT0,
  MINIMAP_SIZE as _MINIMAP0, ACTION_SLOT_SIZE as _ASLOT0,
  GEAR_SLOT_SIZE as _GSLOT0, INV_SLOT_SIZE as _ISLOT0,
} from './GameScene.js';
import ITEMS_DATA from '../data/items.json';
import SHOP_DATA  from '../data/shop.json';

// ── Design constants ──────────────────────────────────────────────────────────
const FRAME   = 6;   // px from panel edge to inner content on each side
const TITLE_H = 24;  // title-strip height inside each panel

// ── Colour values ─────────────────────────────────────────────────────────────
const BRONZE_OUTER = 0x6a4c14;  // outer frame ring  — dark iron-bronze
const BRONZE_GAP   = 0x0a0806;  // dark ring between outer and inner
const GOLD_INNER   = 0x9a7828;  // inner ring + text — muted bronze
const NAVY_DEEP    = 0x0c0b09;  // main panel bg     — charcoal iron
const NAVY_MID     = 0x131110;  // inset fill        — dark charcoal
const NAVY_TOP     = 0x0e0c0b;  // top-bar bg        — near-black
const TITLE_L      = 0x2c1418;  // title strip left  — deep wine red
const TITLE_R      = 0x180c10;  // title strip right — darker wine
const SLOT_EDGE    = 0x080604;  // slot outer ring
const SLOT_MID     = 0x0e0a08;
const SLOT_INNER   = 0x151210;
const SLOT_CENTER  = 0x1c1814;  // slightly lighter — carved-centre effect
const SLOT_BORDER  = 0x584010;  // muted bronze border
const HP_TRACK     = 0x120808;
const HP_TRACK_BDR = 0x2a0808;
const HP_RED_L     = 0x6a0e0e;
const HP_RED_M     = 0xaa1e1e;
const HP_RED_R     = 0xcc2020;
const EQ_BG        = 0x0e0c0a;  // equipment slot bg — dark iron, no blue
const EQ_BDR       = 0x2a1e0e;  // dark bronze border
const INV_BG       = 0x161008;
const INV_BDR      = 0x4a3010;  // muted bronze

const GOLD_STR    = '#b89048';  // muted bronze-gold text
const SKILL_STR   = '#a88c6c';  // warm parchment
const DIM_STR     = '#786048';  // warm dim brown
const RED_STR     = '#cc3344';

const FONT_PS8 = '"Press Start 2P", monospace';
const FONT_VT  = 'VT323, monospace';

// ── Base layout dimensions (derived from locked panel extents) ────────────────
const BASE_W = 2510;
const BASE_H = 1280;

// ── Debug layout toggle ───────────────────────────────────────────────────────
const DEBUG_LAYOUT = false;

// ── Mutable layout object — single source of truth for all HUD geometry ──────
// Keyboard shortcuts (when DEBUG_LAYOUT=true):
//   [ / ]   →  RIGHT_W  ± 10
//   ; / '   →  BOTTOM_H ± 10
//   , / .   →  ACTION_SLOT_SIZE ± 2
//   9 / 0   →  MINIMAP_SIZE ± 5
const L = {
  TOP_H:             _TOP_H0,
  BOTTOM_H:          _BOTTOM_H0,
  RIGHT_W:           _RIGHT_W0,
  BOTTOM_INFO_PCT:   _INFO_PCT0,
  BOTTOM_ACTION_PCT: _ACTION_PCT0,
  BOTTOM_GEAR_PCT:   _GEAR_PCT0,
  MINIMAP_SIZE:      _MINIMAP0,
  ACTION_SLOT_SIZE:  _ASLOT0,
  GEAR_SLOT_SIZE:    _GSLOT0,
  INV_SLOT_SIZE:     _ISLOT0,
  // Hardcoded default layout — set from panel editor, never auto-regenerated
  panels: {
    journal:   { x: 5,    y: 45,   w: 305,  h: 960  },
    game:      { x: 316,  y: 45,   w: 1809, h: 960  },
    minimap:   { x: 2125, y: 40,   w: 385,  h: 300  },
    skills:    { x: 2125, y: 340,  w: 385,  h: 670  },
    status:    { x: 5,    y: 1010, w: 955,  h: 270  },
    action:    { x: 960,  y: 1010, w: 830,  h: 270  },
    gear:      { x: 2125, y: 1010, w: 385,  h: 270  },
    inventory: { x: 1790, y: 1010, w: 335,  h: 270  },
  },
  SNAP: 5,
};

const SKILLS = [
  { key: 'melee',     name: 'Melee',     icon: '⚔️',
    hint: 'Fight with swords and melee weapons.\nLv up by attacking in melee combat.\nUnlocks: Thrust (T) — 220% damage strike.' },
  { key: 'archer',    name: 'Archer',    icon: '🏹',
    hint: 'Attack at range with bows.\nLv up by using a bow in combat.\nUnlocks: Quick Shot (T) — two rapid arrows.' },
  { key: 'magic',     name: 'Magic',     icon: '🔮',
    hint: 'Cast elemental spells with a staff.\nLv up by using a staff in combat.\nUnlocks: Arc Burst (T) — hits main target and splashes nearby enemies.' },
  { key: 'druidism',  name: 'Druidism',  icon: '🌿',
    hint: 'Harness nature magic with a totem.\nLv up by using a totem in combat.\nUnlocks: Root Snare (T) — damages and roots the target for 3 seconds.' },
  { key: 'defence',   name: 'Defence',   icon: '🛡️',
    hint: 'Reduces damage taken from enemies.\nTrained passively during all combat.' },
  { key: 'hitpoints', name: 'Hitpoints', icon: '❤️',  lv: 10,
    hint: 'Increases maximum health.\nTrained passively during all combat.\nGains 25% of combat XP earned.' },
  { key: 'woodcutting', name: 'Woodcut', icon: '🪓',
    hint: 'Chop trees for logs. Logs used at the Paper Press.\nLv 1  Trees  ·  Lv 5  Ashwood  ·  Lv 10  Grimoak\nLv 15  Deadwood  ·  Lv 20  Veilwood' },
  { key: 'mining',    name: 'Mining',    icon: '⛏️',
    hint: 'Mine rocks for ore used in crafting.\nLv 1  Copperstone  ·  Lv 5  Grimsteel\nLv 10  Ashstone  ·  Lv 15  Veilmetal' },
  { key: 'fishing',   name: 'Fishing',   icon: '🎣',
    hint: 'Fish at water spots for food that restores mana.\nLv 1  Raw Fish  ·  Lv 5  Saltfin\nLv 10  Grimscale Bass  ·  Lv 20  Trout' },
  { key: 'cooking',   name: 'Cooking',   icon: '🍳',
    hint: 'Cook raw fish at the Campfire to restore mana.\nLv 1  Cooked Fish (+10 mana)\nLv 5  Saltfin (+18 mana)  ·  Lv 10  Grimscale Bass (+30)\nLv 20  Cooked Trout (heals HP)' },
  { key: 'foraging',  name: 'Foraging',  icon: '🌾',
    hint: 'Gather herbs used as Alchemy ingredients.\nBitterleaf  ·  Mooncap  ·  Redroot\nStonecap (Quarry)  ·  Veilbloom  ·  Ironleaf' },
  { key: 'blacksmithing', name: 'Blacksmith', icon: '🔨', dim: true,
    hint: 'Craft buff items at the Blacksmith Bench.\nLv 1  Copper Sharpening Stone  (+10% melee/ranged dmg)\nLv 1  Copper Guard Charm  (-10% incoming damage)' },
  { key: 'carpentry', name: 'Carpentry', icon: '🪚', dim: true,
    hint: 'Craft at the Carpentry Bench or convert logs at the Paper Press.\nLv 1  Ashwood Focus Totem  (+10% magic/druid dmg)\nLv 1  Log → 4 pages  ·  Ashwood Log → 6\nGrimoak Log → 8  ·  Deadwood Log → 10' },
  { key: 'alchemy',   name: 'Alchemy',   icon: '⚗️', dim: true,
    hint: 'Brew potions at the Alchemy Table.\nLv 1   Minor Healing Potion  (+20 HP)\nLv 5   Focus Potion  (+15 mana)\nLv 15  Veil Elixir  (+50 mana, grants a free ability use)' },
  { key: 'tinkering', name: 'Tinkering', icon: '⚙️', dim: true,
    hint: 'Coming soon.' },
  { key: 'loremaster', name: 'Loremaster', icon: '📚', dim: true,
    hint: 'Coming soon.' },
  { key: 'questing',  name: 'Questing',  icon: '🗺️', dim: true,
    hint: 'Coming soon.' },
];

const SHOP_WEAPON_IDS = ['iron_sword', 'shortbow', 'apprentice_staff', 'oak_totem'];

// Campfire cooking menu — the three fish tiers shown in order
const COOK_MENU_RECIPES = [
  { key: 'raw_fish',       result: 'cooked_fish',           lvl: 1,  xp: 30, label: 'Raw Fish',       resultLabel: 'Cooked Fish'           },
  { key: 'saltfin_fish',   result: 'saltfin_cooked',        lvl: 5,  xp: 40, label: 'Saltfin',         resultLabel: 'Cooked Saltfin'        },
  { key: 'grimscale_bass', result: 'grimscale_bass_cooked', lvl: 10, xp: 65, label: 'Grimscale Bass',  resultLabel: 'Cooked Grimscale Bass' },
];
const SHOP_PRICE_MAP  = Object.fromEntries(SHOP_DATA.stock.map(s => [s.item, s.price]));

const ABILITY_KEYS       = ['Q', 'W', 'E', 'R', 'T', 'Y'];
const ABILITY_LOCKED     = [false, false, false, false, true, true];
const ABILITY_ACTIVE_COL = [0x44ff88, 0x4488ff, 0xff4422, 0xffdd22, 0, 0];
// Two-line ability name labels for Q/W/E/R slots
const QWER_LABELS = [
  ['MINOR', 'HEAL'],   // Q
  ['IRON',  'SHIELD'], // W
  ['ENRAGE'],          // E — one word
  ['STUN',  'STRIKE'], // R
];
// PNG texture keys for Q W E R — T is dynamic, Y stays locked
const ABILITY_TEX_KEYS = [
  'ability_minor_heal',   // Q
  'ability_shield',       // W
  'ability_enrage',       // E
  'ability_stun_strike',  // R
  null,                   // T — resolved dynamically from style
  null,                   // Y — locked, no icon
];
// T slot: texture key per weaponCombatStyle
const STYLE_TEX_KEYS = {
  melee:    'ability_thrust',
  archer:   'ability_quick_shot',
  magic:    'ability_arc_burst',
  druidism: 'ability_root_snare',
};

// World-map tile colour table — index = T value in GameScene.js
// GRASS=0  WATER=1  MOUNTAIN=2  PATH=3  SAND=4  DGRASS=5  FLOOR=6  WALL=7  DFLOOR=8
const MAP_TILE_COL = [
  0x4a8c48, 0x1e5ea8, 0x7a6a58, 0xc4a87e, 0xd4b882,
  0x3a7038, 0xb89060, 0x2a2018, 0x1e1428,
];
const MAP_IACT_COL = {
  bank: 0xf0d050, shop: 0x4488ee, campfire: 0xff8822, dungeon_entrance: 0x9966cc,
};

export default class UIScene extends Phaser.Scene {
  constructor() { super({ key: 'UIScene' }); }

  // ════════════════════════════════════════════════════════════════════════════
  //  LIFECYCLE
  // ════════════════════════════════════════════════════════════════════════════

  create() {
    this.gfx   = this.add.graphics().setDepth(0);
    this._objs = [];
    // Persistent minimap overlay (frame + player dot) — survives _redraw clears
    this._minimapOverlay = this.add.graphics().setDepth(2);

    // Persistent tooltip — lives outside _objs so it survives redraws
    this._tooltipBg  = this.add.graphics().setDepth(40).setVisible(false);
    this._tooltipTxt = this.add.text(0, 0, '', {
      fontFamily: FONT_VT, fontSize: '16px', color: '#f0d8a0',
    }).setDepth(41).setVisible(false);

    this.state = {
      hp: 10, maxHp: 10, mana: 0, maxMana: 30, coins: 0, zone: 'Overworld',
      playerTileX: Math.floor(MAP_W / 2),
      playerTileY: Math.floor(MAP_H / 3),
      skills:    {},  // { skillKey: { level, xpFrac } }
      inventory: [],  // [{ item, qty }]
      bank:      [],  // 400-slot bank array
      gear:      {},  // { slotId: itemKey | null }
      paperPressRepaired: false,
      freeAbility: false,
    };
    // Messages stored as { text, cat } — cat drives tab filtering and colour
    this.chatLog = [
      { text: '⚔️  Welcome to GRIMFELL!',                                    cat: 'system' },
      { text: '🌲 North: Woodcutting  |  ⛏️ East: Mining  |  🎣 South: Fishing', cat: 'system' },
      { text: '🏘️ Town: Bank • Shop • Campfire',                              cat: 'system' },
      { text: '🕯️ Dungeon entrance south of town — high danger!',             cat: 'system' },
      { text: '💡 Start on the Training Dummy to level up safely!',           cat: 'system' },
    ];
    this.statusTab       = 'all';   // active tab on STATUS panel
    this.hotbar          = [null, null, null, null, null];
    this.abilityState    = {};     // keyed by 'Q'/'W'/'E'/'R': { cooldownRemaining, isActive }
    this._invSelectedSlot = null;  // index of shift-selected inventory slot, or null

    // Initial / zone-change state (also keeps minimap player dot in sync)
    this.game.events.on('game-state', (data) => {
      Object.assign(this.state, data);
      this._redraw();
    });

    // Live combat / XP updates from GameScene — refreshes HP + skill levels
    this.game.events.on('player-update', (data) => {
      Object.assign(this.state, data);
      this._redraw();
      if (this._shopOpen)    { this._closeShop(); this._openShop(); }
      if (this._bankOpen)    { this._closeBank(); this._openBank(); }
      if (this._cookOpen)    { this._closeCookMenu(false); this._openCookMenu(); }
      if (this._alchemyOpen) { this._closeAlchemy(); this._openAlchemy(); }
      if (this._pressOpen)   { this._closePaperPress(); this._openPaperPress(); }
      if (this._mapOpen)     this._refreshWorldMapPlayer();
    });

    // Ability cooldown / active state updates from GameScene
    this.game.events.on('ability-update', (state) => {
      this.abilityState = state;
      this._redraw();
    });

    // World-hover labels emitted by GameScene pointermove.
    // _worldHover persists so redraws can restore the tooltip without waiting for next mousemove.
    this._worldHover = null;
    this._invHover   = null;   // { name, sx, sy } — survives _redraw so tooltip doesn't flicker
    this.game.events.on('hover-world', (data) => {
      if (this._bankOpen || this._shopOpen || this._alchemyOpen || this._libOpen) {
        this._worldHover = null;
        this._hideTooltip(); return;
      }
      this._worldHover = data ?? null;
      if (!data) { this._hideTooltip(); return; }
      this._showTooltip(data.text, data.sx + 14, data.sy);
    });

    // ── Shop modal ────────────────────────────────────────────────────────
    this._shopOpen = false;
    this._shopObjs = [];
    this.game.events.on('chat-log', (msg) => {
      this.chatLog.push(msg);
      this._redraw();
    });

    this.game.events.on('open-shop', () => {
      if (this._shopOpen) this._closeShop(); else this._openShop();
    });
    this.input.keyboard.on('keydown-ESC', () => { if (this._shopOpen) this._closeShop(); });

    // ── Bank modal ────────────────────────────────────────────────────────
    this._bankOpen = false;
    this._bankPage = 0;
    this._bankObjs = [];
    this.game.events.on('open-bank', () => {
      if (this._bankOpen) this._closeBank(); else this._openBank();
    });
    this.input.keyboard.on('keydown-ESC', () => { if (this._bankOpen) this._closeBank(); });

    // ── Alchemy modal ──────────────────────────────────────────────────────
    this._alchemyOpen = false;
    this._alchemyObjs = [];
    this.game.events.on('open-alchemy', () => {
      if (this._alchemyOpen) this._closeAlchemy(); else this._openAlchemy();
    });

    // ── Paper Press modal ──────────────────────────────────────────────────
    this._pressOpen = false;
    this._pressObjs = [];
    this.game.events.on('open-paper-press', () => {
      if (this._pressOpen) this._closePaperPress(); else this._openPaperPress();
    });

    // ── Library modal ──────────────────────────────────────────────────────
    this._libOpen = false;
    this._libObjs = [];
    this.game.events.on('open-library', () => {
      if (this._libOpen) this._closeLibrary(); else this._openLibrary();
    });

    // ── Blacksmith Bench modal ────────────────────────────────────────────
    this._blacksmithOpen = false;
    this._blacksmithObjs = [];
    this.game.events.on('open-blacksmith', () => {
      if (this._blacksmithOpen) this._closeBench('blacksmith'); else this._openBench('blacksmith');
    });

    // ── Carpentry Bench modal ─────────────────────────────────────────────
    this._carpentryOpen = false;
    this._carpentryObjs = [];
    this.game.events.on('open-carpentry', () => {
      if (this._carpentryOpen) this._closeBench('carpentry'); else this._openBench('carpentry');
    });

    // ── Skill info popup ───────────────────────────────────────────────────
    this._skillInfoOpen = false;
    this._skillInfoObjs = [];

    this.input.keyboard.on('keydown-ESC', () => {
      if (this._alchemyOpen)    this._closeAlchemy();
      if (this._pressOpen)      this._closePaperPress();
      if (this._libOpen)        this._closeLibrary();
      if (this._skillInfoOpen)  this._closeSkillInfo();
      if (this._blacksmithOpen) this._closeBench('blacksmith');
      if (this._carpentryOpen)  this._closeBench('carpentry');
    });

    // ── Campfire cooking modal ─────────────────────────────────────────────
    this._cookOpen        = false;
    this._cookObjs        = [];
    this._cookQueueStatus = null;   // { itemKey, remaining } or null
    this.game.events.on('open-cookfire', () => {
      if (this._cookOpen) this._closeCookMenu(); else this._openCookMenu();
    });
    this.input.keyboard.on('keydown-ESC', () => { if (this._cookOpen) this._closeCookMenu(); });
    // Queue ticks refresh the menu with updated counts
    this.game.events.on('cook-queue-status', (status) => {
      this._cookQueueStatus = status;
      if (this._cookOpen) { this._closeCookMenu(false); this._openCookMenu(); }
    });

    // ── World map overlay ─────────────────────────────────────────────────
    this._mapOpen       = false;
    this._mapObjs       = [];
    this._mapDynGfx     = null;
    this._mapGeom       = null;
    this._worldMapTiles     = null;
    this._worldMapIacts     = [];
    this._worldMapResources = [];
    // Minimap image cache — rebuilt only when player tile or SIZE changes
    this._minimapImage = null;
    this._minimapKey   = '';

    this.game.events.on('map-data', ({ tiles, interactables, resources }) => {
      this._worldMapTiles     = tiles;
      this._worldMapIacts     = interactables;
      this._worldMapResources = resources ?? [];
    });
    // Pull data immediately — demand-driven, works even when the push-once
    // ui-ready → map-data path was already consumed (e.g. Vite HMR reload).
    this.game.events.emit('request-map-data');

    this.input.keyboard.on('keydown-M', () => {
      if (this._shopOpen || this._bankOpen) return;
      if (this._mapOpen) this._closeWorldMap(); else this._openWorldMap();
    });
    this.input.keyboard.on('keydown-ESC', () => { if (this._mapOpen) this._closeWorldMap(); });

    // ── Mouse-based HUD editor (DEBUG_LAYOUT = true) ─────────────────────
    if (DEBUG_LAYOUT) {
      this._hovHandle  = null;  // { name, edge } currently hovered
      this._dragState  = null;  // active drag

      const EDGE_HIT  = 10;               // px hit radius around every edge/corner
      const TITLE_HIT = FRAME + TITLE_H + 4; // title bar height (draggable)
      const snap      = v => Math.round(v / L.SNAP) * L.SNAP;

      // Hit-test: returns { name, edge } or null
      const hitTest = (mx, my) => {
        if (!L.panels) return null;
        for (const [name, p] of Object.entries(L.panels)) {
          const { x, y, w, h } = p;
          if (mx < x - EDGE_HIT || mx > x + w + EDGE_HIT ||
              my < y - EDGE_HIT || my > y + h + EDGE_HIT) continue;

          if (name === 'game') {
            // Game panel: resize from right / bottom / se corner only — x/y stay locked
            const onR = mx >= x + w - EDGE_HIT;
            const onB = my >= y + h - EDGE_HIT;
            if (onR && onB) return { name, edge: 'se' };
            if (onR)        return { name, edge: 'e'  };
            if (onB)        return { name, edge: 's'  };
            continue;  // interior / other edges: not interactive
          }

          // All other panels: full drag + resize
          const onL = mx <= x + EDGE_HIT, onR = mx >= x + w - EDGE_HIT;
          const onT = my <= y + EDGE_HIT, onB = my >= y + h - EDGE_HIT;
          if (onL && onT) return { name, edge: 'nw' };
          if (onR && onT) return { name, edge: 'ne' };
          if (onL && onB) return { name, edge: 'sw' };
          if (onR && onB) return { name, edge: 'se' };
          if (onL) return { name, edge: 'w' };
          if (onR) return { name, edge: 'e' };
          if (onT) return { name, edge: 'n' };
          if (onB) return { name, edge: 's' };
          if (my < y + TITLE_HIT) return { name, edge: 'move' };
        }
        return null;
      };

      const refresh = () => {
        this._redraw();
        this.game.events.emit('layout-update', { panels: L.panels });
      };

      const printLayout = () => {};

      // Keyboard: P=print, S=save, L=load; slot sizing still works
      this.input.keyboard.on('keydown', (e) => {
        switch (e.key) {
          case 'p': case 'P': printLayout(); break;
          case 'S':
            localStorage.setItem('grimfell_layout', JSON.stringify(L.panels));
            break;
          case 'l': case 'L': {
            const saved = localStorage.getItem('grimfell_layout');
            if (saved) { L.panels = JSON.parse(saved); refresh(); }
            break;
          }
          // Slot size tuning (still useful)
          case ',': L.ACTION_SLOT_SIZE = Math.max(20, L.ACTION_SLOT_SIZE - 2); refresh(); break;
          case '.': L.ACTION_SLOT_SIZE = Math.min(80, L.ACTION_SLOT_SIZE + 2); refresh(); break;
          case '9': L.MINIMAP_SIZE     = Math.max(60, L.MINIMAP_SIZE     - 5); refresh(); break;
          case '0': L.MINIMAP_SIZE     = Math.min(300,L.MINIMAP_SIZE     + 5); refresh(); break;
          case 'i': L.INV_SLOT_SIZE    = Math.max(16, L.INV_SLOT_SIZE    - 2); refresh(); break;
          case 'o': L.INV_SLOT_SIZE    = Math.min(60, L.INV_SLOT_SIZE    + 2); refresh(); break;
        }
      });

      // Pointermove — hover detection + drag
      this.input.on('pointermove', (ptr) => {
        this._hovHandle = hitTest(ptr.x, ptr.y);

        if (!this._dragState) return;
        const ds    = this._dragState;
        const panel = L.panels[ds.name];
        const dx    = ptr.x - ds.mx0;
        const dy    = ptr.y - ds.my0;
        const W     = this.scale.width;
        const H     = this.scale.height;
        const minW  = 60, minH = 30;

        if (ds.edge === 'move') {
          panel.x = snap(Math.max(0, Math.min(W - panel.w, ds.x0 + dx)));
          panel.y = snap(Math.max(0, Math.min(H - panel.h, ds.y0 + dy)));
        } else {
          if (ds.edge.includes('e'))
            panel.w = snap(Math.max(minW, ds.w0 + dx));
          if (ds.edge.includes('s'))
            panel.h = snap(Math.max(minH, ds.h0 + dy));
          if (ds.edge.includes('w')) {
            const nx = snap(Math.max(0, Math.min(ds.x0 + ds.w0 - minW, ds.x0 + dx)));
            panel.w  = snap(ds.x0 + ds.w0 - nx);
            panel.x  = nx;
          }
          if (ds.edge.includes('n')) {
            const ny = snap(Math.max(0, Math.min(ds.y0 + ds.h0 - minH, ds.y0 + dy)));
            panel.h  = snap(ds.y0 + ds.h0 - ny);
            panel.y  = ny;
          }
        }
        refresh();
      });

      // Pointerdown — start drag if over a handle
      this.input.on('pointerdown', (ptr) => {
        const hit = hitTest(ptr.x, ptr.y);
        if (!hit || !L.panels[hit.name]) return;
        const panel = L.panels[hit.name];
        this._dragState = {
          name: hit.name, edge: hit.edge,
          mx0: ptr.x, my0: ptr.y,
          x0: panel.x, y0: panel.y,
          w0: panel.w, h0: panel.h,
        };
      });

      this.input.on('pointerup', () => { this._dragState = null; });
    }

    // ── Discovery toast slot counter (reset each _redraw; persists between calls) ─
    if (this._toastSlot === undefined) this._toastSlot = 0;

    // Discovery / notification toasts — emitted by GameScene
    if (!this._discoveryListenerAdded) {
      this._discoveryListenerAdded = true;
      this.game.events.on('discovery-toast', ({ text, color }) => {
        this._showDiscoveryToast(text, color);
      });
    }

    // "Saved!" confirmation flash — registered exactly once with a flag guard
    if (!this._saveListenerAdded) {
      this._saveListenerAdded = true;
      this.game.events.on('save-complete', () => {
        const W   = this.scale.width;
        const txt = this.add.text(W - 200, L.TOP_H / 2 - 14, 'Saved!', {
          fontFamily: FONT_PS8, fontSize: '6px', color: '#44cc44',
        }).setOrigin(0.5).setDepth(20);
        this.tweens.add({
          targets: txt, y: L.TOP_H / 2 - 24, alpha: 0, duration: 1300,
          ease: 'Power2', onComplete: () => txt.destroy(),
        });
      });
    }

    // ── Dev editor HUD panel ─────────────────────────────────────────────────
    // Lives in UIScene so it renders ABOVE all GameScene content (UIScene draws
    // last in the scene list).  Depth 30-31 places it above UIScene's own panels.
    // Position: inside the game viewport (right of Journal, below the top bar).
    {
      const EDX = MARGIN + JOURNAL_W + GAP + 10;  // ≈ 332 px — inside game viewport
      const EDY = _TOP_H0 + MARGIN + 4;           // ≈ 50 px  — below top bar
      this._edBg     = this.add.graphics().setDepth(30).setVisible(false);
      this._edText   = this.add.text(EDX + 10, EDY + 9, '', {
        fontFamily: FONT_PS8, fontSize: '9px', color: '#ffdd55',
        stroke: '#000000', strokeThickness: 3, lineSpacing: 6,
      }).setDepth(31).setVisible(false);
      this._edSwatch = this.add.graphics().setDepth(31).setVisible(false);

      this.game.events.on('editor-hud-visible', (on) => {
        this._edBg.setVisible(on);
        this._edText.setVisible(on);
        this._edSwatch.setVisible(on);
        if (!on) { this._edBg.clear(); this._edSwatch.clear(); }
      });

      this.game.events.on('editor-hud-update', ({ lines, tileColor }) => {
        if (!this._edText?.visible) return;
        this._edText.setText(lines);
        // Background sized to fit text content
        const tw = this._edText.width + 16;
        const th = this._edText.height + 12;
        this._edBg.clear();
        this._edBg.fillStyle(0x000000, 0.85);
        this._edBg.fillRect(EDX, EDY, tw, th);
        this._edBg.lineStyle(1, 0xffcc44, 0.40);
        this._edBg.strokeRect(EDX, EDY, tw, th);
        // Tile colour swatch below the panel
        const sy = EDY + th + 6;
        this._edSwatch.clear();
        this._edSwatch.fillStyle(0x000000, 0.8);
        this._edSwatch.fillRect(EDX + 7, sy - 1, 22, 22);
        this._edSwatch.fillStyle(tileColor, 1);
        this._edSwatch.fillRect(EDX + 8, sy,     20, 20);
        this._edSwatch.lineStyle(1, 0xffffff, 0.6);
        this._edSwatch.strokeRect(EDX + 8, sy,   20, 20);
      });
    }

    this.scale.on('resize', () => this._redraw());
    this._redraw();

    // Signal GameScene that UIScene listeners are live — it will push current state.
    // Must come AFTER _redraw() so the initial draw uses defaults while waiting.
    this.game.events.emit('ui-ready');
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  REDRAW
  // ════════════════════════════════════════════════════════════════════════════

  _redraw() {
    this._objs.forEach(o => o.destroy());
    this._objs = [];
    this.gfx.clear();
    const W = this.scale.width;
    const H = this.scale.height;

    // Scale from locked base layout (BASE_W × BASE_H) and center in window
    const scale   = Math.min(W / BASE_W, H / BASE_H);
    this._uiScale = scale;
    const offsetX = Math.floor((W - BASE_W * scale) / 2);
    const offsetY = Math.floor((H - BASE_H * scale) / 2);

    // Build scaled panel rects from locked base
    const sp = {};
    for (const [name, base] of Object.entries(L.panels)) {
      sp[name] = {
        x: Math.round(base.x * scale) + offsetX,
        y: Math.round(base.y * scale) + offsetY,
        w: Math.round(base.w * scale),
        h: Math.round(base.h * scale),
      };
    }

    // Fixed top bar (always full-width at y=0)
    this._drawTopBar(W);

    // Vignette over the scaled game viewport
    if (sp.game.w > 0 && sp.game.h > 0)
      this._drawVignette(sp.game.x, sp.game.y, sp.game.w, sp.game.h);

    // Each HUD panel drawn at its scaled rect
    this._panel(sp.journal.x,  sp.journal.y,  sp.journal.w,  sp.journal.h,  'JOURNAL');
    this._drawJournal (sp.journal.x,  sp.journal.y,  sp.journal.w,  sp.journal.h);

    this._panel(sp.minimap.x,  sp.minimap.y,  sp.minimap.w,  sp.minimap.h,  'MINIMAP');
    this._drawMinimap (sp.minimap.x,  sp.minimap.y,  sp.minimap.w,  sp.minimap.h);

    this._panel(sp.skills.x,   sp.skills.y,   sp.skills.w,   sp.skills.h,   'SKILLS');
    this._drawSkills  (sp.skills.x,   sp.skills.y,   sp.skills.w,   sp.skills.h);

    this._panel(sp.status.x,   sp.status.y,   sp.status.w,   sp.status.h,   'STATUS');
    this._drawInfoPanel(sp.status.x,  sp.status.y,   sp.status.w,   sp.status.h);

    this._panel(sp.action.x,   sp.action.y,   sp.action.w,   sp.action.h,   'QUICKBAR');
    this._drawActionBar(sp.action.x,  sp.action.y,   sp.action.w,   sp.action.h);

    this._panel(sp.gear.x,     sp.gear.y,     sp.gear.w,     sp.gear.h,     'GEAR');
    this._drawEquipPanel(sp.gear.x,   sp.gear.y,     sp.gear.w,     sp.gear.h);

    this._panel(sp.inventory.x, sp.inventory.y, sp.inventory.w, sp.inventory.h, 'INVENTORY');
    this._drawInvPanel(sp.inventory.x, sp.inventory.y, sp.inventory.w, sp.inventory.h);

    // Notify GameScene of scaled game panel rect for viewport
    this.game.events.emit('layout-update', { panels: sp });

    if (DEBUG_LAYOUT) this._drawPanelHandles(W, H);

    // Restore world hover tooltip — suppressed while any modal or cooking menu is open
    const _anyModalOpen = this._cookOpen || this._bankOpen || this._shopOpen || this._alchemyOpen || this._libOpen || this._blacksmithOpen || this._carpentryOpen;
    if (this._worldHover && !_anyModalOpen) {
      this._showTooltip(this._worldHover.text, this._worldHover.sx + 14, this._worldHover.sy);
    } else if (this._invHover && !_anyModalOpen) {
      this._showTooltip(this._invHover.name, this._invHover.sx, this._invHover.sy);
    }
  }

  // ── Panel initialiser — computes starting positions from current L values ─────

  _initPanels(W, H) {
    const snap  = v => Math.round(v / L.SNAP) * L.SNAP;
    const cX    = MARGIN + FRAME;
    const cW    = W - MARGIN * 2 - FRAME * 2;
    const iW    = Math.floor(cW * L.BOTTOM_INFO_PCT);
    const aW    = Math.floor(cW * L.BOTTOM_ACTION_PCT);
    const gbW   = cW - iW - aW;          // total gear+inv width
    const gW    = Math.floor(gbW * 0.40);
    const ivW   = gbW - gW;
    const sideX = W - L.RIGHT_W - MARGIN;
    const sideH = H - L.TOP_H - L.BOTTOM_H - MARGIN * 2 - GAP;
    const mapH  = L.MINIMAP_SIZE + 40;   // panel height for minimap (incl frame+title)
    const by    = H - L.BOTTOM_H - MARGIN + FRAME;
    const bH    = L.BOTTOM_H - FRAME * 2 - TITLE_H - 4;

    const gameX = snap(MARGIN + JOURNAL_W + GAP);
    const gameW = snap(W - L.RIGHT_W - JOURNAL_W - GAP * 2 - MARGIN * 3);
    const gameH = snap(H - L.TOP_H - L.BOTTOM_H - MARGIN * 3);

    return {
      journal:   { x: snap(MARGIN),              y: snap(L.TOP_H + MARGIN),          w: snap(JOURNAL_W),  h: gameH },
      game:      { x: gameX,                     y: snap(L.TOP_H + MARGIN),          w: gameW,            h: gameH },
      minimap:   { x: snap(sideX + GAP),         y: snap(L.TOP_H + MARGIN + GAP),    w: snap(L.RIGHT_W - GAP * 2),           h: snap(mapH - GAP) },
      skills:    { x: snap(sideX + GAP),         y: snap(L.TOP_H + MARGIN + mapH + GAP), w: snap(L.RIGHT_W - GAP * 2),       h: snap(sideH - mapH - GAP * 2) },
      status:    { x: snap(cX),                  y: snap(by),                         w: snap(iW),                            h: snap(bH) },
      action:    { x: snap(cX + iW),             y: snap(by),                         w: snap(aW),                            h: snap(bH) },
      gear:      { x: snap(cX + iW + aW),        y: snap(by),                         w: snap(gW),                            h: snap(bH) },
      inventory: { x: snap(cX + iW + aW + gW),   y: snap(by),                         w: snap(ivW),                           h: snap(bH) },
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  PRIMITIVE HELPERS
  // ════════════════════════════════════════════════════════════════════════════

  _add(obj)         { this._objs.push(obj); return obj; }
  _text(x, y, s, t) { return this._add(this.add.text(x, y, s, t).setDepth(5)); }
  _fs(base)         { return Math.max(10, Math.floor(base * (this._uiScale ?? 1))); }

  // ── Ornate panel frame ─────────────────────────────────────────────────────
  // Creates: drop-shadow → outer bronze border (3 px) → dark gap (2 px) →
  //          inner gold ring (1 px) → navy deep fill → navy mid inset fill →
  //          inner bevel lines → corner diamonds.
  //
  // After this call the usable interior starts at (x+FRAME, y+FRAME).

  _frame(x, y, w, h) {
    const g = this.gfx;

    // Drop shadow
    g.fillStyle(0x000000, 0.55);
    g.fillRect(x + 4, y + 4, w, h);

    // Layer 1 – outer bronze fill (becomes the 3 px outer border)
    g.fillStyle(BRONZE_OUTER, 1);
    g.fillRect(x, y, w, h);

    // Layer 2 – dark gap (inset 3 px)
    g.fillStyle(BRONZE_GAP, 1);
    g.fillRect(x + 3, y + 3, w - 6, h - 6);

    // Layer 3 – inner gold ring setup (inset 5 px; only the 1 px strip survives)
    g.fillStyle(GOLD_INNER, 1);
    g.fillRect(x + 5, y + 5, w - 10, h - 10);

    // Layer 4 – main dark navy (inset 6 px → leaves 1 px gold ring at x+5)
    g.fillStyle(NAVY_DEEP, 1);
    g.fillRect(x + 6, y + 6, w - 12, h - 12);

    // Layer 5 – slightly lighter inset fill (simulates panel depth)
    g.fillStyle(NAVY_MID, 1);
    g.fillRect(x + 9, y + 9, w - 18, h - 18);

    // Inner bevel – bright top & left
    g.lineStyle(1, GOLD_INNER, 0.2);
    g.lineBetween(x + 7, y + 7, x + w - 7, y + 7);
    g.lineBetween(x + 7, y + 7, x + 7, y + h - 7);

    // Inner bevel – dark bottom & right
    g.lineStyle(1, 0x000000, 0.4);
    g.lineBetween(x + 7, y + h - 7, x + w - 7, y + h - 7);
    g.lineBetween(x + w - 7, y + 7, x + w - 7, y + h - 7);

    // Corner diamonds
    this._diamonds(x, y, w, h, 7);
  }

  // ── Corner diamond ornaments ───────────────────────────────────────────────

  _diamonds(x, y, w, h, s) {
    const g = this.gfx;
    g.fillStyle(GOLD_INNER, 1);
    for (const [cx, cy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) {
      g.fillPoints([
        { x: cx,     y: cy - s },
        { x: cx + s, y: cy     },
        { x: cx,     y: cy + s },
        { x: cx - s, y: cy     },
      ], true);
    }
  }

  // ── Title strip (drawn inside the frame, 24 px tall) ──────────────────────

  _titleStrip(x, y, w, label) {
    const g = this.gfx;
    const tx = x + FRAME, ty = y + FRAME;
    const tw = w - FRAME * 2;

    // Simulated left→right gradient: lighter left half, darker right half
    g.fillStyle(TITLE_L, 1);
    g.fillRect(tx, ty, tw, TITLE_H);
    g.fillStyle(TITLE_R, 1);
    g.fillRect(tx + Math.floor(tw / 2), ty, tw - Math.floor(tw / 2), TITLE_H);

    // Thin highlight at very top of strip
    g.lineStyle(1, GOLD_INNER, 0.35);
    g.lineBetween(tx, ty, tx + tw, ty);

    // Gold bottom separator
    g.lineStyle(1, GOLD_INNER, 0.75);
    g.lineBetween(tx, ty + TITLE_H, tx + tw, ty + TITLE_H);

    this._text(tx + tw / 2, ty + TITLE_H / 2, label, {
      fontFamily: FONT_PS8, fontSize: `${this._fs(7)}px`, color: GOLD_STR,
    }).setOrigin(0.5, 0.5);
  }

  // Full panel = frame + title strip
  _panel(x, y, w, h, title) {
    this._frame(x, y, w, h);
    if (title) this._titleStrip(x, y, w, title);
  }

  // Content-area Y after a titled frame
  _cy(panelY, titled = true) {
    return panelY + FRAME + (titled ? TITLE_H : 0) + 2;
  }
  // Content-area X (same for titled and untitled)
  _cx(panelX) { return panelX + FRAME + 4; }
  // Content width
  _cw(panelW) { return panelW - (FRAME + 4) * 2; }

  // ── HP bar (12 px, simulated dark→bright gradient) ────────────────────────

  _hpBar(x, y, w, value, max) {
    const g = this.gfx;
    const h = 12;

    // Track
    g.fillStyle(HP_TRACK, 1);
    g.fillRect(x, y, w, h);
    g.lineStyle(1, HP_TRACK_BDR, 1);
    g.strokeRect(x, y, w, h);

    if (max > 0 && value > 0) {
      const fw = Math.max(0, (w - 2) * (value / max));
      const fx = x + 1;
      // Three-band gradient simulation: left dark → mid → right bright
      g.fillStyle(HP_RED_L, 1); g.fillRect(fx,                    y + 1, fw * 0.3,             h - 2);
      g.fillStyle(HP_RED_M, 1); g.fillRect(fx + fw * 0.3,          y + 1, fw * 0.4,             h - 2);
      g.fillStyle(HP_RED_R, 1); g.fillRect(fx + fw * 0.7,          y + 1, fw - fw * 0.7,        h - 2);
      // Subtle top sheen
      g.fillStyle(0xffffff, 0.07);
      g.fillRect(fx, y + 1, fw, 4);
    }
  }

  // ── Generic thin bar (XP, etc.) ───────────────────────────────────────────

  _thinBar(x, y, w, h, value, max, colL, colR) {
    const g = this.gfx;
    g.fillStyle(0x0a0908, 1);
    g.fillRect(x, y, w, h);
    if (max > 0 && value > 0) {
      const fw = Math.max(0, (w - 2) * (value / max));
      g.fillStyle(colL, 1); g.fillRect(x + 1, y, fw * 0.5, h);
      g.fillStyle(colR, 1); g.fillRect(x + 1 + fw * 0.5, y, fw * 0.5, h);
    }
  }

  // ── Single slot (action / equipment / inventory) ──────────────────────────

  _slot(sx, sy, sz, label, icon, locked) {
    const g = this.gfx;

    // Layered radial-center simulation: edge→mid→center gets lighter
    g.fillStyle(SLOT_EDGE,   1); g.fillRect(sx, sy, sz, sz);
    if (sz > 18) {
      g.fillStyle(SLOT_MID,  1); g.fillRect(sx + 3, sy + 3, sz - 6,  sz - 6);
    }
    if (sz > 28) {
      g.fillStyle(SLOT_INNER,  1); g.fillRect(sx + 7,  sy + 7,  sz - 14, sz - 14);
      g.fillStyle(SLOT_CENTER, 1); g.fillRect(sx + 12, sy + 12, sz - 24, sz - 24);
    }

    // Outer dark ring
    g.lineStyle(1, 0x050301, 0.9);
    g.strokeRect(sx - 1, sy - 1, sz + 2, sz + 2);

    // Main border
    g.lineStyle(1, locked ? 0x3a2508 : SLOT_BORDER, 1);
    g.strokeRect(sx, sy, sz, sz);

    // Top-left inner highlight (not on locked)
    if (!locked) {
      g.lineStyle(1, 0xc08830, 0.10);
      g.lineBetween(sx + 1, sy + 1, sx + sz - 1, sy + 1);
      g.lineBetween(sx + 1, sy + 1, sx + 1, sy + sz - 1);
    }

    // Key / number label
    if (label) {
      this._text(sx + 3, sy + 2, label, {
        fontFamily: FONT_PS8, fontSize: `${this._fs(6)}px`,
        color: locked ? '#2a1606' : '#9a6e18',
      });
    }

    // Icon
    if (icon) {
      const fs = Math.max(this._fs(14), Math.floor(sz * 0.45));
      this._text(sx + sz / 2, sy + sz / 2, icon, {
        fontFamily: 'serif', fontSize: `${fs}px`,
        color: locked ? '#2a2010' : '#ffffff',
      }).setOrigin(0.5, 0.5).setAlpha(locked ? 0.25 : 1);
    }
  }

  // ── Game-area vignette — soft dark gradient from edges inward ────────────────
  // Drawn before HUD panels so panels appear cleanly on top.

  _drawVignette(gx, gy, gw, gh) {
    const g      = this.gfx;
    const STEPS  = 22;
    const DEPTH  = 80;   // px from each edge the gradient extends
    const BG     = 0x070504;
    const step   = DEPTH / STEPS;

    for (let i = 0; i < STEPS; i++) {
      // t=1 at edge (i=0), t→0 toward centre — quadratic falloff
      const t     = (STEPS - 1 - i) / (STEPS - 1);
      const alpha = 0.72 * t * t;
      if (alpha < 0.004) continue;

      const d     = Math.round(i * step);
      const thick = Math.ceil(step) + 1;   // slight overlap ensures no gaps

      g.fillStyle(BG, alpha);
      g.fillRect(gx + d,                gy,            thick, gh);  // left
      g.fillRect(gx + gw - d - thick,   gy,            thick, gh);  // right
      g.fillRect(gx,                    gy + d,        gw,    thick); // top
      g.fillRect(gx,                    gy + gh - d - thick, gw, thick); // bottom
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  TOP BAR
  // ════════════════════════════════════════════════════════════════════════════

  _drawTopBar(W) {
    const g = this.gfx;

    // Background
    g.fillStyle(NAVY_TOP, 1);
    g.fillRect(0, 0, W, L.TOP_H);
    // Subtle top sheen
    g.fillStyle(0xffffff, 0.03);
    g.fillRect(0, 0, W, Math.floor(L.TOP_H / 2));

    // Outer bronze bottom band (2 px)
    g.fillStyle(BRONZE_OUTER, 1);
    g.fillRect(0, L.TOP_H - 2, W, 2);
    // Gold inner line
    g.lineStyle(1, GOLD_INNER, 0.9);
    g.lineBetween(0, L.TOP_H - 3, W, L.TOP_H - 3);
    // Dark shadow below bar
    g.fillStyle(0x000000, 0.4);
    g.fillRect(0, L.TOP_H, W, 3);

    // Top gold hairline
    g.lineStyle(1, GOLD_INNER, 0.3);
    g.lineBetween(0, 0, W, 0);

    // Left & right edge diamond accents (at bar bottom)
    this._diamonds(0, L.TOP_H, 0, 0, 5);
    this._diamonds(W, L.TOP_H, 0, 0, 5);

    // ── Title ──
    this._text(16, L.TOP_H / 2, '⚔  GRIMFELL', {
      fontFamily: FONT_PS8, fontSize: `${this._fs(13)}px`, color: GOLD_STR,
    }).setOrigin(0, 0.5);

    // ── Hints ──
    this._text(W / 2, L.TOP_H / 2,
      'Click to move  |  TAB Target  |  1–5 Weapons  |  Q/W/E/R/T Abilities  |  M Map', {
        fontFamily: FONT_VT, fontSize: `${this._fs(16)}px`, color: DIM_STR,
      }).setOrigin(0.5);

    // ── SAVE button ──
    const saveBtn = this._add(
      this.add.text(W - 200, L.TOP_H / 2, '💾 SAVE', {
        fontFamily: FONT_VT, fontSize: `${this._fs(18)}px`, color: GOLD_STR,
      }).setOrigin(0.5).setDepth(5).setInteractive({ useHandCursor: true })
    );
    saveBtn.on('pointerover',  () => saveBtn.setStyle({ color: '#e8c060' }));
    saveBtn.on('pointerout',   () => saveBtn.setStyle({ color: GOLD_STR }));
    saveBtn.on('pointerdown',  () => this.game.events.emit('ui-save'));

    // ── LOGOUT button ──
    const logoutBtn = this._add(
      this.add.text(W - 78, L.TOP_H / 2, '⏎ LOGOUT', {
        fontFamily: FONT_VT, fontSize: `${this._fs(18)}px`, color: '#cc4444',
      }).setOrigin(0.5).setDepth(5).setInteractive({ useHandCursor: true })
    );
    logoutBtn.on('pointerover',  () => logoutBtn.setStyle({ color: '#ff6666' }));
    logoutBtn.on('pointerout',   () => logoutBtn.setStyle({ color: '#cc4444' }));
    logoutBtn.on('pointerdown',  () => {
      localStorage.removeItem('grimfell_token');
      window.location.href = '../index.html';
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  RIGHT SIDEBAR  (two independent ornate panels stacked)
  // ════════════════════════════════════════════════════════════════════════════

  _drawSidebar(W, H) {
    const SX = W - L.RIGHT_W - MARGIN;
    const SY = L.TOP_H + MARGIN;
    const SH = H - L.TOP_H - L.BOTTOM_H - MARGIN * 2 - GAP;

    this.gfx.fillStyle(0x0a0908, 1);
    this.gfx.fillRect(SX, SY, L.RIGHT_W, SH);
    this.gfx.lineStyle(2, GOLD_INNER, 0.8);
    this.gfx.lineBetween(SX, SY, SX, SY + SH);

    // Minimap panel height: MINIMAP_SIZE + overhead (frame 6 + title 24 + padding 4 + frame 6 = 40)
    const MAP_PANEL_H = L.MINIMAP_SIZE + 40;

    const MP = { x: SX + GAP, y: SY + GAP, w: L.RIGHT_W - GAP * 2, h: MAP_PANEL_H - GAP };
    this._panel(MP.x, MP.y, MP.w, MP.h, 'MINIMAP');
    this._drawMinimap(MP.x, MP.y, MP.w, MP.h);

    const SP = { x: SX + GAP, y: SY + MAP_PANEL_H + GAP, w: L.RIGHT_W - GAP * 2, h: SH - MAP_PANEL_H - GAP * 2 };
    this._panel(SP.x, SP.y, SP.w, SP.h, 'SKILLS & XP');
    this._drawSkills(SP.x, SP.y, SP.w, SP.h);
  }

  // ── Journal panel content (placeholder) ───────────────────────────────────

  _drawJournal(px, py, pw, ph) {
    const g  = this.gfx;
    const IX = this._cx(px);
    const IW = this._cw(pw);
    let   IY = this._cy(py, true);

    // Subtle inner background wash
    g.fillStyle(0x070504, 1);
    g.fillRect(px + FRAME + 1, py + FRAME + TITLE_H + 1, pw - (FRAME + 1) * 2, ph - FRAME * 2 - TITLE_H - 2);

    // Thin top divider under title
    g.lineStyle(1, GOLD_INNER, 0.10);
    g.lineBetween(IX, IY, IX + IW, IY);
    IY += 10;

    // "No active tasks" notice
    this._text(IX + Math.floor(IW / 2), IY + 16, '📋', {
      fontFamily: 'serif', fontSize: `${this._fs(28)}px`, color: '#ffffff',
    }).setOrigin(0.5, 0.5).setAlpha(0.18);
    IY += 40;

    this._text(IX + Math.floor(IW / 2), IY, 'No active tasks', {
      fontFamily: FONT_VT, fontSize: `${this._fs(16)}px`, color: DIM_STR,
    }).setOrigin(0.5, 0);
    IY += 22;

    this._text(IX + Math.floor(IW / 2), IY, 'Quests & codex coming soon', {
      fontFamily: FONT_VT, fontSize: `${this._fs(13)}px`, color: '#302018',
    }).setOrigin(0.5, 0);
    IY += 36;

    // Faint separator
    g.lineStyle(1, GOLD_INNER, 0.07);
    g.lineBetween(IX + 8, IY, IX + IW - 8, IY);
  }

  // ── Minimap content ────────────────────────────────────────────────────────

  _drawMinimap(px, py, pw, ph) {
    const g  = this.gfx;
    const ov = this._minimapOverlay;
    ov.clear();

    const IX = this._cx(px);
    const IY = this._cy(py, true);
    const IW = this._cw(pw);
    if (IW <= 0) return;

    const avH  = (py + ph - FRAME) - IY;
    const SIZE = Math.floor(Math.min(IW, avH) * 0.87);
    const mX   = IX + Math.floor((IW  - SIZE) / 2);
    const mY   = IY + Math.floor((avH - SIZE) / 2);

    const TILE_PX = 32;
    const RADIUS  = 15;
    const VIEW_PX = (RADIUS * 2 + 1) * TILE_PX;  // 31 tiles × 32 px = 992

    const plx = Math.round(this.state.playerTileX ?? 50);
    const ply = Math.round(this.state.playerTileY ?? 50);

    // Shadow (gfx depth-0, clips behind the image)
    g.fillStyle(0x000000, 0.55);
    g.fillRect(mX - 2, mY - 2, SIZE + 4, SIZE + 4);

    const CROP_KEY = '__minimapCrop__';

    if (this.textures.exists('mapbg')) {
      // ── Canvas crop — rebuilt only when player tile or SIZE changes ──────────
      // Uses Canvas 2D drawImage so it works in Phaser 4 without relying on
      // RenderTexture.draw() behaviour that changed between Phaser 3 and 4.
      const cropKey = `${plx},${ply},${SIZE}`;
      if (this._minimapKey !== cropKey) {
        this._minimapKey = cropKey;

        const mapPX = MAP_W * TILE_PX;   // 3200
        const mapPY = MAP_H * TILE_PX;   // 3200
        const srcX  = Math.max(0, Math.min(mapPX - VIEW_PX, plx * TILE_PX - RADIUS * TILE_PX));
        const srcY  = Math.max(0, Math.min(mapPY - VIEW_PX, ply * TILE_PX - RADIUS * TILE_PX));

        const srcEl  = this.textures.get('mapbg').getSourceImage();
        const canvas = document.createElement('canvas');
        canvas.width  = SIZE;
        canvas.height = SIZE;
        canvas.getContext('2d').drawImage(srcEl, srcX, srcY, VIEW_PX, VIEW_PX, 0, 0, SIZE, SIZE);

        // Swap out Phaser texture from fresh canvas
        if (this.textures.exists(CROP_KEY)) this.textures.remove(CROP_KEY);
        this.textures.addCanvas(CROP_KEY, canvas);

        if (this._minimapImage) {
          this._minimapImage.setTexture(CROP_KEY).setDisplaySize(SIZE, SIZE);
        } else {
          this._minimapImage = this.add.image(0, 0, CROP_KEY)
            .setOrigin(0, 0).setDepth(1).setDisplaySize(SIZE, SIZE);
        }
      }

      // Always sync position (panel can shift on resize without tile change)
      if (this._minimapImage) this._minimapImage.setPosition(mX, mY);

    } else {
      // ── Fallback: tile-color grid (mapbg not yet loaded) ────────────────────
      const tiles = this._worldMapTiles;
      const TCOL  = [0x4a8c48,0x1e5ea8,0x7a6a58,0xc4a87e,0xd4b882,0x3a7038,0xb89060,0x2a2018,0x1e1428];
      const cell  = SIZE / (RADIUS * 2 + 1);
      for (let dy = -RADIUS; dy <= RADIUS; dy++) {
        for (let dx = -RADIUS; dx <= RADIUS; dx++) {
          const wx = plx + dx, wy = ply + dy;
          const col = (wx < 0 || wx >= MAP_W || wy < 0 || wy >= MAP_H)
            ? 0x0a0808 : (TCOL[tiles?.[wy]?.[wx] ?? 0] ?? TCOL[0]);
          g.fillStyle(col, 1);
          g.fillRect(mX + (dx + RADIUS) * cell, mY + (dy + RADIUS) * cell, cell + 0.5, cell + 0.5);
        }
      }
    }

    // ── Player marker + frame on overlay (depth 2, always above image) ────────
    const centerX = mX + SIZE / 2;
    const centerY = mY + SIZE / 2;
    ov.fillStyle(0x000000, 0.50);
    ov.fillRect(centerX - 4, centerY - 4, 9, 9);
    ov.fillStyle(0xffffff, 0.92);
    ov.fillRect(centerX - 3, centerY - 3, 7, 7);
    ov.fillStyle(GOLD_INNER, 1);
    ov.fillRect(centerX - 1.5, centerY - 1.5, 3, 3);

    ov.lineStyle(1, 0x000000, 0.6);
    ov.strokeRect(mX - 1, mY - 1, SIZE + 2, SIZE + 2);
    ov.lineStyle(2, GOLD_INNER, 0.65);
    ov.strokeRect(mX, mY, SIZE, SIZE);
    ov.lineStyle(1, GOLD_INNER, 0.20);
    ov.strokeRect(mX + 1, mY + 1, SIZE - 2, SIZE - 2);
  }

  // ── Skills content ─────────────────────────────────────────────────────────

  _drawSkills(px, py, pw, ph) {
    const IX = this._cx(px);
    const IW = this._cw(pw);
    let IY = this._cy(py, true);
    const g = this.gfx;

    // ── HP bar — 9 px, less dominant than full combat bar ────────────────
    const HP_H = 9;
    g.fillStyle(HP_TRACK, 1);
    g.fillRect(IX, IY, IW, HP_H);
    g.lineStyle(1, HP_TRACK_BDR, 1);
    g.strokeRect(IX, IY, IW, HP_H);
    if (this.state.maxHp > 0 && this.state.hp > 0) {
      const fw = Math.max(0, (IW - 2) * (this.state.hp / this.state.maxHp));
      g.fillStyle(HP_RED_L, 1); g.fillRect(IX + 1,           IY + 1, fw * 0.3,       HP_H - 2);
      g.fillStyle(HP_RED_M, 1); g.fillRect(IX + 1 + fw * 0.3, IY + 1, fw * 0.4,       HP_H - 2);
      g.fillStyle(HP_RED_R, 1); g.fillRect(IX + 1 + fw * 0.7, IY + 1, fw - fw * 0.7,  HP_H - 2);
      g.fillStyle(0xffffff, 0.05); g.fillRect(IX + 1, IY + 1, fw, 3);
    }
    IY += HP_H + 3;

    this._text(IX, IY, `❤  ${this.state.hp} / ${this.state.maxHp}`, {
      fontFamily: FONT_VT, fontSize: `${this._fs(14)}px`, color: '#cc2828',
    });
    IY += 14;

    this._text(IX, IY, 'Combat Lv. 1   Bonus +0', {
      fontFamily: FONT_VT, fontSize: `${this._fs(13)}px`, color: DIM_STR,
    });
    IY += 11;

    // Divider below HP section
    g.lineStyle(1, GOLD_INNER, 0.18);
    g.lineBetween(px + FRAME, IY + 3, px + pw - FRAME, IY + 3);
    IY += 8;

    // ── Skill rows ────────────────────────────────────────────────────────
    // Group dividers: insert a faint line after index 5 (combat) and 10 (gathering)
    const DIVIDER_AFTER = new Set([5, 10]);
    const ROW_H  = 26;   // taller rows fill the panel better
    const XP_H   = 5;    // thicker XP bar
    const XP_Y   = 18;   // offset from row top

    for (let si = 0; si < SKILLS.length; si++) {
      const sk = SKILLS[si];
      if (IY + ROW_H > py + ph - FRAME - 2) break;

      const live     = this.state.skills?.[sk.key];
      const lv       = live?.level  ?? (sk.lv ?? 1);
      const xpF      = live?.xpFrac ?? 0;
      // Dim only explicitly flagged secondary skills (unless they've gained XP)
      const inactive = (sk.dim === true) && lv <= 1 && xpF === 0;

      if (inactive) {
        this._text(IX, IY, `${sk.icon}  ${sk.name}`, {
          fontFamily: FONT_VT, fontSize: `${this._fs(14)}px`, color: '#5a4830',
        }).setAlpha(0.65);
        this._text(px + pw - FRAME - 8, IY, '1', {
          fontFamily: FONT_VT, fontSize: `${this._fs(14)}px`, color: '#5a4830',
        }).setOrigin(1, 0).setAlpha(0.65);
      } else {
        // Active — has XP progress or above level 1
        this._text(IX, IY, `${sk.icon}  ${sk.name}`, {
          fontFamily: FONT_VT, fontSize: `${this._fs(15)}px`, color: SKILL_STR,
        });
        this._text(px + pw - FRAME - 8, IY, `${lv}`, {
          fontFamily: FONT_VT, fontSize: `${this._fs(16)}px`, color: GOLD_STR,
        }).setOrigin(1, 0);
        this._thinBar(IX, IY + XP_Y, IW, XP_H, xpF * 100, 100, 0xa07828, 0xd4ac50);
        // Clickable zone — shows skill info popup
        this._add(
          this.add.zone(IX, IY, IW, ROW_H).setOrigin(0, 0).setDepth(5).setInteractive()
            .on('pointerdown', () => this._openSkillInfo(sk, lv, xpF))
        );
      }

      IY += ROW_H;

      // Group divider line
      if (DIVIDER_AFTER.has(si) && IY + ROW_H <= py + ph - FRAME - 2) {
        g.lineStyle(1, GOLD_INNER, 0.12);
        g.lineBetween(px + FRAME + 4, IY - 4, px + pw - FRAME - 4, IY - 4);
        IY += 2;
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  BOTTOM BAR  — ONE connected ornate frame, three interior columns
  // ════════════════════════════════════════════════════════════════════════════

  _drawBottomBar(W, H) {
    const BY  = H - L.BOTTOM_H - MARGIN;
    const g   = this.gfx;

    this._frame(MARGIN, BY, W - MARGIN * 2, L.BOTTOM_H);

    const cX  = MARGIN + FRAME;
    const cY  = BY + FRAME;
    const cW  = W - MARGIN * 2 - FRAME * 2;
    const cH  = L.BOTTOM_H - FRAME * 2;

    const infoW   = Math.floor(cW * L.BOTTOM_INFO_PCT);
    const actionW = Math.floor(cW * L.BOTTOM_ACTION_PCT);
    const gearW   = cW - infoW - actionW;

    const infoX   = cX;
    const actionX = cX + infoW;
    const gearX   = cX + infoW + actionW;

    // ── Internal vertical dividers ──────────────────────────────────────────
    // Each divider: dark gap + gold line + dark gap (3-layer, like a mini column border)
    for (const dvX of [actionX, gearX]) {
      g.lineStyle(1, 0x050810, 1);
      g.lineBetween(dvX - 1, cY, dvX - 1, cY + cH);

      g.lineStyle(1, GOLD_INNER, 0.65);
      g.lineBetween(dvX, cY, dvX, cY + cH);

      g.lineStyle(1, 0x050810, 1);
      g.lineBetween(dvX + 1, cY, dvX + 1, cY + cH);

      // Diamond accents on top & bottom of each divider
      const DS = 5;
      g.fillStyle(GOLD_INNER, 1);
      for (const dy of [cY, cY + cH]) {
        g.fillPoints([
          { x: dvX,      y: dy - DS },
          { x: dvX + DS, y: dy      },
          { x: dvX,      y: dy + DS },
          { x: dvX - DS, y: dy      },
        ], true);
      }
    }

    // ── Section title strips ────────────────────────────────────────────────
    const sections = [
      { x: infoX,   w: infoW,   label: 'STATUS' },
      { x: actionX, w: actionW, label: 'ACTIONS' },
      { x: gearX,   w: gearW,   label: 'GEAR' },
    ];
    for (const s of sections) {
      g.fillStyle(TITLE_L, 1);
      g.fillRect(s.x, cY, s.w, TITLE_H);
      g.fillStyle(TITLE_R, 1);
      g.fillRect(s.x + Math.floor(s.w / 2), cY, s.w - Math.floor(s.w / 2), TITLE_H);
      // Top sheen
      g.fillStyle(0xffffff, 0.04);
      g.fillRect(s.x, cY, s.w, 6);
      // Gold bottom separator
      g.lineStyle(1, GOLD_INNER, 0.7);
      g.lineBetween(s.x, cY + TITLE_H, s.x + s.w, cY + TITLE_H);
      this._text(s.x + s.w / 2, cY + TITLE_H / 2, s.label, {
        fontFamily: FONT_PS8, fontSize: '7px', color: GOLD_STR,
      }).setOrigin(0.5, 0.5);
    }

    // ── Section content ─────────────────────────────────────────────────────
    const contentY = cY + TITLE_H + 4;
    const contentH = cH - TITLE_H - 4;

    this._drawInfoPanel  (infoX,   contentY, infoW,   contentH);
    this._drawActionBar  (actionX, contentY, actionW, contentH);
    this._drawGearPanel  (gearX,   contentY, gearW,   contentH);
  }

  // ── STATUS section content ─────────────────────────────────────────────────

  _drawInfoPanel(px, py, pw, ph) {
    const g  = this.gfx;
    const IX = px + 8;
    const IW = pw - 16;

    // Content starts below panel title strip
    let IY = this._cy(py, true);

    // ── Message colour map ───────────────────────────────────────────────────
    const MSG_COL = {
      system: '#786858', info:   '#786858',
      combat: '#c87030', loot:   '#5ab0a0',
      skill:  '#b89048', xp:     '#b89048', lvlup:  '#d4a840',
      zone:   '#4a9848', safe:   '#4a9848',
    };

    // ── Tab filter map ───────────────────────────────────────────────────────
    const FILTER = {
      all:    null,                                    // show all
      combat: new Set(['combat']),
      loot:   new Set(['loot']),
      skills: new Set(['skill', 'xp', 'lvlup']),
      system: new Set(['system', 'info', 'zone', 'safe']),
    };

    // ── Draw tabs ────────────────────────────────────────────────────────────
    const TABS = [
      { id: 'all',    label: 'All'    },
      { id: 'combat', label: 'Combat' },
      { id: 'loot',   label: 'Loot'  },
      { id: 'skills', label: 'Skills' },
      { id: 'system', label: 'System' },
    ];
    const TAB_H   = 20;
    const TAB_GAP = 3;
    let tabX = IX;

    for (const tab of TABS) {
      const active  = this.statusTab === tab.id;
      const tabW    = Math.max(38, tab.label.length * 8 + 18);
      // Background
      g.fillStyle(active ? 0x1c100a : 0x0a0806, 1);
      g.fillRect(tabX, IY, tabW, TAB_H);
      // Border
      g.lineStyle(1, active ? GOLD_INNER : 0x281c10, 1);
      g.strokeRect(tabX, IY, tabW, TAB_H);
      // Bottom edge removed for active tab (merges with log area)
      if (active) {
        g.lineStyle(1, 0x1c100a, 1);
        g.lineBetween(tabX + 1, IY + TAB_H, tabX + tabW - 1, IY + TAB_H);
      }

      const tabId = tab.id;
      const txt = this._add(
        this.add.text(tabX + tabW / 2, IY + TAB_H / 2, tab.label, {
          fontFamily: FONT_PS8, fontSize: `${this._fs(6)}px`,
          color: active ? '#c89848' : '#483828',
        }).setOrigin(0.5, 0.5).setDepth(6).setInteractive({ useHandCursor: true })
      );
      txt.on('pointerdown', () => { this.statusTab = tabId; this._redraw(); });
      txt.on('pointerover',  () => { if (!active) txt.setStyle({ color: '#907860' }); });
      txt.on('pointerout',   () => { if (!active) txt.setStyle({ color: '#483828' }); });

      tabX += tabW + TAB_GAP;
    }

    IY += TAB_H + 1;

    // Thin gold line below tabs (log area border top)
    g.fillStyle(0x0e0a08, 1);
    g.fillRect(px + FRAME, IY, pw - FRAME * 2, ph - (IY - py) - FRAME);
    g.lineStyle(1, GOLD_INNER, 0.20);
    g.strokeRect(px + FRAME, IY, pw - FRAME * 2, ph - (IY - py) - FRAME);
    IY += 6;

    // ── Messages ─────────────────────────────────────────────────────────────
    const filter = FILTER[this.statusTab] ?? null;
    const msgs   = filter
      ? this.chatLog.filter(m => filter.has(typeof m === 'string' ? 'system' : (m.cat ?? 'system')))
      : this.chatLog;

    // Show latest messages that fit the remaining height
    const LINE_H  = 18;
    const maxLines = Math.floor((ph - (IY - py) - 8) / LINE_H);
    const visible  = msgs.slice(-Math.max(1, maxLines));

    for (let i = 0; i < visible.length; i++) {
      const m   = visible[i];
      const txt = typeof m === 'string' ? m : m.text;
      const cat = typeof m === 'string' ? 'system' : (m.cat ?? 'system');
      const col = MSG_COL[cat] ?? '#70707c';
      const y   = IY + i * LINE_H;
      if (y + LINE_H > py + ph - 4) break;
      this._text(IX, y, txt, {
        fontFamily: FONT_VT, fontSize: `${this._fs(17)}px`, color: col,
        wordWrap: { width: IW },
      });
    }
  }

  // ── ACTIONS section content ────────────────────────────────────────────────

  _drawActionBar(px, py, pw, ph) {
    const g        = this.gfx;
    const COLS     = 6, ROWS = 2;
    const SLOT_GAP = 8;   // gap between adjacent slots
    const ROW_GAP  = 14;  // extra vertical gap between the two rows

    // Interior content bounds (below title strip)
    const IX = this._cx(px);
    const IY = this._cy(py, true);
    const IW = this._cw(pw);
    const IH = ph - (IY - py) - FRAME - 4;

    // Near-black wash over the interior — removes blue/purple tint from panel fill
    g.fillStyle(0x060504, 1);
    g.fillRect(px + FRAME + 1, py + FRAME + TITLE_H + 1, pw - (FRAME + 1) * 2, ph - FRAME * 2 - TITLE_H - 2);

    // Slot size: constrain by available space, scaled cap, min 42px
    const szW = Math.floor((IW - (COLS - 1) * SLOT_GAP) / COLS);
    const szH = Math.floor((IH - ROW_GAP) / ROWS);
    const sz  = Math.max(42, Math.min(szW, szH, Math.round(82 * (this._uiScale ?? 1))));

    const gridW  = COLS * sz + (COLS - 1) * SLOT_GAP;
    const gridH  = ROWS * sz + ROW_GAP;
    const startX = px + Math.floor((pw - gridW) / 2);
    const startY = py + Math.floor((ph - gridH) / 2);

    // Row 0 — weapon quickbar slots 1–5; slot 6 is a reserved placeholder
    {
      const hotbar = this.state.hotbar ?? [null, null, null, null, null];
      const gear   = this.state.gear   ?? {};
      const inv    = this.state.inventory ?? [];

      // Detect pending weapon assignment: shift-selected inventory item is a weapon
      const pendingInvItem = (this._invSelectedSlot !== null)
        ? (inv[this._invSelectedSlot] ?? null) : null;
      const pendingIsWeapon = !!(pendingInvItem && ITEMS_DATA[pendingInvItem.item]?.slot === 'weapon');

      for (let col = 0; col < COLS; col++) {
        const sx = startX + col * (sz + SLOT_GAP);

        if (col === 5) {
          // Slot 6: reserved / empty placeholder (restored)
          this._slot(sx, startY, sz, '6', '', false);
          g.fillStyle(0x000000, 0.28);
          g.fillRect(sx + 1, startY + 1, sz - 2, sz - 2);
          continue;
        }

        const itemKey    = hotbar[col] ?? null;
        const def        = itemKey ? (ITEMS_DATA[itemKey] ?? null) : null;
        const isEquipped = !!(itemKey && gear.weapon === itemKey);

        this._slot(sx, startY, sz, `${col + 1}`, '', false);

        if (!def) {
          // Empty: dark overlay; amber hint when user has a weapon selected for assignment
          g.fillStyle(pendingIsWeapon ? 0x4a3800 : 0x000000, pendingIsWeapon ? 0.40 : 0.28);
          g.fillRect(sx + 1, startY + 1, sz - 2, sz - 2);
          if (pendingIsWeapon) {
            g.lineStyle(1, 0xffcc44, 0.55);
            g.strokeRect(sx, startY, sz, sz);
          }
        } else {
          // Filled: icon centred + short name at bottom
          this._itemIcon(itemKey, sx + sz / 2, startY + sz / 2 - 4, sz);

          const shortName = def.name.length > 8 ? def.name.slice(0, 7) + '…' : def.name;
          this._text(sx + sz / 2, startY + sz - 3, shortName, {
            fontFamily: FONT_VT, fontSize: `${this._fs(10)}px`, color: '#b89048',
          }).setOrigin(0.5, 1);

          // Equipped glow — amber border matching the selection highlight style
          if (isEquipped) {
            g.lineStyle(2, 0xffe080, 0.90);
            g.strokeRect(sx - 1, startY - 1, sz + 2, sz + 2);
            g.lineStyle(1, 0xffe080, 0.30);
            g.strokeRect(sx - 3, startY - 3, sz + 6, sz + 6);
          }
          // Pending-assignment hint on filled slots too
          if (pendingIsWeapon) {
            g.lineStyle(1, 0xffcc44, 0.60);
            g.strokeRect(sx, startY, sz, sz);
          }
        }

        // Click / tap zone — assign if weapon pending, else equip
        const capturedCol       = col;
        const capturedPending   = pendingIsWeapon;
        const capturedPendItem  = pendingInvItem;
        const capturedEmpty     = !def;
        const wZone = this._add(
          this.add.zone(sx, startY, sz, sz)
            .setOrigin(0, 0)
            .setDepth(6)
            .setInteractive()
            .on('pointerdown', () => {
              if (capturedPending && capturedPendItem) {
                // Assign the shift-selected weapon to this quickbar slot
                this.game.events.emit('assign-hotbar', {
                  slot: capturedCol, itemKey: capturedPendItem.item,
                });
                this._invSelectedSlot = null;
              } else {
                const hb = this.state.hotbar ?? [];
                if (hb[capturedCol]) {
                  this.game.events.emit('use-hotbar', capturedCol);
                }
              }
            })
        );
        // Empty slot: show helper tooltip on hover
        if (capturedEmpty) {
          const tip = 'Shift-click a weapon in inventory,\nthen click this slot.';
          wZone.on('pointerover', (ptr) => this._showTooltip(tip, ptr.x + 10, ptr.y));
          wZone.on('pointermove', (ptr) => this._showTooltip(tip, ptr.x + 10, ptr.y));
          wZone.on('pointerout',  ()    => this._hideTooltip());
        }
      }
    }

    // Weapon slot hint — always-visible instruction line under slots 1–5
    {
      const hintX = startX + Math.floor((5 * sz + 4 * SLOT_GAP) / 2);
      const hintY = startY + sz + 3;
      this._text(hintX, hintY, 'Shift-click weapon → click 1–5 slot', {
        fontFamily: FONT_VT,
        fontSize: `${this._fs(9)}px`,
        color: '#6a5030',
      }).setOrigin(0.5, 0).setAlpha(0.70);
    }

    // Row 1 — ability slots Q W E R T Y
    for (let col = 0; col < COLS; col++) {
      const key  = ABILITY_KEYS[col];
      let locked = ABILITY_LOCKED[col];
      const ab   = this.abilityState[key] ?? { cooldownRemaining: 0, isActive: false };

      // Resolve PNG texture key for this slot
      let texKey = ABILITY_TEX_KEYS[col] ?? null;
      if (col === 4) {
        locked = !ab.unlocked;
        texKey = ab.unlocked ? (STYLE_TEX_KEYS[ab.style] ?? null) : null;
      }

      // Y slot and locked T slot still use the lock emoji; others suppress emoji
      const fallbackIcon = (locked) ? '🔒' : '';

      const onCD   = !locked && ab.cooldownRemaining > 0;
      const active = !locked && ab.isActive;
      const sx     = startX + col * (sz + SLOT_GAP);
      const sy     = startY + sz + ROW_GAP;

      this._slot(sx, sy, sz, key, fallbackIcon, locked);

      // PNG icon — centered, pixel-art scale, dims during cooldown
      if (texKey && !locked && this.textures.exists(texKey)) {
        const iconSz = Math.max(22, Math.min(38, Math.floor(sz * 0.63)));
        this._add(
          this.add.image(sx + sz / 2, sy + sz / 2, texKey)
            .setDisplaySize(iconSz, iconSz)
            .setDepth(4)
            .setAlpha(onCD ? 0.38 : 1.0)
        );
      }

      // Q-R slots: static 2-line ability name at slot bottom
      if (col < 4 && !locked) {
        const lines = QWER_LABELS[col];
        if (lines) {
          const nfs = 7;
          const bot = sy + sz - 4;
          if (lines.length >= 2) {
            this._text(sx + sz / 2, bot,           lines[1], {
              fontFamily: FONT_PS8, fontSize: `${nfs}px`, color: '#cc9933',
            }).setOrigin(0.5, 1);
            this._text(sx + sz / 2, bot - nfs - 1, lines[0], {
              fontFamily: FONT_PS8, fontSize: `${nfs}px`, color: '#cc9933',
            }).setOrigin(0.5, 1);
          } else {
            this._text(sx + sz / 2, bot, lines[0], {
              fontFamily: FONT_PS8, fontSize: `${nfs}px`, color: '#cc9933',
            }).setOrigin(0.5, 1);
          }
        }
      }

      // T slot: 2-line ability name in small fixed font at bottom
      if (col === 4 && !locked && ab.abilityName) {
        const words = ab.abilityName.split(' ');
        const nfs   = 7; // fixed — bypass _fs minimum so it stays inside the slot
        const barReserve = 5; // px gap above cooldown bar
        if (words.length >= 2) {
          const line2 = words.slice(1).join(' ');
          this._text(sx + sz / 2, sy + sz - barReserve - 1, line2, {
            fontFamily: FONT_PS8, fontSize: `${nfs}px`, color: '#cc9933',
          }).setOrigin(0.5, 1);
          this._text(sx + sz / 2, sy + sz - barReserve - 1 - nfs - 1, words[0], {
            fontFamily: FONT_PS8, fontSize: `${nfs}px`, color: '#cc9933',
          }).setOrigin(0.5, 1);
        } else {
          this._text(sx + sz / 2, sy + sz - barReserve - 1, ab.abilityName, {
            fontFamily: FONT_PS8, fontSize: `${nfs}px`, color: '#cc9933',
          }).setOrigin(0.5, 1);
        }
      }

      // Cooldown dim overlay
      if (onCD) {
        g.fillStyle(0x000000, 0.62);
        g.fillRect(sx + 1, sy + 1, sz - 2, sz - 2);

        // Timer centered over slot for all ability keys
        const secs = Math.ceil(ab.cooldownRemaining / 1000);
        this._text(sx + sz / 2, sy + sz / 2, `${secs}s`, {
          fontFamily: FONT_PS8, fontSize: `${this._fs(6)}px`, color: '#cccccc',
        }).setOrigin(0.5, 0.5);

        if (col === 4 && ab.cooldownTotal > 0) {
          // T slot: purple progress bar at slot bottom
          const frac    = ab.cooldownRemaining / ab.cooldownTotal;
          const barH    = 3;
          const barMaxW = sz - 4;
          const barY    = sy + sz - barH - 1;
          g.fillStyle(0x221133, 0.8);
          g.fillRect(sx + 2, barY, barMaxW, barH);
          g.fillStyle(0xaa55ff, 0.9);
          g.fillRect(sx + 2, barY, Math.floor(barMaxW * frac), barH);
        }
      }

      // Active glow border
      if (active) {
        const acCol = ABILITY_ACTIVE_COL[col];
        g.lineStyle(2, acCol, 0.90);
        g.strokeRect(sx - 1, sy - 1, sz + 2, sz + 2);
        g.lineStyle(1, acCol, 0.40);
        g.strokeRect(sx - 3, sy - 3, sz + 6, sz + 6);
      }

      // W slot: bright mana-ready glow when mana >= 10 or free ability active
      if (col === 1 && !locked && !active && !onCD && ((this.state.mana ?? 0) >= 10 || this.state.freeAbility)) {
        g.lineStyle(1, 0x3377dd, 0.80);
        g.strokeRect(sx - 1, sy - 1, sz + 2, sz + 2);
        g.lineStyle(1, 0x3377dd, 0.25);
        g.strokeRect(sx - 3, sy - 3, sz + 6, sz + 6);
      }
      // All other ability slots: same glow style as W when mana >= 10
      if (col !== 1 && !locked && !active && !onCD && (this.state.mana ?? 0) >= 10) {
        g.lineStyle(1, 0x3377dd, 0.80);
        g.strokeRect(sx - 1, sy - 1, sz + 2, sz + 2);
        g.lineStyle(1, 0x3377dd, 0.25);
        g.strokeRect(sx - 3, sy - 3, sz + 6, sz + 6);
      }

      // Click / tap hit zone — unlocked slots only
      if (!locked) {
        this._add(
          this.add.zone(sx, sy, sz, sz)
            .setOrigin(0, 0)
            .setDepth(6)
            .setInteractive()
            .on('pointerdown', () => this.game.events.emit('use-ability', key))
        );
      }
    }

    // ── Mana bar — horizontal strip below grid, hidden when mana is 0 ─────────
    const mana    = this.state.mana    ?? 0;
    const maxMana = this.state.maxMana ?? 25;
    if (mana > 0) {
      const mFrac = maxMana > 0 ? Math.min(1, mana / maxMana) : 0;
      const barH  = 17;
      const barW  = gridW;
      const barX  = startX;
      const barY  = startY + gridH + 6;
      const midY  = barY + Math.floor(barH / 2);

      // Dark backing + gold border
      g.fillStyle(0x060810, 1);
      g.fillRect(barX, barY, barW, barH);
      g.lineStyle(1, GOLD_INNER, 1);
      g.strokeRect(barX, barY, barW, barH);

      // Blue fill (left-to-right)
      if (mFrac > 0) {
        const fillW = Math.max(1, Math.floor((barW - 2) * mFrac));
        g.fillStyle(0x2255a0, 1);
        g.fillRect(barX + 1, barY + 1, fillW, barH - 2);
      }

      // MP label on left — brighter blue
      this._text(barX + 5, midY, 'MP', {
        fontFamily: FONT_PS8, fontSize: `${this._fs(6)}px`, color: '#88aaff',
      }).setOrigin(0, 0.5);

      // Value text right-aligned: "10 / 50"
      this._text(barX + barW - 5, midY, `${mana} / ${maxMana}`, {
        fontFamily: FONT_VT, fontSize: `${this._fs(13)}px`, color: '#c0d8ff',
      }).setOrigin(1, 0.5);
    }
  }

  // ── GEAR section content ───────────────────────────────────────────────────

  _drawGearPanel(px, py, pw, ph) {
    const g    = this.gfx;
    const gear = this.state.gear      ?? {};
    const inv  = this.state.inventory ?? [];

    // ── Side-by-side column geometry ─────────────────────────────────────────
    // Left 40% = equipment  |  Right 60% = inventory
    const X_PAD   = 6;
    const COL_GAP = 5;   // gap between the two columns
    const usable  = pw - X_PAD;
    const eqColW  = Math.floor(usable * 0.40);
    const invColW = usable - eqColW - COL_GAP;
    const eqX     = px + X_PAD;
    const invX    = eqX + eqColW + COL_GAP;
    const topY    = py + 2;

    // Thin vertical divider between columns
    const sepX = eqX + eqColW + Math.floor(COL_GAP / 2);
    g.lineStyle(1, GOLD_INNER, 0.22);
    g.lineBetween(sepX, py + 2, sepX, py + ph - 2);

    // ── Equipment slots — 3 cols, size fills left column ─────────────────────
    const EQ_ORDER = ['weapon','shield','head','body','legs','boots','tool'];
    const EQ_ICONS = { weapon:'🗡️',shield:'🛡️',head:'⛑️',body:'👕',legs:'👖',boots:'👟',tool:'🪓' };
    const EQ_COLS = 3, EQ_GAP = 3;
    // Slot size: fill column width, scaled cap, min 24px
    const EQ_SZ = Math.max(24, Math.min(
      Math.round(L.GEAR_SLOT_SIZE * (this._uiScale ?? 1)),
      Math.floor((eqColW - (EQ_COLS - 1) * EQ_GAP) / EQ_COLS)
    ));

    for (let i = 0; i < EQ_ORDER.length; i++) {
      const slotId = EQ_ORDER[i];
      const itemKey = gear[slotId] ?? null;
      const itemDef = itemKey ? ITEMS_DATA[itemKey] : null;
      const icon    = itemDef?.icon ?? EQ_ICONS[slotId];
      const occ     = !!itemKey;
      const row = Math.floor(i / EQ_COLS);
      const col = i % EQ_COLS;
      const sx  = eqX + col * (EQ_SZ + EQ_GAP);
      const sy  = topY + row * (EQ_SZ + EQ_GAP);
      if (sy + EQ_SZ > py + ph - 1) break;

      g.fillStyle(0x060810, 1);
      g.fillRect(sx - 1, sy - 1, EQ_SZ + 2, EQ_SZ + 2);
      g.fillStyle(occ ? 0x162040 : EQ_BG, 1);
      g.fillRect(sx, sy, EQ_SZ, EQ_SZ);
      g.fillStyle(0x111838, 1);
      g.fillRect(sx + 2, sy + 2, EQ_SZ - 4, EQ_SZ - 4);
      // Bright border when occupied, dim when empty
      g.lineStyle(occ ? 2 : 1, GOLD_INNER, occ ? 0.95 : 0.22);
      g.strokeRect(sx, sy, EQ_SZ, EQ_SZ);
      g.lineStyle(1, GOLD_INNER, 0.14);
      g.strokeRect(sx + 2, sy + 2, EQ_SZ - 4, EQ_SZ - 4);
      g.lineStyle(1, GOLD_INNER, 0.12);
      g.lineBetween(sx + 1, sy + 1, sx + EQ_SZ - 1, sy + 1);
      if (occ) {
        this._itemIcon(itemKey, sx + EQ_SZ / 2, sy + EQ_SZ / 2, EQ_SZ);
      } else {
        this._text(sx + EQ_SZ / 2, sy + EQ_SZ / 2, icon, {
          fontFamily: 'serif', fontSize: `${this._fs(11)}px`, color: '#ffffff',
        }).setOrigin(0.5, 0.5).setAlpha(0.12);
      }
    }

    // ── Inventory slots — 5 cols, size fills right column ────────────────────
    const INV_COLS = 5, INV_GAP = 2;
    // Slot size: fill column width, scaled cap, min 24px
    const INV_SZ = Math.max(24, Math.min(
      Math.round(L.INV_SLOT_SIZE * (this._uiScale ?? 1)),
      Math.floor((invColW - (INV_COLS - 1) * INV_GAP) / INV_COLS)
    ));

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < INV_COLS; c++) {
        const sy   = topY + r * (INV_SZ + INV_GAP);
        if (sy + INV_SZ > py + ph - 1) break;
        const sx   = invX + c * (INV_SZ + INV_GAP);
        const idx  = r * INV_COLS + c;
        const slot = inv[idx] ?? null;
        const def  = slot ? (ITEMS_DATA[slot.item] ?? null) : null;
        const filled = !!slot;

        g.fillStyle(0x050301, 1); g.fillRect(sx - 1, sy - 1, INV_SZ + 2, INV_SZ + 2);
        g.fillStyle(0x0e0906, 1); g.fillRect(sx, sy, INV_SZ, INV_SZ);
        g.fillStyle(INV_BG, 1);   g.fillRect(sx + 2, sy + 2, INV_SZ - 4, INV_SZ - 4);
        g.lineStyle(1, filled ? GOLD_INNER : INV_BDR, filled ? 0.75 : 0.35);
        g.strokeRect(sx, sy, INV_SZ, INV_SZ);
        g.lineStyle(1, 0xffd070, filled ? 0.12 : 0.05);
        g.lineBetween(sx + 1, sy + 1, sx + INV_SZ - 1, sy + 1);

        if (def) {
          this._itemIcon(slot.item, sx + INV_SZ / 2, sy + INV_SZ / 2, INV_SZ);
          if (slot.qty > 1) {
            this._text(sx + INV_SZ - 1, sy + INV_SZ - 1, `${slot.qty}`, {
              fontFamily: FONT_VT, fontSize: `${this._fs(11)}px`, color: '#e8c060',
            }).setOrigin(1, 1);
          }
          const zone = this._add(
            this.add.zone(sx + INV_SZ / 2, sy + INV_SZ / 2, INV_SZ, INV_SZ)
              .setInteractive({ useHandCursor: true }).setDepth(7)
          );
          zone.on('pointerdown', () => this.game.events.emit('equip-item', slot.item));
        }
      }
    }
  }

  // ── Equipment panel (gear slots only) ────────────────────────────────────────

  _drawEquipPanel(px, py, pw, ph) {
    const g     = this.gfx;
    const gear  = this.state.gear  ?? {};
    const coins = this.state.coins ?? 0;

    // ── RPG layout: 3 cols × 4 rows  (null = blank cell, no slot drawn) ────
    const LAYOUT = [
      [null,      'head',   'tool'  ],
      ['weapon',  'body',   'shield'],
      ['ring_l',  'legs',   'ring_r'],
      [null,      'boots',  null    ],
    ];
    const PLACEHOLDER = {
      head:   '⛑️', tool:   '💎',
      weapon: '🗡️', body:   '👕', shield: '🛡️',
      ring_l: '💍', legs:   '👖', ring_r: '💍',
      boots:  '👟',
    };
    const FUTURE = new Set(['ring_l', 'ring_r']);

    // ── Aggregate stats from all equipped gear ────────────────────────────
    const wepKey   = gear.weapon ?? null;
    const wepDef   = wepKey ? ITEMS_DATA[wepKey] : null;
    const style    = wepDef?.combatStyle ?? 'melee';
    const styleLvl = this.state.skills?.[style]?.level ?? 1;
    const wDmg     = wepDef?.weaponDamage   ?? (wepDef?.strBonus ?? 0);
    const wAcc     = wepDef?.weaponAccuracy ?? (wepDef?.atkBonus ?? 0);
    const damage   = wDmg + Math.floor(styleLvl / 5);
    const accuracy = wAcc + styleLvl * 2;
    let armor = 0;
    for (const itemKey of Object.values(gear)) {
      if (!itemKey) continue;
      const def = ITEMS_DATA[itemKey];
      if (def) armor += def.defBonus ?? 0;
    }
    const vitality = this.state.maxHp ?? 10;

    // ── Geometry ─────────────────────────────────────────────────────────
    const GOLD_H    = 20, GOLD_GAP  = 5;
    const COL_DIV   = 5;   // gap around the vertical divider
    const COLS = 3, ROWS = 4, SLOT_GAP = 4;

    const titleEndY  = py + FRAME + TITLE_H;
    const contentBot = py + ph - FRAME;
    const avH        = contentBot - titleEndY;
    const avH_grid   = avH - GOLD_H - GOLD_GAP;

    // Horizontal split: left 60% = equipment grid, right 40% = stats
    const splitX  = px + Math.floor(pw * 0.60);
    const leftW   = splitX - px - FRAME - COL_DIV;   // usable width for grid column
    const rightX  = splitX + COL_DIV;
    const rightW  = px + pw - FRAME - rightX;

    // Slot size constrained by left column width and available height, min 24px
    const szW = Math.floor((leftW - (COLS - 1) * SLOT_GAP) / COLS);
    const szH = Math.floor((avH_grid - (ROWS - 1) * SLOT_GAP) / ROWS);
    const sz  = Math.max(24, Math.min(szW, szH));

    // Center grid within left column
    const gridW  = COLS * sz + (COLS - 1) * SLOT_GAP;
    const gridH  = ROWS * sz + (ROWS - 1) * SLOT_GAP;
    const startX = px + FRAME + Math.floor((leftW - gridW) / 2);
    const startY = titleEndY + Math.floor((avH_grid - gridH) / 2);

    // ── Vertical divider ──────────────────────────────────────────────────
    g.lineStyle(1, 0x1e1a08, 1);
    g.lineBetween(splitX, titleEndY + 2, splitX, contentBot - GOLD_H - GOLD_GAP - 2);
    g.lineStyle(1, GOLD_INNER, 0.18);
    g.lineBetween(splitX, titleEndY + 2, splitX, contentBot - GOLD_H - GOLD_GAP - 2);

    // ── Equipment slots ───────────────────────────────────────────────────
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const slotId = LAYOUT[r][c];
        if (slotId === null) continue;

        const sx = startX + c * (sz + SLOT_GAP);
        const sy = startY + r * (sz + SLOT_GAP);

        const future  = FUTURE.has(slotId);
        const itemKey = future ? null : (gear[slotId] ?? null);
        const itemDef = itemKey ? (ITEMS_DATA[itemKey] ?? null) : null;
        const occ     = !!itemDef;

        g.fillStyle(0x060504, 1);
        g.fillRect(sx - 1, sy - 1, sz + 2, sz + 2);
        g.fillStyle(occ ? 0x1c1408 : (future ? 0x080706 : EQ_BG), 1);
        g.fillRect(sx, sy, sz, sz);
        g.fillStyle(occ ? 0x181410 : 0x111210, 1);
        g.fillRect(sx + 2, sy + 2, sz - 4, sz - 4);

        g.lineStyle(occ ? 2 : 1, GOLD_INNER, occ ? 0.90 : (future ? 0.10 : 0.28));
        g.strokeRect(sx, sy, sz, sz);
        g.lineStyle(1, GOLD_INNER, occ ? 0.14 : 0.07);
        g.strokeRect(sx + 2, sy + 2, sz - 4, sz - 4);
        g.lineStyle(1, GOLD_INNER, occ ? 0.18 : 0.06);
        g.lineBetween(sx + 1, sy + 1, sx + sz - 1, sy + 1);
        g.lineBetween(sx + 1, sy + 1, sx + 1, sy + sz - 1);

        const icon  = itemDef?.icon ?? PLACEHOLDER[slotId];
        if (occ) {
          this._itemIcon(itemKey, sx + sz / 2, sy + sz / 2, sz);
        } else {
          const fs = Math.max(this._fs(14), Math.floor(sz * 0.50));
          this._text(sx + sz / 2, sy + sz / 2, icon, {
            fontFamily: 'serif', fontSize: `${fs}px`, color: '#ffffff',
          }).setOrigin(0.5, 0.5).setAlpha(future ? 0.10 : 0.20);
        }
      }
    }

    // ── Stats box ─────────────────────────────────────────────────────────
    const statsY = titleEndY + 4;
    const statsH = avH_grid - 8;

    // Stats box background
    g.fillStyle(0x080604, 1);
    g.fillRect(rightX, statsY, rightW, statsH);
    g.lineStyle(1, GOLD_INNER, 0.18);
    g.strokeRect(rightX, statsY, rightW, statsH);
    g.lineStyle(1, GOLD_INNER, 0.08);
    g.lineBetween(rightX + 1, statsY + 1, rightX + rightW - 1, statsY + 1);

    const STATS = [
      { icon: '⚔️', label: 'Damage',   value: damage   },
      { icon: '🎯', label: 'Accuracy', value: accuracy },
      { icon: '🛡️', label: 'Armor',    value: armor    },
      { icon: '❤️', label: 'Vitality', value: vitality },
    ];

    // Title inside stats box
    this._text(rightX + Math.floor(rightW / 2), statsY + 10, 'STATS', {
      fontFamily: FONT_PS8, fontSize: `${this._fs(6)}px`, color: DIM_STR,
    }).setOrigin(0.5, 0.5);

    g.lineStyle(1, GOLD_INNER, 0.14);
    g.lineBetween(rightX + 4, statsY + 18, rightX + rightW - 4, statsY + 18);

    const statRowH = Math.floor((statsH - 22) / STATS.length);
    STATS.forEach(({ icon, label, value }, i) => {
      const ry    = statsY + 22 + i * statRowH;
      const midY  = ry + Math.floor(statRowH / 2);
      const hasVal = value > 0;

      // Row separator (skip first)
      if (i > 0) {
        g.lineStyle(1, GOLD_INNER, 0.07);
        g.lineBetween(rightX + 4, ry, rightX + rightW - 4, ry);
      }

      // Icon
      this._text(rightX + 10, midY, icon, {
        fontFamily: 'serif', fontSize: `${this._fs(13)}px`, color: '#ffffff',
      }).setOrigin(0.5, 0.5).setAlpha(hasVal ? 0.90 : 0.25);

      // Label
      this._text(rightX + 20, midY - 5, label, {
        fontFamily: FONT_PS8, fontSize: `${this._fs(5)}px`, color: hasVal ? DIM_STR : '#2a1e18',
      }).setOrigin(0, 0.5);

      // Value
      this._text(rightX + rightW - 5, midY + 4, `${value}`, {
        fontFamily: FONT_VT, fontSize: `${this._fs(15)}px`,
        color: hasVal ? (i < 2 ? '#c47828' : (i === 2 ? '#3a7088' : '#aa2830')) : '#2a1e18',
      }).setOrigin(1, 0.5);
    });

    // ── Gold counter — full panel width ───────────────────────────────────
    const goldY    = contentBot - GOLD_H;
    const goldBarX = px + FRAME + 2;
    const goldBarW = pw - (FRAME + 2) * 2;

    g.fillStyle(0x0a0804, 1);
    g.fillRect(goldBarX, goldY, goldBarW, GOLD_H);
    g.lineStyle(1, 0x584010, 0.55);
    g.strokeRect(goldBarX, goldY, goldBarW, GOLD_H);
    g.lineStyle(1, GOLD_INNER, 0.12);
    g.lineBetween(goldBarX + 1, goldY + 1, goldBarX + goldBarW - 1, goldY + 1);

    const _coinSz = Math.round(GOLD_H - 4);
    if (this.textures.exists('coin_spr')) {
      this._add(this.add.image(goldBarX + _coinSz / 2 + 2, goldY + GOLD_H / 2, 'coin_spr')
        .setDisplaySize(_coinSz, _coinSz).setDepth(6));
    }
    this._text(px + Math.floor(pw / 2), goldY + Math.floor(GOLD_H / 2),
      coins.toLocaleString(), {
        fontFamily: FONT_VT, fontSize: `${this._fs(18)}px`, color: '#e8c060',
      }).setOrigin(0.5, 0.5);
  }

  // ── Inventory panel (inventory grid only) ─────────────────────────────────────

  _showTooltip(name, wx, wy) {
    const pad = 5, margin = 4;
    this._tooltipTxt.setText(name).setVisible(true);
    const tw = this._tooltipTxt.width + pad * 2;
    const th = this._tooltipTxt.height + pad * 2;
    // Position above cursor, clamp to screen
    const sx = Math.min(wx, this.scale.width  - tw - margin);
    const sy = Math.max(margin, wy - th - 4);
    this._tooltipTxt.setPosition(sx + pad, sy + pad);
    this._tooltipBg.clear().setVisible(true)
      .fillStyle(0x1a120a, 0.92).fillRect(sx, sy, tw, th)
      .lineStyle(1, 0x8a6020, 0.80).strokeRect(sx, sy, tw, th);
  }

  _hideTooltip() {
    this._tooltipBg.setVisible(false);
    this._tooltipTxt.setVisible(false);
  }

  // ── Discovery / notification toast ────────────────────────────────────────
  // Appears top-centre, slides in, auto-fades. Stacks safely if multiple fire.
  _showDiscoveryToast(text, color = '#c9a84c') {
    const W  = this.scale.width;
    const cx = Math.round(W / 2);
    const slot = this._toastSlot;
    this._toastSlot++;
    const baseY  = 52 + slot * 34;
    const startY = baseY - 10;

    const txt = this.add.text(cx, startY, text, {
      fontFamily: FONT_PS8, fontSize: '7px', color,
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 0.5).setDepth(37).setAlpha(0);

    const pw = txt.width + 28, ph = 20;
    const bg = this.add.rectangle(cx, startY, pw, ph, 0x0a0806, 0.90)
      .setDepth(36).setAlpha(0).setStrokeStyle(1, 0x9a7828);

    this.tweens.add({
      targets: [bg, txt], alpha: 1, y: `+=${10}`,
      duration: 280, ease: 'Back.easeOut',
      onComplete: () => {
        this.time.delayedCall(2300, () => {
          this.tweens.add({
            targets: [bg, txt], alpha: 0,
            duration: 500, ease: 'Power2',
            onComplete: () => {
              bg.destroy(); txt.destroy();
              this._toastSlot = Math.max(0, this._toastSlot - 1);
            },
          });
        });
      },
    });
  }

  // Render item icon: PNG sprite if preloaded as item_<key>, else emoji text fallback.
  // trackFn: object registration for cleanup; defaults to this._add.
  _itemIcon(itemKey, cx, cy, sz, alpha = 1, trackFn = null) {
    const track  = trackFn ?? ((o) => this._add(o));
    const texKey = `item_${itemKey}`;
    if (itemKey && this.textures.exists(texKey)) {
      const pad = Math.max(2, Math.floor(sz * 0.10));
      return track(
        this.add.image(cx, cy, texKey)
          .setDisplaySize(sz - pad * 2, sz - pad * 2)
          .setOrigin(0.5, 0.5).setDepth(5).setAlpha(alpha)
      );
    }
    const def   = ITEMS_DATA[itemKey];
    const emoji = def?.icon ?? '?';
    const fs    = Math.max(10, Math.floor(sz * 0.50));
    return track(
      this.add.text(cx, cy, emoji, {
        fontFamily: 'serif', fontSize: `${fs}px`, color: '#ffffff',
      }).setOrigin(0.5, 0.5).setDepth(5).setAlpha(alpha)
    );
  }

  _drawInvPanel(px, py, pw, ph) {
    this._hideTooltip();
    const g   = this.gfx;
    const inv = this.state.inventory ?? [];

    const COLS = 8, ROWS = 5, GAP = 2;

    // ── Sort button — right side of title strip ───────────────────────────
    {
      const btnH = Math.max(12, Math.floor(TITLE_H * 0.65));
      const btnW = Math.max(28, Math.floor(pw * 0.20));
      const bx   = px + pw - FRAME - 2 - btnW;
      const by   = py + FRAME + Math.floor((TITLE_H - btnH) / 2);
      const btn  = this._add(
        this.add.rectangle(bx + btnW / 2, by + btnH / 2, btnW, btnH, 0x1a1008)
          .setStrokeStyle(1, GOLD_INNER, 0.65).setDepth(6).setInteractive({ useHandCursor: true })
      );
      const txt = this._add(
        this.add.text(bx + btnW / 2, by + btnH / 2, 'SORT', {
          fontFamily: FONT_PS8, fontSize: `${Math.max(5, Math.floor(btnH * 0.45))}px`, color: GOLD_STR,
        }).setOrigin(0.5, 0.5).setDepth(7)
      );
      btn.on('pointerover',  () => { btn.setFillStyle(0x3a2808); txt.setColor('#ffffff'); });
      btn.on('pointerout',   () => { btn.setFillStyle(0x1a1008); txt.setColor(GOLD_STR); });
      btn.on('pointerdown',  () => this.game.events.emit('sort-inventory'));
    }

    // Available area below title strip
    const titleEndY  = py + FRAME + TITLE_H;
    const contentBot = py + ph - FRAME;
    const avW = pw - FRAME * 2 - 4;
    const avH = contentBot - titleEndY;

    // Slot size: fill the available space, constrained by both axes, min 24px
    const szW = Math.floor((avW - (COLS - 1) * GAP) / COLS);
    const szH = Math.floor((avH - (ROWS - 1) * GAP) / ROWS);
    const sz  = Math.max(24, Math.min(szW, szH));

    // Center grid within panel
    const gridW  = COLS * sz + (COLS - 1) * GAP;
    const gridH  = ROWS * sz + (ROWS - 1) * GAP;
    const startX = px + Math.floor((pw - gridW) / 2);
    const startY = titleEndY + Math.floor((avH - gridH) / 2);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const sx  = startX + c * (sz + GAP);
        const sy  = startY + r * (sz + GAP);
        const idx = r * COLS + c;
        const slot     = inv[idx] ?? null;
        const def      = slot ? (ITEMS_DATA[slot.item] ?? null) : null;
        const filled   = !!slot;
        const selected = this._invSelectedSlot === idx;

        // Slot background layers
        g.fillStyle(0x050301, 1);
        g.fillRect(sx - 1, sy - 1, sz + 2, sz + 2);
        g.fillStyle(filled ? 0x100d04 : 0x080604, 1);
        g.fillRect(sx, sy, sz, sz);
        g.fillStyle(filled ? INV_BG : 0x0c0a05, 1);
        g.fillRect(sx + 2, sy + 2, sz - 4, sz - 4);

        // Border: bright gold when filled, dim bronze when empty
        g.lineStyle(1, filled ? GOLD_INNER : INV_BDR, filled ? 0.75 : 0.30);
        g.strokeRect(sx, sy, sz, sz);

        // Top-left sheen
        g.lineStyle(1, 0xc08830, filled ? 0.14 : 0.04);
        g.lineBetween(sx + 1, sy + 1, sx + sz - 1, sy + 1);
        g.lineBetween(sx + 1, sy + 1, sx + 1, sy + sz - 1);

        // Shift-select highlight — subtle amber glow
        if (selected) {
          g.fillStyle(0xffe080, 0.13);
          g.fillRect(sx + 1, sy + 1, sz - 2, sz - 2);
          g.lineStyle(2, 0xffe080, 0.88);
          g.strokeRect(sx, sy, sz, sz);
        }

        if (def) {
          this._itemIcon(slot.item, sx + sz / 2, sy + sz / 2, sz);
          if (slot.qty > 1) {
            this._text(sx + sz - 1, sy + sz - 1, `${slot.qty}`, {
              fontFamily: FONT_VT, fontSize: `${this._fs(12)}px`, color: '#e8c060',
            }).setOrigin(1, 1);
          }
        }

        // Zone covers every slot: left-click equips (filled only), shift-click organises
        const capturedIdx = idx;
        const zone = this._add(
          this.add.zone(sx + sz / 2, sy + sz / 2, sz, sz)
            .setInteractive({ useHandCursor: !!def }).setDepth(7)
        );
        if (def) {
          zone.on('pointerover', (ptr) => { this._invHover = { name: def.name, sx: ptr.x + 10, sy: ptr.y }; this._showTooltip(def.name, ptr.x + 10, ptr.y); });
          zone.on('pointermove', (ptr) => { this._invHover = { name: def.name, sx: ptr.x + 10, sy: ptr.y }; this._showTooltip(def.name, ptr.x + 10, ptr.y); });
          zone.on('pointerout',  ()    => { this._invHover = null; this._hideTooltip(); });
        }
        zone.on('pointerdown', (pointer) => {
          if (pointer.event?.shiftKey) {
            this._onInvSlotClick(capturedIdx);
          } else if (def) {
            this.game.events.emit('equip-item', slot.item);
          }
        });
      }
    }
  }

  // ── Inventory shift-click slot organiser ─────────────────────────────────

  _onInvSlotClick(idx) {
    const inv  = this.state.inventory;
    const slot = inv[idx] ?? null;

    if (this._invSelectedSlot === null) {
      if (slot !== null) this._invSelectedSlot = idx;
    } else if (this._invSelectedSlot === idx) {
      this._invSelectedSlot = null;
    } else {
      const srcIdx = this._invSelectedSlot;
      const src    = inv[srcIdx] ?? null;
      const dst    = slot;
      const maxIdx = Math.max(srcIdx, idx);
      while (inv.length <= maxIdx) inv.push(null);
      inv[idx]    = src;
      inv[srcIdx] = dst;
      while (inv.length > 0 && inv[inv.length - 1] === null) inv.pop();
      this._invSelectedSlot = null;
    }
    this._redraw();
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  PANEL HANDLES  (debug overlay — only when DEBUG_LAYOUT = true)
  // ════════════════════════════════════════════════════════════════════════════

  _drawPanelHandles(W, H) {
    if (!L.panels) return;
    const g = this.gfx;
    const HANDLE = 8;
    // Per-panel accent colours
    const COLS = { game:0x00ff88, minimap:0x4488ff, skills:0x44aaff,
                   status:0xff8800, action:0xcc44ff, gear:0x00eeff, inventory:0x44ff88 };

    for (const [name, p] of Object.entries(L.panels)) {
      if (name === 'game') {
        // Game panel: just a subtle outline to show the viewport area
        g.lineStyle(1, COLS.game, 0.25);
        g.strokeRect(p.x, p.y, p.w, p.h);
        continue;
      }
      const col = COLS[name] ?? 0x888888;
      // Translucent fill
      g.fillStyle(col, 0.06);
      g.fillRect(p.x, p.y, p.w, p.h);
      // Panel outline
      g.lineStyle(1, col, 0.5);
      g.strokeRect(p.x, p.y, p.w, p.h);

      // Highlight active drag panel
      if (this._dragState?.name === name) {
        g.lineStyle(2, 0xffffff, 0.8);
        g.strokeRect(p.x, p.y, p.w, p.h);
      }

      // Resize handles — corners + edge midpoints
      const handles = [
        [p.x,           p.y          ],  // nw
        [p.x + p.w,     p.y          ],  // ne
        [p.x,           p.y + p.h    ],  // sw
        [p.x + p.w,     p.y + p.h    ],  // se
        [p.x + p.w / 2, p.y          ],  // n
        [p.x + p.w / 2, p.y + p.h    ],  // s
        [p.x,           p.y + p.h / 2],  // w
        [p.x + p.w,     p.y + p.h / 2],  // e
      ];
      for (const [hx, hy] of handles) {
        const isHov = this._hovHandle?.name === name;
        g.fillStyle(isHov ? 0xffffff : col, 0.9);
        g.fillRect(hx - HANDLE / 2, hy - HANDLE / 2, HANDLE, HANDLE);
        g.lineStyle(1, 0x000000, 0.5);
        g.strokeRect(hx - HANDLE / 2, hy - HANDLE / 2, HANDLE, HANDLE);
      }

      // Label: name + coords
      this._text(p.x + 4, p.y + 4,
        `${name}  ${Math.round(p.x)},${Math.round(p.y)}  ${Math.round(p.w)}×${Math.round(p.h)}`, {
          fontFamily: FONT_VT, fontSize: '12px', color: '#ffffff',
          stroke: '#000000', strokeThickness: 2,
        }).setDepth(55);
    }

    // ── Key reference strip ────────────────────────────────────────────────
    const hov = this._hovHandle;
    const lines = [
      `[P] print layout   [S] save   [L] load`,
      `[,/.] ACTION_SLOT=${L.ACTION_SLOT_SIZE}   [9/0] MINIMAP=${L.MINIMAP_SIZE}   [i/o] INV_SLOT=${L.INV_SLOT_SIZE}`,
      `Drag title bar → move   ·   Drag edge/corner → resize   ·   Snap: ${L.SNAP}px`,
      hov ? `▶  ${hov.name}  [${hov.edge}]` : `Hover a panel handle to see its name`,
    ];
    const pW = 540, pH = lines.length * 15 + 8;
    g.fillStyle(0x000000, 0.82);
    g.fillRect(MARGIN, L.TOP_H + MARGIN, pW, pH);
    g.lineStyle(1, GOLD_INNER, 0.7);
    g.strokeRect(MARGIN, L.TOP_H + MARGIN, pW, pH);
    lines.forEach((line, i) => {
      this._text(MARGIN + 5, L.TOP_H + MARGIN + 4 + i * 15, line, {
        fontFamily: FONT_VT, fontSize: '13px', color: '#ffe040',
        stroke: '#000000', strokeThickness: 1,
      }).setDepth(56);
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  SHOP MODAL
  // ════════════════════════════════════════════════════════════════════════════

  _shopAdd(obj) { this._shopObjs.push(obj); return obj; }

  _closeShop() {
    this._shopObjs.forEach(o => o.destroy());
    this._shopObjs = [];
    this._shopOpen = false;
  }

  _openShop() {
    this._shopOpen = true;
    const W = this.scale.width, H = this.scale.height;
    const sc   = Math.max(0.45, Math.min(1.4, Math.min(W / 640, H / 480)));
    const MW   = Math.round(500 * sc);
    const ROWS = SHOP_WEAPON_IDS.length;
    const ROW_H = Math.round(52 * sc);
    const HDR_H = Math.round(52 * sc);   // title + coins
    const FTR_H = Math.round(26 * sc);   // ESC hint
    const PAD   = Math.round(10 * sc);
    const MH   = HDR_H + ROWS * ROW_H + FTR_H + PAD * 2;
    const MX   = ((W - MW) / 2) | 0;
    const MY   = ((H - MH) / 2) | 0;

    // ── Darkened overlay — click outside to close ──────────────────────────
    const overlay = this._shopAdd(
      this.add.rectangle(0, 0, W, H, 0x000000, 0.68).setOrigin(0, 0).setDepth(20).setInteractive()
    );
    overlay.on('pointerdown', () => this._closeShop());

    // ── Modal background — absorbs clicks so overlay doesn't fire ──────────
    const g = this._shopAdd(this.add.graphics().setDepth(21));
    g.fillStyle(0x0c0a08, 1);   g.fillRect(MX, MY, MW, MH);
    g.lineStyle(2, 0x6a4c14, 1); g.strokeRect(MX, MY, MW, MH);
    g.lineStyle(1, 0x9a7828, 0.4); g.strokeRect(MX + 3, MY + 3, MW - 6, MH - 6);
    // Title bar gradient
    g.fillStyle(0x2c1418, 1); g.fillRect(MX + 2, MY + 2, MW - 4, Math.round(28 * sc));

    // ── Title ──────────────────────────────────────────────────────────────
    this._shopAdd(this.add.text(MX + MW / 2, MY + Math.round(16 * sc), '🛒  SHOP', {
      fontFamily: FONT_PS8, fontSize: `${Math.max(8, Math.round(9 * sc))}px`, color: '#b89048',
    }).setOrigin(0.5, 0.5).setDepth(22));

    // ── Coins display ──────────────────────────────────────────────────────
    const coins = this.state.coins ?? 0;
    this._shopAdd(this.add.text(MX + MW - PAD, MY + Math.round(38 * sc),
      `🪙 ${coins}`, {
        fontFamily: FONT_VT, fontSize: `${Math.max(14, Math.round(18 * sc))}px`, color: '#f0d050',
      }).setOrigin(1, 0.5).setDepth(22));

    // ── Divider ────────────────────────────────────────────────────────────
    const divY = MY + HDR_H;
    g.lineStyle(1, 0x4a3010, 0.8); g.lineBetween(MX + PAD, divY, MX + MW - PAD, divY);

    // ── Item rows ──────────────────────────────────────────────────────────
    const hitW = MW - PAD * 2, hitH = ROW_H - 4;
    SHOP_WEAPON_IDS.forEach((id, i) => {
      const def   = ITEMS_DATA[id];
      if (!def) return;
      const price = SHOP_PRICE_MAP[id] ?? 0;
      const ry    = divY + i * ROW_H;

      // Row bg (alternating tint)
      if (i % 2 === 0) {
        g.fillStyle(0x100e08, 0.6);
        g.fillRect(MX + PAD, ry + 2, hitW, hitH);
      }

      const cy = ry + ROW_H / 2;

      // Icon
      this._shopAdd(this.add.text(MX + PAD + Math.round(14 * sc), cy, def.icon ?? '?', {
        fontFamily: 'serif', fontSize: `${Math.max(14, Math.round(18 * sc))}px`,
      }).setOrigin(0.5, 0.5).setDepth(22));

      // Name
      this._shopAdd(this.add.text(MX + PAD + Math.round(34 * sc), cy, def.name, {
        fontFamily: FONT_VT, fontSize: `${Math.max(14, Math.round(18 * sc))}px`, color: '#d0a860',
      }).setOrigin(0, 0.5).setDepth(22));

      // Combat style
      const styleLabel = def.combatStyle ? def.combatStyle.charAt(0).toUpperCase() + def.combatStyle.slice(1) : '';
      this._shopAdd(this.add.text(MX + Math.round(MW * 0.52), cy, styleLabel, {
        fontFamily: FONT_VT, fontSize: `${Math.max(12, Math.round(15 * sc))}px`, color: '#786048',
      }).setOrigin(0, 0.5).setDepth(22));

      // Price
      this._shopAdd(this.add.text(MX + Math.round(MW * 0.70), cy, `🪙 ${price}`, {
        fontFamily: FONT_VT, fontSize: `${Math.max(14, Math.round(17 * sc))}px`, color: '#c0a040',
      }).setOrigin(0, 0.5).setDepth(22));

      // BUY button
      const btnW = Math.round(60 * sc), btnH = Math.round(24 * sc);
      const bx   = MX + MW - PAD - btnW;
      const by   = cy - btnH / 2;
      const btn  = this._shopAdd(
        this.add.rectangle(bx + btnW / 2, cy, btnW, btnH, 0x1a3a10)
          .setStrokeStyle(1, 0x4a8030).setDepth(22)
          .setInteractive({ useHandCursor: true })
      );
      const btnTxt = this._shopAdd(this.add.text(bx + btnW / 2, cy, 'BUY', {
        fontFamily: FONT_PS8, fontSize: `${Math.max(6, Math.round(7 * sc))}px`, color: '#88dd44',
      }).setOrigin(0.5, 0.5).setDepth(23));
      btn.on('pointerover',  () => { btn.setFillStyle(0x2a5a18); btnTxt.setColor('#aaffaa'); });
      btn.on('pointerout',   () => { btn.setFillStyle(0x1a3a10); btnTxt.setColor('#88dd44'); });
      btn.on('pointerdown',  () => this.game.events.emit('buy-item', { itemKey: id, price }));

      // Row separator
      g.lineStyle(1, 0x2a1e0e, 0.5);
      g.lineBetween(MX + PAD, ry + ROW_H, MX + MW - PAD, ry + ROW_H);
    });

    // ── Absorb-click zone over the whole modal body ────────────────────────
    const absorb = this._shopAdd(
      this.add.zone(MX + MW / 2, MY + MH / 2, MW, MH).setDepth(21).setInteractive()
    );
    absorb.on('pointerdown', (ptr) => ptr.event.stopPropagation());

    // ── ESC hint ──────────────────────────────────────────────────────────
    this._shopAdd(this.add.text(MX + MW / 2, MY + MH - FTR_H / 2, 'ESC  ·  click outside  to close', {
      fontFamily: FONT_VT, fontSize: `${Math.max(12, Math.round(14 * sc))}px`, color: '#5a4830',
    }).setOrigin(0.5, 0.5).setDepth(22));
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  ALCHEMY MODAL
  // ════════════════════════════════════════════════════════════════════════════

  _alchemyAdd(obj) { this._alchemyObjs.push(obj); return obj; }

  _closeAlchemy() {
    this._alchemyObjs.forEach(o => o.destroy());
    this._alchemyObjs = [];
    this._alchemyOpen = false;
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  CAMPFIRE COOKING MODAL
  // ════════════════════════════════════════════════════════════════════════════

  _cookAdd(obj) { this._cookObjs.push(obj); return obj; }

  _closeCookMenu(cancelQueue = true) {
    if (cancelQueue) {
      this.game.events.emit('campfire-cancel-queue');
      this._cookQueueStatus = null;
    }
    this._cookObjs.forEach(o => o.destroy());
    this._cookObjs = [];
    this._cookOpen = false;
  }

  _openCookMenu() {
    this._cookOpen = true;
    // Hide any lingering campfire hover tooltip immediately
    this._worldHover = null;
    this._hideTooltip();
    const W = this.scale.width, H = this.scale.height;
    const sc    = Math.max(0.45, Math.min(1.4, Math.min(W / 640, H / 480)));
    const MW    = Math.round(500 * sc);
    const HDR_H = Math.round(50 * sc);
    const ROW_H = Math.round(76 * sc);
    const queueActive = this._cookQueueStatus !== null;
    const FTR_H = Math.round((queueActive ? 56 : 28) * sc);
    const PAD   = Math.round(12 * sc);
    const MH    = HDR_H + ROW_H * COOK_MENU_RECIPES.length + FTR_H;
    const MX    = ((W - MW) / 2) | 0;
    const MY    = ((H - MH) / 2) | 0;

    const cookLvl  = this.state.skills?.cooking?.level ?? 1;
    const inv      = this.state.inventory ?? [];
    const countItem = (key) =>
      inv.filter(s => s && s.item === key).reduce((n, s) => n + s.qty, 0);

    // Darkened overlay — click outside to close
    const overlay = this._cookAdd(
      this.add.rectangle(0, 0, W, H, 0x000000, 0.68).setOrigin(0, 0).setDepth(20).setInteractive()
    );
    overlay.on('pointerdown', () => this._closeCookMenu());

    // Modal panel
    const g = this._cookAdd(this.add.graphics().setDepth(21));
    g.fillStyle(0x080c08, 1); g.fillRect(MX, MY, MW, MH);
    g.lineStyle(2, 0x3a5a20, 1); g.strokeRect(MX, MY, MW, MH);
    g.lineStyle(1, 0x70a030, 0.35); g.strokeRect(MX + 3, MY + 3, MW - 6, MH - 6);
    g.fillStyle(0x0c1a08, 1); g.fillRect(MX + 2, MY + 2, MW - 4, Math.round(26 * sc));

    // Title
    this._cookAdd(this.add.text(MX + MW / 2, MY + Math.round(15 * sc), '🍳  CAMPFIRE COOKING', {
      fontFamily: FONT_PS8, fontSize: `${Math.max(7, Math.round(8 * sc))}px`, color: '#f0c050',
    }).setOrigin(0.5, 0.5).setDepth(22));

    // Title divider
    g.lineStyle(1, 0x3a5a20, 0.8);
    g.lineBetween(MX + PAD, MY + HDR_H, MX + MW - PAD, MY + HDR_H);

    // Recipe rows
    COOK_MENU_RECIPES.forEach((recipe, i) => {
      const ry      = MY + HDR_H + i * ROW_H;
      const qty     = countItem(recipe.key);
      const canLvl  = cookLvl >= recipe.lvl;
      const hasItem = qty > 0;
      const canCook = canLvl && hasItem;

      // Row divider (skip before first row)
      if (i > 0) {
        g.lineStyle(1, 0x243818, 0.6);
        g.lineBetween(MX + PAD, ry, MX + MW - PAD, ry);
      }

      // Row background tint for available recipes
      if (canCook) {
        g.fillStyle(0x0e1a08, 1);
        g.fillRect(MX + 2, ry + 1, MW - 4, ROW_H - 2);
      }

      const titleCol = canCook ? '#d8eca0' : canLvl ? '#5a5030' : '#3e3820';
      const subCol   = canCook ? '#80aa50' : '#383220';

      // Recipe name line
      this._cookAdd(this.add.text(
        MX + PAD, ry + Math.round(10 * sc),
        `${recipe.label}  →  ${recipe.resultLabel}`, {
          fontFamily: FONT_VT, fontSize: `${Math.max(13, Math.round(17 * sc))}px`, color: titleCol,
        }
      ).setOrigin(0, 0).setDepth(22));

      // Sub-line: level / XP / quantity or locked reason
      const subText = !canLvl
        ? `Requires Cooking Lv. ${recipe.lvl}`
        : `Cooking Lv. ${recipe.lvl}  ·  ${recipe.xp} XP  ·  In bag: ${qty}`;
      this._cookAdd(this.add.text(
        MX + PAD, ry + Math.round(33 * sc), subText, {
          fontFamily: FONT_VT, fontSize: `${Math.max(11, Math.round(14 * sc))}px`, color: subCol,
        }
      ).setOrigin(0, 0).setDepth(22));

      // Buttons — only when cookable and no queue currently running
      if (canCook && !queueActive) {
        const btnH  = Math.round(22 * sc);
        const btn1W = Math.round(68 * sc);
        const btnAW = Math.round(86 * sc);
        const bcy   = ry + Math.round(50 * sc);
        const gap   = Math.round(6 * sc);

        // Cook 1 — emit only; player-update fires automatically and refreshes the menu
        const b1x  = MX + MW - PAD - btnAW - gap - btn1W;
        const btn1 = this._cookAdd(
          this.add.rectangle(b1x + btn1W / 2, bcy + btnH / 2, btn1W, btnH, 0x1a3010)
            .setStrokeStyle(1, 0x60a030).setDepth(22).setInteractive({ useHandCursor: true })
        );
        const btn1T = this._cookAdd(this.add.text(b1x + btn1W / 2, bcy + btnH / 2, 'Cook 1', {
          fontFamily: FONT_PS8, fontSize: `${Math.max(5, Math.round(6 * sc))}px`, color: '#a0d050',
        }).setOrigin(0.5, 0.5).setDepth(23));
        btn1.on('pointerover',  () => { btn1.setFillStyle(0x2a5018); btn1T.setColor('#ffffff'); });
        btn1.on('pointerout',   () => { btn1.setFillStyle(0x1a3010); btn1T.setColor('#a0d050'); });
        btn1.on('pointerdown',  () => {
          this.game.events.emit('campfire-cook', { itemKey: recipe.key, qty: 1 });
          // Refresh driven by player-update → _closeCookMenu(false) → _openCookMenu
        });

        // Cook All — emit only; cook-queue-status drives refresh without cancelling the queue
        const bAx  = MX + MW - PAD - btnAW;
        const btnA = this._cookAdd(
          this.add.rectangle(bAx + btnAW / 2, bcy + btnH / 2, btnAW, btnH, 0x243c10)
            .setStrokeStyle(1, 0x80b840).setDepth(22).setInteractive({ useHandCursor: true })
        );
        const btnAT = this._cookAdd(this.add.text(bAx + btnAW / 2, bcy + btnH / 2, `Cook All (${qty})`, {
          fontFamily: FONT_PS8, fontSize: `${Math.max(5, Math.round(6 * sc))}px`, color: '#c0f060',
        }).setOrigin(0.5, 0.5).setDepth(23));
        btnA.on('pointerover',  () => { btnA.setFillStyle(0x345820); btnAT.setColor('#ffffff'); });
        btnA.on('pointerout',   () => { btnA.setFillStyle(0x243c10); btnAT.setColor('#c0f060'); });
        btnA.on('pointerdown',  () => {
          this.game.events.emit('campfire-cook', { itemKey: recipe.key, qty });
          // Refresh driven by cook-queue-status → _closeCookMenu(false) → _openCookMenu
        });
      }
    });

    // Footer divider
    const ftDivY = MY + MH - FTR_H;
    g.lineStyle(1, 0x2a4018, 0.7);
    g.lineBetween(MX + PAD, ftDivY, MX + MW - PAD, ftDivY);

    if (queueActive) {
      // ── Cook All progress banner ──────────────────────────────────────────
      const qs    = this._cookQueueStatus;
      const label = COOK_MENU_RECIPES.find(r => r.key === qs.itemKey)?.label ?? qs.itemKey;
      const done  = (qs.total ?? qs.remaining) - qs.remaining;
      const total = qs.total ?? qs.remaining;
      const frac  = total > 0 ? done / total : 0;

      // Status text: "Cooking Saltfin..."
      this._cookAdd(this.add.text(MX + MW / 2, ftDivY + Math.round(13 * sc),
        `Cooking ${label}...`, {
          fontFamily: FONT_VT, fontSize: `${Math.max(13, Math.round(16 * sc))}px`, color: '#f0c050',
        }
      ).setOrigin(0.5, 0.5).setDepth(22));

      // Progress bar
      const bpX = MX + PAD, bpW = MW - PAD * 2, bpH = Math.round(5 * sc);
      const bpY = ftDivY + Math.round(27 * sc);
      g.fillStyle(0x0a1208, 1); g.fillRect(bpX, bpY, bpW, bpH);
      if (frac > 0) {
        g.fillStyle(0x2a6020, 1); g.fillRect(bpX, bpY, Math.floor(bpW * frac * 0.6), bpH);
        g.fillStyle(0x50a038, 1); g.fillRect(bpX + Math.floor(bpW * frac * 0.6), bpY, Math.floor(bpW * frac * 0.4), bpH);
      }
      g.lineStyle(1, 0x304820, 0.7); g.strokeRect(bpX, bpY, bpW, bpH);

      // Remaining count
      this._cookAdd(this.add.text(MX + MW / 2, ftDivY + Math.round(42 * sc),
        `${qs.remaining} remaining  ·  ESC to cancel`, {
          fontFamily: FONT_VT, fontSize: `${Math.max(11, Math.round(13 * sc))}px`, color: '#80a858',
        }
      ).setOrigin(0.5, 0.5).setDepth(22));
    } else {
      // Close hint
      this._cookAdd(this.add.text(MX + MW / 2, ftDivY + Math.round(14 * sc),
        'ESC or click outside to close', {
          fontFamily: FONT_VT, fontSize: `${Math.max(11, Math.round(13 * sc))}px`, color: '#3a5020',
        }
      ).setOrigin(0.5, 0.5).setDepth(22));
    }
  }

  _openAlchemy() {
    this._alchemyOpen = true;
    const W = this.scale.width, H = this.scale.height;
    const sc  = Math.max(0.45, Math.min(1.4, Math.min(W / 640, H / 480)));
    const MW  = Math.round(420 * sc);
    const HDR_H = Math.round(52 * sc);
    const FTR_H = Math.round(26 * sc);
    const PAD   = Math.round(10 * sc);

    const foragingLv = this.state.skills?.foraging?.level ?? 1;
    const alchLv     = this.state.skills?.alchemy?.level  ?? 1;
    const unlocked   = foragingLv >= 5;

    const ALCH_RECIPES = [
      { key: 'minor_healing_potion', name: '🧪  Minor Healing Potion', effect: '+20 HP',
        alchReq: 1,
        ingredients: [{ key: 'redroot',  label: '🌱 Redroot',  qty: 1 },
                      { key: 'mooncap',  label: '🍄 Mooncap',  qty: 1 }] },
      { key: 'focus_potion', name: '💙  Focus Potion', effect: '+15 Mana',
        alchReq: 5,
        ingredients: [{ key: 'mooncap',  label: '🍄 Mooncap',  qty: 1 },
                      { key: 'stonecap', label: '🍄 Stonecap', qty: 1 }] },
      { key: 'veil_elixir', name: '🔮  Veil Elixir', effect: '+50 Mana · Free Ability',
        alchReq: 15,
        ingredients: [{ key: 'veilbloom', label: '🌸 Veilbloom', qty: 1 },
                      { key: 'mooncap',   label: '🍄 Mooncap',   qty: 1 },
                      { key: 'stonecap',  label: '🍄 Stonecap',  qty: 1 }] },
    ];

    const ROW_H  = Math.round(66 * sc);
    const BODY_H = unlocked
      ? Math.round(8 * sc) + ALCH_RECIPES.length * ROW_H
      : Math.round(70 * sc);
    const MH = HDR_H + BODY_H + FTR_H + PAD * 2;
    const MX = ((W - MW) / 2) | 0;
    const MY = ((H - MH) / 2) | 0;

    // Darkened overlay — click outside to close
    const overlay = this._alchemyAdd(
      this.add.rectangle(0, 0, W, H, 0x000000, 0.68).setOrigin(0, 0).setDepth(20).setInteractive()
    );
    overlay.on('pointerdown', () => this._closeAlchemy());

    // Modal background
    const g = this._alchemyAdd(this.add.graphics().setDepth(21));
    g.fillStyle(0x0a0c14, 1); g.fillRect(MX, MY, MW, MH);
    g.lineStyle(2, 0x4a2878, 1); g.strokeRect(MX, MY, MW, MH);
    g.lineStyle(1, 0x8040cc, 0.4); g.strokeRect(MX + 3, MY + 3, MW - 6, MH - 6);
    g.fillStyle(0x1a0c28, 1); g.fillRect(MX + 2, MY + 2, MW - 4, Math.round(28 * sc));

    // Title
    this._alchemyAdd(this.add.text(MX + MW / 2, MY + Math.round(16 * sc), '⚗  ALCHEMY', {
      fontFamily: FONT_PS8, fontSize: `${Math.max(8, Math.round(9 * sc))}px`, color: '#aa88ff',
    }).setOrigin(0.5, 0.5).setDepth(22));

    // Divider
    const divY = MY + HDR_H;
    g.lineStyle(1, 0x4a2878, 0.8); g.lineBetween(MX + PAD, divY, MX + MW - PAD, divY);

    if (!unlocked) {
      // Locked message
      this._alchemyAdd(this.add.text(MX + MW / 2, divY + BODY_H / 2, [
        'You need to unlock Alchemy first.',
        'Reach Foraging Level 5.',
      ], {
        fontFamily: FONT_VT, fontSize: `${Math.max(14, Math.round(17 * sc))}px`,
        color: '#786048', align: 'center',
      }).setOrigin(0.5, 0.5).setDepth(22));
    } else {
      const inv       = this.state.inventory ?? [];
      const countItem = (key) =>
        inv.filter(s => s && s.item === key).reduce((n, s) => n + s.qty, 0);

      ALCH_RECIPES.forEach((rec, i) => {
        const meetsLvl  = alchLv >= rec.alchReq;
        const haveIngs  = rec.ingredients.every(ing => countItem(ing.key) >= ing.qty);
        const canCraft  = meetsLvl && haveIngs;
        const ry        = divY + Math.round(8 * sc) + i * ROW_H;

        if (i > 0) {
          g.lineStyle(1, 0x2a1640, 0.6);
          g.lineBetween(MX + PAD, ry, MX + MW - PAD, ry);
        }

        // Recipe name + effect
        const nameCol = canCraft ? '#d0a8ff' : meetsLvl ? '#7a5898' : '#4a3060';
        this._alchemyAdd(this.add.text(MX + PAD, ry + Math.round(7 * sc),
          `${rec.name}  (${rec.effect})`, {
            fontFamily: FONT_VT, fontSize: `${Math.max(13, Math.round(16 * sc))}px`, color: nameCol,
          }).setOrigin(0, 0).setDepth(22));

        // Level badge (right side) if locked
        if (!meetsLvl) {
          this._alchemyAdd(this.add.text(MX + MW - PAD, ry + Math.round(7 * sc),
            `Alchemy Lv.${rec.alchReq}`, {
              fontFamily: FONT_VT, fontSize: `${Math.max(11, Math.round(13 * sc))}px`, color: '#5a3880',
            }).setOrigin(1, 0).setDepth(22));
        }

        // Ingredient line
        const ingLine = rec.ingredients.map(ing =>
          `${ing.label} ×${ing.qty} (${countItem(ing.key)})`
        ).join('  +  ');
        const ingCol = !meetsLvl ? '#3a2450' : haveIngs ? '#88dd88' : '#aa6644';
        this._alchemyAdd(this.add.text(MX + PAD, ry + Math.round(32 * sc), ingLine, {
          fontFamily: FONT_VT, fontSize: `${Math.max(11, Math.round(13 * sc))}px`, color: ingCol,
        }).setOrigin(0, 0).setDepth(22));

        // CRAFT button
        if (canCraft) {
          const btnW = Math.round(88 * sc), btnH = Math.round(22 * sc);
          const bx   = MX + MW - PAD - btnW;
          const bcy  = ry + Math.round(32 * sc);
          const btn  = this._alchemyAdd(
            this.add.rectangle(bx + btnW / 2, bcy + btnH / 2, btnW, btnH, 0x2a1450)
              .setStrokeStyle(1, 0x8040cc).setDepth(22).setInteractive({ useHandCursor: true })
          );
          const btnTxt = this._alchemyAdd(this.add.text(bx + btnW / 2, bcy + btnH / 2, 'CRAFT', {
            fontFamily: FONT_PS8, fontSize: `${Math.max(6, Math.round(7 * sc))}px`, color: '#cc88ff',
          }).setOrigin(0.5, 0.5).setDepth(23));
          const recipeKey = rec.key;
          btn.on('pointerover',  () => { btn.setFillStyle(0x44207a); btnTxt.setColor('#ffffff'); });
          btn.on('pointerout',   () => { btn.setFillStyle(0x2a1450); btnTxt.setColor('#cc88ff'); });
          btn.on('pointerdown',  () => {
            this.game.events.emit('alch-craft', { recipe: recipeKey });
            this._closeAlchemy();
            this._openAlchemy();
          });
        }
      });
    }

    // Absorb-click zone over modal body
    const absorb = this._alchemyAdd(
      this.add.zone(MX + MW / 2, MY + MH / 2, MW, MH).setDepth(21).setInteractive()
    );
    absorb.on('pointerdown', (ptr) => ptr.event.stopPropagation());

    // ESC hint
    this._alchemyAdd(this.add.text(MX + MW / 2, MY + MH - FTR_H / 2, 'ESC  ·  click outside  to close', {
      fontFamily: FONT_VT, fontSize: `${Math.max(12, Math.round(14 * sc))}px`, color: '#5a4870',
    }).setOrigin(0.5, 0.5).setDepth(22));
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  PAPER PRESS MODAL
  // ════════════════════════════════════════════════════════════════════════════

  _pressAdd(obj) { this._pressObjs.push(obj); return obj; }

  _closePaperPress() {
    this._pressObjs.forEach(o => o.destroy());
    this._pressObjs = [];
    this._pressOpen = false;
  }

  _openPaperPress() {
    this._pressOpen = true;
    const W = this.scale.width, H = this.scale.height;
    const sc     = Math.max(0.45, Math.min(1.4, Math.min(W / 640, H / 480)));
    const MW     = Math.round(440 * sc);
    const HDR_H  = Math.round(52 * sc);
    const FTR_H  = Math.round(26 * sc);
    const PAD    = Math.round(12 * sc);
    const repaired = this.state.paperPressRepaired ?? false;

    const RECIPES = [
      { logKey: 'log',          logName: 'Log',         pagesOut: 4  },
      { logKey: 'ashwood_log',  logName: 'Ashwood Log', pagesOut: 6  },
      { logKey: 'grimoak_log',  logName: 'Grimoak Log', pagesOut: 8  },
      { logKey: 'deadwood_log', logName: 'Deadwood Log',pagesOut: 10 },
    ];
    const inv       = this.state.inventory ?? [];
    const countItem = (key) =>
      inv.filter(s => s && s.item === key).reduce((n, s) => n + s.qty, 0);

    const ROW_H  = repaired ? Math.round(46 * sc) : 0;
    const BODY_H = repaired
      ? Math.round(16 * sc) + RECIPES.length * ROW_H
      : Math.round(80 * sc);
    const MH = HDR_H + BODY_H + FTR_H + PAD;
    const MX = ((W - MW) / 2) | 0;
    const MY = ((H - MH) / 2) | 0;

    // Overlay
    const overlay = this._pressAdd(
      this.add.rectangle(0, 0, W, H, 0x000000, 0.68).setOrigin(0, 0).setDepth(20).setInteractive()
    );
    overlay.on('pointerdown', () => this._closePaperPress());

    // Panel
    const g = this._pressAdd(this.add.graphics().setDepth(21));
    g.fillStyle(0x100a04, 1);      g.fillRect(MX, MY, MW, MH);
    g.lineStyle(2, 0x6a3e18, 1);   g.strokeRect(MX, MY, MW, MH);
    g.lineStyle(1, 0xb07840, 0.35);g.strokeRect(MX + 3, MY + 3, MW - 6, MH - 6);
    g.fillStyle(0x1a1008, 1);      g.fillRect(MX + 2, MY + 2, MW - 4, Math.round(28 * sc));

    // Title
    this._pressAdd(this.add.text(MX + MW / 2, MY + Math.round(16 * sc),
      repaired ? '🗜  PAPER PRESS' : '🗜  PAPER PRESS  (Broken)', {
        fontFamily: FONT_PS8, fontSize: `${Math.max(7, Math.round(8 * sc))}px`,
        color: repaired ? '#c8a060' : '#7a5030',
      }).setOrigin(0.5, 0.5).setDepth(22));

    // Title divider
    g.lineStyle(1, 0x6a3e18, 0.8);
    g.lineBetween(MX + PAD, MY + HDR_H, MX + MW - PAD, MY + HDR_H);

    if (!repaired) {
      // Broken state — show repair requirement
      const logsHeld = countItem('log');
      const canRepair = logsHeld >= 10;
      this._pressAdd(this.add.text(MX + MW / 2, MY + HDR_H + Math.round(18 * sc), [
        'This press is damaged and won\'t run.',
        `Repair it with 10 Logs.  (You have: ${logsHeld})`,
      ], {
        fontFamily: FONT_VT, fontSize: `${Math.max(13, Math.round(16 * sc))}px`,
        color: canRepair ? '#c8a060' : '#786048', align: 'center',
      }).setOrigin(0.5, 0).setDepth(22));

      if (canRepair) {
        const btnW = Math.round(100 * sc), btnH = Math.round(26 * sc);
        const bx   = MX + (MW - btnW) / 2;
        const by   = MY + HDR_H + Math.round(52 * sc);
        const btn  = this._pressAdd(
          this.add.rectangle(bx + btnW / 2, by + btnH / 2, btnW, btnH, 0x3a2010)
            .setStrokeStyle(1, 0xb07840).setDepth(22).setInteractive({ useHandCursor: true })
        );
        const btnT = this._pressAdd(this.add.text(bx + btnW / 2, by + btnH / 2, 'REPAIR', {
          fontFamily: FONT_PS8, fontSize: `${Math.max(6, Math.round(7 * sc))}px`, color: '#c8a060',
        }).setOrigin(0.5, 0.5).setDepth(23));
        btn.on('pointerover',  () => { btn.setFillStyle(0x6a3e18); btnT.setColor('#ffffff'); });
        btn.on('pointerout',   () => { btn.setFillStyle(0x3a2010); btnT.setColor('#c8a060'); });
        btn.on('pointerdown',  () => {
          this.game.events.emit('paper-press-repair');
          this._closePaperPress();
        });
      }
    } else {
      // Functional state — recipe rows
      let ry = MY + HDR_H + Math.round(10 * sc);
      RECIPES.forEach((rec, i) => {
        if (i > 0) {
          g.lineStyle(1, 0x2a1a08, 0.6);
          g.lineBetween(MX + PAD, ry, MX + MW - PAD, ry);
        }
        const qty       = countItem(rec.logKey);
        const canConvert = qty >= 1;
        const rowMid    = ry + Math.floor(ROW_H / 2);
        const totalOut  = qty * rec.pagesOut;

        // Recipe text — PNG icon left of label, emoji fallback if texture missing
        const iconSz  = Math.max(12, Math.round(16 * sc));
        const textX   = MX + PAD + iconSz + Math.round(4 * sc);
        if (this.textures.exists('item_paper_pages')) {
          this._pressAdd(this.add.image(MX + PAD + iconSz / 2, rowMid, 'item_paper_pages')
            .setDisplaySize(iconSz, iconSz).setDepth(22)
            .setAlpha(canConvert ? 1.0 : 0.35));
        }
        this._pressAdd(this.add.text(textX, rowMid,
          `${this.textures.exists('item_paper_pages') ? '' : '📄 '}${rec.logName}  ×${qty}  →  ${totalOut} Paper Pages`, {
            fontFamily: FONT_VT, fontSize: `${Math.max(13, Math.round(16 * sc))}px`,
            color: canConvert ? '#d8c890' : '#5a4020',
          }).setOrigin(0, 0.5).setDepth(22));

        // CONVERT button
        if (canConvert) {
          const btnW = Math.round(100 * sc), btnH = Math.round(22 * sc);
          const bx   = MX + MW - PAD - btnW;
          const btn  = this._pressAdd(
            this.add.rectangle(bx + btnW / 2, rowMid, btnW, btnH, 0x3a2010)
              .setStrokeStyle(1, 0xb07840).setDepth(22).setInteractive({ useHandCursor: true })
          );
          const btnT = this._pressAdd(this.add.text(bx + btnW / 2, rowMid, 'CONVERT ALL', {
            fontFamily: FONT_PS8, fontSize: `${Math.max(5, Math.round(6 * sc))}px`, color: '#c8a060',
          }).setOrigin(0.5, 0.5).setDepth(23));
          const logKey = rec.logKey;
          btn.on('pointerover',  () => { btn.setFillStyle(0x6a3e18); btnT.setColor('#ffffff'); });
          btn.on('pointerout',   () => { btn.setFillStyle(0x3a2010); btnT.setColor('#c8a060'); });
          btn.on('pointerdown',  () => {
            this.game.events.emit('paper-press-convert', { logKey });
            this._closePaperPress();
          });
        }
        ry += ROW_H;
      });
    }

    // Absorb zone + ESC hint
    this._pressAdd(
      this.add.zone(MX + MW / 2, MY + MH / 2, MW, MH).setDepth(21).setInteractive()
    ).on('pointerdown', (ptr) => ptr.event.stopPropagation());
    this._pressAdd(this.add.text(MX + MW / 2, MY + MH - FTR_H / 2,
      'ESC  ·  click outside  to close', {
        fontFamily: FONT_VT, fontSize: `${Math.max(12, Math.round(14 * sc))}px`, color: '#5a4020',
      }).setOrigin(0.5, 0.5).setDepth(22));
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  LIBRARY MODAL
  // ════════════════════════════════════════════════════════════════════════════

  _libAdd(obj) { this._libObjs.push(obj); return obj; }

  _closeLibrary() {
    this._libObjs.forEach(o => { this.tweens.killTweensOf(o); o.destroy(); });
    this._libObjs = [];
    this._libOpen = false;
    this.game.events.emit('modal-closed');
  }

  _openLibrary() {
    this._libOpen = true;
    this.game.events.emit('modal-opened');
    const W = this.scale.width, H = this.scale.height;

    // Scale image (1476×1066, aspect ~1.385) to 90% of viewport
    const IMG_ASPECT = 1476 / 1066;
    const imgW = Math.min(W * 0.90, H * 0.90 * IMG_ASPECT);
    const imgH = imgW / IMG_ASPECT;
    const CX = W / 2, CY = H / 2;

    // Dark backdrop — click outside to close
    const overlay = this._libAdd(
      this.add.rectangle(0, 0, W, H, 0x000000, 0.80).setOrigin(0, 0).setDepth(25).setInteractive()
    );
    overlay.on('pointerdown', () => this._closeLibrary());

    // Solid black backing — fills transparent border pixels so no checkerboard
    this._libAdd(
      this.add.rectangle(CX, CY, imgW, imgH, 0x000000, 1).setDepth(25.5)
    );

    // Modal artwork
    const hasImg = this.textures.exists('library_modal');
    if (hasImg) {
      this._libAdd(
        this.add.image(CX, CY, 'library_modal').setDisplaySize(imgW, imgH).setDepth(26)
          .setInteractive().on('pointerdown', (ptr) => ptr.event.stopPropagation())
      );
    } else {
      this._libAdd(this.add.graphics().setDepth(26))
        .fillStyle(0x0a0e08, 1).fillRect(CX - imgW / 2, CY - imgH / 2, imgW, imgH);
    }

    // ── Warm light pulse overlay ──────────────────────────────────────────
    const glow = this._libAdd(
      this.add.rectangle(CX, CY, imgW, imgH, 0xffaa44, 0.04).setDepth(27)
    );
    this.tweens.add({
      targets: glow, alpha: 0.11,
      duration: 2000, ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
    });

    // ── Drifting dust particles ───────────────────────────────────────────
    for (let i = 0; i < 12; i++) {
      const startX = CX - imgW * 0.42 + Math.random() * imgW * 0.84;
      const startY = CY + imgH * 0.1  + Math.random() * imgH * 0.3;
      const dot = this._libAdd(
        this.add.circle(startX, startY, 1 + Math.random(), 0xffe8b0, 0.5).setDepth(28)
      );
      const drift = imgH * (0.25 + Math.random() * 0.2);
      this.tweens.add({
        targets: dot,
        y: startY - drift,
        alpha: 0,
        duration: 3500 + Math.random() * 3500,
        delay: Math.random() * 3000,
        ease: 'Sine.easeIn',
        repeat: -1,
        onRepeat: () => {
          if (!dot.active) return;
          dot.setAlpha(0.5);
          dot.setY(startY);
          dot.setX(CX - imgW * 0.42 + Math.random() * imgW * 0.84);
        },
      });
    }

    // ── Title & subtitle ─────────────────────────────────────────────────
    const titleY    = CY - imgH * 0.38;
    const subtitleY = titleY + Math.round(imgH * 0.075);
    this._libAdd(this.add.text(CX, titleY, 'Old Library', {
      fontFamily: FONT_PS8,
      fontSize: `${Math.max(10, Math.round(imgW * 0.020))}px`,
      color: '#f5e090', stroke: '#1a0a02', strokeThickness: 4,
    }).setOrigin(0.5, 0.5).setDepth(29));
    this._libAdd(this.add.text(CX, subtitleY, 'Study coming soon', {
      fontFamily: FONT_VT,
      fontSize: `${Math.max(12, Math.round(imgW * 0.015))}px`,
      color: '#c8a860', stroke: '#1a0a02', strokeThickness: 3,
    }).setOrigin(0.5, 0.5).setDepth(29));

    // ── X close button (top-right of modal image) ────────────────────────
    const btnSz = Math.max(26, Math.round(imgW * 0.042));
    const btnX  = CX + imgW / 2 - btnSz * 0.65;
    const btnY  = CY - imgH / 2 + btnSz * 0.65;
    const btn   = this._libAdd(
      this.add.rectangle(btnX, btnY, btnSz, btnSz, 0x140a02, 0.88)
        .setStrokeStyle(1.5, 0xb08040).setDepth(29).setInteractive({ useHandCursor: true })
    );
    const btnTxt = this._libAdd(this.add.text(btnX, btnY, '✕', {
      fontFamily: FONT_PS8,
      fontSize: `${Math.max(7, Math.round(btnSz * 0.42))}px`,
      color: '#d0a050',
    }).setOrigin(0.5, 0.5).setDepth(30));
    btn.on('pointerover',  () => { btn.setFillStyle(0x3a1e06, 0.95); btnTxt.setColor('#ffffff'); });
    btn.on('pointerout',   () => { btn.setFillStyle(0x140a02, 0.88); btnTxt.setColor('#d0a050'); });
    btn.on('pointerdown',  () => this._closeLibrary());
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  SKILL INFO POPUP
  // ════════════════════════════════════════════════════════════════════════════

  _skillInfoAdd(obj) { this._skillInfoObjs.push(obj); return obj; }

  _closeSkillInfo() {
    this._skillInfoObjs.forEach(o => o.destroy());
    this._skillInfoObjs = [];
    this._skillInfoOpen = false;
  }

  _openSkillInfo(sk, lv, xpFrac) {
    if (this._skillInfoOpen) this._closeSkillInfo();
    this._skillInfoOpen = true;
    const W = this.scale.width, H = this.scale.height;
    const sc  = Math.max(0.45, Math.min(1.4, Math.min(W / 640, H / 480)));
    const MW  = Math.round(340 * sc);
    const MH  = Math.round(200 * sc);
    const MX  = ((W - MW) / 2) | 0;
    const MY  = ((H - MH) / 2) | 0;
    const PAD = Math.round(12 * sc);

    const overlay = this._skillInfoAdd(
      this.add.rectangle(0, 0, W, H, 0x000000, 0.55).setOrigin(0, 0).setDepth(30).setInteractive()
    );
    overlay.on('pointerdown', () => this._closeSkillInfo());

    const g = this._skillInfoAdd(this.add.graphics().setDepth(31));
    g.fillStyle(0x0c0a06, 1);    g.fillRect(MX, MY, MW, MH);
    g.lineStyle(2, GOLD_INNER, 1); g.strokeRect(MX, MY, MW, MH);
    g.lineStyle(1, GOLD_INNER, 0.3); g.strokeRect(MX + 3, MY + 3, MW - 6, MH - 6);

    // Title row: icon + name + level
    this._skillInfoAdd(this.add.text(MX + PAD, MY + Math.round(16 * sc),
      `${sk.icon}  ${sk.name}`, {
        fontFamily: FONT_VT, fontSize: `${Math.max(16, Math.round(20 * sc))}px`, color: GOLD_STR,
      }).setOrigin(0, 0.5).setDepth(32));
    this._skillInfoAdd(this.add.text(MX + MW - PAD, MY + Math.round(16 * sc),
      `Lv. ${lv}`, {
        fontFamily: FONT_PS8, fontSize: `${Math.max(7, Math.round(9 * sc))}px`, color: GOLD_STR,
      }).setOrigin(1, 0.5).setDepth(32));

    // XP bar
    const barY = MY + Math.round(34 * sc);
    const barW = MW - PAD * 2;
    g.fillStyle(0x2a2010, 1); g.fillRect(MX + PAD, barY, barW, Math.round(5 * sc));
    if (xpFrac > 0) {
      g.fillStyle(0xd4ac50, 1);
      g.fillRect(MX + PAD, barY, Math.floor(barW * xpFrac), Math.round(5 * sc));
    }

    // Hint text
    if (sk.hint) {
      this._skillInfoAdd(this.add.text(MX + MW / 2, MY + Math.round(58 * sc), sk.hint, {
        fontFamily: FONT_VT, fontSize: `${Math.max(13, Math.round(15 * sc))}px`,
        color: '#a09070', align: 'center', wordWrap: { width: MW - PAD * 2 },
      }).setOrigin(0.5, 0).setDepth(32));
    }

    this._skillInfoAdd(this.add.text(MX + MW / 2, MY + MH - Math.round(10 * sc),
      'ESC  ·  click outside  to close', {
        fontFamily: FONT_VT, fontSize: `${Math.max(10, Math.round(12 * sc))}px`, color: '#5a4830',
      }).setOrigin(0.5, 1).setDepth(32));
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  CRAFTING BENCH MODALS  (Blacksmith + Carpentry — shared renderer)
  // ════════════════════════════════════════════════════════════════════════════

  _closeBench(bench) {
    const key = bench === 'blacksmith' ? '_blacksmithObjs' : '_carpentryObjs';
    const flag = bench === 'blacksmith' ? '_blacksmithOpen' : '_carpentryOpen';
    this[key].forEach(o => o.destroy());
    this[key] = [];
    this[flag] = false;
    this.game.events.emit('modal-closed');
  }

  _openBench(bench) {
    const flag    = bench === 'blacksmith' ? '_blacksmithOpen' : '_carpentryOpen';
    const objsKey = bench === 'blacksmith' ? '_blacksmithObjs' : '_carpentryObjs';
    if (this[flag]) this._closeBench(bench);
    this[flag] = true;
    this.game.events.emit('modal-opened');

    const W = this.scale.width, H = this.scale.height;
    const sc  = Math.max(0.45, Math.min(1.4, Math.min(W / 640, H / 480)));
    const MW  = Math.round(420 * sc);
    const HDR_H = Math.round(52 * sc);
    const FTR_H = Math.round(26 * sc);
    const PAD   = Math.round(10 * sc);
    const ROW_H = Math.round(66 * sc);

    const inv       = this.state.inventory ?? [];
    const countItem = (key) =>
      inv.filter(s => s && s.item === key).reduce((n, s) => n + s.qty, 0);

    const isBlacksmith = bench === 'blacksmith';
    const BENCH_RECIPES = isBlacksmith ? [
      { key: 'copper_sharpening_stone', name: 'Copper Sharpening Stone',
        effect: '+10% melee/ranged dmg · 10 min',
        ingredients: [{ key: 'copperstone_ore', label: '🟠 Copper Ore', qty: 3 }] },
      { key: 'copper_guard_charm',      name: 'Copper Guard Charm',
        effect: '-10% incoming damage · 10 min',
        ingredients: [{ key: 'copperstone_ore', label: '🟠 Copper Ore', qty: 3 }] },
    ] : [
      { key: 'ashwood_focus_totem',     name: 'Ashwood Focus Totem',
        effect: '+10% magic/druid dmg · 10 min',
        ingredients: [{ key: 'ashwood_log', label: '🪵 Ashwood Log', qty: 2 }] },
    ];

    const BODY_H = Math.round(8 * sc) + BENCH_RECIPES.length * ROW_H;
    const MH = HDR_H + BODY_H + FTR_H + PAD * 2;
    const MX = ((W - MW) / 2) | 0;
    const MY = ((H - MH) / 2) | 0;

    const add = (obj) => { this[objsKey].push(obj); return obj; };

    // Overlay
    const overlay = add(
      this.add.rectangle(0, 0, W, H, 0x000000, 0.68).setOrigin(0, 0).setDepth(20).setInteractive()
    );
    overlay.on('pointerdown', () => this._closeBench(bench));

    // Background
    const g = add(this.add.graphics().setDepth(21));
    const borderCol = isBlacksmith ? 0xcc8844 : 0x88aa44;
    const dimBorder = isBlacksmith ? 0x784422 : 0x446622;
    const titleCol  = isBlacksmith ? '#ffcc88' : '#aaddaa';
    const titleIcon = isBlacksmith ? '⚒  BLACKSMITH BENCH' : '🪚  CARPENTRY BENCH';
    g.fillStyle(0x0c0a06, 1); g.fillRect(MX, MY, MW, MH);
    g.lineStyle(2, borderCol, 1); g.strokeRect(MX, MY, MW, MH);
    g.lineStyle(1, borderCol, 0.35); g.strokeRect(MX + 3, MY + 3, MW - 6, MH - 6);
    g.fillStyle(dimBorder, 1); g.fillRect(MX + 2, MY + 2, MW - 4, Math.round(28 * sc));

    // Title
    add(this.add.text(MX + MW / 2, MY + Math.round(16 * sc), titleIcon, {
      fontFamily: FONT_PS8, fontSize: `${Math.max(7, Math.round(8 * sc))}px`, color: titleCol,
    }).setOrigin(0.5, 0.5).setDepth(22));

    // Divider
    const divY = MY + HDR_H;
    g.lineStyle(1, borderCol, 0.7); g.lineBetween(MX + PAD, divY, MX + MW - PAD, divY);

    // Recipes
    BENCH_RECIPES.forEach((rec, i) => {
      const haveIngs = rec.ingredients.every(ing => countItem(ing.key) >= ing.qty);
      const ry = divY + Math.round(8 * sc) + i * ROW_H;

      if (i > 0) {
        g.lineStyle(1, dimBorder, 0.5);
        g.lineBetween(MX + PAD, ry, MX + MW - PAD, ry);
      }

      // Recipe name + effect
      const nameCol = haveIngs ? titleCol : '#6a5840';
      const iconSz  = Math.round(18 * sc);
      const iconCX  = MX + PAD + Math.round(iconSz / 2);
      const iconCY  = ry + Math.round(7 * sc) + Math.round(iconSz / 2);
      this._itemIcon(rec.key, iconCX, iconCY, iconSz, haveIngs ? 1 : 0.35, add)?.setDepth(22);
      add(this.add.text(MX + PAD + iconSz + Math.round(5 * sc), ry + Math.round(7 * sc), `${rec.name}  (${rec.effect})`, {
        fontFamily: FONT_VT, fontSize: `${Math.max(13, Math.round(16 * sc))}px`, color: nameCol,
      }).setOrigin(0, 0).setDepth(22));

      // Ingredient line
      const ingLine = rec.ingredients.map(ing =>
        `${ing.label} ×${ing.qty} (${countItem(ing.key)})`
      ).join('  +  ');
      add(this.add.text(MX + PAD, ry + Math.round(32 * sc), ingLine, {
        fontFamily: FONT_VT, fontSize: `${Math.max(11, Math.round(13 * sc))}px`,
        color: haveIngs ? '#88dd88' : '#aa6644',
      }).setOrigin(0, 0).setDepth(22));

      // CRAFT button
      if (haveIngs) {
        const btnW = Math.round(88 * sc), btnH = Math.round(22 * sc);
        const bx  = MX + MW - PAD - btnW;
        const bcy = ry + Math.round(32 * sc);
        const btnFill   = isBlacksmith ? 0x3a2010 : 0x102010;
        const btnBorder = borderCol;
        const btnTxtCol = titleCol;
        const btn = add(
          this.add.rectangle(bx + btnW / 2, bcy + btnH / 2, btnW, btnH, btnFill)
            .setStrokeStyle(1, btnBorder).setDepth(22).setInteractive({ useHandCursor: true })
        );
        const btnTxt = add(this.add.text(bx + btnW / 2, bcy + btnH / 2, 'CRAFT', {
          fontFamily: FONT_PS8, fontSize: `${Math.max(6, Math.round(7 * sc))}px`, color: btnTxtCol,
        }).setOrigin(0.5, 0.5).setDepth(23));
        const recKey = rec.key;
        btn.on('pointerover',  () => { btn.setFillStyle(borderCol); btnTxt.setColor('#ffffff'); });
        btn.on('pointerout',   () => { btn.setFillStyle(btnFill);   btnTxt.setColor(btnTxtCol); });
        btn.on('pointerdown',  () => {
          this.game.events.emit('bench-craft', { recipe: recKey });
          this._closeBench(bench);
          this._openBench(bench);
        });
      }
    });

    // Absorb clicks
    add(this.add.zone(MX + MW / 2, MY + MH / 2, MW, MH).setDepth(21).setInteractive())
      .on('pointerdown', (ptr) => ptr.event.stopPropagation());

    // ESC hint
    add(this.add.text(MX + MW / 2, MY + MH - FTR_H / 2, 'ESC  ·  click outside  to close', {
      fontFamily: FONT_VT, fontSize: `${Math.max(12, Math.round(14 * sc))}px`, color: '#5a4830',
    }).setOrigin(0.5, 0.5).setDepth(22));
  }

  //  BANK MODAL
  // ════════════════════════════════════════════════════════════════════════════

  _bankAdd(obj) { this._bankObjs.push(obj); return obj; }

  _closeBank() {
    this._bankObjs.forEach(o => o.destroy());
    this._bankObjs = [];
    this._bankOpen = false;
    this.game.events.emit('modal-closed');
  }

  _openBank() {
    this._bankOpen = true;
    this._hideTooltip();
    this.game.events.emit('modal-opened');
    const W = this.scale.width, H = this.scale.height;
    const sc  = Math.max(0.40, Math.min(W * 0.90 / 820, H * 0.88 / 490));
    const MW  = Math.round(800 * sc);
    const MH  = Math.round(480 * sc);
    const MX  = Math.round((W - MW) / 2);
    const MY  = Math.round((H - MH) / 2);
    const PAD = Math.round(8 * sc);
    const HDR_H = Math.round(34 * sc);
    const FTR_H = Math.round(18 * sc);

    const inv = this.state.inventory ?? [];
    const bnk = this.state.bank      ?? [];

    // ── Dim overlay ───────────────────────────────────────────────────────
    const overlay = this._bankAdd(
      this.add.rectangle(0, 0, W, H, 0x000000, 0.55).setOrigin(0, 0).setDepth(20).setInteractive()
    );
    overlay.on('pointerdown', () => this._closeBank());

    // ── Background image ──────────────────────────────────────────────────
    const hasImg = this.textures.exists('bank_interior_ui');
    if (hasImg) {
      this._bankAdd(
        this.add.image(MX + MW / 2, MY + MH / 2, 'bank_interior_ui')
          .setDisplaySize(MW, MH).setDepth(21)
          .setInteractive().on('pointerdown', (ptr) => ptr.event.stopPropagation())
      );
    }

    // ── Candle flicker — very subtle warm pulse over interior art ────────────
    if (hasImg) {
      const flicker = this._bankAdd(
        this.add.rectangle(MX + MW / 2, MY + MH / 2, MW - 4, MH - 4, 0xffaa44, 0).setDepth(21.5)
      );
      this.tweens.add({
        targets: flicker, alpha: 0.020,
        duration: 750, ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
      });
    }

    // ── Graphics layer (borders, panels, slots) ───────────────────────────
    const g = this._bankAdd(this.add.graphics().setDepth(21));
    if (!hasImg) { g.fillStyle(0x0c0a08, 1); g.fillRect(MX, MY, MW, MH); }
    g.lineStyle(2, 0x7a5a18, 1);    g.strokeRect(MX, MY, MW, MH);
    g.lineStyle(1, 0xb08828, 0.45); g.strokeRect(MX + 3, MY + 3, MW - 6, MH - 6);
    // Header strip
    g.fillStyle(0x060402, 0.90); g.fillRect(MX + 2, MY + 2, MW - 4, HDR_H - 2);
    g.lineStyle(1, 0x7a5a18, 0.55); g.lineBetween(MX + 2, MY + HDR_H, MX + MW - 2, MY + HDR_H);

    // ── Header: flavor text + close ───────────────────────────────────────
    this._bankAdd(this.add.text(MX + PAD * 2, MY + Math.round(HDR_H / 2),
      'Welcome to Grimfell Bank.  Your items are safe here.', {
        fontFamily: FONT_PS8, fontSize: `${Math.max(5, Math.round(6 * sc))}px`, color: '#c9a84c',
      }).setOrigin(0, 0.5).setDepth(22));

    const closeBtn = this._bankAdd(
      this.add.text(MX + MW - PAD, MY + Math.round(HDR_H / 2), '✕', {
        fontFamily: FONT_VT, fontSize: `${Math.max(14, Math.round(18 * sc))}px`, color: '#cc4444',
      }).setOrigin(1, 0.5).setDepth(22).setInteractive({ useHandCursor: true })
    );
    closeBtn.on('pointerover', () => closeBtn.setStyle({ color: '#ff6666' }));
    closeBtn.on('pointerout',  () => closeBtn.setStyle({ color: '#cc4444' }));
    closeBtn.on('pointerdown', () => this._closeBank());

    // ── Lower panel geometry — occupies bottom 46% of modal ───────────────
    // Upper 54% stays clear so the bank interior artwork is visible.
    const LOWER_Y  = MY + Math.round(MH * 0.54);
    const LOWER_H  = MY + MH - FTR_H - LOWER_Y - 4;
    const LROW_H   = Math.round(14 * sc);  // label row height
    const TAB_H    = Math.round(15 * sc);  // page tab height
    const I_GAP = 3, B_GAP = 3;

    // Slot sizes — fill available space, capped to keep items readable
    // I_ROWS=6 so 5×6=30 slots, covering all 28 possible inventory positions.
    const I_COLS = 5, I_ROWS = 6;
    const I_SZ = Math.max(22, Math.min(38,
      Math.floor((LOWER_H - LROW_H - I_GAP * (I_ROWS - 1)) / I_ROWS)
    ));
    const invGridW = I_COLS * I_SZ + (I_COLS - 1) * I_GAP;
    const INV_PW   = invGridW + Math.round(14 * sc);
    const DIV_GAP  = Math.round(8 * sc);
    const bankPX   = MX + PAD + INV_PW + DIV_GAP;
    const bankPW   = MX + MW - PAD - bankPX;

    const B_COLS = 10, B_ROWS = 5;
    const B_SZ = Math.max(24, Math.min(52,
      Math.floor((bankPW - (B_COLS - 1) * B_GAP) / B_COLS),
      Math.floor((LOWER_H - LROW_H - TAB_H - 4 - B_GAP * (B_ROWS - 1)) / B_ROWS)
    ));

    // ── Footer strip ──────────────────────────────────────────────────────
    g.fillStyle(0x040302, 0.80);
    g.fillRect(MX + 2, MY + MH - FTR_H - 2, MW - 4, FTR_H);

    // ── Inventory panel (lower-left) ──────────────────────────────────────
    const invPanelX = MX + PAD - 2;
    const invPanelW = INV_PW + 4;
    g.fillStyle(0x050301, 0.72); g.fillRect(invPanelX, LOWER_Y, invPanelW, LOWER_H);
    g.lineStyle(1, 0x7a5428, 0.70); g.strokeRect(invPanelX, LOWER_Y, invPanelW, LOWER_H);
    g.lineStyle(1, 0xa07020, 0.20); g.strokeRect(invPanelX + 2, LOWER_Y + 2, invPanelW - 4, LOWER_H - 4);

    // ── Bank vault panel (lower-right) ────────────────────────────────────
    g.fillStyle(0x030504, 0.72); g.fillRect(bankPX - 2, LOWER_Y, bankPW + 2, LOWER_H);
    g.lineStyle(1, 0x7a5428, 0.70); g.strokeRect(bankPX - 2, LOWER_Y, bankPW + 2, LOWER_H);
    g.lineStyle(1, 0xa07020, 0.20); g.strokeRect(bankPX, LOWER_Y + 2, bankPW - 2, LOWER_H - 4);

    // ── Labels + inventory sort button ────────────────────────────────────
    this._bankAdd(this.add.text(invPanelX + invPanelW / 2, LOWER_Y + 4, 'INVENTORY', {
      fontFamily: FONT_PS8, fontSize: `${Math.max(5, Math.round(6 * sc))}px`, color: '#a08060',
    }).setOrigin(0.5, 0).setDepth(22));
    // Sort button — right edge of inventory panel header
    {
      const sBtnH = Math.max(12, Math.round(LROW_H * 0.85));
      const sBtnW = Math.max(28, Math.round(36 * sc));
      const sBtnX = invPanelX + invPanelW - sBtnW - 2;
      const sBtnY = LOWER_Y + Math.floor((LROW_H - sBtnH) / 2);
      const sBtn = this._bankAdd(
        this.add.rectangle(sBtnX + sBtnW / 2, sBtnY + sBtnH / 2, sBtnW, sBtnH, 0x1a1008)
          .setStrokeStyle(1, 0x7a5428, 0.65).setDepth(22).setInteractive({ useHandCursor: true })
      );
      const sTxt = this._bankAdd(
        this.add.text(sBtnX + sBtnW / 2, sBtnY + sBtnH / 2, 'SORT', {
          fontFamily: FONT_PS8, fontSize: `${Math.max(5, Math.round(6 * sc))}px`, color: '#a08060',
        }).setOrigin(0.5, 0.5).setDepth(23)
      );
      sBtn.on('pointerover',  () => { sBtn.setFillStyle(0x3a2808); sTxt.setColor('#ffffff'); });
      sBtn.on('pointerout',   () => { sBtn.setFillStyle(0x1a1008); sTxt.setColor('#a08060'); });
      sBtn.on('pointerdown',  () => this.game.events.emit('sort-inventory'));
    }

    this._bankAdd(this.add.text(bankPX + bankPW / 2, LOWER_Y + 4, 'BANK VAULT', {
      fontFamily: FONT_PS8, fontSize: `${Math.max(5, Math.round(6 * sc))}px`, color: '#c9a84c',
    }).setOrigin(0.5, 0).setDepth(22));

    // ── Inventory slots ───────────────────────────────────────────────────
    const invGridX = MX + PAD + Math.floor((INV_PW - invGridW) / 2);
    const invGridY = LOWER_Y + LROW_H;

    for (let r = 0; r < I_ROWS; r++) {
      for (let c = 0; c < I_COLS; c++) {
        const idx  = r * I_COLS + c;
        const sx   = invGridX + c * (I_SZ + I_GAP);
        const sy   = invGridY + r * (I_SZ + I_GAP);
        const slot = inv[idx] ?? null;
        const def  = slot ? (ITEMS_DATA[slot.item] ?? null) : null;
        const filled = !!slot;

        g.fillStyle(0x050301, 1);                          g.fillRect(sx - 1, sy - 1, I_SZ + 2, I_SZ + 2);
        g.fillStyle(filled ? 0x100d04 : 0x080604, 1);     g.fillRect(sx, sy, I_SZ, I_SZ);
        g.fillStyle(filled ? 0x161008 : 0x0c0a05, 1);     g.fillRect(sx + 2, sy + 2, I_SZ - 4, I_SZ - 4);
        g.lineStyle(1, filled ? 0x9a7828 : 0x7a6030, filled ? 0.75 : 0.55);
        g.strokeRect(sx, sy, I_SZ, I_SZ);
        g.lineStyle(1, 0xc08830, filled ? 0.14 : 0.07);
        g.lineBetween(sx + 1, sy + 1, sx + I_SZ - 1, sy + 1);

        if (def) {
          this._itemIcon(slot.item, sx + I_SZ / 2, sy + I_SZ / 2, I_SZ, 1,
            (o) => this._bankAdd(o.setDepth(22)));
          if (slot.qty > 1) {
            this._bankAdd(this.add.text(sx + I_SZ - 1, sy + I_SZ - 1, `${slot.qty}`, {
              fontFamily: FONT_VT, fontSize: `${Math.max(8, Math.round(10 * sc))}px`, color: '#e8c060',
            }).setOrigin(1, 1).setDepth(22));
          }
          const captIdx = idx;
          const zone = this._bankAdd(
            this.add.zone(sx + I_SZ / 2, sy + I_SZ / 2, I_SZ, I_SZ)
              .setInteractive({ useHandCursor: true }).setDepth(23)
          );
          zone.on('pointerdown', () =>
            this.game.events.emit('bank-deposit', { invIdx: captIdx, page: this._bankPage })
          );
        }
      }
    }

    // ── Bank page tabs ────────────────────────────────────────────────────
    const TAB_W  = Math.floor(bankPW / 8);
    const tabsY  = LOWER_Y + LROW_H;

    for (let p = 0; p < 8; p++) {
      const tx     = bankPX + p * TAB_W;
      const active = p === this._bankPage;
      g.fillStyle(active ? 0x1c1208 : 0x080604, 1);
      g.fillRect(tx, tabsY, TAB_W - 1, TAB_H);
      g.lineStyle(1, active ? 0x9a7828 : 0x3a2810, 1);
      g.strokeRect(tx, tabsY, TAB_W - 1, TAB_H);
      if (active) {
        g.lineStyle(1, 0x1c1208, 1);
        g.lineBetween(tx + 1, tabsY + TAB_H, tx + TAB_W - 2, tabsY + TAB_H);
      }
      const captP  = p;
      const tabTxt = this._bankAdd(
        this.add.text(tx + TAB_W / 2, tabsY + TAB_H / 2, `${p + 1}`, {
          fontFamily: FONT_PS8, fontSize: `${Math.max(5, Math.round(6 * sc))}px`,
          color: active ? '#c89848' : '#5a4030',
        }).setOrigin(0.5, 0.5).setDepth(22)
      );
      const tabZone = this._bankAdd(
        this.add.zone(tx + TAB_W / 2, tabsY + TAB_H / 2, TAB_W - 1, TAB_H)
          .setInteractive({ useHandCursor: true }).setDepth(23)
      );
      tabZone.on('pointerdown', () => { this._bankPage = captP; this._closeBank(); this._openBank(); });
      tabZone.on('pointerover', () => { if (captP !== this._bankPage) tabTxt.setStyle({ color: '#907860' }); });
      tabZone.on('pointerout',  () => { if (captP !== this._bankPage) tabTxt.setStyle({ color: '#5a4030' }); });
    }

    // ── Bank slots (10 × 5 = 50 per page, 8 pages = 400 total) ──────────
    const slotsY    = tabsY + TAB_H + 3;
    const bankGridW = B_COLS * B_SZ + (B_COLS - 1) * B_GAP;
    const bankGridH = B_ROWS * B_SZ + (B_ROWS - 1) * B_GAP;
    const bankGridX = bankPX + Math.floor((bankPW - bankGridW) / 2);
    const bankGridY = slotsY;

    const pageStart = this._bankPage * 50;
    for (let r = 0; r < B_ROWS; r++) {
      for (let c = 0; c < B_COLS; c++) {
        const slotI  = pageStart + r * B_COLS + c;
        const sx     = bankGridX + c * (B_SZ + B_GAP);
        const sy     = bankGridY + r * (B_SZ + B_GAP);
        const slot   = bnk[slotI] ?? null;
        const def    = slot ? (ITEMS_DATA[slot.item] ?? null) : null;
        const filled = !!slot;

        g.fillStyle(0x050403, 1);                           g.fillRect(sx - 1, sy - 1, B_SZ + 2, B_SZ + 2);
        g.fillStyle(filled ? 0x0a0f08 : 0x070806, 1);      g.fillRect(sx, sy, B_SZ, B_SZ);
        g.fillStyle(filled ? 0x101408 : 0x0a0c05, 1);      g.fillRect(sx + 2, sy + 2, B_SZ - 4, B_SZ - 4);
        g.lineStyle(1, filled ? 0x9a7828 : 0x7a6830, filled ? 0.70 : 0.50);
        g.strokeRect(sx, sy, B_SZ, B_SZ);
        g.lineStyle(1, 0xc08830, filled ? 0.12 : 0.06);
        g.lineBetween(sx + 1, sy + 1, sx + B_SZ - 1, sy + 1);

        if (def) {
          this._itemIcon(slot.item, sx + B_SZ / 2, sy + B_SZ / 2, B_SZ, 1,
            (o) => this._bankAdd(o.setDepth(22)));
          if (slot.qty > 1) {
            this._bankAdd(this.add.text(sx + B_SZ - 1, sy + B_SZ - 1, `${slot.qty}`, {
              fontFamily: FONT_VT, fontSize: `${Math.max(8, Math.round(10 * sc))}px`, color: '#e8c060',
            }).setOrigin(1, 1).setDepth(22));
          }
          const captSlotI = slotI;
          const bzone = this._bankAdd(
            this.add.zone(sx + B_SZ / 2, sy + B_SZ / 2, B_SZ, B_SZ)
              .setInteractive({ useHandCursor: true }).setDepth(23)
          );
          bzone.on('pointerdown', () =>
            this.game.events.emit('bank-withdraw', { bankIdx: captSlotI })
          );
        }
      }
    }

    // ── Absorb clicks on modal body ───────────────────────────────────────
    this._bankAdd(
      this.add.zone(MX + MW / 2, MY + MH / 2, MW, MH).setDepth(21).setInteractive()
    ).on('pointerdown', (ptr) => ptr.event.stopPropagation());

    // ── Footer hint ───────────────────────────────────────────────────────
    this._bankAdd(this.add.text(MX + MW / 2, MY + MH - FTR_H / 2,
      'Click inventory to deposit  ·  Click bank item to withdraw  ·  ESC or ✕ to close', {
        fontFamily: FONT_VT, fontSize: `${Math.max(9, Math.round(11 * sc))}px`, color: '#8a7050',
      }).setOrigin(0.5, 0.5).setDepth(22));
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  WORLD MAP OVERLAY
  // ════════════════════════════════════════════════════════════════════════════

  _mapAdd(obj) { this._mapObjs.push(obj); return obj; }

  _closeWorldMap() {
    this._mapObjs.forEach(o => o.destroy());
    this._mapObjs   = [];
    this._mapDynGfx = null;
    this._mapGeom   = null;
    this._mapOpen   = false;
    this.game.events.emit('world-map-closed');
  }

  _openWorldMap() {
    if (!this._worldMapTiles) {
      // Tiles not yet received — request them and retry in one frame
      this.game.events.emit('request-map-data');
      this.time.delayedCall(16, () => {
        if (this._worldMapTiles && !this._mapOpen) this._openWorldMap();
      });
      return;
    }
    this._mapOpen = true;
    this.game.events.emit('world-map-opened');
    const W = this.scale.width, H = this.scale.height;

    // Map square: fills the screen with a comfortable margin, capped at 820 px
    const border  = 50;
    const mapSize = Math.min(Math.min(W, H) - border * 2, 820);
    const mapX    = Math.floor((W - mapSize) / 2);
    const mapY    = Math.floor((H - mapSize) / 2);
    const tileW   = mapSize / MAP_W;
    const tileH   = mapSize / MAP_H;
    this._mapGeom = { mapX, mapY, mapSize, tileW, tileH };

    // Full-screen dim — clicking outside map body closes the overlay
    const overlay = this._mapAdd(
      this.add.rectangle(0, 0, W, H, 0x000000, 0.84)
        .setOrigin(0, 0).setDepth(24).setInteractive()
    );
    overlay.on('pointerdown', () => this._closeWorldMap());

    // Bronze border ring matching HUD style
    const borderGfx = this._mapAdd(this.add.graphics().setDepth(25));
    borderGfx.fillStyle(BRONZE_OUTER, 1);
    borderGfx.fillRect(mapX - 5, mapY - 5, mapSize + 10, mapSize + 10);
    borderGfx.fillStyle(0x000000, 1);
    borderGfx.fillRect(mapX - 3, mapY - 3, mapSize + 6,  mapSize + 6);
    borderGfx.lineStyle(1, GOLD_INNER, 0.55);
    borderGfx.strokeRect(mapX, mapY, mapSize, mapSize);

    // Painted map base — grimfell_map_bg.png scaled to fill the modal square
    if (this.textures.exists('mapbg')) {
      this._mapAdd(
        this.add.image(mapX, mapY, 'mapbg')
          .setOrigin(0, 0).setDisplaySize(mapSize, mapSize).setDepth(25)
      );
    } else {
      // Fallback: procedural tile colours if texture not available
      const tileGfx = this._mapAdd(this.add.graphics().setDepth(25));
      this._drawWorldMapTiles(tileGfx, mapX, mapY, tileW, tileH);
      const coastGfx = this._mapAdd(this.add.graphics().setDepth(25));
      this._drawWorldMapCoast(coastGfx, mapX, mapY, mapSize, tileH);
    }

    // Scourge Pass / Scourge Peak danger overlay — blocked future content
    const dangerGfx = this._mapAdd(this.add.graphics().setDepth(26));
    this._drawWorldMapDangerZone(dangerGfx, mapX, mapY, tileW, tileH);

    // Resource node dots (woodcutting/mining/fishing/foraging)
    const resGfx = this._mapAdd(this.add.graphics().setDepth(27));
    this._drawWorldMapResources(resGfx, mapX, mapY, tileW, tileH);

    // Interactable markers (static dots)
    const iactGfx = this._mapAdd(this.add.graphics().setDepth(28));
    this._drawWorldMapIacts(iactGfx, mapX, mapY, tileW, tileH);

    // Interactable text labels
    for (const iact of this._worldMapIacts) {
      const col    = MAP_IACT_COL[iact.type] ?? 0xcccccc;
      const colStr = '#' + col.toString(16).padStart(6, '0');
      const lx     = mapX + (iact.x + 0.5) * tileW;
      const ly     = mapY + (iact.y - 0.8) * tileH;
      this._mapAdd(this.add.text(lx, ly, iact.label, {
        fontFamily: FONT_PS8, fontSize: '5px', color: colStr,
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5, 1).setDepth(29));
    }

    // Region labels
    this._drawWorldMapRegionLabels(mapX, mapY, tileW, tileH);

    // Dynamic layer: player marker — always on top
    this._mapDynGfx = this._mapAdd(this.add.graphics().setDepth(31));
    this._refreshWorldMapPlayer();

    // Title above map
    this._mapAdd(this.add.text(W / 2, mapY - 12,
      'GRIMFELL  —  WORLD MAP', {
        fontFamily: FONT_PS8, fontSize: '9px', color: '#c9a84c',
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5, 1).setDepth(31));

    // Close hint below map
    this._mapAdd(this.add.text(W / 2, mapY + mapSize + 8,
      '[M]  or  [ESC]  to close', {
        fontFamily: FONT_PS8, fontSize: '6px', color: '#786048',
      }).setOrigin(0.5, 0).setDepth(31));

    // Absorb zone over map body — stops clicks propagating to game scene overlay
    this._mapAdd(
      this.add.zone(mapX + mapSize / 2, mapY + mapSize / 2, mapSize, mapSize)
        .setInteractive().setDepth(26)
    ).on('pointerdown', (ptr) => ptr.event.stopPropagation());
  }

  // Renders the full 100×100 tile grid using actual tile-type colours.
  // Called once on open — static terrain never changes.
  _drawWorldMapTiles(g, mapX, mapY, tileW, tileH) {
    const tiles = this._worldMapTiles;
    if (!tiles) return;
    for (let ty = 0; ty < MAP_H; ty++) {
      for (let tx = 0; tx < MAP_W; tx++) {
        const t   = tiles[ty][tx] ?? 0;
        const col = MAP_TILE_COL[t] ?? MAP_TILE_COL[0];
        g.fillStyle(col, 1);
        g.fillRect(
          Math.floor(mapX + tx * tileW),
          Math.floor(mapY + ty * tileH),
          Math.ceil(tileW),
          Math.ceil(tileH),
        );
      }
    }
  }

  // Draws a coloured square marker for each interactable.
  _drawWorldMapIacts(g, mapX, mapY, tileW, tileH) {
    const dotSz = Math.max(4, Math.round(tileW * 1.8));
    for (const iact of this._worldMapIacts) {
      const col = MAP_IACT_COL[iact.type] ?? 0xaaaaaa;
      const cx  = Math.floor(mapX + (iact.x + 0.5) * tileW);
      const cy  = Math.floor(mapY + (iact.y + 0.5) * tileH);
      // Drop shadow
      g.fillStyle(0x000000, 0.65);
      g.fillRect(cx - dotSz / 2 + 1, cy - dotSz / 2 + 1, dotSz, dotSz);
      // Coloured dot
      g.fillStyle(col, 1);
      g.fillRect(cx - dotSz / 2, cy - dotSz / 2, dotSz, dotSz);
      // Thin dark outline
      g.lineStyle(1, 0x000000, 0.5);
      g.strokeRect(cx - dotSz / 2, cy - dotSz / 2, dotSz, dotSz);
    }
  }

  // Redraws only the player position marker — called on every player-update
  // while the map is open, so the dot tracks movement without redrawing tiles.
  // Glow rings are drawn on the same dynamic layer — no extra redraw cost.
  _refreshWorldMapPlayer() {
    if (!this._mapOpen || !this._mapDynGfx || !this._mapGeom) return;
    const { mapX, mapY, tileW, tileH } = this._mapGeom;
    const g  = this._mapDynGfx;
    g.clear();
    const px = Math.floor(mapX + (this.state.playerTileX + 0.5) * tileW);
    const py = Math.floor(mapY + (this.state.playerTileY + 0.5) * tileH);
    const sz = Math.max(6, Math.round(tileW * 2.4));
    // Soft outer glow halo — two semi-transparent rings
    const g1 = sz + 8, g2 = sz + 4;
    g.fillStyle(0xffdd88, 0.09);
    g.fillRect(px - g1 / 2, py - g1 / 2, g1, g1);
    g.fillStyle(0xffffff, 0.16);
    g.fillRect(px - g2 / 2, py - g2 / 2, g2, g2);
    // Drop shadow
    g.fillStyle(0x000000, 0.7);
    g.fillRect(px - sz / 2 + 1, py - sz / 2 + 1, sz, sz);
    // White outer ring
    g.fillStyle(0xffffff, 1);
    g.fillRect(px - sz / 2, py - sz / 2, sz, sz);
    // Gold centre
    g.fillStyle(GOLD_INNER, 1);
    const inner = Math.max(2, Math.round(sz * 0.5));
    g.fillRect(px - inner / 2, py - inner / 2, inner, inner);
  }

  // Subtle horizontal shading bands in the north water strip — breaks up the
  // flat uniform blue of the coast so it reads as open sea, not a rectangle.
  _drawWorldMapCoast(g, mapX, mapY, mapSize, tileH) {
    // Lighter upper tint (open deep ocean)
    g.fillStyle(0x5880d0, 0.06);
    g.fillRect(mapX, mapY, mapSize, tileH * 5);
    // Darker mid-water band (adds perceived depth)
    g.fillStyle(0x08122a, 0.10);
    g.fillRect(mapX, mapY + tileH * 4, mapSize, tileH * 4);
    // Light shimmer strip near shoreline
    g.fillStyle(0x88aacc, 0.09);
    g.fillRect(mapX, mapY + tileH * 9, mapSize, tileH * 1.0);
  }

  // Dark red-tinted overlay over the Scourge Peak / Scourge Pass region.
  // Visually communicates "dangerous / inaccessible / future content"
  // without touching the actual terrain generation.
  _drawWorldMapDangerZone(g, mapX, mapY, tileW, tileH) {
    // Cover x:79–99 (21 tiles), y:69–99 (31 tiles) — the mountain mass + approach
    const dX = Math.floor(mapX + 79 * tileW);
    const dY = Math.floor(mapY + 69 * tileH);
    const dW = Math.ceil(21 * tileW);
    const dH = Math.ceil(31 * tileH);
    // Main desaturating dark overlay
    g.fillStyle(0x0a0000, 0.52);
    g.fillRect(dX, dY, dW, dH);
    // Slightly darker inner vignette
    g.fillStyle(0x000000, 0.14);
    g.fillRect(dX + 3, dY + 3, dW - 6, dH - 6);
    // Outer danger border — bold red
    g.lineStyle(2, 0x880000, 0.62);
    g.strokeRect(dX, dY, dW, dH);
    // Inner red glow ring — adds depth to the effect
    g.lineStyle(1, 0xff2200, 0.14);
    g.strokeRect(dX + 4, dY + 4, dW - 8, dH - 8);
  }

  // Draws region name labels over the world map using proportional font size
  // so labels scale with map size. Thick dark stroke acts as the text backing.
  _drawWorldMapRegionLabels(mapX, mapY, tileW, tileH) {
    // Font size scales with tile width so labels fill their region proportionally
    const fs   = Math.max(10, Math.round(tileW * 1.55)) + 'px';
    const fsLg = Math.max(11, Math.round(tileW * 1.80)) + 'px';  // slightly larger for key locations
    const LABELS = [
      // Coast
      { text: 'Whispering Coast',      tx: 50, ty:  7, col: '#90b8e0', sz: fs   },
      // Northwest
      { text: 'Desecrated Graveyard',  tx: 16, ty: 27, col: '#9898b8', sz: fs   },
      // West
      { text: 'Sunken Grove',          tx: 13, ty: 60, col: '#68a848', sz: fs   },
      // Southwest
      { text: 'Highfields Farm',       tx: 13, ty: 88, col: '#a8c060', sz: fs   },
      // Center
      { text: 'Grimfell Outpost',      tx: 50, ty: 57, col: '#c9a84c', sz: fsLg },
      // East
      { text: 'Shattered Quarry',      tx: 80, ty: 40, col: '#b09878', sz: fs   },
      // Northeast
      { text: 'Goblin Camp',           tx: 86, ty: 18, col: '#cc6644', sz: fs   },
      // Southeast — in the danger zone, red to signal blocked content
      { text: 'Scourge Pass',          tx: 74, ty: 76, col: '#cc4444', sz: fs   },
    ];
    for (const { text, tx, ty, col, sz } of LABELS) {
      const lx = mapX + (tx + 0.5) * tileW;
      const ly = mapY + (ty + 0.5) * tileH;
      this._mapAdd(this.add.text(lx, ly, text, {
        fontFamily: FONT_VT,
        fontSize:   sz,
        color:      col,
        stroke:     '#0a0806',
        strokeThickness: 3,
      }).setOrigin(0.5, 0.5).setDepth(30));
    }
  }

  // Resource node markers: small coloured circles by skill category.
  _drawWorldMapResources(g, mapX, mapY, tileW, tileH) {
    const SKILL_COL = {
      woodcutting: 0x44bb44,
      mining:      0x9988cc,
      fishing:     0x44aaee,
      foraging:    0xaacc44,
    };
    const TYPE_SKILL = {
      tree: 'woodcutting', ashwood: 'woodcutting', grimoak: 'woodcutting',
      deadwood: 'woodcutting', veilwood: 'woodcutting', oak: 'woodcutting',
      copper_rock: 'mining', grimsteel_rock: 'mining',
      ashstone_rock: 'mining', veilmetal_rock: 'mining',
      fishing_spot: 'fishing', trout_spot: 'fishing',
      herb_bitterleaf: 'foraging', herb_mooncap: 'foraging',
      herb_redroot: 'foraging', herb_stonecap: 'foraging',
      herb_veilbloom: 'foraging',
    };
    const r = Math.max(2, Math.round(tileW * 0.65));
    for (const res of (this._worldMapResources ?? [])) {
      const skill = TYPE_SKILL[res.type];
      if (!skill) continue;
      const col = SKILL_COL[skill];
      const cx  = Math.floor(mapX + (res.x + 0.5) * tileW);
      const cy  = Math.floor(mapY + (res.y + 0.5) * tileH);
      g.fillStyle(0x000000, 0.40);
      g.fillCircle(cx + 1, cy + 1, r);
      g.fillStyle(col, 0.80);
      g.fillCircle(cx, cy, r);
    }
  }
}
