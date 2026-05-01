// Returns { blocked: string } | { item, qty, xp, skill, depleted, label }
export function gatherResource(player, resource, rdefs) {
  const d = rdefs[resource.type];
  if (player.skills[d.skill].level < d.lvlReq) {
    return { blocked: `Need level ${d.lvlReq} ${d.skill}.` };
  }
  const depleted = Math.random() < d.depChance;
  return { item: d.loot, qty: 1, xp: d.xp, skill: d.skill, depleted, label: d.label };
}
