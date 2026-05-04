import Phaser from 'phaser';
import { TOP_H, BOTTOM_H, RIGHT_W, GAP, MARGIN, MAP_W, MAP_H } from './GameScene.js';
import ITEMS_DATA from '../data/items.json';

// ── Design constants ──────────────────────────────────────────────────────────
const FRAME   = 6;   // px from panel edge to inner content on each side
const TITLE_H = 24;  // title-strip height inside each panel

// ── Colour values ─────────────────────────────────────────────────────────────
const BRONZE_OUTER = 0x8a6a20;  // outer frame ring
const BRONZE_GAP   = 0x060810;  // dark ring between outer and inner
const GOLD_INNER   = 0xc9a84c;  // inner 1 px ring + text
const NAVY_DEEP    = 0x070b1c;  // main panel bg (outermost fill)
const NAVY_MID     = 0x0d1230;  // inset fill (creates depth)
const NAVY_TOP     = 0x060918;  // top-bar bg
const TITLE_L      = 0x141e3c;  // title strip left (lighter)
const TITLE_R      = 0x0c1428;  // title strip right (darker)
const SLOT_EDGE    = 0x0a0804;  // slot outer ring
const SLOT_MID     = 0x130c06;
const SLOT_INNER   = 0x1a1108;
const SLOT_CENTER  = 0x1e1608;
const SLOT_BORDER  = 0x6a4a18;
const HP_TRACK     = 0x1a0808;
const HP_TRACK_BDR = 0x3a0808;
const HP_RED_L     = 0x7a1010;
const HP_RED_M     = 0xcc2222;
const HP_RED_R     = 0xee2020;
const EQ_BG        = 0x0e1535;
const EQ_BDR       = 0x2a3468;
const INV_BG       = 0x1c1008;
const INV_BDR      = 0x5a3518;

const GOLD_STR    = '#c9a84c';
const SKILL_STR   = '#9098a8';
const DIM_STR     = '#505868';
const RED_STR     = '#cc4444';
const COIN_STR    = '#e8c060';

const FONT_PS8 = '"Press Start 2P", monospace';
const FONT_VT  = 'VT323, monospace';

// Bottom bar fixed column widths
const INFO_W = 300;
const GEAR_W = 300;

const SKILLS = [
  { key: 'attack',      name: 'Attack',    icon: '⚔',  lv: 1  },
  { key: 'strength',    name: 'Strength',  icon: '💪', lv: 1  },
  { key: 'defence',     name: 'Defence',   icon: '🛡',  lv: 1  },
  { key: 'hitpoints',   name: 'Hitpoints', icon: '❤',  lv: 10 },
  { key: 'woodcutting', name: 'Woodcut',   icon: '🌲', lv: 1  },
  { key: 'mining',      name: 'Mining',    icon: '⛏',  lv: 1  },
  { key: 'fishing',     name: 'Fishing',   icon: '🎣', lv: 1  },
  { key: 'cooking',     name: 'Cooking',   icon: '🍳', lv: 1  },
];

