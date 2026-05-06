import { TS } from '../../shared/constants.js';

export function updateCam(player, mapW, mapH, canvasW, canvasH, zoom = 1) {
  const vw = canvasW / zoom;
  const vh = canvasH / zoom;
  return {
    x: Math.max(0, Math.min(player.x * TS - vw / 2 + TS / 2, mapW * TS - vw)),
    y: Math.max(0, Math.min(player.y * TS - vh / 2 + TS / 2, mapH * TS - vh)),
  };
}
