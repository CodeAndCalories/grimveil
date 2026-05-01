import { P, RDEFS, ITEMS } from '../core/state.js';
import { chat } from '../ui/chat.js';
import { addItem } from './inventory.js';
import { giveXP } from './xp.js';
import { gatherResource } from './GatherSystem.js';

export function gatherRes(res) {
  const result = gatherResource(P, res, RDEFS);
  if (result.blocked) { chat(result.blocked, 'info'); P.action = null; return; }

  giveXP(result.skill, result.xp);
  if (!addItem(result.item, result.qty)) { P.action = null; return; }
  chat(`You got some ${ITEMS[result.item].name}.`, 'skill');

  if (result.depleted) {
    res.depleted = true;
    setTimeout(() => { res.depleted = false; }, RDEFS[res.type].respawn);
    chat(`The ${result.label} is depleted.`, 'info');
    P.action = null;
  } else {
    P.action.timer = 0;
  }
}
