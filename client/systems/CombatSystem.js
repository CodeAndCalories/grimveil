import { rnd, resolveLootQty, calcPlayerHit, calcPlayerMaxHit, calcMonHit, calcMonMaxHit } from '../../shared/GameMath.js';

// Returns { hit: false } | { hit: true, dmg, killed, loot[] }
export function attackMonster(player, monster, mdefs, eqBonusFn) {
  const def = mdefs[monster.type];
  const hit = calcPlayerHit(player.skills.attack.level, eqBonusFn('atk'), def.def);
  if (!hit) return { hit: false };

  const dmg = rnd(1, calcPlayerMaxHit(player.skills.strength.level, eqBonusFn('str')));
  monster.takeDamage(dmg);

  if (def.immortal) {
    monster.reset();
    return { hit: true, dmg, killed: false, loot: [] };
  }

  if (monster.hp > 0) return { hit: true, dmg, killed: false, loot: [] };

  monster.die();
  const loot = [];
  def.loot.forEach(e => {
    if (Math.random() < e.ch) {
      loot.push({ x: monster.x, y: monster.y, item: e.item, qty: resolveLootQty(e.qty) });
    }
  });
  return { hit: true, dmg, killed: true, loot };
}

// Returns { hit: false } | { hit: true, dmg, died }
export function monsterAttacksPlayer(monster, player, mdefs, eqBonusFn) {
  const def = mdefs[monster.type];
  const hit = calcMonHit(def.atk, player.skills.defence.level, eqBonusFn('def'));
  if (!hit) return { hit: false };

  const dmg = rnd(1, calcMonMaxHit(def.str));
  player.takeDamage(dmg);
  return { hit: true, dmg, died: player.hp <= 0 };
}

// Returns xp grants for killing a monster: [{ skill, amt }]
export function killXP(mdefs, monType) {
  const d = mdefs[monType];
  return [
    { skill: 'attack',  amt: Math.floor(d.xp * 0.4) },
    { skill: 'strength',amt: Math.floor(d.xp * 0.4) },
    { skill: 'defence', amt: Math.floor(d.xp * 0.2) },
  ];
}
