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

// locked:true → greyed out, 🔒 icon, no XP bar (skill not yet implemented)
const SKILLS = [
  { key: 'melee',         name: 'Melee',       icon: '⚔️'  },
  { key: 'archer',        name: 'Archer',      icon: '🏹'  },
  { key: 'magic',         name: 'Magic',       icon: '🔮'  },
  { key: 'druidism',      name: 'Druidism',    icon: '🌿'  },
  { key: 'defence',       name: 'Defence',     icon: '🛡️'  },
  { key: 'hitpoints',     name: 'Hitpoints',   icon: '❤️',  lv: 10 },
  { key: 'woodcutting',   name: 'Woodcut',     icon: '🪓'  },
  { key: 'mining',        name: 'Mining',      icon: '⛏️'  },
  { key: 'fishing',       name: 'Fishing',     icon: '🎣'  },
  { key: 'cooking',       name: 'Cooking',     icon: '🍳'  },
  { key: 'foraging',      name: 'Foraging',    icon: '🌾'  },
  { key: 'blacksmithing', name: 'Blacksmith',  icon: '🔨',  locked: true },
  { key: 'carpentry',     name: 'Carpentry',   icon: '🪚',  locked: true },
  { key: 'alchemy',       name: 'Alchemy',     icon: '⚗️',  locked: true },
  { key: 'tinkering',     name: 'Tinkering',   icon: '⚙️',  locked: true },
  { key: 'loremaster',    name: 'Loremaster',  icon: '📚',  locked: true },
  { key: 'questing',      name: 'Questing',    icon: '🗺️',  locked: true },
];

const SHOP_WEAPON_IDS = ['iron_sword', 'shortbow', 'apprentice_staff', 'oak_totem'];
const SHOP_PRICE_MAP  = Object.fromEntries(SHOP_DATA.stock.map(s => [s.item, s.price]));

const ABILITY_ICONS      = ['✨', '🛡', '🔥', '⚡', '🔒', '🔒'];
const ABILITY_KEYS       = ['Q', 'W', 'E', 'R', 'T', 'Y'];
const ABILITY_LOCKED     = [false, false, false, false, true, true];
const ABILITY_ACTIVE_COL = [0x44ff88, 0x4488ff, 0xff4422, 0xffdd22, 0, 0];

export default class UIScene extends Phaser.Scene {
  constructor() { super({ key: 'UIScene' }); }

  // ════════════════════════════════════════════════════════════════════════════
  //  LIFECYCLE
  // ════════════════════════════════════════════════════════════════════════════

  create() {
    this.gfx   = this.add.graphics().setDepth(0);
    this._objs = [];

    this.state = {
      hp: 10, maxHp: 10, coins: 0, zone: 'Overworld',
      playerTileX: Math.floor(MAP_W / 2),
      playerTileY: Math.floor(MAP_H / 3),
      skills:    {},  // { skillKey: { level, xpFrac } }
      inventory: [],  // [{ item, qty }]
      gear:      {},  // { slotId: itemKey | null }
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
      if (this._shopOpen) { this._closeShop(); this._openShop(); }
    });

    // Ability cooldown / active state updates from GameScene
    this.game.events.on('ability-update', (state) => {
      this.abilityState = state;
      this._redraw();
    });

