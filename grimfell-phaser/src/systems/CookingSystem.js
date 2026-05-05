// Returns { blocked: null }      — item not cookable
//       | { blocked: string }     — level requirement not met
//       | { burned: bool, result: itemKey, xp: number }
export function cookOne(player, itemKey, cook) {
  const r = cook[itemKey];
  if (!r) return { blocked: null };
  if (player.skills.cooking.level < r.reqLvl) {
    return { blocked: `Need Cooking ${r.reqLvl}.` };
  }
  const lvl = player.skills.cooking.level;
  const burnChance = 'baseBurnChance' in r
    ? Math.max(
        r.minBurnChance ?? 0,
        r.baseBurnChance - (lvl - 1) * (r.burnReductionPerLevel ?? 0)
      )
    : Math.max(0, (r.burnLvl - lvl) / r.burnLvl);
  const burned = Math.random() < burnChance;
  return {
    burned,
    result: burned ? 'burnt_fish' : r.result,
    xp:     burned ? 0 : r.xp,
  };
}
