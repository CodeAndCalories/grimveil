// Returns the gather speed multiplier for the currently equipped tool.
// Returns 1 if no tool is equipped or the tool doesn't match the skill.
export function toolBonus(player, skill, items) {
  const key = player.gear?.tool;
  if (!key) return 1;
  const def = items[key];
  if (!def || def.toolSkill !== skill) return 1;
  return def.gatherBonus ?? 1;
}

// Returns { blocked: string } | { item, qty, xp, skill, depleted, label }
export function gatherResource(player, resource, rdefs) {
  const d = rdefs[resource.type];
  if (player.skills[d.skill].level < d.lvlReq) {
    return { blocked: `Need level ${d.lvlReq} ${d.skill}.` };
  }
  const depleted = Math.random() < d.depChance;
  return {
    item:     d.loot,
    qty:      1,
    xp:       d.xp,
    skill:    d.skill,
    depleted,
    label:    d.label,
  };
}
