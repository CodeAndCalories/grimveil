// XP table: index = level, value = total XP needed
export const XPT = [0, 0];
(() => {
  let t = 0;
  for (let i = 1; i < 99; i++) {
    t += Math.floor(i + 300 * Math.pow(2, i / 7));
    XPT.push(Math.floor(t / 4));
  }
})();

export function lvlForXP(xp) {
  for (let i = 98; i >= 1; i--) if (xp >= XPT[i]) return i;
  return 1;
}

export function xpProg(sk) {
  const l = sk.level;
  const a = XPT[l] || 0;
  const b = XPT[l + 1] || (a + 9999);
  return Math.min(1, (sk.xp - a) / (b - a));
}

export function rnd(a, b) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

// Resolve a loot qty entry: number → fixed, [min,max] → random range
export function resolveLootQty(qty) {
  return Array.isArray(qty) ? rnd(qty[0], qty[1]) : qty;
}

// Combat formulas
export function calcPlayerMaxHit(strengthLvl, strBonus) {
  return Math.max(1, Math.floor(1.3 + (strengthLvl + strBonus) * 0.5));
}

export function calcPlayerHit(attackLvl, atkBonus, targetDef) {
  const a = Math.random() * (attackLvl + atkBonus + 5);
  const d = Math.random() * (targetDef + 5);
  return a > d;
}

export function calcMonHit(monAtk, playerDefLvl, defBonus) {
  const a = Math.random() * (monAtk + 3);
  const d = Math.random() * (playerDefLvl + defBonus + 3);
  return a > d;
}

export function calcMonMaxHit(monStr) {
  return Math.max(1, Math.floor(1 + monStr * 0.5));
}

export function combatLevel(SK) {
  return Math.floor(
    (SK.defence.level + SK.hitpoints.level) / 4 +
    (SK.attack.level + SK.strength.level) / 4
  );
}
