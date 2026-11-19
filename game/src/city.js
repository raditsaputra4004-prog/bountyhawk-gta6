// Sunport itself: the road grid, the blocks, the buildings, the parks and
// the bay, plus the named places the story sends the player to. Everything
// is generated from one seed, so the same seed always builds the same city.

import { WORLD, CITY, PALETTE } from './config.js';
import { makeRng, pick, range, rangeInt, chance } from './rng.js';

const LINES = [];
for (let v = 0; v <= WORLD.size; v += WORLD.roadEvery) LINES.push(v);

// Named places the missions and the free-roam life use. Each sits just
// off a road centre line (36 units off, at the road edge) so the player can
// drive or walk right up to it — a place in the middle of a block would be
// unreachable by car.
export const PLACES = {
  club: { x: 1800, y: 860, label: 'Neon Palms Club' },
  garage: { x: 1400, y: 2036, label: "Rex's Garage" },
  chopShop: { x: 1000, y: 2436, label: 'Chop Shop' },
  docks: { x: 300, y: 3236, label: 'Sunport Docks' },
  motel: { x: 2600, y: 1236, label: 'Sunset Motel' },
  jewelers: { x: 1800, y: 1236, label: 'Gilded Cage Jewelers' },
  safehouse: { x: 600, y: 2436, label: 'Safehouse' },
  hospital: { x: 2600, y: 436, label: 'Sunport General' },
  policeHq: { x: 2200, y: 1636, label: 'SPPD Headquarters' },
  armory: { x: 3000, y: 2836, label: 'Bullion Depot' },
  taxiStand: { x: 1000, y: 836, label: 'Taxi Stand' },
  beach: { x: 1800, y: 3500, label: 'Marina Beach' },
};

function districtFor(bx, by) {
  for (const d of CITY.districts) {
    if (by >= d.row[0] && by <= d.row[1] && bx >= d.col[0] && bx <= d.col[1]) return d;
  }
  return { name: 'Sunport', style: 'houses' };
}

// Build the whole city from a seed. Returns buildings, trees, the water
// rectangle, the park blocks and the road lines.
export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const trees = [];
  const parks = [];
  const blockCount = WORLD.size / WORLD.roadEvery; // 9 blocks a side

  for (let by = 0; by < blockCount; by += 1) {
    for (let bx = 0; bx < blockCount; bx += 1) {
      const district = districtFor(bx, by);
      const x0 = bx * WORLD.roadEvery + WORLD.roadWidth / 2 + WORLD.sidewalk;
      const y0 = by * WORLD.roadEvery + WORLD.roadWidth / 2 + WORLD.sidewalk;
      const w = WORLD.block - WORLD.sidewalk * 2;
      const h = WORLD.block - WORLD.sidewalk * 2;
      // The bay row: the last block row is beachfront, no buildings.
      if (by === blockCount - 1) {
        if (chance(rng, 0.5)) {
          trees.push({ x: x0 + w / 2, y: y0 + h / 2, r: 26 });
        }
        continue;
      }
      if (district.style === 'marina') continue;
      // A couple of green blocks break the grid up.
      if ((bx === 1 && by === 4) || (bx === 7 && by === 1) || chance(rng, 0.06)) {
        parks.push({ x: x0, y: y0, w, h });
        const count = rangeInt(rng, 5, 9);
        for (let i = 0; i < count; i += 1) {
          trees.push({
            x: x0 + range(rng, 30, w - 30),
            y: y0 + range(rng, 30, h - 30),
            r: range(rng, 12, 20),
          });
        }
        continue;
      }
      const style = district.style;
      const lots = style === 'towers' ? 1 : style === 'industrial' ? 2 : rangeInt(rng, 2, 4);
      for (let i = 0; i < lots; i += 1) {
        const cols = Math.ceil(Math.sqrt(lots));
        const cw = w / cols;
        const ch = h / Math.ceil(lots / cols);
        const lx = x0 + (i % cols) * cw;
        const ly = y0 + Math.floor(i / cols) * ch;
        const bw = cw * range(rng, 0.55, 0.8);
        const bh = ch * range(rng, 0.55, 0.8);
        const bx0 = lx + (cw - bw) / 2;
        const by0 = ly + (ch - bh) / 2;
        buildings.push({
          x: bx0,
          y: by0,
          w: bw,
          h: bh,
          style,
          district: district.name,
          roof: pick(rng, PALETTE.buildingRoof),
          wall: pick(rng, PALETTE.buildingWall),
          glass: pick(rng, PALETTE.towerGlass),
          height: style === 'towers' ? rangeInt(rng, 3, 8) : style === 'industrial' ? 1 : rangeInt(rng, 1, 2),
          seed: rangeInt(rng, 0, 999999),
        });
      }
      if (chance(rng, 0.4)) {
        trees.push({ x: x0 + range(rng, 20, w - 20), y: y0 + range(rng, 20, h - 20), r: range(rng, 10, 16) });
      }
    }
  }

  return {
    buildings,
    trees,
    parks,
    water: { x: 0, y: WORLD.size - 160, w: WORLD.size, h: 160 },
    beach: { x: 0, y: WORLD.size - 240, w: WORLD.size, h: 80 },
    lines: LINES,
  };
}

