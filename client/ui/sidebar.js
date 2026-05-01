import { xpProg, combatLevel } from '../../shared/GameMath.js';
import { TS } from '../../shared/constants.js';
import { P, SK, ITEMS, EQ_SLOTS, CAM, eqBonus } from '../core/state.js';
import { chat, ftext } from './chat.js';
// Note: equipment.js also imports from this file (renderEquip, updateHP).
// ES modules handle this circular reference correctly at runtime.
import { equipItem, unequipSlot } from '../systems/equipment.js';
import { removeItem } from '../systems/inventory.js';

export function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tab);
  });
  document.querySelectorAll('.tabpanel').forEach(el => el.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
  if (tab === 'skills') renderSkills();
  if (tab === 'inv')    renderInv();
  if (tab === 'combat') { renderEquip(); updateHP(); }
}

export function updateHP() {
  const pct = P.hp / P.maxHp * 100;
  const f = document.getElementById('hpfill');
  const v = document.getElementById('hpval');
  if (f) f.style.width = pct + '%';
  if (v) v.textContent = `${P.hp}/${P.maxHp}`;
  const cl = document.getElementById('cmbatlvl');
  if (cl) {
    const tot = eqBonus('atk') + eqBonus('str') + eqBonus('def');
    cl.textContent = `Combat Lv.${combatLevel(SK)}   Bonus:+${tot}`;
  }
}

export function updateCoins() {
  const el = document.getElementById('coinsval');
  if (el) el.textContent = P.countItem('coins').toLocaleString();
}

export function renderSkills() {
  const el = document.getElementById('skillpanel');
  if (!el) return;
  el.innerHTML = '';
  Object.entries(SK).forEach(([, sk]) => {
    const prog = (xpProg(sk) * 100).toFixed(1);
    const d = document.createElement('div');
    d.innerHTML = `<div class="ski"><span class="skiico">${sk.icon}</span><span class="skiname">${sk.label}</span><span class="skilv">${sk.level}</span></div><div class="xbar"><div class="xfill" style="width:${prog}%"></div></div>`;
    el.appendChild(d);
  });
}

export function renderEquip() {
  const g = document.getElementById('eqgrid');
  if (!g) return;
  g.innerHTML = '';
  EQ_SLOTS.forEach(slot => {
    const eq  = P.gear[slot.id];
    const def = eq ? ITEMS[eq] : null;
    const d   = document.createElement('div');
    d.className = `eqslot${eq ? ' has' : ''}`;
    d.title = def ? `${def.name} (click to unequip)` : slot.label;
    if (eq) {
      const b = [
        (def.atkBonus || 0) > 0 ? `A+${def.atkBonus}` : '',
        (def.strBonus || 0) > 0 ? `S+${def.strBonus}` : '',
        (def.defBonus || 0) > 0 ? `D+${def.defBonus}` : '',
      ].filter(Boolean).join(' ');
      d.innerHTML = `<span style="font-size:17px">${def.icon || '?'}</span><span class="eqbonus">${b}</span>`;
      d.onclick = () => unequipSlot(slot.id);
    } else {
      d.innerHTML = `<span class="eqslotlabel">${slot.icon}</span><span class="eqslotlabel">${slot.label}</span>`;
    }
    g.appendChild(d);
  });
}

export function renderInv() {
  const g = document.getElementById('invgrid');
  if (!g) return;
  g.innerHTML = '';
  const cnt = document.getElementById('invcount');
  if (cnt) cnt.textContent = `${P.inventory.length}/28`;
  for (let i = 0; i < 28; i++) {
    const c  = document.createElement('div');
    const it = P.inventory[i];
    if (it) {
      const def  = ITEMS[it.item];
      const isEq = def?.slot && Object.values(P.gear).includes(it.item);
      c.className = `icel hasi${isEq ? ' equipped' : ''}`;
      c.innerHTML = `${def?.icon || '?'}${it.qty > 1 ? `<span class="iqty">${it.qty}</span>` : ''}`;
      c.title = def
        ? `${def.name}${def.slot ? '\n[Click to equip]' : def.heal ? '\n[Click to eat]' : ''}`
        : it.item;
      c.onclick = () => {
        if (def?.slot)      { equipItem(it.item); switchTab('combat'); }
        else if (def?.heal) eatItem(it.item, def.heal);
      };
    } else {
      c.className = 'icel emp';
    }
    g.appendChild(c);
  }
  if (window._mRefresh) window._mRefresh();
}

export function eatItem(key, heal) {
  if (P.hp >= P.maxHp) { chat('You are already at full health!', 'info'); return; }
  removeItem(key, 1);
  const actual = Math.min(heal, P.maxHp - P.hp);
  P.heal(heal);
  chat(`You eat the ${ITEMS[key]?.name || key}. Healed ${actual} HP.`, 'cook');
  ftext(P.x * TS - CAM.x + TS / 2, P.y * TS - CAM.y - 8, `+${actual}hp`, '#38b860');
  updateHP();
}
