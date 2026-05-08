import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import GameScene from './scenes/GameScene.js';
import UIScene   from './scenes/UIScene.js';

// Fixed design canvas — matches UIScene's BASE_W/BASE_H so scale=1 at design size.
// Phaser.Scale.FIT CSS-scales the canvas to fit any window while keeping pointer
// input accurate; no gameplay or layout code needs to change.
const GAME_W = 2510;
const GAME_H = 1280;

const config = {
  type: Phaser.AUTO,
  width:  GAME_W,
  height: GAME_H,
  backgroundColor: '#070a14',
  pixelArt: true,
  scale: {
    mode:       Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade:  { gravity: { y: 0 }, debug: false },
  },
  scene: [BootScene, GameScene, UIScene],
};

// ── Password gate (production only) ──────────────────────────────────────────
// Set VITE_SITE_PASSWORD in .env.production.local (gitignored) or your host's
// env config.  Localhost is always unrestricted.  Empty/absent = no gate.

const SITE_PASS = import.meta.env.VITE_SITE_PASSWORD;
const PASS_KEY  = 'grimfell_access';

const isDev      = ['localhost', '127.0.0.1', ''].includes(location.hostname);
const hasPass    = !!SITE_PASS;
const isUnlocked = !hasPass || isDev || localStorage.getItem(PASS_KEY) === SITE_PASS;

function startGame() {
  document.fonts.ready.then(() => new Phaser.Game(config));
}

if (isUnlocked) {
  startGame();
} else {
  mountPasswordGate(SITE_PASS, startGame);
}

function mountPasswordGate(correctPass, onSuccess) {
  const overlay = document.createElement('div');
  overlay.style.cssText = [
    'position:fixed;inset:0;background:#070a14;',
    'display:flex;align-items:center;justify-content:center;',
    'font-family:"Press Start 2P",monospace;z-index:9999;',
  ].join('');

  overlay.innerHTML = `
    <div style="
      background:#0d1230;border:2px solid #c9a84c;padding:40px 48px;
      text-align:center;max-width:360px;width:90%;
    ">
      <div style="color:#c9a84c;font-size:18px;margin-bottom:28px;letter-spacing:2px;">
        &#9876;&nbsp; GRIMFELL
      </div>
      <input id="gf-pw" type="password" placeholder="Access code"
        style="
          width:100%;box-sizing:border-box;padding:10px 12px;
          background:#050810;border:1px solid #c9a84c;color:#e8d8a0;
          font-family:inherit;font-size:9px;outline:none;margin-bottom:16px;
        "
        autocomplete="current-password"
      />
      <button id="gf-btn" style="
        width:100%;padding:10px;background:#c9a84c;border:none;
        color:#070a14;font-family:inherit;font-size:9px;cursor:pointer;
        letter-spacing:1px;
      ">ENTER</button>
      <div id="gf-err" style="color:#cc3344;font-size:7px;margin-top:14px;min-height:12px;"></div>
    </div>
  `;

  document.body.appendChild(overlay);

  const input  = overlay.querySelector('#gf-pw');
  const btn    = overlay.querySelector('#gf-btn');
  const errMsg = overlay.querySelector('#gf-err');

  const attempt = () => {
    if (input.value === correctPass) {
      localStorage.setItem(PASS_KEY, correctPass);
      overlay.remove();
      onSuccess();
    } else {
      errMsg.textContent = 'Incorrect access code.';
      input.value = '';
      input.focus();
    }
  };

  btn.addEventListener('click', attempt);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') attempt(); });
  // Auto-focus after a tick so the browser doesn't block it
  setTimeout(() => input.focus(), 50);
}
