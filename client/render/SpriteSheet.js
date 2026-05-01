import { Assets } from 'pixi.js';

// Texture cache keyed by clean frame name (no .png extension).
const _cache = new Map();
let   _ready = false;

// Load a Pixi-compatible spritesheet (Aseprite JSON Hash export).
// Silently falls back to null-returns if the file is missing or invalid.
export async function loadAtlas(jsonUrl) {
  try {
    const sheet = await Assets.load({
      src: jsonUrl,
      data: { textureOptions: { scaleMode: 'nearest' } },
    });
    // sheet.textures is a {frameName: Texture} map from Pixi's Spritesheet parser.
    // Frame names may include a .png extension depending on how the atlas was authored;
    // we normalise by stripping it so callers always use clean keys.
    Object.entries(sheet.textures ?? {}).forEach(([raw, tex]) => {
      const name = raw.replace(/\.[^.]+$/, '');
      _cache.set(name, tex);
    });
    _ready = true;
    console.log(`[SpriteSheet] loaded ${_cache.size} frame(s) from ${jsonUrl}`);
  } catch (e) {
    // Missing atlas or parse error — all getSpriteTexture calls return null, triggering fallback.
    console.warn(`[SpriteSheet] atlas not loaded (${jsonUrl}): ${e.message}`);
  }
}

// Returns a Pixi Texture for the named frame, or null if unavailable.
export function getSpriteTexture(name) {
  return _ready ? (_cache.get(name) ?? null) : null;
}

// True once the atlas has been successfully parsed.
export function isAtlasReady() { return _ready; }

// Returns all loaded frame names (useful for debugging).
export function listFrames() { return [..._cache.keys()]; }
