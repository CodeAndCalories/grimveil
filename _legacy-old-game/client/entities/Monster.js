import MDEFS_DATA from '../data/monsters.json';
import { rnd } from '../../shared/GameMath.js';

let _nextId = 1;

export class Monster {
  constructor(id, type, x, y, zone, def) {
    this.id          = id;
    this.type        = type;
    this.x           = x;  this.y      = y;
    this.spawnX      = x;  this.spawnY = y;
    this.zone        = zone;
    this.hp          = def.maxHp;
    this.maxHp       = def.maxHp;
    this.state       = 'idle';
    this.target      = null;
    this.moveTimer   = 0;
    this.atkTimer    = 0;
    this.wanderTimer = rnd(500, 3000);
  }

  takeDamage(amt) {
    this.hp = Math.max(0, this.hp - amt);
  }

  die() {
    this.hp    = 0;
    this.state = 'dead';
  }

  // Teleport back to spawn and restore full health.
  reset() {
    this.x      = this.spawnX;
    this.y      = this.spawnY;
    this.hp     = this.maxHp;
    this.state  = 'idle';
    this.target = null;
  }

  static spawn(type, x, y, zone = 'overworld') {
    const def = MDEFS_DATA[type];
    return new Monster(_nextId++, type, x, y, zone, def);
  }
}
