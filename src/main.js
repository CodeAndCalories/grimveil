import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import GameScene from './scenes/GameScene.js';
import UIScene   from './scenes/UIScene.js';
import { supabase } from './lib/supabase.js';

// ── Phaser game config ────────────────────────────────────────────────────────
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

// ── Beta access gate ──────────────────────────────────────────────────────────
const BETA_CODE_KEY = 'grimfell_beta_code';
const SAVE_KEY_V5   = 'grimfell_v5';

// Bypass conditions — any one of these skips the gate entirely.
const isDev           = ['localhost', '127.0.0.1', ''].includes(location.hostname);
const hasExistingSave = !!localStorage.getItem(SAVE_KEY_V5);
const hasStoredCode   = !!localStorage.getItem(BETA_CODE_KEY);

function startGame() {
  document.fonts.ready.then(() => new Phaser.Game(config));
}

if (isDev || hasExistingSave || hasStoredCode) {
  startGame();
} else {
  mountBetaGate(startGame);
}

// ── Beta code entry screen ────────────────────────────────────────────────────
function mountBetaGate(onSuccess) {
  const overlay = document.createElement('div');
  overlay.style.cssText = [
    'position:fixed;inset:0;background:#070a14;',
    'display:flex;align-items:center;justify-content:center;',
    "font-family:'Press Start 2P',monospace;z-index:9999;",
  ].join('');

  overlay.innerHTML = `
    <div style="
      background:#0c0b09;
      border:2px solid #9a7828;
      outline:1px solid #3a2808;
      box-shadow:0 0 48px rgba(154,120,40,0.15),inset 0 0 80px rgba(0,0,0,0.5);
      padding:48px 56px;
      text-align:center;
      max-width:440px;
      width:90%;
    ">
      <div style="
        color:#c9a84c;font-size:13px;margin-bottom:12px;
        letter-spacing:3px;text-shadow:0 0 20px rgba(200,160,60,0.4);
      ">
        &#9876; GRIMFELL BETA &#9876;
      </div>
      <div style="
        color:#7a5c24;font-size:7px;margin-bottom:36px;letter-spacing:1px;line-height:1.8;
      ">
        Enter your beta access code
      </div>
      <input id="gf-code" type="text" placeholder="XXXX-XXXX-XXXX"
        autocomplete="off" autocorrect="off" autocapitalize="characters" spellcheck="false"
        maxlength="32"
        style="
          width:100%;box-sizing:border-box;padding:12px 14px;
          background:#0a0906;border:1px solid #6a4c14;color:#e8c060;
          font-family:inherit;font-size:9px;outline:none;margin-bottom:16px;
          letter-spacing:2px;text-align:center;text-transform:uppercase;
        "
      />
      <button id="gf-btn" style="
        width:100%;padding:12px;
        background:#131006;border:1px solid #9a7828;
        color:#c9a84c;font-family:inherit;font-size:9px;cursor:pointer;
        letter-spacing:2px;
      ">ENTER GRIMFELL</button>
      <div id="gf-err" style="
        color:#cc3344;font-size:7px;margin-top:18px;min-height:14px;letter-spacing:1px;
      "></div>
    </div>
  `;

  document.body.appendChild(overlay);

  const input  = overlay.querySelector('#gf-code');
  const btn    = overlay.querySelector('#gf-btn');
  const errDiv = overlay.querySelector('#gf-err');

  const setErr     = (msg) => { errDiv.textContent = msg; };
  const setLoading = (on)  => {
    btn.disabled    = on;
    btn.textContent = on ? 'CHECKING...' : 'ENTER GRIMFELL';
    btn.style.opacity = on ? '0.5' : '1';
    btn.style.cursor  = on ? 'default' : 'pointer';
  };

  const attempt = async () => {
    const code = input.value.trim().toUpperCase();
    if (!code) { setErr('Please enter your beta access code.'); return; }

    if (!supabase) {
      setErr('Beta service unavailable. Check connection.');
      return;
    }

    setLoading(true);
    setErr('');

    try {
      // 1. Verify code exists, is active, and has not been claimed
      const { data, error } = await supabase
        .from('beta_codes')
        .select('code')
        .eq('code', code)
        .eq('is_active', true)
        .is('used_by', null)
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        setErr('Invalid or already used code.');
        setLoading(false);
        return;
      }

      // 2. Claim the code — extra .is('used_by', null) guard prevents race conditions
      const claimedAt = new Date().toISOString();
      const { data: claimed, error: updateErr } = await supabase
        .from('beta_codes')
        .update({ used_by: claimedAt, used_at: claimedAt })
        .eq('code', code)
        .is('used_by', null)
        .select('code');

      if (updateErr || !claimed?.length) {
        // 0 rows updated = someone else claimed it in the same instant
        setErr('Code already claimed. Please try another.');
        setLoading(false);
        return;
      }

      // 3. Persist locally so future loads skip the gate, then launch
      localStorage.setItem(BETA_CODE_KEY, code);
      overlay.remove();
      onSuccess();

    } catch (err) {
      console.error('[beta-gate]', err);
      setErr('Connection error. Please try again.');
      setLoading(false);
    }
  };

  btn.addEventListener('click',    attempt);
  btn.addEventListener('mouseover', () => { if (!btn.disabled) btn.style.background = '#1e1608'; });
  btn.addEventListener('mouseout',  () => { if (!btn.disabled) btn.style.background = '#131006'; });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') attempt(); });
  setTimeout(() => input.focus(), 50);
}
