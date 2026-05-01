import { SAVE_KEY } from '../../shared/constants.js';
import { P, currentZone, setZone, updateCam } from '../core/state.js';
import { Player } from '../entities/Player.js';
import { buildZone } from '../world/Zone.js';
import { chat } from '../ui/chat.js';

export function saveGame() {
  localStorage.setItem(SAVE_KEY, JSON.stringify({ ...P.toJSON(), zone: currentZone }));
  chat('💾 Game saved!', 'sys');
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);

    Player.fromJSON(d, P);

    const zoneName = d.zone || 'overworld';
    setZone(zoneName);
    buildZone(zoneName);
    P.x = d.px ?? 20;
    P.y = d.py ?? 14;
    updateCam();

    chat('💾 Save loaded!', 'sys');
    return true;
  } catch (e) {
    chat('Failed to load save.', 'info');
    return false;
  }
}
