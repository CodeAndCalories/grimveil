import Phaser from 'phaser';

const GOLD  = '#c9a84c';
const PANEL = 0x0d1230;

export default class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'BootScene' }); }

  preload() {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    // Dark overlay
    const bg = this.add.graphics();
    bg.fillStyle(0x070a14, 1);
    bg.fillRect(0, 0, W, H);

    // Frame
    const FW = 420, FH = 130;
    const FX = (W - FW) / 2, FY = (H - FH) / 2;
    const frame = this.add.graphics();
    frame.fillStyle(PANEL, 1);
    frame.fillRect(FX, FY, FW, FH);
    frame.lineStyle(2, 0xc9a84c, 1);
    frame.strokeRect(FX, FY, FW, FH);
    // inner bevel
    frame.lineStyle(1, 0xc9a84c, 0.2);
    frame.strokeRect(FX + 5, FY + 5, FW - 10, FH - 10);

    this.add.text(W / 2, FY + 22, '⚔  GRIMFELL', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '16px', color: GOLD,
    }).setOrigin(0.5);

    const statusText = this.add.text(W / 2, FY + 52, 'Initialising…', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px', color: '#888',
    }).setOrigin(0.5);

    // Bar track
    const BAR_X = FX + 20, BAR_Y = FY + 72, BAR_W = FW - 40, BAR_H = 18;
    const track = this.add.graphics();
    track.fillStyle(0x050810, 1);
    track.fillRect(BAR_X, BAR_Y, BAR_W, BAR_H);
    track.lineStyle(1, 0xc9a84c, 0.4);
    track.strokeRect(BAR_X, BAR_Y, BAR_W, BAR_H);

    const bar = this.add.graphics();
    let progress = 0;

    // Animate fake load (no assets yet — everything drawn with Graphics)
    const tick = this.time.addEvent({
      delay: 60,
      callback: () => {
        progress = Math.min(1, progress + 0.12);
        bar.clear();
        bar.fillStyle(0xc9a84c, 1);
        bar.fillRect(BAR_X + 2, BAR_Y + 2, (BAR_W - 4) * progress, BAR_H - 4);
        statusText.setText(progress >= 1 ? 'Ready!' : `Loading… ${Math.round(progress * 100)}%`);
      },
      loop: true,
    });

    // No real assets to preload yet
    this.load.on('complete', () => tick.destroy());
  }

  create() {
    // Small pause so the "Ready!" text is visible, then start the game
    this.time.delayedCall(400, () => {
      this.scene.start('GameScene');
      this.scene.launch('UIScene');
    });
  }
}
