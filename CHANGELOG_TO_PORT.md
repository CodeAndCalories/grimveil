## 2026-05-15

### Audio
- melody1.mp3, melody2.mp3, dungeon1.mp3 added
- Zone-based music switching (overworld vs dungeon)
- Music toggle + volume slider in ESC options menu

### Hollow Warden Boss
- hollow_warden_sheet.png added (96x96, 2x5 frames)
- Spawns in Hollow Crypt dungeon
- 5-attack slam telegraph mechanic
- Purple warning circle before slam
- Stun if player doesn't move 4 tiles away
- Boss HP bar at top of screen
- Aura fixed to sprite size

### Combat XP Balance
- Chicken: 12 XP, Rat: 8 XP, Goblin: 28 XP
- Skeleton: 45 XP, Grimshade: 80 XP
- Hollow Warden: 300 XP

### Phaser Fixes (2026-05-18)
- **Herb depletion** — all 5 herb nodes now deplete (depChance + respawn added to resources.json) ✅ PORTED to Phaser
- **Single combat lock** — clicking different mob while in combat blocked; shows "You are already in combat." ✅ PORTED to Phaser
- **Ambient aggro** — non-combat-target mobs in agro range chase but cannot attack (single-attacker rule) ✅ PORTED to Phaser
- **XP rebalance** — Rat 80, Goblin 120, Skeleton 190, Grimshade 800 ✅ PORTED to Phaser
- **Icon white backgrounds** — apprentice_staff, training_bow, shortbow, cracked_staff PNGs had white BG; fixed via pixel processing in GameScene._fixWhiteIconBg ✅ PORTED to Phaser | ⚠️ NEEDS FIX IN BABYLON TOO

### Babylon Status
- Audio: not yet ported
- Hollow Warden Boss: not yet ported
- Herb depletion: ported to Phaser ✅
- Single combat lock: ported to Phaser ✅
- Ambient aggro / single attacker: ported to Phaser ✅
- XP rebalance: ported to Phaser ✅
- Icon white BG fix: needs fix in Babylon ⚠️
