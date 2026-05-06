import ABILITIES from '../data/abilities.json';
export { ABILITIES };

/**
 * Try to activate an ability.
 * Returns true and mutates player.abilities on success; false if on cooldown or locked.
 */
export function activateAbility(player, abilityId, now) {
  const def = ABILITIES[abilityId];
  const ab  = player.abilities?.[abilityId];
  if (!def || !ab || def.cooldown === 0) return false; // locked / unknown
  if (now < ab.cooldownUntil) return false;            // still on cooldown

  ab.activeUntil   = now + def.duration;
  ab.cooldownUntil = now + def.cooldown;

  if (abilityId === 'ironShield') ab.shieldHp   = 20;
  if (abilityId === 'stunStrike') ab.pendingStun = true;

  return true;
}

/** Returns true while the ability's active window hasn't expired. */
export function isActive(player, abilityId, now) {
  const ab = player.abilities?.[abilityId];
  return ab ? now < ab.activeUntil : false;
}
