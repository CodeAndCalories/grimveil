export class RemotePlayer {
  constructor(playerId, x, y, name, zone) {
    this.playerId = playerId;
    this.x = x; this.y = y;       // logical tile position
    this.targetX = x; this.targetY = y;
    this.renderX = x; this.renderY = y; // sub-tile lerp position
    this.name = name || 'Adventurer';
    this.zone = zone || 'overworld';
  }

  setTarget(x, y, zone) {
    this.x = x; this.y = y;
    this.targetX = x; this.targetY = y;
    if (zone) this.zone = zone;
  }

  // Call each game-loop tick with delta-ms to advance lerp
  tick(dt) {
    const t = Math.min(1, dt / 100); // reach target in ~100 ms
    this.renderX += (this.targetX - this.renderX) * t;
    this.renderY += (this.targetY - this.renderY) * t;
  }
}
