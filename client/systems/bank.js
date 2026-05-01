import { P, ITEMS } from '../core/state.js';
import { chat } from '../ui/chat.js';
import { addItem, removeItem } from './inventory.js';

export function depositItem(key, qty = 1) {
  if (!removeItem(key, qty)) return;
  const ex = P.bank.find(i => i.item === key);
  if (ex) ex.qty += qty;
  else P.bank.push({ item: key, qty });
  chat(`Deposited ${qty}x ${ITEMS[key]?.name || key}.`, 'bank');
}

export function withdrawItem(key, qty = 1) {
  const ex = P.bank.find(i => i.item === key);
  if (!ex || ex.qty < qty) { chat('Not enough in bank.', 'info'); return; }
  if (!addItem(key, qty)) return;
  ex.qty -= qty;
  if (ex.qty <= 0) P.bank.splice(P.bank.indexOf(ex), 1);
  chat(`Withdrew ${qty}x ${ITEMS[key]?.name || key}.`, 'bank');
}
