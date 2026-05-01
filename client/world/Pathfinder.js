export function findPath(sx, sy, ex, ey, walkableFn, mw, mh) {
  if (sx === ex && sy === ey) return [];
  const visited = new Set([`${sx},${sy}`]);
  const q = [{ x: sx, y: sy, p: [] }];
  const D = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  while (q.length) {
    const { x: cx, y: cy, p } = q.shift();
    for (const [dx, dy] of D) {
      const nx = cx + dx, ny = cy + dy, k = `${nx},${ny}`;
      if (visited.has(k)) continue;
      visited.add(k);
      const np = [...p, [nx, ny]];
      if (nx === ex && ny === ey) return np;
      if (walkableFn(nx, ny)) q.push({ x: nx, y: ny, p: np });
    }
  }
  return null;
}

export function pathAdj(px, py, tx, ty, walkableFn, mw, mh) {
  const D = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  for (const [dx, dy] of D) if (px === tx + dx && py === ty + dy) return [];
  let best = null, bestD = Infinity;
  for (const [dx, dy] of D) {
    const ax = tx + dx, ay = ty + dy;
    if (!walkableFn(ax, ay)) continue;
    const d = Math.abs(ax - px) + Math.abs(ay - py);
    if (d < bestD) { bestD = d; best = [ax, ay]; }
  }
  if (!best) return null;
  if (best[0] === px && best[1] === py) return [];
  return findPath(px, py, best[0], best[1], walkableFn, mw, mh);
}

export function adj8(ax, ay, bx, by) {
  return Math.abs(ax - bx) <= 1 && Math.abs(ay - by) <= 1 && !(ax === bx && ay === by);
}
