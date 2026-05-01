import { TS, CW, CH } from '../../shared/constants.js';
import { RDEFS, ITEMS, resources } from '../core/state.js';
import { drawProgressBar } from './UIRenderer.js';

function sx(x, cam) { return x * TS - cam.x; }
function sy(y, cam) { return y * TS - cam.y; }
function vis(screenX, screenY) { return screenX + TS >= 0 && screenX < CW && screenY + TS >= 0 && screenY < CH; }

export function drawInteractable(ctx, iact, cam, hov, now) {
  const ox = sx(iact.x, cam), oy = sy(iact.y, cam);
  if (!vis(ox, oy)) return;
  if (iact.type === 'bank') {
    ctx.fillStyle = '#6a4018'; ctx.fillRect(ox + 6, oy + 8, 20, 20);
    ctx.fillStyle = '#c89030'; ctx.fillRect(ox + 10, oy + 12, 12, 12);
    ctx.fillStyle = '#804c20'; ctx.fillRect(ox + 14, oy + 16, 4, 6);
    if (hov) { ctx.strokeStyle = '#f0c050'; ctx.lineWidth = 2; ctx.strokeRect(ox + 2, oy + 2, TS - 4, TS - 4); ctx.lineWidth = 1; }
    ctx.fillStyle = '#f0c050'; ctx.font = '8px "Press Start 2P",monospace'; ctx.textAlign = 'center';
    ctx.fillText('BANK', ox + TS / 2, oy + TS + 10); ctx.textAlign = 'left';
  } else if (iact.type === 'shop') {
    ctx.fillStyle = '#60308a'; ctx.fillRect(ox + 4, oy + 6, 24, 22);
    ctx.fillStyle = '#8050b8'; ctx.fillRect(ox + 8, oy + 4, 16, 6);
    ctx.fillStyle = '#c89030'; ctx.fillRect(ox + 4, oy + 6, 24, 4);
    ctx.fillStyle = '#c8c8b0'; ctx.fillRect(ox + 10, oy + 14, 12, 12);
    ctx.fillStyle = '#f0c050'; ctx.font = '8px "Press Start 2P",monospace'; ctx.textAlign = 'center';
    ctx.fillText('SHOP', ox + TS / 2, oy + TS + 10); ctx.textAlign = 'left';
  } else if (iact.type === 'campfire') {
    const fl = Math.sin(now / 120) * 2;
    ctx.fillStyle = '#703010'; ctx.fillRect(ox + 9, oy + 24, 14, 4);
    ctx.fillStyle = '#ff5800'; ctx.beginPath(); ctx.ellipse(ox + 16, oy + 18 + fl, 6, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffb800'; ctx.beginPath(); ctx.ellipse(ox + 16, oy + 20 + fl, 3, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff8c0'; ctx.beginPath(); ctx.ellipse(ox + 16, oy + 21 + fl, 2, 3, 0, 0, Math.PI * 2); ctx.fill();
    if (hov) { ctx.strokeStyle = '#ffb800'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ox + 16, oy + 20, 13, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1; }
  } else if (iact.type === 'dungeon_entrance' || iact.type === 'dungeon_exit') {
    ctx.fillStyle = '#1a1020'; ctx.fillRect(ox + 4, oy + 4, 24, 26);
    ctx.fillStyle = '#401860'; ctx.fillRect(ox + 10, oy + 4, 12, 22);
    const p = 0.5 + Math.sin(now / 400) * 0.4;
    ctx.globalAlpha = p; ctx.fillStyle = '#aa70ff'; ctx.fillRect(ox + 12, oy + 6, 8, 18); ctx.globalAlpha = 1;
    ctx.fillStyle = '#aa70ff'; ctx.font = '7px "Press Start 2P",monospace'; ctx.textAlign = 'center';
    ctx.fillText(iact.type === 'dungeon_entrance' ? 'DUNGEON' : 'EXIT', ox + TS / 2, oy + TS + 10); ctx.textAlign = 'left';
  }
}

export function drawResource(ctx, res, cam, hov, now) {
  const ox = sx(res.x, cam), oy = sy(res.y, cam);
  if (!vis(ox, oy)) return;
  if (res.type === 'tree' || res.type === 'oak') drawTree(ctx, ox, oy, res, hov, now);
  else if (res.type.includes('rock'))            drawRock(ctx, ox, oy, res, hov);
  else                                           drawFish(ctx, ox, oy, res, hov, now);
}

export function drawLootPile(ctx, lp, cam) {
  const ox = sx(lp.x, cam), oy = sy(lp.y, cam);
  if (!vis(ox, oy)) return;
  ctx.font = '14px serif';
  ctx.textAlign = 'center';
  ctx.fillText(ITEMS[lp.item]?.icon || '?', ox + TS / 2, oy + TS - 4);
  ctx.textAlign = 'left';
}

export function drawMonster(ctx, mon, cam, now, mdefs) {
  if (mon.state === 'dead') return;
  const ox = sx(mon.x, cam), oy = sy(mon.y, cam);
  if (!vis(ox, oy)) return;
  const d = mdefs[mon.type];

  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath(); ctx.ellipse(ox + 16, oy + TS - 4, 8, 3, 0, 0, Math.PI * 2); ctx.fill();

  if (mon.type === 'training_dummy') {
    ctx.fillStyle = '#7a4e28'; ctx.fillRect(ox + 13, oy + 8, 6, 22);
    ctx.fillStyle = '#6a3e18'; ctx.fillRect(ox + 8, oy + 12, 16, 4);
    ctx.fillStyle = '#c09060'; ctx.beginPath(); ctx.arc(ox + 16, oy + 9, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5a2e10'; ctx.fillRect(ox + 14, oy + 28, 4, 4);
    ctx.fillStyle = '#e09030'; ctx.font = 'bold 7px "Press Start 2P",monospace'; ctx.textAlign = 'center';
    ctx.fillText('DUMMY', ox + 16, oy + TS + 10); ctx.textAlign = 'left';
    return;
  }

  const bh = mon.type === 'cow' ? 15 : 17;
  const bw = mon.type === 'cow' ? 17 : 12;
  ctx.fillStyle = d.col; ctx.fillRect(ox + 16 - bw / 2, oy + TS - 4 - bh, bw, bh);
  const hs = mon.type === 'cow' ? 12 : 10;
  ctx.fillStyle = d.col2; ctx.fillRect(ox + 16 - hs / 2, oy + TS - 4 - bh - hs + 2, hs, hs);
  ctx.fillStyle = '#111';
  ctx.fillRect(ox + 13, oy + TS - 4 - bh - hs + 6, 2, 2);
  ctx.fillRect(ox + 17, oy + TS - 4 - bh - hs + 6, 2, 2);

  if (mon.type === 'dark_wizard') {
    const p = 0.4 + Math.sin(now / 300) * 0.3;
    ctx.globalAlpha = p; ctx.fillStyle = '#7030ff';
    ctx.beginPath(); ctx.arc(ox + 16, oy + 12, 10, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  }
  if (mon.type === 'cave_troll') {
    ctx.fillStyle = d.col; ctx.fillRect(ox + 7, oy + 5, 18, 20);
    ctx.fillStyle = d.col2; ctx.fillRect(ox + 9, oy + 2, 14, 10);
    ctx.fillStyle = '#111';
    ctx.fillRect(ox + 11, oy + 6, 3, 3);
    ctx.fillRect(ox + 17, oy + 6, 3, 3);
  }

  const hp = mon.hp / mon.maxHp;
  ctx.fillStyle = '#1a1a1a'; ctx.fillRect(ox + 2, oy + 2, TS - 4, 4);
  ctx.fillStyle = hp > 0.5 ? '#27ae60' : hp > 0.25 ? '#e67e22' : '#e74c3c';
  ctx.fillRect(ox + 2, oy + 2, (TS - 4) * hp, 4);

  ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.fillRect(ox + 1, oy + 7, 18, 10);
  ctx.fillStyle = '#f0c050'; ctx.font = '8px "Press Start 2P",monospace';
  ctx.fillText(`${d.level}`, ox + 3, oy + 16);

  if (mon.state === 'aggro') {
    ctx.fillStyle = '#ff3838'; ctx.font = 'bold 11px VT323,monospace';
    ctx.fillText('!', ox + TS - 8, oy + 10);
  }
}

export function drawPlayer(ctx, player, cam, now) {
  const ox = sx(player.x, cam), oy = sy(player.y, cam);

  ctx.fillStyle = 'rgba(0,0,0,.4)';
  ctx.beginPath(); ctx.ellipse(ox + 16, oy + TS - 3, 8, 3.5, 0, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = player.gear.legs ? '#2e1850' : '#143058';
  ctx.fillRect(ox + 11, oy + 20, 5, 10); ctx.fillRect(ox + 17, oy + 20, 5, 10);

  ctx.fillStyle = player.gear.body ? '#282858' : '#185090';
  ctx.fillRect(ox + 10, oy + 12, 13, 11);

  ctx.fillStyle = '#e0b050'; ctx.fillRect(ox + 11, oy + 4, 11, 10);
  if (player.gear.head) { ctx.fillStyle = '#787878'; ctx.fillRect(ox + 10, oy + 3, 13, 7); }
  ctx.fillStyle = '#603008'; ctx.fillRect(ox + 11, oy + 4, 11, 3);
  ctx.fillStyle = '#111';
  ctx.fillRect(ox + 13, oy + 9, 2, 2); ctx.fillRect(ox + 17, oy + 9, 2, 2);

  const ca = player.inCombat || (now - player.lastCombatTime < 2500);
  if (ca) {
    const sw = Math.sin(now / 200) * 3;
    const wc = player.gear.weapon
      ? (player.gear.weapon.includes('steel') ? '#a0b8c8' : player.gear.weapon.includes('iron') ? '#8888a0' : '#a09040')
      : '#a09040';
    ctx.fillStyle = wc;        ctx.fillRect(ox + 23, oy + 10 + sw, 3, 13);
    ctx.fillStyle = '#5a2810'; ctx.fillRect(ox + 22, oy + 18 + sw, 5, 3);
    ctx.fillStyle = '#e8b830'; ctx.fillRect(ox + 23, oy + 8  + sw, 3, 3);
    if (player.gear.shield) {
      ctx.fillStyle = '#686878'; ctx.fillRect(ox + 6, oy + 12, 5, 12);
      ctx.fillStyle = '#8888a0'; ctx.fillRect(ox + 7, oy + 13, 3, 8);
    }
  }

  if (player.action?.type === 'gather' && player.action.timer) {
    const res = resources.find(r => r.id === player.action.targetId);
    if (res) {
      const pct = player.action.timer / (RDEFS[res.type]?.time || 3000);
      drawProgressBar(ctx, ox, oy - 10, TS, 6, pct, '#c89830');
    }
  }

  ctx.fillStyle = '#fff'; ctx.font = 'bold 9px "Press Start 2P",monospace'; ctx.textAlign = 'center';
  ctx.fillText('You', ox + 16, oy - 2); ctx.textAlign = 'left';
}

export function drawFloatingTexts(ctx, ftexts) {
  ftexts.forEach(f => {
    const a = Math.max(0, 1 - f.t / f.dur);
    ctx.globalAlpha = a;
    ctx.fillStyle = f.color;
    ctx.font = 'bold 13px "VT323",monospace';
    ctx.textAlign = 'center';
    ctx.fillText(f.text, f.sx, f.sy);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  });
}

// ── Private draw helpers ─────────────────────────────────────────────────────

function drawTree(ctx, ox, oy, res, hov, now) {
  if (res.depleted) {
    ctx.fillStyle = '#704818'; ctx.fillRect(ox + 13, oy + 18, 6, 14);
    ctx.fillStyle = '#503010'; ctx.fillRect(ox + 10, oy + 26, 12, 4);
    return;
  }
  const oak = res.type === 'oak';
  ctx.fillStyle = oak ? '#704818' : '#583010'; ctx.fillRect(ox + 13, oy + 18, 6, 14);
  ctx.fillStyle = oak ? '#205018' : '#164010';
  ctx.beginPath(); ctx.arc(ox + 16, oy + 13, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = oak ? '#286828' : '#1e5818';
  ctx.beginPath(); ctx.arc(ox + 11, oy + 10, 8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(ox + 22, oy + 11, 7, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(ox + 16, oy + 7,  7, 0, Math.PI * 2); ctx.fill();
  if (hov) { ctx.strokeStyle = '#f0c050'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ox + 16, oy + 12, 14, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1; }
}

function drawRock(ctx, ox, oy, res, hov) {
  const iron = res.type === 'iron_rock';
  if (res.depleted) { ctx.fillStyle = '#555'; ctx.beginPath(); ctx.ellipse(ox + 16, oy + 24, 9, 4, 0, 0, Math.PI * 2); ctx.fill(); return; }
  ctx.fillStyle = iron ? '#404050' : '#906020';
  ctx.beginPath(); ctx.ellipse(ox + 16, oy + 22, 11, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = iron ? '#686878' : '#a87030';
  ctx.beginPath(); ctx.ellipse(ox + 13, oy + 18, 6, 4, -0.3, 0, Math.PI * 2); ctx.fill();
  if (hov) { ctx.strokeStyle = '#f0c050'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(ox + 16, oy + 22, 13, 9, 0, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1; }
}

function drawFish(ctx, ox, oy, res, hov, now) {
  if (res.depleted) return;
  const bob = Math.sin(now / 600 + res.x) * 2;
  ctx.globalAlpha = 0.65; ctx.fillStyle = '#3888cc';
  ctx.beginPath(); ctx.ellipse(ox + 16, oy + 21 + bob, 8, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  ctx.fillStyle = '#ff4818'; ctx.fillRect(ox + 15, oy + 12 + bob, 3, 10);
  ctx.fillStyle = '#fff';    ctx.fillRect(ox + 13, oy + 10 + bob, 6, 3);
  if (hov) { ctx.strokeStyle = '#3888cc'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ox + 16, oy + 18, 12, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1; }
}
