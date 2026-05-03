import { Application, Graphics, Text, TextStyle, Container, Sprite } from 'pixi.js';
import { CW, CH, TS, T, TCOL, TEDGE } from '../../shared/constants.js';
import { currentZone, MDEFS, ITEMS, RDEFS, resources, zoom } from '../core/state.js';
import { toolBonus } from '../systems/GatherSystem.js';
import { loadAtlas, getSpriteTexture } from './SpriteSheet.js';

// ── Pixi app singletons ───────────────────────────────────────────────────────
export let app;
let gfx;          // single Graphics object, cleared every frame
let spriteLayer;  // Container for pooled Sprite objects (between gfx and text)
let textLayer;    // Container for pooled Text objects

// ── Sprite pool ───────────────────────────────────────────────────────────────
const _sp   = [];   // pooled Sprite objects
let   _spIdx = 0;

function _getSprite() {
  if (_spIdx >= _sp.length) {
    const s = new Sprite();
    s.visible = false;
    spriteLayer.addChild(s);
    _sp.push(s);
  }
  return _sp[_spIdx++];
}

// Draw a sprite frame centered on the tile at (px, py) in screen-space.
// Returns true if the texture existed and was drawn, false if the caller
// should draw its colored-rect fallback instead.
function _trySprite(name, px, py, w = TS, h = TS) {
  const tex = getSpriteTexture(name);
  if (!tex) return false;
  const s = _getSprite();
  s.texture = tex;
  s.x = px + (TS - w) / 2;
  s.y = py + (TS - h) / 2;
  s.width  = w;
  s.height = h;
  s.alpha  = 1;
  s.visible = true;
  return true;
}

// ── Text pool ─────────────────────────────────────────────────────────────────
const _pool  = [];
let   _pidx  = 0;

const PS8 = '"Press Start 2P", monospace';
const VT  = 'VT323, monospace';

const ST = {
  label:     new TextStyle({ fontFamily: PS8, fontSize: 8,  fill: '#f0c050' }),
  level:     new TextStyle({ fontFamily: PS8, fontSize: 8,  fill: '#f0c050' }),
  player:    new TextStyle({ fontFamily: PS8, fontSize: 11, fill: '#ffffff', fontWeight: 'bold' }),
  map:       new TextStyle({ fontFamily: PS8, fontSize: 8,  fill: '#505868' }),
  zone:      new TextStyle({ fontFamily: PS8, fontSize: 10, fill: '#cc88ff' }),
  dummy:     new TextStyle({ fontFamily: PS8, fontSize: 7,  fill: '#e09030', fontWeight: 'bold' }),
  aggro:     new TextStyle({ fontFamily: VT,  fontSize: 11, fill: '#ff3838', fontWeight: 'bold' }),
  dunglabel: new TextStyle({ fontFamily: PS8, fontSize: 7,  fill: '#aa70ff' }),
  loot:      new TextStyle({ fontFamily: 'serif', fontSize: 14, fill: '#ffffff' }),
  gather:    new TextStyle({ fontFamily: VT,  fontSize: 15, fill: '#f0c050', fontWeight: 'bold' }),
  hotkey:    new TextStyle({ fontFamily: PS8, fontSize: 6,  fill: '#606070' }),
  hoticon:   new TextStyle({ fontFamily: 'serif', fontSize: 18, fill: '#ffffff' }),
  hotqty:    new TextStyle({ fontFamily: VT,  fontSize: 12, fill: '#f0c050' }),
  hothint:   new TextStyle({ fontFamily: PS8, fontSize: 6,  fill: '#d0b060' }),
};

const _floatStyles = new Map();
function floatST(color) {
  if (!_floatStyles.has(color))
    _floatStyles.set(color, new TextStyle({ fontFamily: VT, fontSize: 13, fill: color, fontWeight: 'bold' }));
  return _floatStyles.get(color);
}

function _get() {
  if (_pidx >= _pool.length) {
    const t = new Text({ text: ' ', style: ST.label });
    t.visible = false;
    textLayer.addChild(t);
    _pool.push(t);
  }
  return _pool[_pidx++];
}

