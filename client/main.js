import { TS, CW, CH, WALKABLE } from '../shared/constants.js';
import { rnd } from '../shared/GameMath.js';
import {
  P, SK, CAM, IACTS, MDEFS, RDEFS, ITEMS,
  currentZone, gameMap, resources, monsters, lootPiles, ftexts,
  MW, MH, setLootPiles, setFtexts, updateCam, zoom, setZoom,
} from './core/state.js';

import { buildZone }                from './world/Zone.js';
import { findPath, pathAdj, adj8 }  from './world/Pathfinder.js';
import { walkable }                 from './world/pathfinding.js';

import { addItem }                               from './systems/inventory.js';
import { attackMonster, monsterAttacksPlayer }   from './systems/combat.js';
import { gatherRes }                             from './systems/gathering.js';
import { toolBonus }                             from './systems/GatherSystem.js';

import {
  initPixi, beginFrame, endFrame,
  drawTile, drawMinimap,
  drawInteractable, drawResource, drawLootPile,
  drawMonster, drawPlayer, drawFloatingTexts,
  drawClickEffect, drawHoverHighlight, renderZoneLabel,
  drawWorldMap, showZoomLabel, tickZoomLabel, drawZoomLabel,
} from './render/PixiRenderer.js';

import { chat }                                  from './ui/chat.js';
import { switchTab, updateHP, updateCoins, renderSkills, renderInv, renderEquip } from './ui/sidebar.js';
import { handleInteract, bindModalGlobals }      from './ui/modals.js';

import { saveGame, loadGame }                    from './save/SaveLoad.js';

// ── Canvas / input refs ───────────────────────────────────────────────────────
let canvas;
let hovTile = null;
let clickFx = null;

// ── Pause & map state ─────────────────────────────────────────────────────────
let isPaused  = false;
let mapOpen   = false;

function togglePause() {
  isPaused = !isPaused;
  const overlay = document.getElementById('pause-overlay');
  if (overlay) overlay.classList.toggle('active', isPaused);
  if (!isPaused) last = performance.now(); // avoid giant dt spike on resume
}

function toggleMap() {
  mapOpen = !mapOpen;
}

window._resumeGame = () => { if (isPaused) togglePause(); };

// ── Game loop ─────────────────────────────────────────────────────────────────
let last = 0;
let _lastUITick = 0;

function loop(now) {
  const dt = Math.min(now - last, 80);
  last = now;

  if (!isPaused && !mapOpen) update(dt, now);
  draw(now);

  // Throttle sidebar UI refresh to ~5 fps — avoids per-frame DOM writes
  if (now - _lastUITick > 200) {
    updateHP();
    updateCoins();
    _lastUITick = now;
  }

  requestAnimationFrame(loop);
}

// walkableFn for player pathing (blocks monsters + interactables)
const wfn = (x, y) => walkable(x, y, false);

