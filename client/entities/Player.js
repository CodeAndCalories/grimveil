import ITEMS_DATA  from '../data/items.json';
import SKILLS_DATA from '../data/skills.json';
import { lvlForXP } from '../../shared/GameMath.js';

export class Player {
  constructor() {
    this.skills = Object.fromEntries(
      Object.entries(SKILLS_DATA).map(([k, v]) => [k, { ...v }])
    );
    this.x = 20; this.y = 14;
    this.hp = 10;
    this.path = []; this.moveTimer = 0; this.moveSpd = 340;
    this.action = null;
    this.inventory = []; this.bank = [];
    // NOTE: stored as `gear` because `equip` is a method name on this class
    this.gear   = { head: null, body: null, legs: null, weapon: null, shield: null, boots: null, tool: null };
    this.hotbar = [null, null, null, null, null];
    this.atkTimer = 0; this.atkSpd = 2400;
    this.inCombat = false; this.lastCombatTime = 0;
    this.immuneUntil = 0;
  }

  // ── Getters ──────────────────────────────────────────────────────────────────

  get maxHp() {
    return 10 + (this.skills.hitpoints.level - 10);
  }

  get combatLevel() {
    return Math.floor(
      (this.skills.defence.level + this.skills.hitpoints.level) / 4 +
      (this.skills.attack.level  + this.skills.strength.level)  / 4
    );
  }

  eqBonus(type) {
    return Object.values(this.gear).reduce((s, k) => {
      if (!k) return s;
      const d = ITEMS_DATA[k];
      return s + (d ? (d[type + 'Bonus'] || 0) : 0);
    }, 0);
  }

  // ── Movement ─────────────────────────────────────────────────────────────────

  move(nx, ny) {
    this.x = nx; this.y = ny;
  }

  // ── Health ───────────────────────────────────────────────────────────────────

  takeDamage(amt) {
    this.hp = Math.max(0, this.hp - amt);
  }

  heal(amt) {
    this.hp = Math.min(this.maxHp, this.hp + amt);
  }

  // ── XP (data only; caller handles UI side-effects) ───────────────────────────

  giveXP(skill, amt) {
    if (!this.skills[skill]) return { leveledUp: false, gain: 0, newLevel: 0 };
    this.skills[skill].xp += amt;
    const newLevel  = lvlForXP(this.skills[skill].xp);
    const leveledUp = newLevel > this.skills[skill].level;
    let gain = 0;
    if (leveledUp) {
      gain = newLevel - this.skills[skill].level;
      this.skills[skill].level = newLevel;
      if (skill === 'hitpoints') this.hp = Math.min(this.hp + gain, this.maxHp);
    }
    return { leveledUp, gain, newLevel };
  }

  // ── Inventory ────────────────────────────────────────────────────────────────

  addItem(key, qty = 1) {
    if (ITEMS_DATA[key]?.stackable) {
      const ex = this.inventory.find(i => i.item === key);
      if (ex) { ex.qty += qty; return true; }
    }
    if (this.inventory.length >= 28) return false;
    this.inventory.push({ item: key, qty });
    return true;
  }

  removeItem(key, qty = 1) {
    const idx = this.inventory.findIndex(i => i.item === key);
    if (idx < 0) return false;
    this.inventory[idx].qty -= qty;
    if (this.inventory[idx].qty <= 0) this.inventory.splice(idx, 1);
    return true;
  }

  countItem(key) {
    return this.inventory.filter(i => i.item === key).reduce((s, i) => s + i.qty, 0);
  }

  // ── Equipment ────────────────────────────────────────────────────────────────

  // Returns { slot, prev, name } on success, null if item has no slot definition.
  equip(key) {
    const def = ITEMS_DATA[key];
    if (!def?.slot) return null;
    const prev = this.gear[def.slot] || null;
    if (prev) this.addItem(prev, 1);
    this.removeItem(key, 1);
    this.gear[def.slot] = key;
    return { slot: def.slot, prev, name: def.name };
  }

  // Returns { key, name } on success, null if slot empty, { full: true } if no inv space.
  unequip(slot) {
    const key = this.gear[slot];
    if (!key) return null;
    if (this.inventory.length >= 28) return { full: true };
    this.addItem(key, 1);
    this.gear[slot] = null;
    return { key, name: ITEMS_DATA[key]?.name };
  }

  // ── Serialization ─────────────────────────────────────────────────────────────

  toJSON() {
    return {
      skills:    Object.fromEntries(Object.entries(this.skills).map(([k, v]) => [k, { xp: v.xp }])),
      inventory: this.inventory,
      bank:      this.bank,
      equip:     this.gear,   // keep save-file key as 'equip' for compatibility
      hotbar:    this.hotbar,
      px: this.x, py: this.y,
      hp: this.hp,
    };
  }

  // Populates `target` in-place (preserves external references like SK = P.skills).
  // Returns the populated instance.
  static fromJSON(data, target = null) {
    const p = target || new Player();
    Object.entries(data.skills || {}).forEach(([k, v]) => {
      if (p.skills[k]) { p.skills[k].xp = v.xp; p.skills[k].level = lvlForXP(v.xp); }
    });
    p.inventory = data.inventory || [];
    p.bank      = data.bank      || [];
    p.gear      = { head: null, body: null, legs: null, weapon: null, shield: null, boots: null, tool: null, ...(data.equip || {}) };
    p.hotbar    = Array.isArray(data.hotbar) ? [...data.hotbar] : [null, null, null, null, null];
    p.hp        = data.hp ?? p.maxHp;
    p.x         = data.px ?? 20;
    p.y         = data.py ?? 14;
    return p;
  }
}