    // ── Shop modal ────────────────────────────────────────────────────────
    this._shopOpen = false;
    this._shopObjs = [];
    this.game.events.on('open-shop', () => {
      if (this._shopOpen) this._closeShop(); else this._openShop();
    });
    this.input.keyboard.on('keydown-ESC', () => { if (this._shopOpen) this._closeShop(); });

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
      'Click to move   |   Arrow keys   |   [Q/W/E] Abilities', {
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
    const IX = this._cx(px);
    const IY = this._cy(py, true);
    const IW = this._cw(pw);
    if (IW <= 0) return;

    // Available content height (below title strip, above bottom frame)
    const avH  = (py + ph - FRAME) - IY;

    // Square at ~87% of the tighter dimension, centered on both axes
    const SIZE = Math.floor(Math.min(IW, avH) * 0.87);
    const mX   = IX + Math.floor((IW  - SIZE) / 2);
    const mY   = IY + Math.floor((avH - SIZE) / 2);
    const scX  = SIZE / MAP_W;
    const scY  = SIZE / MAP_H;

    // Outer shadow ring (depth behind map frame)
    g.fillStyle(0x000000, 0.55);
    g.fillRect(mX - 2, mY - 2, SIZE + 4, SIZE + 4);

    // Base grass
    g.fillStyle(0x2e7d1f, 1);
    g.fillRect(mX, mY, SIZE, SIZE);
    // Checkerboard darker patches
    g.fillStyle(0x246018, 0.5);
    for (let my = 0; my < MAP_H; my += 2) {
      for (let mx = 1 - (my % 2 === 0 ? 0 : 1); mx < MAP_W; mx += 2) {
        g.fillRect(mX + mx * scX, mY + my * scY, scX + 0.5, scY + 0.5);
      }
    }

    // Water strip
    g.fillStyle(0x1a4a8c, 1);
    g.fillRect(mX, mY + (MAP_H - 4) * scY, SIZE, 4 * scY + 1);
    // Water shimmer
    g.fillStyle(0x2a5aae, 0.4);
    g.fillRect(mX, mY + (MAP_H - 3) * scY, SIZE, scY);

    // Paths (cross through town)
    const midY = Math.floor(MAP_H / 2);
    const midX = Math.floor(MAP_W / 2);
    g.fillStyle(0xb09460, 1);
    g.fillRect(mX,              mY + midY * scY, SIZE,              Math.max(1.5, scY));
    g.fillRect(mX + midX * scX, mY,              Math.max(1.5, scX), SIZE);
    // Path highlight
    g.fillStyle(0xc8a870, 0.4);
    g.fillRect(mX, mY + midY * scY, SIZE, Math.max(1, scY * 0.5));

    // Player marker — 8×8 white halo + 4×4 gold centre
    const pdx = mX + this.state.playerTileX * scX;
    const pdy = mY + this.state.playerTileY * scY;
    g.fillStyle(0x000000, 0.50);
    g.fillRect(pdx - 5, pdy - 5, 10, 10);   // drop-shadow
    g.fillStyle(0xffffff, 0.92);
    g.fillRect(pdx - 4, pdy - 4, 8, 8);
    g.fillStyle(GOLD_INNER, 1);
    g.fillRect(pdx - 2, pdy - 2, 4, 4);

    // Inner map frame — brighter than panel border, gives contained look
    g.lineStyle(1, 0x000000, 0.6);           // dark outer ring
    g.strokeRect(mX - 1, mY - 1, SIZE + 2, SIZE + 2);
    g.lineStyle(2, GOLD_INNER, 0.65);        // bright gold frame
    g.strokeRect(mX, mY, SIZE, SIZE);
    g.lineStyle(1, GOLD_INNER, 0.20);        // soft inner highlight
    g.strokeRect(mX + 1, mY + 1, SIZE - 2, SIZE - 2);
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

      const locked  = sk.locked ?? false;
      const live    = locked ? null : this.state.skills?.[sk.key];
      const lv      = live?.level  ?? (sk.lv ?? 1);
      const xpF     = live?.xpFrac ?? 0;
      const rowIcon = locked ? '🔒' : sk.icon;

      if (locked) {
        // Locked: very dim, clearly secondary
        this._text(IX, IY, `${rowIcon}  ${sk.name}`, {
          fontFamily: FONT_VT, fontSize: `${this._fs(14)}px`, color: '#1e1510',
        }).setAlpha(0.55);
        this._text(px + pw - FRAME - 8, IY, '--', {
          fontFamily: FONT_VT, fontSize: `${this._fs(14)}px`, color: '#1e1510',
        }).setOrigin(1, 0).setAlpha(0.55);
      } else {
        // Active skill
        const hasXp = xpF > 0;
        this._text(IX, IY, `${rowIcon}  ${sk.name}`, {
          fontFamily: FONT_VT, fontSize: `${this._fs(15)}px`, color: SKILL_STR,
        });
        this._text(px + pw - FRAME - 8, IY, `${lv}`, {
          fontFamily: FONT_VT, fontSize: `${this._fs(16)}px`, color: GOLD_STR,
        }).setOrigin(1, 0);

        // XP bar — brighter fill for skills with actual progress
        const barColL = hasXp ? 0xa07828 : 0x5a3c10;
        const barColR = hasXp ? 0xd4ac50 : 0x8a6020;
        this._thinBar(IX, IY + XP_Y, IW, XP_H, xpF * 100, 100, barColL, barColR);
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
    const LINE_H  = 15;
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
        fontFamily: FONT_VT, fontSize: `${this._fs(14)}px`, color: col,
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

    // Row 0 — item slots 1–6 (dimmed: darker overlay over empty slots)
    for (let col = 0; col < COLS; col++) {
      const sx = startX + col * (sz + SLOT_GAP);
      this._slot(sx, startY, sz, `${col + 1}`, '', false);
      g.fillStyle(0x000000, 0.28);
      g.fillRect(sx + 1, startY + 1, sz - 2, sz - 2);
    }

    // Row 1 — ability slots Q W E R T Y
    for (let col = 0; col < COLS; col++) {
      const key    = ABILITY_KEYS[col];
      const locked = ABILITY_LOCKED[col];
      const ab     = this.abilityState[key] ?? { cooldownRemaining: 0, isActive: false };
      const onCD   = !locked && ab.cooldownRemaining > 0;
      const active = !locked && ab.isActive;
      const sx     = startX + col * (sz + SLOT_GAP);
      const sy     = startY + sz + ROW_GAP;

      this._slot(sx, sy, sz, key, ABILITY_ICONS[col], locked);

      // Cooldown dim overlay + countdown text
      if (onCD) {
        g.fillStyle(0x000000, 0.62);
        g.fillRect(sx + 1, sy + 1, sz - 2, sz - 2);
        const secs = Math.ceil(ab.cooldownRemaining / 1000);
        this._text(sx + sz / 2, sy + sz / 2, `${secs}s`, {
          fontFamily: FONT_PS8, fontSize: `${this._fs(6)}px`, color: '#cccccc',
        }).setOrigin(0.5, 0.5);
      }

      // Active glow border
      if (active) {
        const acCol = ABILITY_ACTIVE_COL[col];
        g.lineStyle(2, acCol, 0.90);
        g.strokeRect(sx - 1, sy - 1, sz + 2, sz + 2);
        g.lineStyle(1, acCol, 0.40);
        g.strokeRect(sx - 3, sy - 3, sz + 6, sz + 6);
      }
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
      this._text(sx + EQ_SZ / 2, sy + EQ_SZ / 2, icon, {
        fontFamily: 'serif', fontSize: occ ? `${this._fs(14)}px` : `${this._fs(11)}px`, color: '#ffffff',
      }).setOrigin(0.5, 0.5).setAlpha(occ ? 1 : 0.12);
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
          const fs = Math.max(10, Math.floor(INV_SZ * 0.50));
          this._text(sx + INV_SZ / 2, sy + INV_SZ / 2, def.icon ?? '?', {
            fontFamily: 'serif', fontSize: `${fs}px`, color: '#ffffff',
          }).setOrigin(0.5, 0.5);
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
        const fs    = Math.max(this._fs(14), Math.floor(sz * 0.50));
        this._text(sx + sz / 2, sy + sz / 2, icon, {
          fontFamily: 'serif', fontSize: `${fs}px`, color: '#ffffff',
        }).setOrigin(0.5, 0.5).setAlpha(occ ? 1 : (future ? 0.10 : 0.20));
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

    this._text(px + Math.floor(pw / 2), goldY + Math.floor(GOLD_H / 2),
      `🪙  ${coins.toLocaleString()}`, {
        fontFamily: FONT_VT, fontSize: `${this._fs(18)}px`, color: '#e8c060',
      }).setOrigin(0.5, 0.5);
  }

  // ── Inventory panel (inventory grid only) ─────────────────────────────────────

  _drawInvPanel(px, py, pw, ph) {
    const g   = this.gfx;
    const inv = this.state.inventory ?? [];

    const COLS = 8, ROWS = 5, GAP = 2;

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
          const fs = Math.max(this._fs(12), Math.floor(sz * 0.52));
          this._text(sx + sz / 2, sy + sz / 2, def.icon ?? '?', {
            fontFamily: 'serif', fontSize: `${fs}px`, color: '#ffffff',
          }).setOrigin(0.5, 0.5);
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
}