// ── Update ────────────────────────────────────────────────────────────────────
function update(dt, now) {
  // Move player along path
  if (P.path.length > 0 && P.moveTimer <= 0) {
    const [nx, ny] = P.path[0];
    P.x = nx; P.y = ny;
    P.path.shift();
    P.moveTimer = P.moveSpd;
    updateCam();
  }
  if (P.moveTimer > 0) P.moveTimer -= dt;

  // Player action
  if (P.path.length === 0 && P.action) {
    const act = P.action;

    if (act.type === 'gather') {
      const res = resources.find(r => r.id === act.targetId && r.zone === currentZone);
      if (!res || res.depleted) { chat('Resource depleted.', 'info'); P.action = null; return; }
      if (!adj8(P.x, P.y, res.x, res.y)) {
        const p = pathAdj(P.x, P.y, res.x, res.y, wfn, MW, MH);
        if (p) P.path = p; else P.action = null;
        return;
      }
      const effTime = RDEFS[res.type].time / toolBonus(P, RDEFS[res.type].skill, ITEMS);
      act.timer = (act.timer || 0) + dt;
      if (act.timer >= effTime) { act.timer = 0; gatherRes(res); }

    } else if (act.type === 'attack') {
      const mon = monsters.find(m => m.id === act.targetId && m.state !== 'dead' && m.zone === currentZone);
      if (!mon) { P.action = null; P.inCombat = false; return; }
      if (!adj8(P.x, P.y, mon.x, mon.y)) {
        const p = pathAdj(P.x, P.y, mon.x, mon.y, wfn, MW, MH);
        if (p) P.path = p;
        return;
      }
      P.inCombat = true; P.lastCombatTime = now;
      mon.state = 'aggro'; mon.target = 'player';
      P.atkTimer = (P.atkTimer || 0) + dt;
      if (P.atkTimer >= P.atkSpd) { P.atkTimer = 0; attackMonster(mon); }

    } else if (act.type === 'interact') {
      const iact = IACTS.find(i => i.id === act.targetId && i.zone === currentZone);
      if (!iact) { P.action = null; return; }
      if (!adj8(P.x, P.y, iact.x, iact.y)) {
        const p = pathAdj(P.x, P.y, iact.x, iact.y, wfn, MW, MH);
        if (p) P.path = p; else P.action = null;
        return;
      }
      handleInteract(iact);
      P.action = null;
    }
  }

  // Monster AI
  monsters.filter(m => m.zone === currentZone && m.state !== 'dead').forEach(mon => {
    const def  = MDEFS[mon.type];
    if (def.immortal) return;
    const dist = Math.abs(mon.x - P.x) + Math.abs(mon.y - P.y);
    if (dist <= def.agro && mon.state === 'idle') {
      mon.state = 'aggro'; mon.target = 'player';
      chat(`The ${def.label} attacks you!`, 'hit');
    }
    mon.wanderTimer -= dt;
    if (mon.wanderTimer <= 0) {
      mon.wanderTimer = rnd(2000, 4000);
      if (mon.state === 'idle') {
        const D = [[0,1],[0,-1],[1,0],[-1,0]];
        const [dx, dy] = D[rnd(0, 3)];
        const nx = mon.x + dx, ny = mon.y + dy;
        if (Math.abs(nx - mon.spawnX) + Math.abs(ny - mon.spawnY) <= 5 && walkable(nx, ny, true))
          { mon.x = nx; mon.y = ny; }
      }
    }
    if (mon.state === 'aggro' && mon.target === 'player') {
      mon.moveTimer = (mon.moveTimer || 0) + dt;
      if (mon.moveTimer >= def.spd) {
        mon.moveTimer = 0;
        if (!adj8(mon.x, mon.y, P.x, P.y)) {
          const dx = Math.sign(P.x - mon.x), dy = Math.sign(P.y - mon.y);
          for (const [adx, ady] of [[dx,0],[0,dy],[dx,dy],[-dy,dx],[dy,-dx]]) {
            const nx = mon.x + adx, ny = mon.y + ady;
            const occ = monsters.find(m => m !== mon && m.x === nx && m.y === ny && m.state !== 'dead');
            if (walkable(nx, ny, true) && !occ && !(nx === P.x && ny === P.y))
              { mon.x = nx; mon.y = ny; break; }
          }
        }
        if (Math.abs(mon.x - mon.spawnX) + Math.abs(mon.y - mon.spawnY) > 16) {
          mon.state = 'idle'; mon.target = null;
          mon.x = mon.spawnX; mon.y = mon.spawnY; mon.hp = mon.maxHp;
        }
      }
      if (adj8(mon.x, mon.y, P.x, P.y)) {
        mon.atkTimer = (mon.atkTimer || 0) + dt;
        if (mon.atkTimer >= def.spd * 1.8) { mon.atkTimer = 0; monsterAttacksPlayer(mon); }
      }
    }
  });

  // Auto-loot
  let pickedUp = false;
  setLootPiles(lootPiles.filter(lp => {
    if (lp.x === P.x && lp.y === P.y) {
      addItem(lp.item, lp.qty);
      chat(`Picked up ${lp.qty}x ${ITEMS[lp.item]?.name || lp.item}.`, 'loot');
      pickedUp = true;
      return false;
    }
    return true;
  }));
  if (pickedUp) updateCoins();

  // Advance floating texts
  setFtexts(ftexts.filter(f => { f.t += dt; f.sy -= dt * 0.022; return f.t < f.dur; }));
  tickZoomLabel(dt);
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function draw(now) {
  beginFrame();

  // World map overlay replaces the normal scene
  if (mapOpen) {
    drawWorldMap(
      gameMap,
      monsters.filter(m => m.zone === currentZone && m.state !== 'dead'),
      IACTS.filter(i => i.zone === currentZone),
      P
    );
    endFrame();
    return;
  }

  const tx0 = Math.max(0, Math.floor(CAM.x / TS));
  const tx1 = Math.min(MW, tx0 + Math.ceil(CW / zoom / TS) + 2);
  const ty0 = Math.max(0, Math.floor(CAM.y / TS));
  const ty1 = Math.min(MH, ty0 + Math.ceil(CH / zoom / TS) + 2);
  for (let y = ty0; y < ty1; y++)
    for (let x = tx0; x < tx1; x++)
      drawTile(x, y, gameMap[y]?.[x] ?? 0, CAM, now);

  drawHoverHighlight(hovTile, CAM);

  IACTS.filter(i => i.zone === currentZone).forEach(i =>
    drawInteractable(i, CAM, hovTile && hovTile.x === i.x && hovTile.y === i.y, now));
  resources.filter(r => r.zone === currentZone).forEach(r =>
    drawResource(r, CAM, hovTile && hovTile.x === r.x && hovTile.y === r.y, now));
  lootPiles.forEach(lp => drawLootPile(lp, CAM));
  monsters.filter(m => m.zone === currentZone && m.state !== 'dead').forEach(m =>
    drawMonster(m, CAM, now));
  drawPlayer(P, CAM, now);

  drawClickEffect(clickFx, CAM, now);
  drawFloatingTexts(ftexts);
  drawMinimap(gameMap, monsters.filter(m => m.zone === currentZone && m.state !== 'dead'), P, CAM);
  renderZoneLabel();
  drawZoomLabel();

  endFrame();
}

// ── Input ─────────────────────────────────────────────────────────────────────
function tileFromE(e) {
  const r  = canvas.getBoundingClientRect();
  const sx = CW / r.width, sy = CH / r.height;
  return {
    x: Math.floor(((e.clientX - r.left) * sx / zoom + CAM.x) / TS),
    y: Math.floor(((e.clientY - r.top)  * sy / zoom + CAM.y) / TS),
  };
}

function handleClick(e) {
  if (isPaused || mapOpen) return;
  const { x, y } = tileFromE(e);
  if (x < 0 || x >= MW || y < 0 || y >= MH) return;
  clickFx = { x, y, t: performance.now() };

  const iact = IACTS.find(i => i.x === x && i.y === y && i.zone === currentZone);
  if (iact) {
    const p = pathAdj(P.x, P.y, x, y, wfn, MW, MH);
    if (p !== null) { P.path = p; P.action = { type: 'interact', targetId: iact.id }; }
    return;
  }
  const mon = monsters.find(m => m.x === x && m.y === y && m.state !== 'dead' && m.zone === currentZone);
  if (mon) {
    chat(`Attacking ${MDEFS[mon.type].label}...`, 'info');
    const p = pathAdj(P.x, P.y, x, y, wfn, MW, MH);
    if (p !== null) {
      P.path = p;
      P.action = { type: 'attack', targetId: mon.id, timer: 0 };
      P.atkTimer = 0; P.inCombat = true;
    }
    return;
  }
  const res = resources.find(r => r.x === x && r.y === y && !r.depleted && r.zone === currentZone);
  if (res) {
    const d = RDEFS[res.type];
    const v = d.skill === 'woodcutting' ? 'Chopping' : d.skill === 'mining' ? 'Mining' : 'Fishing';
    chat(`${v}...`, 'info');
    const p = pathAdj(P.x, P.y, x, y, wfn, MW, MH);
    if (p !== null) { P.path = p; P.action = { type: 'gather', targetId: res.id, timer: 0 }; }
    else chat("Can't reach that.", 'info');
    return;
  }
  if (!WALKABLE.has(gameMap[y]?.[x])) { chat("Can't walk there.", 'info'); return; }
  const p = findPath(P.x, P.y, x, y, wfn, MW, MH);
  if (p) { P.path = p; P.action = null; P.inCombat = false; }
  else chat("Can't reach that location.", 'info');
}

function setupInput() {
  canvas.addEventListener('mousemove', e => {
    const t    = tileFromE(e);
    hovTile    = t;
    const mon  = monsters.find(m => m.x === t.x && m.y === t.y && m.state !== 'dead' && m.zone === currentZone);
    const res  = resources.find(r => r.x === t.x && r.y === t.y && !r.depleted && r.zone === currentZone);
    const iact = IACTS.find(i => i.x === t.x && i.y === t.y && i.zone === currentZone);
    canvas.style.cursor = mon ? 'crosshair' : (res || iact) ? 'pointer' : 'default';
  });
  canvas.addEventListener('mouseleave', () => { hovTile = null; });
  canvas.addEventListener('click', handleClick);
  canvas.addEventListener('touchend', e => {
    e.preventDefault();
    const t = e.changedTouches[0];
    canvas.dispatchEvent(new MouseEvent('click', { clientX: t.clientX, clientY: t.clientY }));
  }, { passive: false });

  document.querySelectorAll('.tab').forEach(el => {
    el.addEventListener('click', () => switchTab(el.dataset.tab));
  });
  document.getElementById('savebtn').addEventListener('click', saveGame);

  // Keyboard: ESC = pause, M = world map, = zoom in, - zoom out
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (mapOpen) { mapOpen = false; return; }
      togglePause();
    } else if (e.key === 'm' || e.key === 'M') {
      if (isPaused) return;
      toggleMap();
    } else if (e.key === '=' || e.key === '+') {
      const next = Math.min(2.5, zoom + 0.25);
      if (next !== zoom) { setZoom(next); updateCam(); showZoomLabel(zoom); }
    } else if (e.key === '-' || e.key === '_') {
      const next = Math.max(1.0, zoom - 0.25);
      if (next !== zoom) { setZoom(next); updateCam(); showZoomLabel(zoom); }
    }
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  canvas = document.getElementById('gc');

  const wrap = document.getElementById('canvaswrap');
  function resize() {
    const s = Math.min(wrap.clientWidth / CW, wrap.clientHeight / CH);
    canvas.style.width  = CW * s + 'px';
    canvas.style.height = CH * s + 'px';
  }
  window.addEventListener('resize', resize);

  await initPixi(canvas);
  resize();

  bindModalGlobals();
  setupInput();

  const loaded = loadGame();
  if (!loaded) {
    buildZone('overworld');
    P.hp = P.maxHp;
  }
  updateCam();
  renderSkills(); renderInv(); renderEquip(); updateHP(); updateCoins();

  if (!loaded) {
    P.addItem('ashstone_axe',  1);
    P.addItem('ashstone_pick', 1);
    P.addItem('basic_rod',     1);
    chat('⚔️  Welcome to GRIMVEIL!', 'sys');
    chat('🌲 North: Woodcutting  |  ⛏️ East: Mining  |  🎣 South: Fishing', 'sys');
    chat('🏘️  Town: Bank • Shop • Campfire (cook your fish!)', 'sys');
    chat('🕯️  Dungeon entrance south of town — high danger!', 'sys');
    chat('💡 Start on the Training Dummy in town to level up safely!', 'info');
    chat('💡 Press [M] for World Map  |  [ESC] to Pause  |  [=/-] to Zoom', 'info');
  }

  setInterval(saveGame, 60000);
  last = performance.now();
  requestAnimationFrame(loop);
}

init();