// True when the point is on a road (within the road half-width of a line).
export function onRoad(x, y) {
  const hw = WORLD.roadWidth / 2;
  for (const line of LINES) {
    if (Math.abs(x - line) <= hw || Math.abs(y - line) <= hw) return true;
  }
  return false;
}

// Snap a point to the nearest road centre line.
export function snapToRoad(x, y) {
  let bestX = LINES[0];
  let bestY = LINES[0];
  for (const line of LINES) {
    if (Math.abs(line - x) < Math.abs(bestX - x)) bestX = line;
    if (Math.abs(line - y) < Math.abs(bestY - y)) bestY = line;
  }
  return { x: bestX, y: bestY };
}

// Circle-vs-building test used by the player, cars and pedestrians.
export function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < r * r) return b;
  }
  return null;
}

export function inWater(city, x, y) {
  const w = city.water;
  return x >= w.x && x < w.x + w.w && y >= w.y && y < w.y + w.h;
}

// Push a circle out of every building it overlaps and out of the water, so
// movement slides along walls instead of sticking.
export function resolveSolids(city, body, r) {
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(body.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(body.y, b.y + b.h));
    const dx = body.x - cx;
    const dy = body.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      body.x = cx + (dx / d) * r;
      body.y = cy + (dy / d) * r;
    } else if (d2 <= 0.0001) {
      // Dead centre of a rect: push out along the smallest penetration.
      const left = body.x - b.x;
      const right = b.x + b.w - body.x;
      const top = body.y - b.y;
      const bottom = b.y + b.h - body.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) body.x = b.x - r;
      else if (m === right) body.x = b.x + b.w + r;
      else if (m === top) body.y = b.y - r;
      else body.y = b.y + b.h + r;
    }
  }
  const w = city.water;
  if (body.y + r > w.y && body.x > w.x && body.x < w.x + w.w) {
    body.y = w.y - r;
  }
  body.x = Math.max(r, Math.min(WORLD.size - r, body.x));
  body.y = Math.max(r, Math.min(WORLD.size - r, body.y));
}

// A random intersection (road crossing) as a {x, y} point.
export function randomIntersection(rng) {
  const i = Math.floor(rng() * LINES.length);
  const j = Math.floor(rng() * LINES.length);
  return { x: LINES[i], y: LINES[j] };
}

// The neighbouring intersections of one intersection (up/down/left/right).
export function neighboursOf(x, y) {
  const ix = LINES.indexOf(x);
  const iy = LINES.indexOf(y);
  const out = [];
  if (ix > 0) out.push({ x: LINES[ix - 1], y });
  if (ix < LINES.length - 1) out.push({ x: LINES[ix + 1], y });
  if (iy > 0) out.push({ x, y: LINES[iy - 1] });
  if (iy < LINES.length - 1) out.push({ x, y: LINES[iy + 1] });
  return out;
}
