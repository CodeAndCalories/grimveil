import { ITEMS } from '../core/state.js';
import { chat } from '../ui/chat.js';
import { addItem, removeItem, countItem } from './inventory.js';

export function buyItem(key, price) {
  if (countItem('coins') < price) { chat('Not enough coins!', 'shop'); return; }
  removeItem('coins', price);
  addItem(key, 1);
  chat(`Bought ${ITEMS[key]?.name || key} for ${price} coins.`, 'shop');
  if (window._mRefresh) window._mRefresh();
}

export function sellItem(key, price) {
  if (!removeItem(key, 1)) return;
  addItem('coins', price);
  chat(`Sold ${ITEMS[key]?.name || key} for ${price} coins.`, 'shop');
  if (window._mRefresh) window._mRefresh();
}
