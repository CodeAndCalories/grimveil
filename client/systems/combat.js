import { TS } from '../../shared/constants.js';
import { P, SK, MDEFS, ITEMS, monsters, lootPiles, deathFxes, currentZone, eqBonus, CAM, setDead } from '../core/state.js';
import { chat, ftext } from '../ui/chat.js';
import { updateHP, updateCoins, renderInv } from '../ui/sidebar.js';
import { giveXP } from './xp.js';
import { spawnMon, changeZone } from '../world/Zone.js';
import { attackMonster as _attack, monsterAttacksPlayer as _monAtk, killXP } from './CombatSystem.js';

export function attackMonster(mon) {
  const result = _attack(P, mon, MDEFS, eqBonus);
  if (!result.hit) {
    chat(`You miss the ${MDEFS[mon.type].label}.`, 'miss');
    ftext(mon.x * TS - CAM.x + TS / 2, mon.y * TS - CAM.y + 4, 'miss', '#606070');
    return;
  }
  chat(`You hit the ${MDEFS[mon.type].label} for ${result.dmg}.`, 'dmgout');
  ftext(mon.x * TS - CAM.x + TS / 2, mon.y * TS - CAM.y + 4, `-${result.dmg}`, '#e05050');
  giveXP('attack',    Math.floor(result.dmg * 2));
  giveXP('strength',  Math.floor(result.dmg * 2));
  giveXP('hitpoints', Math.floor(result.dmg * 1.3));
  if (result.killed) killMonster(mon, result.loot);
}

export function monsterAttacksPlayer(mon) {
  const result = _monAtk(mon, P, MDEFS, eqBonus);
  const d = MDEFS[mon.type];
  if (!result.hit) {
    chat(`The ${d.label} misses you.`, 'miss');
    return;
  }
  chat(`The ${d.label} hits you for ${result.dmg}!`, 'hit');
  ftext(P.x * TS - CAM.x + TS / 2, P.y * TS - CAM.y + 4, `-${result.dmg}`, '#ff3838');
  if (result.died) playerDeath(d.label);
  else updateHP();
}

export function killMonster(mon, loot = []) {
  const label = MDEFS[mon.type].label;
  let totalXP = 0;
  killXP(MDEFS, mon.type).forEach(({ skill, amt }) => { giveXP(skill, amt); totalXP += amt; });
  deathFxes.push({ x: mon.x, y: mon.y, t: 0, dur: 3000 });
  loot.forEach(lp => lootPiles.push(lp));

  let summary = `Killed ${label} — earned ${totalXP} XP`;
  if (loot.length) {
    const parts = loot.map(lp => `${lp.qty}x ${ITEMS[lp.item]?.name || lp.item}`).join(', ');
    summary += `, looted ${parts}`;
  }
  chat(summary, 'kill');
  P.action = null; P.inCombat = false;
  setTimeout(() => {
    const i = monsters.indexOf(mon);
    if (i > -1) monsters.splice(i, 1);
    spawnMon(mon.type, mon.spawnX, mon.spawnY, mon.zone);
  }, 60000);
}

export function playerDeath(killerLabel = 'the wilderness') {
  // 10% of carried coins permanently lost
  const carriedCoins = P.countItem('coins');
  const coinsLost = Math.floor(carriedCoins * 0.1);
  if (coinsLost > 0) P.removeItem('coins', coinsLost);

  // Drop entire inventory as a timed gravestone at death tile
  const gx = P.x, gy = P.y;
  const expires = Date.now() + 3 * 60 * 1000;
  [...P.inventory].forEach(slot => {
    lootPiles.push({ x: gx, y: gy, item: slot.item, qty: slot.qty, isGrave: true, expires, zone: currentZone });
  });
  P.inventory = [];

  // Freeze game and de-aggro all monsters
  setDead(true);
  P.path = []; P.action = null; P.inCombat = false;
  monsters.forEach(m => { m.state = 'idle'; m.target = null; m.atkTimer = 0; });

  // Update sidebar to reflect cleared inventory
  renderInv();
  updateCoins();
  updateHP();

  // Populate and show the death overlay
  document.getElementById('death-cause').textContent = `Killed by ${killerLabel}`;
  document.getElementById('death-coins').textContent =
    coinsLost > 0 ? `${coinsLost} coin${coinsLost !== 1 ? 's' : ''} lost permanently` : 'No coins lost';
  const ov = document.getElementById('death-overlay');
  ov.classList.remove('fadeout');
  void ov.offsetWidth; // force reflow so animation restarts
  ov.classList.add('active');

  chat(`💀 Killed by ${killerLabel}! Your items await at the grave for 3 minutes.`, 'death');
}