const ABILITY_ICONS = ['🛡', '⚔', '⚡', '🔒', '🔒'];
const ABILITY_KEYS  = ['Q', 'W', 'E', 'R', 'T'];

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
    this.chatLog = [
      '⚔  Welcome to GRIMFELL!',
      '🖱  Click to move.',
      '🎮  Arrow keys also work.',
    ];
    this.hotbar = [null, null, null, null, null];

    // Initial / zone-change state (also keeps minimap player dot in sync)
    this.game.events.on('game-state', (data) => {
      Object.assign(this.state, data);
      this._redraw();
    });

    // Live combat / XP updates from GameScene — refreshes HP + skill levels
    this.game.events.on('player-update', (data) => {
      console.log('player-update received', data.skills);
      Object.assign(this.state, data);
      this._redraw();
    });

    // "Saved!" confirmation flash — registered exactly once with a flag guard
    if (!this._saveListenerAdded) {
      this._saveListenerAdded = true;
      this.game.events.on('save-complete', () => {
        const W   = this.scale.width;
        const txt = this.add.text(W - 200, TOP_H / 2 - 14, 'Saved!', {
          fontFamily: FONT_PS8, fontSize: '6px', color: '#44cc44',
        }).setOrigin(0.5).setDepth(20);
        this.tweens.add({
          targets: txt, y: TOP_H / 2 - 24, alpha: 0, duration: 1300,
          ease: 'Power2', onComplete: () => txt.destroy(),
        });
      });
    }

    this.scale.on('resize', () => this._redraw());
    this._redraw();
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
    this._drawTopBar(W);
    this._drawSidebar(W, H);
    this._drawBottomBar(W, H);
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  PRIMITIVE HELPERS
  // ════════════════════════════════════════════════════════════════════════════

  _add(obj)         { this._objs.push(obj); return obj; }
  _text(x, y, s, t) { return this._add(this.add.text(x, y, s, t).setDepth(5)); }

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
      fontFamily: FONT_PS8, fontSize: '7px', color: GOLD_STR,
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
    g.fillStyle(0x0a0e18, 1);
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
      g.lineStyle(1, 0xffd070, 0.10);
      g.lineBetween(sx + 1, sy + 1, sx + sz - 1, sy + 1);
      g.lineBetween(sx + 1, sy + 1, sx + 1, sy + sz - 1);
    }

    // Key / number label
    if (label) {
      this._text(sx + 3, sy + 2, label, {
        fontFamily: FONT_PS8, fontSize: '6px',
        color: locked ? '#2a1606' : '#9a6e18',
      });
    }

    // Icon
    if (icon) {
      const fs = Math.max(14, Math.floor(sz * 0.45));
      this._text(sx + sz / 2, sy + sz / 2, icon, {
        fontFamily: 'serif', fontSize: `${fs}px`,
        color: locked ? '#2a2010' : '#ffffff',
      }).setOrigin(0.5, 0.5).setAlpha(locked ? 0.25 : 1);
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  TOP BAR
  // ════════════════════════════════════════════════════════════════════════════

  _drawTopBar(W) {
    const g = this.gfx;

    // Background
    g.fillStyle(NAVY_TOP, 1);
    g.fillRect(0, 0, W, TOP_H);
    // Subtle top sheen
    g.fillStyle(0xffffff, 0.03);
    g.fillRect(0, 0, W, Math.floor(TOP_H / 2));

    // Outer bronze bottom band (2 px)
    g.fillStyle(BRONZE_OUTER, 1);
    g.fillRect(0, TOP_H - 2, W, 2);
    // Gold inner line
    g.lineStyle(1, GOLD_INNER, 0.9);
    g.lineBetween(0, TOP_H - 3, W, TOP_H - 3);
    // Dark shadow below bar
    g.fillStyle(0x000000, 0.4);
    g.fillRect(0, TOP_H, W, 3);

    // Top gold hairline
    g.lineStyle(1, GOLD_INNER, 0.3);
    g.lineBetween(0, 0, W, 0);

    // Left & right edge diamond accents (at bar bottom)
    this._diamonds(0, TOP_H, 0, 0, 5);  // TL corner of bottom edge
    this._diamonds(W, TOP_H, 0, 0, 5);  // TR corner

    // ── Title ──
    this._text(16, TOP_H / 2, '⚔  GRIMFELL', {
      fontFamily: FONT_PS8, fontSize: '13px', color: GOLD_STR,
    }).setOrigin(0, 0.5);

    // ── Hints ──
    this._text(W / 2, TOP_H / 2,
      'Click to move   |   Arrow keys   |   [Q/W/E] Abilities', {
        fontFamily: FONT_VT, fontSize: '16px', color: DIM_STR,
      }).setOrigin(0.5);

    // ── SAVE button ──
    const saveBtn = this._add(
      this.add.text(W - 200, TOP_H / 2, '💾 SAVE', {
        fontFamily: FONT_VT, fontSize: '18px', color: GOLD_STR,
      }).setOrigin(0.5).setDepth(5).setInteractive({ useHandCursor: true })
    );
    saveBtn.on('pointerover',  () => saveBtn.setStyle({ color: '#e8c060' }));
    saveBtn.on('pointerout',   () => saveBtn.setStyle({ color: GOLD_STR }));
    saveBtn.on('pointerdown',  () => this.game.events.emit('ui-save'));

    // ── LOGOUT button ──
    const logoutBtn = this._add(
      this.add.text(W - 78, TOP_H / 2, '⏎ LOGOUT', {
        fontFamily: FONT_VT, fontSize: '18px', color: '#cc4444',
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
    const SX = W - RIGHT_W - MARGIN;
    const SY = TOP_H + MARGIN;
    const SH = H - TOP_H - BOTTOM_H - MARGIN * 2 - GAP;

    // Sidebar bg strip (left border only — sub-panels provide the ornate frames)
    this.gfx.fillStyle(0x060b1c, 1);
    this.gfx.fillRect(SX, SY, RIGHT_W, SH);
    // Left gold divider line
    this.gfx.lineStyle(2, GOLD_INNER, 0.8);
    this.gfx.lineBetween(SX, SY, SX, SY + SH);

    const MAP_PANEL_H = 180;  // minimap fixed height; skills fills the rest

    // Minimap panel (fixed height)
    const MP = { x: SX + GAP, y: SY + GAP, w: RIGHT_W - GAP * 2, h: MAP_PANEL_H - GAP };
    this._panel(MP.x, MP.y, MP.w, MP.h, 'MINIMAP');
    this._drawMinimap(MP.x, MP.y, MP.w, MP.h);

    // Skills panel (fills remaining sidebar height)
    const SP = { x: SX + GAP, y: SY + MAP_PANEL_H + GAP, w: RIGHT_W - GAP * 2, h: SH - MAP_PANEL_H - GAP * 2 };
    this._panel(SP.x, SP.y, SP.w, SP.h, 'SKILLS & XP');
    this._drawSkills(SP.x, SP.y, SP.w, SP.h);
  }

  // ── Minimap content ────────────────────────────────────────────────────────

  _drawMinimap(px, py, pw, ph) {
    const g = this.gfx;
    const IX = this._cx(px);
    const IY = this._cy(py, true);
    const IW = this._cw(pw);
    const IH = (py + ph) - IY - FRAME - 2;
    if (IW <= 0 || IH <= 0) return;

    const scX = IW / MAP_W;
    const scY = IH / MAP_H;

    // Base grass
    g.fillStyle(0x2e7d1f, 1);
    g.fillRect(IX, IY, IW, IH);
    // Checkerboard darker patches
    g.fillStyle(0x246018, 0.5);
    for (let my = 0; my < MAP_H; my += 2) {
      for (let mx = 1 - (my % 2 === 0 ? 0 : 1); mx < MAP_W; mx += 2) {
        g.fillRect(IX + mx * scX, IY + my * scY, scX + 0.5, scY + 0.5);
      }
    }

    // Water strip
    g.fillStyle(0x1a4a8c, 1);
    g.fillRect(IX, IY + (MAP_H - 4) * scY, IW, 4 * scY + 1);
    // Water shimmer
    g.fillStyle(0x2a5aae, 0.4);
    g.fillRect(IX, IY + (MAP_H - 3) * scY, IW, scY);

    // Paths
    const midY = Math.floor(MAP_H / 2);
    const midX = Math.floor(MAP_W / 2);
    g.fillStyle(0xb09460, 1);
    g.fillRect(IX,              IY + midY * scY, IW,        Math.max(1.5, scY));
    g.fillRect(IX + midX * scX, IY,              Math.max(1.5, scX), IH);
    // Path highlight
    g.fillStyle(0xc8a870, 0.4);
    g.fillRect(IX,              IY + midY * scY, IW, Math.max(1, scY * 0.5));

    // Player dot
    const pdx = IX + this.state.playerTileX * scX;
    const pdy = IY + this.state.playerTileY * scY;
    g.fillStyle(0xffffff, 0.9);
    g.fillRect(pdx - 3, pdy - 3, 6, 6);
    g.fillStyle(GOLD_INNER, 1);
    g.fillRect(pdx - 1.5, pdy - 1.5, 3, 3);

    // Map border
    g.lineStyle(1, GOLD_INNER, 0.35);
    g.strokeRect(IX, IY, IW, IH);
  }

  // ── Skills content ─────────────────────────────────────────────────────────

  _drawSkills(px, py, pw, ph) {
    const IX = this._cx(px);
    const IW = this._cw(pw);
    let IY = this._cy(py, true);
    const g = this.gfx;

    // HP bar
    this._hpBar(IX, IY, IW, this.state.hp, this.state.maxHp);
    IY += 14;
    this._text(IX, IY, `❤  ${this.state.hp} / ${this.state.maxHp}`, {
      fontFamily: FONT_VT, fontSize: '15px', color: '#dd3333',
    });
    IY += 16;

    this._text(IX, IY, 'Combat Lv. 1   Bonus +0', {
      fontFamily: FONT_VT, fontSize: '13px', color: DIM_STR,
    });
    IY += 12;

    // Divider
    g.lineStyle(1, GOLD_INNER, 0.18);
    g.lineBetween(px + FRAME, IY + 3, px + pw - FRAME, IY + 3);
    IY += 8;

    // Skill rows — use real level / xpFrac from player-update if available
    const ROW_H = 22;
    for (const sk of SKILLS) {
      if (IY + ROW_H > py + ph - FRAME - 2) break;
      const live = this.state.skills?.[sk.key];
      const lv   = live?.level  ?? sk.lv;
      const xpF  = live?.xpFrac ?? 0;

      this._text(IX, IY, `${sk.icon}  ${sk.name}`, {
        fontFamily: FONT_VT, fontSize: '15px', color: SKILL_STR,
      });
      this._text(px + pw - FRAME - 8, IY, `${lv}`, {
        fontFamily: FONT_VT, fontSize: '16px', color: GOLD_STR,
      }).setOrigin(1, 0);

      // XP progress bar filled proportionally to next level
      this._thinBar(IX, IY + 16, IW, 3, xpF * 100, 100, 0x7a5818, GOLD_INNER);
      IY += ROW_H;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  BOTTOM BAR  — ONE connected ornate frame, three interior columns
  // ════════════════════════════════════════════════════════════════════════════

  _drawBottomBar(W, H) {
    const BY  = H - BOTTOM_H - MARGIN;
    const g   = this.gfx;

    // Single ornate outer frame for the entire bottom bar
    this._frame(MARGIN, BY, W - MARGIN * 2, BOTTOM_H);

    // Content area inside the frame
    const cX  = MARGIN + FRAME;
    const cY  = BY + FRAME;
    const cW  = W - MARGIN * 2 - FRAME * 2;
    const cH  = BOTTOM_H - FRAME * 2;

    const CEN = cW - INFO_W - GEAR_W;

    const infoX   = cX;
    const actionX = cX + INFO_W;
    const gearX   = cX + INFO_W + CEN;

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
      { x: infoX,   w: INFO_W, label: 'STATUS' },
      { x: actionX, w: CEN,    label: 'ACTIONS' },
      { x: gearX,   w: GEAR_W, label: 'GEAR' },
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

    this._drawInfoPanel  (infoX,   contentY, INFO_W, contentH);
    this._drawActionBar  (actionX, contentY, CEN,    contentH);
    this._drawGearPanel  (gearX,   contentY, GEAR_W, contentH);
  }

  // ── STATUS section content ─────────────────────────────────────────────────

  _drawInfoPanel(px, py, pw, ph) {
    const IX = px + 8;
    let IY = py + 4;
    const g = this.gfx;

    // Zone
    this._text(IX, IY, `🌍  ${this.state.zone}`, {
      fontFamily: FONT_PS8, fontSize: '6px', color: GOLD_STR,
    });
    IY += 14;

    // Coins
    this._text(IX, IY, `🪙  ${this.state.coins}`, {
      fontFamily: FONT_VT, fontSize: '17px', color: COIN_STR,
    });
    IY += 18;

    // HP bar
    this._hpBar(IX, IY, pw - 18, this.state.hp, this.state.maxHp);
    IY += 15;

    // Divider
    g.lineStyle(1, GOLD_INNER, 0.15);
    g.lineBetween(px + 4, IY + 1, px + pw - 4, IY + 1);
    IY += 5;

    // Chat log — last 5 messages
    for (const msg of this.chatLog.slice(-5)) {
      if (IY >= py + ph - 2) break;
      this._text(IX, IY, msg, {
        fontFamily: FONT_VT, fontSize: '13px', color: DIM_STR,
        wordWrap: { width: pw - 16 },
      });
      IY += 13;
    }
  }

  // ── ACTIONS section content ────────────────────────────────────────────────

  _drawActionBar(px, py, pw, ph) {
    // Scale slots to fill width nicely
    const MAX_SLOT = 56;
    const sz      = Math.min(MAX_SLOT, Math.floor((pw - 20) / 5));
    const spacing = Math.floor((pw - 5 * sz) / 6);
    const startX  = px + spacing;
    const rows    = 2 * sz + 6;
    const startY  = py + Math.max(4, Math.floor((ph - rows) / 2));

    const rowDefs = [
      { labels: ['1','2','3','4','5'], icons: this.hotbar.map(() => '') },
      { labels: ABILITY_KEYS,         icons: ABILITY_ICONS              },
    ];

    for (let row = 0; row < 2; row++) {
      const RY = startY + row * (sz + 6);
      for (let col = 0; col < 5; col++) {
        const SX     = startX + col * (sz + spacing);
        const locked = row === 1 && col >= 3;
        this._slot(SX, RY, sz, rowDefs[row].labels[col], rowDefs[row].icons[col], locked);
      }
    }
  }

  // ── GEAR section content ───────────────────────────────────────────────────

  _drawGearPanel(px, py, pw, ph) {
    const IX  = px + 8;
    let   IY  = py + 4;
    const g   = this.gfx;
    const gear = this.state.gear      ?? {};
    const inv  = this.state.inventory ?? [];

    // Equipment slot order and placeholder icons
    const EQ_ORDER = ['weapon','shield','head','body','legs','boots','tool'];
    const EQ_ICONS = { weapon:'🗡️',shield:'🛡️',head:'⛑️',body:'👕',legs:'👖',boots:'👟',tool:'🪓' };
    const EQ_COLS = 4, EQ_SZ = 44, EQ_GAP = 3;

    for (let i = 0; i < EQ_ORDER.length; i++) {
      const slotId   = EQ_ORDER[i];
      const itemKey  = gear[slotId] ?? null;
      const itemDef  = itemKey ? ITEMS_DATA[itemKey] : null;
      const icon     = itemDef?.icon ?? EQ_ICONS[slotId];
      const occupied = !!itemKey;
      const row = Math.floor(i / EQ_COLS);
      const col = i % EQ_COLS;
      const sx  = IX + col * (EQ_SZ + EQ_GAP);
      const sy  = IY + row * (EQ_SZ + EQ_GAP);

      // Slot background layers
      g.fillStyle(0x060810, 1);
      g.fillRect(sx - 1, sy - 1, EQ_SZ + 2, EQ_SZ + 2);
      g.fillStyle(occupied ? 0x111e38 : EQ_BG, 1);
      g.fillRect(sx, sy, EQ_SZ, EQ_SZ);
      g.fillStyle(0x121838, 1);
      g.fillRect(sx + 2, sy + 2, EQ_SZ - 4, EQ_SZ - 4);
      // Border — gold when occupied, dim when empty
      g.lineStyle(1, occupied ? GOLD_INNER : EQ_BDR, occupied ? 0.7 : 1);
      g.strokeRect(sx, sy, EQ_SZ, EQ_SZ);
      g.lineStyle(1, GOLD_INNER, 0.18);
      g.strokeRect(sx + 2, sy + 2, EQ_SZ - 4, EQ_SZ - 4);
      // Top-left bevel
      g.lineStyle(1, GOLD_INNER, 0.15);
      g.lineBetween(sx + 1, sy + 1, sx + EQ_SZ - 1, sy + 1);
      // Icon — full alpha if equipped, very faint placeholder if empty
      this._text(sx + EQ_SZ / 2, sy + EQ_SZ / 2, icon, {
        fontFamily: 'serif', fontSize: occupied ? '16px' : '14px', color: '#ffffff',
      }).setOrigin(0.5, 0.5).setAlpha(occupied ? 1 : 0.13);
    }

    const eqRows = Math.ceil(EQ_ORDER.length / EQ_COLS);  // 2
    IY += eqRows * (EQ_SZ + EQ_GAP) + 6;

    // Divider
    g.lineStyle(1, GOLD_INNER, 0.22);
    g.lineBetween(px + 4, IY, px + pw - 4, IY);
    IY += 5;

    // Inventory: 5 cols × as many rows as fit in remaining height
    const INV_SZ  = 38, INV_GAP = 3;
    const INV_COLS = 5;
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < INV_COLS; c++) {
        const sy = IY + r * (INV_SZ + INV_GAP);
        if (sy + INV_SZ > py + ph - 2) break;
        const sx    = IX + c * (INV_SZ + INV_GAP);
        const idx   = r * INV_COLS + c;
        const slot  = inv[idx] ?? null;
        const def   = slot ? (ITEMS_DATA[slot.item] ?? null) : null;

        // Slot background
        g.fillStyle(0x050301, 1); g.fillRect(sx - 1, sy - 1, INV_SZ + 2, INV_SZ + 2);
        g.fillStyle(0x0e0906, 1); g.fillRect(sx, sy, INV_SZ, INV_SZ);
        g.fillStyle(INV_BG, 1);   g.fillRect(sx + 2, sy + 2, INV_SZ - 4, INV_SZ - 4);
        g.lineStyle(1, slot ? 0x6a4a22 : INV_BDR, 0.75);
        g.strokeRect(sx, sy, INV_SZ, INV_SZ);
        g.lineStyle(1, 0xffd070, 0.06);
        g.lineBetween(sx + 1, sy + 1, sx + INV_SZ - 1, sy + 1);

        if (def) {
          // Item icon centred in slot
          this._text(sx + INV_SZ / 2, sy + INV_SZ / 2, def.icon ?? '?', {
            fontFamily: 'serif', fontSize: '13px', color: '#ffffff',
          }).setOrigin(0.5, 0.5);
          // Quantity badge bottom-right (only if > 1)
          if (slot.qty > 1) {
            this._text(sx + INV_SZ - 1, sy + INV_SZ - 1, `${slot.qty}`, {
              fontFamily: FONT_VT, fontSize: '11px', color: '#d4a840',
            }).setOrigin(1, 1);
          }
        }
      }
    }
  }
}
