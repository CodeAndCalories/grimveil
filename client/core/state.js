import { ZONE_SIZES, CW, CH } from '../../shared/constants.js';
import { updateCam as _camUpdate } from '../world/Camera.js';

const ZOOM_KEY = 'grimveil_zoom';
export let zoom = (() => {
  const v = parseFloat(localStorage.getItem(ZOOM_KEY));
  return isNaN(v) ? 1.5 : Math.max(1.0, Math.min(2.5, v));
})();
export function setZoom(z) {
  zoom = Math.max(1.0, Math.min(2.5, Math.round(z / 0.25) * 0.25));
  localStorage.setItem(ZOOM_KEY, zoom);
}
import { Player } from '../entities/Player.js';
import ITEMS_DATA    from '../data/items.json';
import MONSTERS_DATA from '../data/monsters.json';
import RDEFS_DATA    from '../data/resources.json';
import SHOP_DATA     from '../data/shop.json';
import ZONES_DATA    from '../data/zones.json';
import EQ_SLOTS_DATA from '../data/eqSlots.json';

// ── Static definitions (read-only game data) ────────────────────────────────
export const ITEMS      = ITEMS_DATA;
export const MDEFS      = MONSTERS_DATA;
export const RDEFS      = RDEFS_DATA;
export const SHOP_STOCK = SHOP_DATA.stock;
export const COOK       = SHOP_DATA.cooking;
export const ZONES_CFG  = ZONES_DATA;
export const EQ_SLOTS   = EQ_SLOTS_DATA;

// ── Player ──────────────────────────────────────────────────────────────────
export const P = new Player();

// SK is a live alias for P.skills — any mutation to P.skills is visible through SK.
// All existing code that imports SK continues to work without changes.
export const SK = P.skills;

// ── World state (mutable) ───────────────────────────────────────────────────
export let currentZone = 'overworld';
export let MW = ZONE_SIZES.overworld.w;
export let MH = ZONE_SIZES.overworld.h;
export let gameMap   = [];
export let resources = [];
export let monsters  = [];
export let lootPiles  = [];
export let ftexts     = [];
export let deathFxes  = [];
export const IACTS   = [];

// ── ID generator ────────────────────────────────────────────────────────────
let _nid = 1;
export const uid = () => _nid++;

// ── Setters for module-level primitives ─────────────────────────────────────
export function setZone(name) {
  currentZone = name;
  const sz = ZONE_SIZES[name];
  MW = sz.w;
  MH = sz.h;
}

export function setMap(map)      { gameMap   = map; }
export function setResources(r)  { resources = r; }
export function setMonsters(m)   { monsters  = m; }
export function setLootPiles(lp)  { lootPiles  = lp; }
export function setFtexts(ft)     { ftexts     = ft; }
export function setDeathFxes(df)  { deathFxes  = df; }

// ── Camera ───────────────────────────────────────────────────────────────────
export const CAM = { x: 0, y: 0 };

export function updateCam() {
  const pos = _camUpdate(P, MW, MH, CW, CH, zoom);
  CAM.x = pos.x; CAM.y = pos.y;
}

// ── Equipment bonus (delegates to Player) ────────────────────────────────────
export function eqBonus(type) { return P.eqBonus(type); }
