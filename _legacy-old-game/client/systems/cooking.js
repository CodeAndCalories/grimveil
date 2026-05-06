import { P, ITEMS, COOK } from '../core/state.js';
import { chat } from '../ui/chat.js';
import { addItem, removeItem, countItem } from './inventory.js';
import { giveXP } from './xp.js';
import { cookOne as _cookOne } from './CookingSystem.js';

export function cookOne(key) {
  const result = _cookOne(P, key, COOK);
  if (result.blocked == null) return;
  if (result.blocked) { chat(result.blocked, 'info'); return; }
  if (!removeItem(key, 1)) return;
  addItem(result.result, 1);
  if (result.burned) {
    chat('You accidentally burn the fish.', 'cook');
  } else {
    giveXP('cooking', result.xp);
    chat(`You cook the ${ITEMS[key].name}.`, 'cook');
  }
}

export function cookAll(key) {
  const c = countItem(key);
  for (let i = 0; i < c; i++) cookOne(key);
}
