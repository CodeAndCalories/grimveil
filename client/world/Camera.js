import { TS } from '../../shared/constants.js';

export function updateCam(player, mapW, mapH, canvasW, canvasH) {
  return {
    x: Math.max(0, Math.min(player.x * TS - canvasW / 2 + TS / 2, mapW * TS - canvasW)),
    y: Math.max(0, Math.min(player.y * TS - canvasH / 2 + TS / 2, mapH * TS - canvasH)),
  };
}
