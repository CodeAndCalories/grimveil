import { P } from '../core/state.js';
import { chat } from '../ui/chat.js';
import { renderEquip, updateHP } from '../ui/sidebar.js';

export function equipItem(key) {
  const result = P.equip(key);
  if (!result) return;
  if (result.prev) chat(`Unequipped ${result.prev}.`, 'info');
  chat(`Equipped ${result.name}.`, 'skill');
  renderEquip(); updateHP();
}

export function unequipSlot(slot) {
  const result = P.unequip(slot);
  if (!result) return;
  if (result.full) { chat('Inventory full!', 'info'); return; }
  chat(`Unequipped ${result.name}.`, 'info');
  renderEquip(); updateHP();
}
