import { T, TS, CW, CH, TCOL, TEDGE } from '../../shared/constants.js';

export function drawTile(ctx, x, y, tileType, cam, now) {
  const sx = x * TS - cam.x;
  const sy = y * TS - cam.y;
  ctx.fillStyle = TCOL[tileType] || '#333';
  ctx.fillRect(sx, sy, TS, TS);
  ctx.fillStyle = TEDGE[tileType] || '#222';
  ctx.fillRect(sx, sy, TS, 1);
  ctx.fillRect(sx, sy, 1, TS);
  if (tileType === T.WATER) {
    const wave = (now / 900 + x * 0.4 + y * 0.2) % 1;
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#88ccff';
    ctx.fillRect(sx, sy + wave * TS, TS, 3);
    ctx.globalAlpha = 1;
  }
  if (tileType === T.DFLOOR) {
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#8040ff';
    ctx.fillRect(sx, sy, TS, TS);
    ctx.globalAlpha = 1;
  }
}

export function drawMinimap(ctx, gameMap, monsters, player, cam) {
  const MH = gameMap.length;
  const MW = gameMap[0]?.length || 0;
  const mw = 88, mh = 66, mx = CW - mw - 4, my = 4;
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = '#000';
  ctx.fillRect(mx, my, mw, mh);
  for (let y = 0; y < MH; y++) {
    for (let x = 0; x < MW; x++) {
      const t = gameMap[y]?.[x] ?? 0;
      ctx.fillStyle =
        t === T.WATER    ? '#1a58a8' :
        t === T.MOUNTAIN ? '#6a5a48' :
        t === T.WALL     ? '#201410' :
        t === T.DFLOOR   ? '#201828' :
        t === T.PATH     ? '#b09868' :
        t === T.SAND     ? '#c0a870' :
        t === T.DGRASS   ? '#2a5020' :
        t === T.FLOOR    ? '#906848' : '#386028';
      ctx.fillRect(mx + (x / MW) * mw, my + (y / MH) * mh, mw / MW + 0.5, mh / MH + 0.5);
    }
  }
  monsters.forEach(m => {
    ctx.fillStyle = m.state === 'aggro' ? '#ff3030' : '#ff8020';
    ctx.fillRect(mx + (m.x / MW) * mw, my + (m.y / MH) * mh, 2, 2);
  });
  ctx.fillStyle = '#fff';
  ctx.fillRect(mx + (player.x / MW) * mw - 1, my + (player.y / MH) * mh - 1, 3, 3);
  ctx.strokeStyle = '#444';
  ctx.strokeRect(mx, my, mw, mh);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#505868';
  ctx.font = '8px "Press Start 2P",monospace';
  ctx.fillText('MAP', mx + mw / 2 - 10, my + mh + 10);
}
