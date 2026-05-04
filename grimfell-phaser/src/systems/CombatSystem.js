import {
  rnd,
  resolveLootQty,
  calcPlayerHit,
  calcMonHit,
  calcMonMaxHit,
} from '../shared/GameMath.js';
import ITEMS_DATA from '../data/items.json';

// Returns { hit: false } | { hit: true, dmg, killed, loot[] }
// dmgMult: optional damage multiplier (e.g. 1.5 for Enrage)
export function attackMonster(player, monster, mdefs, eqBonusFn, dmgMult = 1) {
  const def = mdefs[monster.type];

  const wepKey   = player.gear?.weapon ?? null;
  const wepDef   = wepKey ? ITEMS_DATA[wepKey] : null;
  const style    = wepDef?.combatStyle ?? 'melee';
  const styleLvl = player.skills[style]?.level ?? 1;
  const wDmg     = wepDef?.weaponDamage   ?? (wepDef?.strBonus   ?? 0);
  const wAcc     = wepDef?.weaponAccuracy ?? (wepDef?.atkBonus   ?? 0);
  const accuracy = wAcc + styleLvl * 2;
  const maxHit   = Math.max(1, 1 + wDmg + Math.floor(styleLvl / 5));

  const hit = calcPlayerHit(0, accuracy, def.def);
  if (!hit) return { hit: false };

  const raw = rnd(1, maxHit);
  const dmg = Math.max(1, Math.floor(raw * dmgMult));
  monster.takeDamage(dmg);

  if (def.immortal) {
    monster.reset();
    return { hit: true, dmg, killed: false, loot: [] };
  }

  if (monster.hp > 0) return { hit: true, dmg, killed: false, loot: [] };

  monster.die();
  const loot = [];
  def.loot.forEach(entry => {
    if (Math.random() < entry.ch) {
      loot.push({
        x:    monster.x,
        y:    monster.y,
        item: entry.item,
        qty:  resolveLootQty(entry.qty),
      });
    }
  });
  return { hit: true, dmg, killed: true, loot };
}

// Returns { hit: false } | { hit: true, dmg, died }
// dmgReducer: optional fn(dmg) → reducedDmg (e.g. Iron Shield absorption)
export function monsterAttacksPlayer(monster, player, mdefs, eqBonusFn, dmgReducer = null) {
  const def = mdefs[monster.type];
  const hit = calcMonHit(def.atk, player.skills.defence.level, eqBonusFn('def'));
  if (!hit) return { hit: false };

  let dmg = rnd(1, calcMonMaxHit(def.str));
  if (dmgReducer) dmg = Math.max(0, dmgReducer(dmg));

  player.takeDamage(dmg);
  return { hit: true, dmg, died: player.hp <= 0 };
}

// Returns XP grants for killing a monster: [{ skill, amt }]
// combatStyle: main combat skill to award (determined by equipped weapon, defaults to 'melee')
export function killXP(mdefs, monType, combatStyle = 'melee') {
  const d = mdefs[monType];
  return [
    { skill: combatStyle, amt: Math.floor(d.xp * 0.8) },
    { skill: 'defence',   amt: Math.floor(d.xp * 0.2) },
  ];
}
