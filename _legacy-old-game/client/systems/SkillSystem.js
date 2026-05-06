// Delegates to the Player method; returns { leveledUp, gain, newLevel }.
export function giveXP(player, skillName, amount) {
  return player.giveXP(skillName, amount);
}
