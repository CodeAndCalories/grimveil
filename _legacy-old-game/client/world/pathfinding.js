import { WALKABLE } from '../../shared/constants.js';
import { gameMap, resources, monsters, IACTS, currentZone, MW, MH } from '../core/state.js';

export function walkable(x, y, forMon = false) {
  if (x < 0 || x >= MW || y < 0 || y >= MH) return false;
  if (!WALKABLE.has(gameMap[y]?.[x])) return false;
  if (resources.find(r => r.x === x && r.y === y && r.zone === currentZone && !r.depleted)) return false;
  if (!forMon && monsters.find(m => m.x === x && m.y === y && m.zone === currentZone && m.state !== 'dead')) return false;
  if (!forMon && IACTS.find(i => i.x === x && i.y === y && i.zone === currentZone)) return false;
  return true;
}
