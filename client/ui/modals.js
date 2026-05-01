import { P, SK, ITEMS, SHOP_STOCK, COOK } from '../core/state.js';
import { depositItem, withdrawItem } from '../systems/bank.js';
import { buyItem, sellItem } from '../systems/shop.js';
import { cookOne, cookAll } from '../systems/cooking.js';
import { countItem } from '../systems/inventory.js';
import { changeZone } from '../world/Zone.js';
import { chat } from './chat.js';

window._mRefresh = null;
window._mState   = { bankTab: 'deposit', shopTab: 'buy' };

export function closeModal() {
  document.getElementById('modal-container').innerHTML = '';
  window._mRefresh = null;
}

export function openBankUI() {
  function render() {
    const tab   = window._mState.bankTab;
    const items = tab === 'deposit' ? P.inventory : P.bank;
    const rows  = items.map(it => {
      const def = ITEMS[it.item] || {};
      const fn  = tab === 'deposit'
        ? `window._bankDeposit('${it.item}',${it.qty})`
        : `window._bankWithdraw('${it.item}',1)`;
      const label = tab === 'deposit' ? 'All' : '1';
      return `<div class="modal-row">
        <span class="modal-icon">${def.icon || '?'}</span>
        <span class="modal-name">${def.name || it.item}</span>
        <span class="modal-detail">${it.qty}</span>
        <button class="mbtn" onclick="${fn}">${label}</button>
      </div>`;
    }).join('') || '<div class="empty-msg">Nothing here.</div>';

    document.getElementById('modal-container').innerHTML = `
      <div class="modal-overlay" onclick="if(event.target===this)window._closeModal()">
        <div class="modal">
          <div class="modal-title">🏦 BANK
            <span class="modal-close" onclick="window._closeModal()">✕</span>
          </div>
          <div class="modal-tabs">
            <div class="mtab ${tab === 'deposit' ? 'active' : ''}" onclick="window._mState.bankTab='deposit';window._mRefresh()">Deposit (${P.inventory.length})</div>
            <div class="mtab ${tab === 'withdraw' ? 'active' : ''}" onclick="window._mState.bankTab='withdraw';window._mRefresh()">Withdraw (${P.bank.length})</div>
          </div>
          <div class="modal-body">${rows}</div>
        </div>
      </div>`;
  }
  window._mRefresh = render;
  render();
}

export function openShopUI() {
  function render() {
    const tab = window._mState.shopTab;
    let rows  = '';
    if (tab === 'buy') {
      rows = SHOP_STOCK.map(s => {
        const def = ITEMS[s.item] || {};
        const can = countItem('coins') >= s.price;
        return `<div class="modal-row">
          <span class="modal-icon">${def.icon || '?'}</span>
          <span class="modal-name">${def.name || s.item}</span>
          <span class="modal-detail">🪙${s.price}</span>
          <button class="mbtn" onclick="window._shopBuy('${s.item}',${s.price})" ${can ? '' : 'disabled'}>Buy</button>
        </div>`;
      }).join('');
    } else {
      rows = P.inventory.filter(it => it.item !== 'coins').map(it => {
        const def = ITEMS[it.item] || {};
        const sp  = def.sellPrice || Math.floor((SHOP_STOCK.find(s => s.item === it.item)?.price || 6) * 0.4);
        return `<div class="modal-row">
          <span class="modal-icon">${def.icon || '?'}</span>
          <span class="modal-name">${def.name || it.item} (${it.qty})</span>
          <span class="modal-detail">🪙${sp}</span>
          <button class="mbtn sell" onclick="window._shopSell('${it.item}',${sp})">Sell</button>
        </div>`;
      }).join('') || '<div class="empty-msg">Nothing to sell.</div>';
    }
    document.getElementById('modal-container').innerHTML = `
      <div class="modal-overlay" onclick="if(event.target===this)window._closeModal()">
        <div class="modal">
          <div class="modal-title">🛒 SHOP &nbsp;<span style="font-size:11px">🪙${countItem('coins')}</span>
            <span class="modal-close" onclick="window._closeModal()">✕</span>
          </div>
          <div class="modal-tabs">
            <div class="mtab ${tab === 'buy'  ? 'active' : ''}" onclick="window._mState.shopTab='buy';window._mRefresh()">Buy</div>
            <div class="mtab ${tab === 'sell' ? 'active' : ''}" onclick="window._mState.shopTab='sell';window._mRefresh()">Sell</div>
          </div>
          <div class="modal-body">${rows}</div>
        </div>
      </div>`;
  }
  window._mRefresh = render;
  render();
}

export function openCookUI() {
  const cookable = P.inventory.filter(i => COOK[i.item]);
  if (!cookable.length) { chat('Nothing to cook! Catch some fish first.', 'cook'); return; }
  function render() {
    const rows = P.inventory.filter(i => COOK[i.item]).map(it => {
      const def  = ITEMS[it.item] || {};
      const r    = COOK[it.item];
      const burn = Math.max(0, Math.round((r.burnLvl - SK.cooking.level) / r.burnLvl * 100));
      return `<div class="modal-row">
        <span class="modal-icon">${def.icon || '?'}</span>
        <span class="modal-name">${def.name} (${it.qty})</span>
        <span class="modal-detail">${r.xp}xp ~${burn}%🔥</span>
        <button class="mbtn" onclick="window._cookOne('${it.item}')">1</button>
        <button class="mbtn" onclick="window._cookAll('${it.item}')">All</button>
      </div>`;
    }).join('') || '<div class="empty-msg">Nothing to cook.</div>';
    document.getElementById('modal-container').innerHTML = `
      <div class="modal-overlay" onclick="if(event.target===this)window._closeModal()">
        <div class="modal">
          <div class="modal-title">🍳 CAMPFIRE <span style="font-size:10px;color:#e89040">Cooking Lv.${SK.cooking.level}</span>
            <span class="modal-close" onclick="window._closeModal()">✕</span>
          </div>
          <div class="modal-body">${rows}</div>
        </div>
      </div>`;
  }
  window._mRefresh = render;
  render();
}

export function handleInteract(iact) {
  switch (iact.type) {
    case 'bank':             openBankUI();  break;
    case 'shop':             openShopUI();  break;
    case 'campfire':         openCookUI();  break;
    case 'dungeon_entrance': changeZone('dungeon',   14, 3);  break;
    case 'dungeon_exit':     changeZone('overworld', 21, 26); break;
  }
}

// Expose helpers that inline onclick strings call
export function bindModalGlobals() {
  window._closeModal  = closeModal;
  window._bankDeposit = (key, qty) => { depositItem(key, qty); window._mRefresh?.(); };
  window._bankWithdraw= (key, qty) => { withdrawItem(key, qty); window._mRefresh?.(); };
  window._shopBuy     = (key, price) => buyItem(key, price);
  window._shopSell    = (key, price) => sellItem(key, price);
  window._cookOne     = (key) => { cookOne(key); window._mRefresh?.(); };
  window._cookAll     = (key) => { cookAll(key); window._mRefresh?.(); };
}
