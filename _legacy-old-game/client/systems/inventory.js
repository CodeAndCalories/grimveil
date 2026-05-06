import { P } from '../core/state.js';
import { chat } from '../ui/chat.js';
import { renderInv } from '../ui/sidebar.js';

export function addItem(key, qty = 1) {
  const ok = P.addItem(key, qty);
  if (!ok) chat('Inventory full!', 'info');
  else renderInv();
  return ok;
}

export function removeItem(key, qty = 1) {
  const ok = P.removeItem(key, qty);
  if (ok) renderInv();
  return ok;
}

export function countItem(key) {
  return P.countItem(key);
}
