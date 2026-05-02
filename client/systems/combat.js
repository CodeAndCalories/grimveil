import { TS } from '../../shared/constants.js';
import { P, SK, MDEFS, ITEMS, monsters, lootPiles, deathFxes, currentZone, eqBonus, CAM } from '../core/state.js';
import { chat, ftext } from '../ui/chat.js';
import { updateHP } from '../ui/sidebar.js';
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
  chat(`You hit the ${MDEFS[mon.type].label} for ${result.dmg}.`, 'hit');
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
  if (result.died) playerDeath();
  else updateHP();
}

export function killMonster(mon, loot = []) {
  chat(`You killed the ${MDEFS[mon.type].label}!`, 'skill');
  killXP(MDEFS, mon.type).forEach(({ skill, amt }) => giveXP(skill, amt));
  deathFxes.push({ x: mon.x, y: mon.y, t: 0, dur: 3000 });
  loot.forEach(lp => {
    lootPiles.push(lp);
    chat(`${MDEFS[mon.type].label} drops: ${lp.qty}x ${ITEMS[lp.item]?.name || lp.item}`, 'loot');
  });
  P.action = null; P.inCombat = false;
  setTimeout(() => {
    const i = monsters.indexOf(mon);
    if (i > -1) monsters.splice(i, 1);
    spawnMon(mon.type, mon.spawnX, mon.spawnY, mon.zone);
  }, 60000);
}

export function playerDeath() {
  chat('💀 You have died! Respawning...', 'death');
  P.hp = Math.max(1, Math.floor(P.maxHp / 2));
  changeZone('overworld', 20, 14);
  P.path = []; P.action = null; P.inCombat = false;
  updateHP();
}
