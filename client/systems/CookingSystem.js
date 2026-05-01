// Returns { blocked: string } | { burned: bool, result: itemKey, xp: number }
export function cookOne(player, itemKey, cook) {
  const r = cook[itemKey];
  if (!r) return { blocked: null };
  if (player.skills.cooking.level < r.reqLvl) {
    return { blocked: `Need Cooking ${r.reqLvl}.` };
  }
  const burnChance = Math.max(0, (r.burnLvl - player.skills.cooking.level) / r.burnLvl);
  const burned = Math.random() < burnChance;
  return { burned, result: burned ? 'burnt_fish' : r.result, xp: burned ? 0 : r.xp };
}