// Place a pooled Text object. ax/ay are anchor (0=left/top, 0.5=center, 1=right/bottom).
function _t(str, x, y, style, ax = 0, ay = 0, alpha = 1) {
  const t = _get();
  if (t.text !== str)     t.text  = str;
  if (t.style !== style)  t.style = style;
  if (t.anchor.x !== ax || t.anchor.y !== ay) t.anchor.set(ax, ay);
  t.x = x; t.y = y; t.alpha = alpha; t.visible = true;
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
export async function initPixi(canvas) {
  app = new Application();
  await app.init({
    canvas,
    width:           CW,
    height:          CH,
    antialias:       false,
    resolution:      1,
    autoDensity:     false,
    backgroundColor: 0x000000,
    autoStart:       false,
  });
  app.ticker.stop();

  // Stage order: shapes → sprites → text (sprites sit above rects, labels above both)
  gfx = new Graphics();
  app.stage.addChild(gfx);

  spriteLayer = new Container();
  app.stage.addChild(spriteLayer);

  textLayer = new Container();
  app.stage.addChild(textLayer);

  // Load atlas in the background — missing file just leaves getSpriteTexture returning null.
  // publicDir:'assets' in vite.config.js strips the 'assets/' prefix from URLs.
  loadAtlas('/sprites/sprites.json');
}

export function beginFrame() {
  gfx.clear();
  _pidx  = 0;
  _spIdx = 0;
  for (let i = 0; i < _pool.length; i++) _pool[i].visible  = false;
  for (let i = 0; i < _sp.length;   i++) _sp[i].visible    = false;
  app.stage.scale.set(zoom);
}

export function endFrame() {
  app.renderer.render(app.stage);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function ox(wx, cam) { return wx * TS - cam.x; }
function oy(wy, cam) { return wy * TS - cam.y; }
function vis(sx, sy)  { return sx + TS >= 0 && sx < CW / zoom && sy + TS >= 0 && sy < CH / zoom; }

// ── Tile variation — deterministic hash from world coords ─────────────────────
function _th(tx, ty) {
  return (((tx * 73856093) ^ (ty * 19349663)) >>> 0) % 1000 / 1000;
}

// ── Tile rendering ─────────────────────────────────────────────────────────────
export function drawTile(x, y, tileType, cam, now) {
  const sx = ox(x, cam), sy = oy(y, cam);
  gfx.rect(sx, sy, TS, TS).fill(TCOL[tileType] || '#333333');
  gfx.rect(sx, sy, TS, 1).fill(TEDGE[tileType] || '#222222');
  gfx.rect(sx, sy, 1, TS).fill(TEDGE[tileType] || '#222222');

  const h = _th(x, y);

  if (tileType === T.GRASS) {
    // Subtle darker/lighter patches on every ~3rd tile
    if (h < 0.33) {
      gfx.rect(sx + 4 + (h * 83 | 0) % 14, sy + 5 + (h * 61 | 0) % 14, 14, 10)
         .fill({ color: '#386028', alpha: 0.45 });
    } else if (h > 0.67) {
      gfx.rect(sx + 6 + (h * 71 | 0) % 12, sy + 8 + (h * 53 | 0) % 12, 13, 9)
         .fill({ color: '#5aaa58', alpha: 0.35 });
    }

  } else if (tileType === T.WATER) {
    // Two shimmer bands at different speeds and phases
    const wave  = (now / 900  + x * 0.4 + y * 0.2) % 1;
    const wave2 = (now / 1600 + x * 0.3 + y * 0.5 + 0.5) % 1;
    gfx.rect(sx, sy + wave  * TS, TS, 3).fill({ color: '#88ccff', alpha: 0.22 });
    gfx.rect(sx, sy + wave2 * TS, TS, 2).fill({ color: '#aaddff', alpha: 0.14 });
    // Occasional deep-water darkness
    if (h > 0.55) {
      gfx.rect(sx + 3, sy + 5, 26, 22).fill({ color: '#0e3a90', alpha: 0.10 });
    }

  } else if (tileType === T.MOUNTAIN) {
    // Two rock shapes — shadow base + lighter highlight edge
    const rx1 = sx + 3  + (h * 79 | 0) % 10;
    const ry1 = sy + 8  + (h * 43 | 0) % 10;
    gfx.rect(rx1,     ry1,     9, 6).fill({ color: '#504838', alpha: 0.60 });
    gfx.rect(rx1 + 1, ry1 - 3, 7, 4).fill({ color: '#9a8a78', alpha: 0.55 });
    if (h > 0.38) {
      const rx2 = sx + 14 + (h * 53 | 0) % 10;
      const ry2 = sy + 17 + (h * 67 | 0) % 7;
      gfx.rect(rx2,     ry2,      11, 7).fill({ color: '#504838', alpha: 0.50 });
      gfx.rect(rx2 + 1, ry2 - 3,   9, 4).fill({ color: '#9a8a78', alpha: 0.45 });
    }

  } else if (tileType === T.PATH) {
    // Lighter or darker dirt patches, occasional small pebble
    if (h < 0.30) {
      gfx.rect(sx + 3, sy + 5, 22, 16).fill({ color: '#d8b888', alpha: 0.32 });
    } else if (h > 0.70) {
      gfx.rect(sx + 5, sy + 7, 20, 14).fill({ color: '#a89060', alpha: 0.28 });
    }
    if (h > 0.52 && h < 0.78) {
      gfx.rect(sx + 10 + (h * 97 | 0) % 10, sy + 9 + (h * 67 | 0) % 10, 4, 3)
         .fill({ color: '#908060', alpha: 0.55 });
    }

  } else if (tileType === T.DGRASS) {
    // Dense shadow patches + occasional sunlit gap
    if (h < 0.40) {
      gfx.rect(
        sx + 4 + (h * 73 | 0) % 13,
        sy + 4 + (h * 59 | 0) % 13,
        12 + (h * 47 | 0) % 8,
         9 + (h * 31 | 0) % 6,
      ).fill({ color: '#1e4016', alpha: 0.50 });
    }
    if (h > 0.62) {
      gfx.rect(sx + 8 + (h * 61 | 0) % 10, sy + 10 + (h * 47 | 0) % 10, 10, 8)
         .fill({ color: '#4a9040', alpha: 0.28 });
    }

  } else if (tileType === T.SAND) {
    // Warm lighter/darker variation per tile
    if (h < 0.35) {
      gfx.rect(sx + 4, sy + 6, 22, 18).fill({ color: '#e0c890', alpha: 0.30 });
    } else if (h > 0.65) {
      gfx.rect(sx + 6, sy + 8, 20, 14).fill({ color: '#c4a060', alpha: 0.25 });
    }

  } else if (tileType === T.FLOOR) {
    // Stone-paving grid lines + subtle slab highlight
    gfx.rect(sx + 15, sy,      1, TS).fill({ color: '#7a5030', alpha: 0.22 });
    gfx.rect(sx,      sy + 15, TS, 1).fill({ color: '#7a5030', alpha: 0.22 });
    if (h > 0.58) {
      gfx.rect(sx + 1, sy + 1, 13, 13).fill({ color: '#c8a878', alpha: 0.18 });
    }

  } else if (tileType === T.DFLOOR) {
    gfx.rect(sx, sy, TS, TS).fill({ color: '#8040ff', alpha: 0.06 });
  }
}

export function drawMinimap(gameMap, monsters, lootPiles, player, cam, activeResources = []) {
  const MH = gameMap.length, MW = gameMap[0]?.length || 0;
  const mw = 88, mh = 66, mx = CW / zoom - mw - 4, my = 4 / zoom;

  gfx.rect(mx, my, mw, mh).fill({ color: '#000000', alpha: 0.85 });

  for (let y = 0; y < MH; y++) {
    for (let x = 0; x < MW; x++) {
      const t   = gameMap[y]?.[x] ?? 0;
      const col =
        t === T.WATER    ? '#1a58a8' :
        t === T.MOUNTAIN ? '#6a5a48' :
        t === T.WALL     ? '#201410' :
        t === T.DFLOOR   ? '#201828' :
        t === T.PATH     ? '#b09868' :
        t === T.SAND     ? '#c0a870' :
        t === T.DGRASS   ? '#2a5020' :
        t === T.FLOOR    ? '#906848' : '#386028';
      gfx.rect(mx + (x / MW) * mw, my + (y / MH) * mh, mw / MW + 0.5, mh / MH + 0.5).fill(col);
    }
  }

  // Active resource nodes — green dots (safe zone markers)
  activeResources.forEach(r => {
    gfx.rect(mx + (r.x / MW) * mw - 0.5, my + (r.y / MH) * mh - 0.5, 2.5, 2.5).fill('#38b860');
  });

  monsters.forEach(m => {
    gfx.rect(mx + (m.x / MW) * mw, my + (m.y / MH) * mh, 2, 2)
       .fill(m.state === 'aggro' ? '#ff3030' : '#ff8020');
  });

  // Loot piles — gold dots
  lootPiles.forEach(lp => {
    gfx.rect(mx + (lp.x / MW) * mw - 0.5, my + (lp.y / MH) * mh - 0.5, 2.5, 2.5).fill('#f0c050');
  });

  gfx.rect(mx + (player.x / MW) * mw - 1, my + (player.y / MH) * mh - 1, 3, 3).fill('#ffffff');
  gfx.rect(mx, my, mw, mh).stroke({ color: '#444444', width: 1 });

  _t('MAP', mx + mw / 2, my + mh + 2, ST.map, 0.5, 0);
}

// ── Interactables ─────────────────────────────────────────────────────────────
export function drawInteractable(iact, cam, hov, now) {
  const px = ox(iact.x, cam), py = oy(iact.y, cam);
  if (!vis(px, py)) return;

  const LABELS = { bank: 'BANK', shop: 'SHOP', dungeon_entrance: 'DUNGEON', dungeon_exit: 'EXIT' };
  const labelStyle = (iact.type === 'dungeon_entrance' || iact.type === 'dungeon_exit') ? ST.dunglabel : ST.label;

  // Sprite path: draw sprite, generic hover border, and text label, then return.
  if (_trySprite(iact.type, px, py)) {
    if (hov) gfx.rect(px + 2, py + 2, TS - 4, TS - 4).stroke({ color: '#f0c050', width: 2 });
    if (LABELS[iact.type]) _t(LABELS[iact.type], px + TS / 2, py + TS + 2, labelStyle, 0.5, 0);
    return;
  }

  // Colored-rect fallback (unchanged from before).
  if (iact.type === 'bank') {
    gfx.rect(px + 6, py + 8,  20, 20).fill('#6a4018');
    gfx.rect(px + 10, py + 12, 12, 12).fill('#c89030');
    gfx.rect(px + 14, py + 16, 4,  6).fill('#804c20');
    if (hov) gfx.rect(px + 2, py + 2, TS - 4, TS - 4).stroke({ color: '#f0c050', width: 2 });
    _t('BANK', px + TS / 2, py + TS + 2, ST.label, 0.5, 0);

  } else if (iact.type === 'shop') {
    gfx.rect(px + 4,  py + 6,  24, 22).fill('#60308a');
    gfx.rect(px + 8,  py + 4,  16, 6).fill('#8050b8');
    gfx.rect(px + 4,  py + 6,  24, 4).fill('#c89030');
    gfx.rect(px + 10, py + 14, 12, 12).fill('#c8c8b0');
    if (hov) gfx.rect(px + 2, py + 2, TS - 4, TS - 4).stroke({ color: '#f0c050', width: 2 });
    _t('SHOP', px + TS / 2, py + TS + 2, ST.label, 0.5, 0);

  } else if (iact.type === 'campfire') {
    const fl = Math.sin(now / 120) * 2;
    gfx.rect(px + 9, py + 24, 14, 4).fill('#703010');
    gfx.ellipse(px + 16, py + 18 + fl, 6,  8).fill('#ff5800');
    gfx.ellipse(px + 16, py + 20 + fl, 3,  5).fill('#ffb800');
    gfx.ellipse(px + 16, py + 21 + fl, 2,  3).fill('#fff8c0');
    if (hov) gfx.circle(px + 16, py + 20, 13).stroke({ color: '#ffb800', width: 2 });

  } else if (iact.type === 'dungeon_entrance' || iact.type === 'dungeon_exit') {
    gfx.rect(px + 4,  py + 4,  24, 26).fill('#1a1020');
    gfx.rect(px + 10, py + 4,  12, 22).fill('#401860');
    const p = 0.5 + Math.sin(now / 400) * 0.4;
    gfx.rect(px + 12, py + 6,  8,  18).fill({ color: '#aa70ff', alpha: p });
    _t(iact.type === 'dungeon_entrance' ? 'DUNGEON' : 'EXIT', px + TS / 2, py + TS + 2, ST.dunglabel, 0.5, 0);
  }
}

// ── Resources ─────────────────────────────────────────────────────────────────
export function drawResource(res, cam, hov, now) {
  const px = ox(res.x, cam), py = oy(res.y, cam);
  if (!vis(px, py)) return;

  // Sprite path: depleted state gets its own frame name; fall through to rect art if absent.
  const spriteName = res.depleted ? `${res.type}_depleted` : res.type;
  if (_trySprite(spriteName, px, py)) {
    if (hov && !res.depleted) gfx.rect(px + 2, py + 2, TS - 4, TS - 4).stroke({ color: '#f0c050', width: 2 });
    return;
  }

  // Colored-rect fallback.
  if      (res.type === 'tree' || res.type === 'oak') _tree(px, py, res, hov, now);
  else if (res.type.includes('rock'))                 _rock(px, py, res, hov);
  else                                                _fish(px, py, res, hov, now);
}

function _tree(px, py, res, hov, now) {
  if (res.depleted) {
    gfx.rect(px + 13, py + 18, 6, 14).fill('#704818');
    gfx.rect(px + 10, py + 26, 12, 4).fill('#503010');
    return;
  }
  const oak = res.type === 'oak';
  gfx.rect(px + 13, py + 18, 6, 14).fill(oak ? '#704818' : '#583010');
  gfx.circle(px + 16, py + 13, 12).fill(oak ? '#205018' : '#164010');
  gfx.circle(px + 11, py + 10, 8).fill(oak ? '#286828' : '#1e5818');
  gfx.circle(px + 22, py + 11, 7).fill(oak ? '#286828' : '#1e5818');
  gfx.circle(px + 16, py + 7,  7).fill(oak ? '#286828' : '#1e5818');
  if (hov) gfx.circle(px + 16, py + 12, 14).stroke({ color: '#f0c050', width: 2 });
}

function _rock(px, py, res, hov) {
  const iron = res.type === 'iron_rock';
  if (res.depleted) {
    gfx.ellipse(px + 16, py + 24, 9, 4).fill('#555555');
    return;
  }
  gfx.ellipse(px + 16, py + 22, 11, 7).fill(iron ? '#404050' : '#906020');
  gfx.ellipse(px + 13, py + 18, 6,  4).fill(iron ? '#686878' : '#a87030');
  if (hov) gfx.ellipse(px + 16, py + 22, 13, 9).stroke({ color: '#f0c050', width: 2 });
}

function _fish(px, py, res, hov, now) {
  if (res.depleted) return;
  const bob = Math.sin(now / 600 + res.x) * 2;
  gfx.ellipse(px + 16, py + 21 + bob, 8, 3).fill({ color: '#3888cc', alpha: 0.65 });
  gfx.rect(px + 15, py + 12 + bob, 3, 10).fill('#ff4818');
  gfx.rect(px + 13, py + 10 + bob, 6, 3).fill('#ffffff');
  if (hov) gfx.circle(px + 16, py + 18, 12).stroke({ color: '#3888cc', width: 2 });
}

// ── Death beam / glow (shown for 3s after a monster is killed) ────────────────
export function drawDeathFxes(deathFxes, cam, now) {
  deathFxes.forEach(fx => {
    const px = ox(fx.x, cam), py = oy(fx.y, cam);
    if (!vis(px, py)) return;
    const life  = 1 - fx.t / fx.dur;
    const pulse = 0.82 + Math.sin(now / 110) * 0.18;
    const a     = life * pulse;
    // Tile glow
    gfx.rect(px - 1, py - 1, TS + 2, TS + 2).fill({ color: '#f0c020', alpha: a * 0.30 });
    gfx.rect(px + 5, py + 5, TS - 10, TS - 10).fill({ color: '#fff8a0', alpha: a * 0.28 });
    // Rising beam — shrinks as life decays
    const beamH = Math.max(0, (TS + 28) * life) | 0;
    gfx.rect(px + TS / 2 - 7, py - beamH + TS, 14, beamH).fill({ color: '#f0c020', alpha: a * 0.32 });
    gfx.rect(px + TS / 2 - 3, py - beamH + TS, 6,  beamH).fill({ color: '#fff8a0', alpha: a * 0.75 });
  });
}

// ── Loot piles ────────────────────────────────────────────────────────────────
export function drawLootPile(lp, cam, now) {
  const px = ox(lp.x, cam), py = oy(lp.y, cam);
  if (!vis(px, py)) return;

  if (lp.isGrave) {
    // Only render one grave marker per tile (skip duplicates that share the same position)
    const pulse = 0.55 + Math.sin(now / 700) * 0.30;
    gfx.circle(px + TS / 2, py + TS - 7, 11).fill({ color: '#881111', alpha: pulse * 0.45 });
    _t('⚰️', px + TS / 2, py + TS / 2 - 1, ST.loot, 0.5, 0.5);
    // Red timer bar when < 60s remain
    if (lp.expires) {
      const secsLeft = (lp.expires - Date.now()) / 1000;
      if (secsLeft < 60) {
        const frac = secsLeft / 60;
        gfx.rect(px + 2, py + TS - 3, TS - 4, 2).fill({ color: '#220000', alpha: 0.9 });
        gfx.rect(px + 2, py + TS - 3, (TS - 4) * frac, 2).fill({ color: '#ff3333', alpha: 0.9 });
      }
    }
    return;
  }

  // Regular loot pile — pulsing glow ring + bobbing icon
  const pulse = 0.50 + Math.sin(now / 430) * 0.28;
  const r = 9 + Math.sin(now / 430) * 2;
  gfx.circle(px + TS / 2, py + TS - 6, r).fill({ color: '#f0c020', alpha: pulse * 0.50 });
  const bob = Math.sin(now / 510) * 3;
  _t(ITEMS[lp.item]?.icon || '?', px + TS / 2, py + TS / 2 - 2 + bob, ST.loot, 0.5, 0.5);
}

// ── Monsters ──────────────────────────────────────────────────────────────────
export function drawMonster(mon, cam, now) {
  if (mon.state === 'dead') return;
  const px = ox(mon.x, cam), py = oy(mon.y, cam);
  if (!vis(px, py)) return;
  const d = MDEFS[mon.type];

  gfx.ellipse(px + 16, py + TS - 4, 8, 3).fill({ color: '#000000', alpha: 0.3 });

  // ── Sprite path ───────────────────��────────────────────────────���─────────────
  if (_trySprite(mon.type, px, py)) {
    // Sprite drawn; fall through to always-on overlays below.
  } else if (mon.type === 'training_dummy') {
  // ── Colored-rect fallback ──────────────────────────���─────────────────────────
    gfx.rect(px + 13, py + 8,  6,  22).fill('#7a4e28');
    gfx.rect(px + 8,  py + 12, 16, 4).fill('#6a3e18');
    gfx.circle(px + 16, py + 9, 5).fill('#c09060');
    gfx.rect(px + 14, py + 28, 4,  4).fill('#5a2e10');
    _t('DUMMY', px + 16, py + TS + 2, ST.dummy, 0.5, 0);
    return; // training dummy has no HP bar
  } else {
    const bh = mon.type === 'cow' ? 15 : 17;
    const bw = mon.type === 'cow' ? 17 : 12;
    gfx.rect(px + 16 - bw / 2, py + TS - 4 - bh, bw, bh).fill(d.col);
    const hs = mon.type === 'cow' ? 12 : 10;
    gfx.rect(px + 16 - hs / 2, py + TS - 4 - bh - hs + 2, hs, hs).fill(d.col2);
    gfx.rect(px + 13, py + TS - 4 - bh - hs + 6, 2, 2).fill('#111111');
    gfx.rect(px + 17, py + TS - 4 - bh - hs + 6, 2, 2).fill('#111111');
    if (mon.type === 'dark_wizard') {
      const p = 0.4 + Math.sin(now / 300) * 0.3;
      gfx.circle(px + 16, py + 12, 10).fill({ color: '#7030ff', alpha: p });
    }
    if (mon.type === 'cave_troll') {
      gfx.rect(px + 7,  py + 5, 18, 20).fill(d.col);
      gfx.rect(px + 9,  py + 2, 14, 10).fill(d.col2);
      gfx.rect(px + 11, py + 6, 3,  3).fill('#111111');
      gfx.rect(px + 17, py + 6, 3,  3).fill('#111111');
    }
  }

  // ── Always-on overlays (HP bar + level badge + aggro indicator) ───────────────
  const hp = mon.hp / mon.maxHp;
  gfx.rect(px + 2, py + 2, TS - 4, 4).fill('#1a1a1a');
  gfx.rect(px + 2, py + 2, (TS - 4) * hp, 4)
     .fill(hp > 0.5 ? '#27ae60' : hp > 0.25 ? '#e67e22' : '#e74c3c');
  gfx.rect(px + 1, py + 7, 18, 10).fill({ color: '#000000', alpha: 0.8 });
  _t(`${d.level}`, px + 3, py + 7, ST.level, 0, 0);
  if (mon.state === 'aggro') _t('!', px + TS - 8, py + 2, ST.aggro, 0, 0);
}

// ── Player ────────────────────────────────────────────────────────────────────
export function drawPlayer(player, cam, now) {
  const px = ox(player.x, cam), py = oy(player.y, cam);
  const ca = player.inCombat || (now - player.lastCombatTime < 2500);

  // Shadow — scaled up to match larger body
  gfx.ellipse(px + 16, py + TS - 2, 11, 4.5).fill({ color: '#000000', alpha: 0.4 });

  // ── Sprite path ───────────────────────────────────────────────────────────────
  const playerSprite = ca ? 'player_combat' : 'player_idle';
  if (!_trySprite(playerSprite, px, py)) {
    // ── Colored-rect fallback — body scaled ~1.3× from feet anchor ─────────────
    // Feet anchor: py+30. Head extends ~4px above tile top (py-2 to py-3).
    const legCol = player.gear.legs ? '#2e1850' : '#143058';
    gfx.rect(px +  9, py + 17,  7, 13).fill(legCol);                               // left leg
    gfx.rect(px + 16, py + 17,  7, 13).fill(legCol);                               // right leg
    gfx.rect(px +  7, py +  7, 18, 12).fill(player.gear.body ? '#282858' : '#185090'); // torso
    gfx.rect(px +  9, py -  2, 14, 12).fill('#e0b050');                            // head
    if (player.gear.head) gfx.rect(px + 8, py - 3, 16, 9).fill('#787878');         // helm
    gfx.rect(px +  9, py -  2, 14,  4).fill('#603008');                            // hair
    gfx.rect(px + 12, py +  3,  3,  3).fill('#111111');                            // eye L
    gfx.rect(px + 17, py +  3,  3,  3).fill('#111111');                            // eye R
    if (ca) {
      const sw = Math.sin(now / 200) * 3;
      const wc = player.gear.weapon
        ? (player.gear.weapon.includes('steel') ? '#a0b8c8'
         : player.gear.weapon.includes('iron')  ? '#8888a0' : '#a09040')
        : '#a09040';
      gfx.rect(px + 27, py +  8 + sw,  4, 16).fill(wc);       // blade
      gfx.rect(px + 25, py + 18 + sw,  7,  4).fill('#5a2810'); // guard
      gfx.rect(px + 27, py +  6 + sw,  4,  4).fill('#e8b830'); // pommel
      if (player.gear.shield) {
        gfx.rect(px + 3, py + 10, 6, 14).fill('#686878');
        gfx.rect(px + 4, py + 11, 4,  9).fill('#8888a0');
      }
    }
  }

  // ── Respawn immunity aura ─────────────────────────────────────────────────────
  if (now < player.immuneUntil) {
    const frac  = (player.immuneUntil - now) / 3000;
    const pulse = 0.45 + Math.sin(now / 110) * 0.35;
    gfx.circle(px + 16, py + 14, 24).fill({ color: '#44ddff', alpha: pulse * 0.18 * frac });
    gfx.circle(px + 16, py + 14, 24).stroke({ color: '#88eeff', width: 2, alpha: pulse * frac });
  }

  // ── Gather progress bar — shifted up to clear the enlarged head ──────────────
  if (player.action?.type === 'gather' && player.action.timer) {
    const res = resources.find(r => r.id === player.action.targetId);
    if (res) {
      const skill   = RDEFS[res.type]?.skill || '';
      const effTime = (RDEFS[res.type]?.time || 3000) / toolBonus(player, skill, ITEMS);
      const pct     = player.action.timer / effTime;
      const lbl     = skill === 'woodcutting' ? '🪓 Chopping'
                    : skill === 'mining'      ? '⛏️ Mining'
                    :                          '🎣 Fishing';
      gfx.rect(px - 3, py - 38, TS + 6, 26).fill({ color: '#000000', alpha: 0.82 });
      _t(lbl, px + TS / 2, py - 37, ST.gather, 0.5, 0);
      drawProgressBar(px, py - 22, TS, 8, pct, '#f0c050');
    }
  }

  // ── "You" label — 11px, dark pill background, sits just above head ────────────
  gfx.rect(px - 2, py - 17, 36, 12).fill({ color: '#000000', alpha: 0.62 });
  _t('You', px + 16, py - 6, ST.player, 0.5, 1);
}

// ── Floating texts ────────────────────────────────────────────────────────────
export function drawFloatingTexts(ftexts) {
  ftexts.forEach(f => {
    const a = Math.max(0, 1 - f.t / f.dur);
    _t(f.text, f.sx, f.sy, floatST(f.color), 0.5, 0.5, a);
  });
}

// ── UI ────────────────────────────────────────────────────────────────────────
export function drawProgressBar(x, y, w, h, pct, color) {
  gfx.rect(x, y, w, h).fill({ color: '#000000', alpha: 0.8 });
  if (pct > 0) gfx.rect(x, y, w * pct, h).fill(color);
}

export function drawClickEffect(clickFx, cam, now) {
  if (!clickFx || now - clickFx.t >= 700) return;
  const a  = 1 - (now - clickFx.t) / 700;
  const sx = clickFx.x * TS - cam.x;
  const sy = clickFx.y * TS - cam.y;
  gfx.rect(sx + 2, sy + 2, TS - 4, TS - 4).stroke({ color: '#ffffff', width: 2, alpha: a });
}

export function drawHoverHighlight(hovTile, cam) {
  if (!hovTile) return;
  const sx = hovTile.x * TS - cam.x;
  const sy = hovTile.y * TS - cam.y;
  gfx.rect(sx + 1, sy + 1, TS - 2, TS - 2).fill({ color: '#ffffff', alpha: 0.12 });
}

export function renderZoneLabel() {
  if (currentZone !== 'dungeon') return;
  gfx.rect(4, 4, 164, 20).fill({ color: '#3c0064', alpha: 0.75 });
  _t('🕯️ THE DUNGEON', 8, 5, ST.zone, 0, 0);
}

// ── Zoom label ────────────────────────────────────────────────────────────────
const ST_zoom = new TextStyle({ fontFamily: '"Press Start 2P", monospace', fontSize: 8, fill: '#f0e090' });

let _zoomTimer = 0;
let _zoomText  = '';

export function showZoomLabel(z) {
  _zoomText  = `ZOOM  ${z.toFixed(2)}x`;
  _zoomTimer = 1500;
}

export function tickZoomLabel(dt) {
  if (_zoomTimer > 0) _zoomTimer -= dt;
}

export function drawZoomLabel() {
  if (_zoomTimer <= 0) return;
  const alpha = Math.min(1, _zoomTimer / 300);
  const vw = CW / zoom, vh = CH / zoom;
  const bw = 108, bh = 18;
  const bx = (vw - bw) / 2, by = vh / 2 - 40;
  gfx.rect(bx, by, bw, bh).fill({ color: '#000000', alpha: alpha * 0.8 });
  gfx.rect(bx, by, bw, bh).stroke({ color: '#f0e090', width: 1, alpha: alpha * 0.5 });
  _t(_zoomText, vw / 2, by + 2, ST_zoom, 0.5, 0, alpha);
}

// ── Hotbar ────────────────────────────────────────────────────────────────────
const HB_N    = 5;   // number of slots
const HB_SZ   = 36;  // slot size in stage pixels (scales with zoom)
const HB_GAP  = 3;
const HB_PADX = 8;   // bottom padding in stage pixels

// Returns canvas-space slot index 0-4, or -1 if miss.
// cx/cy are in raw canvas pixels (before tileFromE zoom-correction).
export function hotbarSlotAt(cx, cy, z) {
  const barW = HB_N * HB_SZ + (HB_N - 1) * HB_GAP;
  const bx   = (CW - barW * z) / 2;
  const by   = CH - (HB_SZ + HB_PADX) * z;
  if (cy < by || cy > by + HB_SZ * z) return -1;
  if (cx < bx || cx > bx + barW * z)  return -1;
  return Math.min(HB_N - 1, Math.floor((cx - bx) / ((HB_SZ + HB_GAP) * z)));
}

export function drawHotbar(player, pendingAssign, now) {
  const vw  = CW / zoom, vh = CH / zoom;
  const barW = HB_N * HB_SZ + (HB_N - 1) * HB_GAP;
  const bx  = (vw - barW) / 2;
  const by  = vh - HB_SZ - HB_PADX;

  for (let i = 0; i < HB_N; i++) {
    const sx  = bx + i * (HB_SZ + HB_GAP);
    const key = player.hotbar[i];
    const def = key ? ITEMS[key] : null;
    const qty = key ? player.countItem(key) : 0;
    const isActive = pendingAssign && key === pendingAssign;
    const pulse = isActive ? 0.7 + Math.sin(now / 150) * 0.3 : 1;

    // Slot background + border
    gfx.rect(sx, by, HB_SZ, HB_SZ).fill({ color: '#0c0c14', alpha: 0.88 });
    gfx.rect(sx, by, HB_SZ, HB_SZ).stroke({
      color: isActive ? '#f0c050' : '#38384a',
      width: isActive ? 2 : 1,
      alpha: isActive ? pulse : 1,
    });

    if (def) {
      // Dim if none left in inventory
      const a = qty > 0 ? 1 : 0.30;
      _t(def.icon || '?', sx + HB_SZ / 2, by + HB_SZ / 2, ST.hoticon, 0.5, 0.5, a);
      if (qty > 0) _t(`${qty}`, sx + HB_SZ - 2, by + HB_SZ - 1, ST.hotqty, 1, 1);
    }

    // Key number badge (top-left)
    _t(`${i + 1}`, sx + 2, by + 1, ST.hotkey, 0, 0);
  }

  // Assign-mode hint above the bar
  if (pendingAssign) {
    const name  = ITEMS[pendingAssign]?.name || pendingAssign;
    const hint  = `${name} — press 1-5 or click slot`;
    const hw    = 220, hh = 14;
    const hx    = (vw - hw) / 2, hy = by - hh - 4;
    gfx.rect(hx, hy, hw, hh).fill({ color: '#000000', alpha: 0.82 });
    gfx.rect(hx, hy, hw, hh).stroke({ color: '#f0c050', width: 1, alpha: 0.55 });
    _t(hint, vw / 2, hy + 1, ST.hothint, 0.5, 0);
  }
}

// ── World Map overlay (M key) ─────────────────────────────────────────────────
const ST_mapTitle  = new TextStyle({ fontFamily: '"Press Start 2P", monospace', fontSize: 10, fill: '#e8eaf0', fontWeight: 'bold' });
const ST_mapHint   = new TextStyle({ fontFamily: 'VT323, monospace', fontSize: 14, fill: '#505868' });
const ST_mapLabel  = new TextStyle({ fontFamily: 'VT323, monospace', fontSize: 13, fill: '#f0c050' });

export function drawWorldMap(gameMap, monsters, iacts, player) {
  const MH = gameMap.length, MW = gameMap[0]?.length || 0;
  if (!MW || !MH) return;

  const pad = 28;
  const scale = Math.min(Math.floor((CW - pad * 2) / MW), Math.floor((CH - pad * 2 - 22) / MH));
  const mapW = MW * scale, mapH = MH * scale;
  const mox = Math.floor((CW - mapW) / 2);
  const moy = Math.floor((CH - mapH) / 2) + 8;

  // Dimmed background
  gfx.rect(0, 0, CW, CH).fill({ color: '#020408', alpha: 0.92 });

  // Tiles
  for (let y = 0; y < MH; y++) {
    for (let x = 0; x < MW; x++) {
      const t = gameMap[y]?.[x] ?? 0;
      gfx.rect(mox + x * scale, moy + y * scale, scale, scale).fill(TCOL[t] || '#333333');
    }
  }

  // Map border
  gfx.rect(mox - 1, moy - 1, mapW + 2, mapH + 2).stroke({ color: '#3a3a4a', width: 1 });

  // Interactables — gold dot + label
  const IACT_COL = { bank: '#f0c050', shop: '#c890f0', campfire: '#ff8830', dungeon_entrance: '#9060ff', dungeon_exit: '#9060ff' };
  iacts.forEach(ia => {
    const ix = mox + ia.x * scale + scale / 2;
    const iy = moy + ia.y * scale + scale / 2;
    const col = IACT_COL[ia.type] || '#f0c050';
    gfx.circle(ix, iy, Math.max(3, scale * 0.55)).fill(col);
    gfx.circle(ix, iy, Math.max(3, scale * 0.55)).stroke({ color: '#ffffff', width: 1, alpha: 0.6 });
    _t(ia.label || ia.type, ix, iy - scale * 0.7, ST_mapLabel, 0.5, 1);
  });

  // Monsters — red/orange dots
  monsters.forEach(m => {
    const mx = mox + m.x * scale + scale / 2;
    const my = moy + m.y * scale + scale / 2;
    gfx.circle(mx, my, Math.max(2, scale * 0.32)).fill(m.state === 'aggro' ? '#ff2020' : '#cc4410');
  });

  // Player — bright cyan dot
  const px = mox + player.x * scale + scale / 2;
  const py = moy + player.y * scale + scale / 2;
  const pr = Math.max(3, scale * 0.45);
  gfx.circle(px, py, pr + 1).fill({ color: '#ffffff', alpha: 0.3 });
  gfx.circle(px, py, pr).fill('#44eeff');

  // Title & hint
  _t('WORLD MAP', CW / 2, moy - 20, ST_mapTitle, 0.5, 1);
  _t('[M] or [ESC] to close', CW / 2, moy + mapH + 7, ST_mapHint, 0.5, 0);

  // Legend
  const lx = mox, ly = moy + mapH + 20;
  gfx.circle(lx + 6, ly + 5, 3).fill('#44eeff');
  _t('You', lx + 12, ly, ST_mapHint, 0, 0);
  gfx.circle(lx + 44, ly + 5, 3).fill('#cc4410');
  _t('Mob', lx + 50, ly, ST_mapHint, 0, 0);
  gfx.circle(lx + 82, ly + 5, 3).fill('#f0c050');
  _t('NPC', lx + 88, ly, ST_mapHint, 0, 0);
}
