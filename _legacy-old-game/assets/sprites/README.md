# Grimveil Sprite Sheets

## Format

Export from Aseprite as **PNG + JSON Hash** (File → Export Sprite Sheet).  
Both files must live in this directory (`assets/sprites/`).  
The JSON `meta.image` field must point to the PNG filename (Aseprite sets this automatically).

## Naming Convention

Frame names use underscores, no file extension in the key:

| Entity | Frame name(s) |
|--------|---------------|
| Player (idle) | `player_idle` |
| Player (walking) | `player_walk_0`, `player_walk_1`, `player_walk_2`, `player_walk_3` |
| Player (combat) | `player_combat` |
| Goblin | `goblin` |
| Cow | `cow` |
| Cave troll | `cave_troll` |
| Dark wizard | `dark_wizard` |
| Training dummy | `training_dummy` |
| Tree | `tree` |
| Oak tree | `oak` |
| Coal rock | `coal_rock` |
| Iron rock | `iron_rock` |
| Fishing spot | `fishing_spot` |
| Bank | `bank` |
| Shop | `shop` |
| Campfire | `campfire` |
| Dungeon entrance | `dungeon_entrance` |
| Dungeon exit | `dungeon_exit` |

## Adding a New Sprite

1. Open `sprites.aseprite` (or create a new Aseprite file at the right size — 32×32 matches one tile).
2. Draw your sprite on its own layer or tag.
3. Export: **File → Export Sprite Sheet** → Output: `assets/sprites/sprites.png`, Data: `assets/sprites/sprites.json`, Format: **JSON Hash**, check "Trim" if desired.
4. The frame will appear automatically in the game next time it loads.

## How the Fallback Works

`SpriteSheet.getSpriteTexture(name)` returns `null` when:
- The atlas file hasn't loaded yet (network error, file missing)
- No frame with that name exists in the atlas

The renderer checks the return value and draws the original colored-rectangle art if `null`. This means the game is always playable even with a missing or incomplete sprite sheet.

## Current Placeholder

`sprites.png` is a 16×16 white square with a grey border — a single frame named `test_square`.  
It is not mapped to any in-game entity, so all entities use colored rectangles until real sprites are added.
