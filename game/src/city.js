// Costa Verde, generated from one seed: avenues and streets, city blocks
// with buildings, parks, trees and a bay along the south edge. The same seed
// always builds the same city, so screenshots are reproducible.

import { WORLD, ROAD_W, AVENUES, STREETS, PALETTE, districtAt } from './config.js';
import { makeRng, clamp } from './random.js';

export function generateCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const trees = [];
  const parks = [];
  const lamps = [];

  const bayTop = 2640; // water below this line

  // Blocks are the cells between roads. Each block gets buildings, a park,
  // or stays empty (a plaza), depending on its district.
  for (let bi = 0; bi < AVENUES.length - 1; bi++) {
    for (let bj = 0; bj < STREETS.length - 1; bj++) {
      const x0 = AVENUES[bi] + ROAD_W / 2 + 14;
      const x1 = AVENUES[bi + 1] - ROAD_W / 2 - 14;
      const y0 = STREETS[bj] + ROAD_W / 2 + 14;
      const y1 = STREETS[bj + 1] - ROAD_W / 2 - 14;
      if (y0 > bayTop - 40) continue; // beach blocks stay open
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const d = districtAt(cx, cy);
      const roll = rng.next();
      if (roll < 0.16) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        const n = rng.int(4, 8);
        for (let i = 0; i < n; i++) {
          trees.push({ x: rng.range(x0 + 20, x1 - 20), y: rng.range(y0 + 20, y1 - 20), r: rng.range(9, 15) });
        }
        continue;
      }
      const cols = d.style === 'downtown' ? 2 : rng.chance(0.5) ? 2 : 1;
      const rows = d.style === 'downtown' ? 2 : rng.chance(0.5) ? 2 : 1;
      const bw = (x1 - x0) / cols, bh = (y1 - y0) / rows;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (rng.chance(0.12)) continue; // gap in the block
          const bx = x0 + c * bw + 10, by = y0 + r * bh + 10;
          const bwid = bw - 20, bhei = bh - 20;
          const tall = d.style === 'downtown' ? rng.int(3, 6) : d.style === 'port' ? 1 : rng.int(1, 3);
          buildings.push({
            x: bx, y: by, w: bwid, h: bhei, floors: tall,
            roof: rng.pick(PALETTE.buildingRoof),
            wall: rng.pick(PALETTE.buildingWall),
            district: d.style,
          });
        }
      }
      // A couple of street trees on the block's corners.
      if (rng.chance(0.7)) trees.push({ x: x0 + 8, y: y0 + 8, r: rng.range(8, 12) });
      if (rng.chance(0.7)) trees.push({ x: x1 - 8, y: y1 - 8, r: rng.range(8, 12) });
    }
  }

  // Lamps along every avenue, both sides, for the night-time glow.
  for (const ax of AVENUES) {
    for (let y = 120; y < WORLD.h - 120; y += 200) {
      lamps.push({ x: ax - ROAD_W / 2 - 6, y });
      lamps.push({ x: ax + ROAD_W / 2 + 6, y: y + 100 });
    }
  }

  // Named places the missions and the map point at.
  const places = {
    garage: { x: 600, y: 1400, label: "Rosa's Garage" },
    docks: { x: 3000, y: 600, label: 'Portside Docks' },
    marina: { x: 2200, y: 2200, label: 'Marina Drop' },
    hideout: { x: 1000, y: 2200, label: 'Hideout' },
    bank: { x: 1800, y: 600, label: 'Costa Verde Trust' },
    hospital: { x: 1400, y: 1000, label: 'St. Alba Hospital' },
    policeHQ: { x: 1800, y: 1800, label: 'CVPD Headquarters' },
  };

  return { seed, buildings, trees, parks, lamps, places, bayTop };
}

// --- Collision and road helpers -------------------------------------------

export function isOnRoad(city, x, y) {
  if (y >= city.bayTop) return false;
  for (const ax of AVENUES) if (Math.abs(x - ax) <= ROAD_W / 2) return true;
  for (const sy of STREETS) if (Math.abs(y - sy) <= ROAD_W / 2) return true;
  return false;
}

export function nearestAvenue(x) {
  let best = AVENUES[0], bd = Infinity;
  for (const ax of AVENUES) { const d = Math.abs(x - ax); if (d < bd) { bd = d; best = ax; } }
  return best;
}
export function nearestStreet(y) {
  let best = STREETS[0], bd = Infinity;
  for (const sy of STREETS) { const d = Math.abs(y - sy); if (d < bd) { bd = d; best = sy; } }
  return best;
}

export function buildingAt(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

export function inWater(city, x, y) { return y >= city.bayTop; }

// Push a point out of buildings and water; returns the corrected point.
export function resolveCollision(city, x, y, radius) {
  let px = clamp(x, 30, WORLD.w - 30);
  let py = clamp(y, 30, WORLD.h - 30);
  if (py >= city.bayTop - radius) py = city.bayTop - radius;
  for (const b of city.buildings) {
    // Only push out when the point is inside the building's expanded rect.
    if (px < b.x - radius || px > b.x + b.w + radius || py < b.y - radius || py > b.y + b.h + radius) continue;
    const dxl = px - (b.x - radius), dxr = (b.x + b.w + radius) - px;
    const dyt = py - (b.y - radius), dyb = (b.y + b.h + radius) - py;
    const m = Math.min(dxl, dxr, dyt, dyb);
    if (m === dxl) px = b.x - radius;
    else if (m === dxr) px = b.x + b.w + radius;
    else if (m === dyt) py = b.y - radius;
    else py = b.y + b.h + radius;
  }
  return { x: px, y: py };
}
