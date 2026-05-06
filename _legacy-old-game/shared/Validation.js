// Input validation stubs (used server-side when multiplayer is wired up)

export function isValidPosition(x, y, mapW, mapH) {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < mapW && y < mapH;
}

export function isValidItemKey(key, ITEMS) {
  return typeof key === 'string' && Object.hasOwn(ITEMS, key);
}

export function isValidZone(name) {
  return name === 'overworld' || name === 'dungeon';
}
