import { TS, CW, CH } from '../../shared/constants.js';
import { currentZone } from '../core/state.js';

export function drawProgressBar(ctx, x, y, w, h, pct, color) {
  ctx.fillStyle = 'rgba(0,0,0,.8)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * pct, h);
}

export function drawClickEffect(ctx, clickFx, cam, now) {
  if (!clickFx || now - clickFx.t >= 700) return;
  const a = 1 - (now - clickFx.t) / 700;
  const sx = clickFx.x * TS - cam.x;
  const sy = clickFx.y * TS - cam.y;
  ctx.globalAlpha = a;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.strokeRect(sx + 2, sy + 2, TS - 4, TS - 4);
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1;
}

export function drawHoverHighlight(ctx, hovTile, cam) {
  if (!hovTile) return;
  const sx = hovTile.x * TS - cam.x;
  const sy = hovTile.y * TS - cam.y;
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#fff';
  ctx.fillRect(sx + 1, sy + 1, TS - 2, TS - 2);
  ctx.globalAlpha = 1;
}

export function renderZoneLabel(ctx) {
  if (currentZone === 'dungeon') {
    ctx.fillStyle = 'rgba(60,0,100,.75)';
    ctx.fillRect(4, 4, 155, 18);
    ctx.fillStyle = '#cc88ff';
    ctx.font = '10px "Press Start 2P",monospace';
    ctx.fillText('🕯️ THE DUNGEON', 8, 17);
  }
}
