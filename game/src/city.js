// Costa Verde's map: roads, blocks, buildings, parks, the bay, and the collision
// that keeps every walker and driver out of walls and water.
import { CITY, DISTRICTS } from './config.js';
import { clamp, makeRng } from './random.js';

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d;
  }
  return DISTRICTS[1];
}

export function isRoad(x, y) {
  const half = CITY.roadWidth / 2;
  for (const ax of CITY.avenues) if (Math.abs(x - ax) <= half) return true;
  for (const sy of CITY.streets) if (Math.abs(y - sy) <= half) return true;
  return false;
}

// Build the city once from a seed: buildings fill the blocks between roads, a few
// blocks become parks, and the bank and market get fixed landmark spots.
export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const trees = [];
  const roadHalf = CITY.roadWidth / 2;
  const margin = roadHalf + 14;

  for (let ai = 0; ai < CITY.avenues.length - 1; ai++) {
    for (let si = 0; si < CITY.streets.length - 1; si++) {
      const x0 = CITY.avenues[ai] + margin;
      const x1 = CITY.avenues[ai + 1] - margin;
      const y0 = CITY.streets[si] + margin;
      const y1 = CITY.streets[si + 1] - margin;
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      // One block in five is a park instead of buildings.
      if (rng.next() < 0.2) {
        const count = rng.int(4, 9);
        for (let t = 0; t < count; t++) {
          trees.push({
            x: rng.range(x0 + 20, x1 - 20),
            y: rng.range(y0 + 20, y1 - 20),
            r: rng.range(9, 15),
          });
        }
        continue;
      }
      const cols = rng.next() < 0.5 ? 1 : 2;
      const rows = rng.next() < 0.5 ? 1 : 2;
      const bw = (x1 - x0 - (cols - 1) * 26) / cols;
      const bh = (y1 - y0 - (rows - 1) * 26) / rows;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const bx = x0 + c * (bw + 26);
          const by = y0 + r * (bh + 26);
          const d = districtAt(bx + bw / 2, by + bh / 2);
          buildings.push({
            x: bx,
            y: by,
            w: bw,
            h: bh,
            roof: d.roof,
            accent: d.accent,
            tall: rng.next() < 0.3,
          });
        }
      }
      // A few trees along the block edges.
      if (rng.next() < 0.5) {
        trees.push({ x: cx, y: y0 + 12, r: 10 });
        trees.push({ x: x0 + 12, y: cy, r: 10 });
      }
    }
  }

  // Landmarks the missions use, placed on roads so they are always reachable.
  const landmarks = {
    market: { x: 760, y: 620, label: 'Old Town Market' },
    arcade: { x: 1650, y: 1050, label: 'Downtown Arcade' },
    docks: { x: 480, y: 2050, label: 'Portside Docks' },
    bank: { x: 2850, y: 1950, label: 'Costa Verde Trust' },
  };
  return { buildings, trees, landmarks };
}

// Push a circle (x, y, radius) out of every solid rectangle and the bay.
// Returns the corrected position. The rule is the textbook one: the closest point
// of the rectangle to the circle centre decides the push direction, and a centre
// inside the rectangle is pushed out along the smallest penetration axis.
export function resolveCollision(city, x, y, radius) {
  const solids = city.buildings;
  for (let pass = 0; pass < 2; pass++) {
    for (const b of solids) {
      const cx = clamp(x, b.x, b.x + b.w);
      const cy = clamp(y, b.y, b.y + b.h);
      let dx = x - cx;
      let dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= radius * radius) continue;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const push = (radius - d) / d;
        x += dx * push;
        y += dy * push;
      } else {
        // Centre is inside the rectangle: leave through the nearest face.
        const left = x - b.x;
        const right = b.x + b.w - x;
        const top = y - b.y;
        const bottom = b.y + b.h - y;
        const min = Math.min(left, right, top, bottom);
        if (min === left) x = b.x - radius;
        else if (min === right) x = b.x + b.w + radius;
        else if (min === top) y = b.y - radius;
        else y = b.y + b.h + radius;
      }
    }
    // The bay is solid water along the south edge.
    if (y + radius > CITY.bayTop) y = CITY.bayTop - radius;
  }
  // Keep everything inside the city.
  x = clamp(x, radius, CITY.width - radius);
  y = clamp(y, radius, CITY.height - radius);
  return { x, y };
}

// Is a point blocked by a building or the bay (used by the AI, not the player)?
export function blockedAt(city, x, y) {
  if (y >= CITY.bayTop) return true;
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
  }
  return false;
}
