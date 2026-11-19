// The city of Sunport: its roads, blocks, buildings, parks, beach and bay,
// plus the road graph the traffic and the police drive on.
// The world is 3600 x 3600. Roads run on a 9 x 9 grid, 400 apart.

import { clamp, dist, pick, randInt, randRange } from './util.js';

export const WORLD = 3600;
export const ROAD_HALF = 32;
const GRID = 9;
const STEP = 400;
const FIRST = 200;

const BUILDING_COLORS = ['#b98a5e', '#8f7d6b', '#a89f8d', '#7e8aa0', '#9c6b52', '#6f7f6a', '#b0a18a', '#8a6f7d'];
const ROOF_COLORS = ['#5d4a38', '#4a4a52', '#6b5a44', '#3f4a3a', '#54423a'];

/** The seven districts, rectangles that tile the whole map. */
export const DISTRICTS = [
  { name: 'West End', x: 0, y: 0, w: 1200, h: 1200 },
  { name: 'Northgate', x: 1200, y: 0, w: 1200, h: 1200 },
  { name: 'Eastside', x: 2400, y: 0, w: 1200, h: 1200 },
  { name: 'Harbor', x: 0, y: 1200, w: 1200, h: 2400 },
  { name: 'Downtown', x: 1200, y: 1200, w: 1200, h: 1200 },
  { name: 'Marina', x: 2400, y: 1200, w: 1200, h: 1200 },
  { name: 'Old Town', x: 2400, y: 2400, w: 1200, h: 1200 },
];

/** Twelve named places the missions and the HUD point at. */
export const PLACES = [
  { name: 'The Gilded Cage', kind: 'club', x: 1800, y: 1800 },
  { name: 'Sunport City Hall', kind: 'civic', x: 2200, y: 1400 },
  { name: 'Police HQ', kind: 'police', x: 1400, y: 2200 },
  { name: 'Sunport General', kind: 'hospital', x: 2600, y: 600 },
  { name: 'Harbor Docks', kind: 'docks', x: 600, y: 3000 },
  { name: 'The Rusty Anchor', kind: 'bar', x: 1000, y: 2600 },
  { name: 'Marina Boardwalk', kind: 'beach', x: 3300, y: 1800 },
  { name: 'Northgate Mall', kind: 'mall', x: 1800, y: 600 },
  { name: 'Old Town Market', kind: 'market', x: 2800, y: 2800 },
  { name: 'Comet Motors', kind: 'dealer', x: 3000, y: 1000 },
  { name: 'Sunport Stadium', kind: 'stadium', x: 600, y: 600 },
  { name: 'The Palms Motel', kind: 'motel', x: 2600, y: 2600 },
];

/** Build the whole city from a seeded RNG. Deterministic per seed. */
export function buildCity(rng) {
  const roadsX = [];
  const roadsY = [];
  for (let i = 0; i < GRID; i++) {
    roadsX.push(FIRST + i * STEP);
    roadsY.push(FIRST + i * STEP);
  }

  // Road graph: one node per intersection, edges to the four neighbours.
  const nodes = [];
  const neighbors = [];
  for (let iy = 0; iy < GRID; iy++) {
    for (let ix = 0; ix < GRID; ix++) {
      const id = iy * GRID + ix;
      nodes.push({ id, x: roadsX[ix], y: roadsY[iy], ix, iy });
      const list = [];
      if (ix > 0) list.push(id - 1);
      if (ix < GRID - 1) list.push(id + 1);
      if (iy > 0) list.push(id - GRID);
      if (iy < GRID - 1) list.push(id + GRID);
      neighbors.push(list);
    }
  }

  // Blocks between the roads: buildings, or a park, or a plaza.
  const buildings = [];
  const parks = [];
  const trees = [];
  for (let by = 0; by < GRID - 1; by++) {
    for (let bx = 0; bx < GRID - 1; bx++) {
      const x0 = roadsX[bx] + ROAD_HALF;
      const y0 = roadsY[by] + ROAD_HALF;
      const x1 = roadsX[bx + 1] - ROAD_HALF;
      const y1 = roadsY[by + 1] - ROAD_HALF;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      // Keep the blocks around the named places clear of buildings.
      const nearPlace = PLACES.some((p) => Math.abs(p.x - cx) < 260 && Math.abs(p.y - cy) < 260);
      const roll = rng();
      if (roll < 0.14 && !nearPlace) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        for (let t = 0; t < 7; t++) {
          trees.push({ x: randRange(rng, x0 + 30, x1 - 30), y: randRange(rng, y0 + 30, y1 - 30), r: randRange(rng, 12, 22) });
        }
        continue;
      }
      const count = nearPlace ? 1 : randInt(rng, 1, 3);
      for (let b = 0; b < count; b++) {
        const bw = randRange(rng, 90, 150);
        const bh = randRange(rng, 90, 150);
        const bx0 = randRange(rng, x0 + 14, x1 - 14 - bw);
        const by0 = randRange(rng, y0 + 14, y1 - 14 - bh);
        if (bx0 + bw > x1 - 14 || by0 + bh > y1 - 14) continue;
        const overlap = buildings.some((o) => bx0 < o.x + o.w + 16 && bx0 + bw + 16 > o.x && by0 < o.y + o.h + 16 && by0 + bh + 16 > o.y);
        if (overlap) continue;
        buildings.push({
          x: bx0, y: by0, w: bw, h: bh,
          hgt: randRange(rng, 8, 34),
          color: pick(rng, BUILDING_COLORS),
          roof: pick(rng, ROOF_COLORS),
          kind: rng() < 0.3 ? 'tower' : rng() < 0.5 ? 'shop' : 'house',
        });
      }
    }
  }

  // Water: a bay along the east edge and the south edge, with sand in front.
  const water = [
    { x: 3480, y: 0, w: 120, h: WORLD },
    { x: 0, y: 3480, w: 3480, h: 120 },
  ];
  const sand = [
    { x: 3400, y: 0, w: 80, h: WORLD },
    { x: 0, y: 3400, w: 3400, h: 80 },
  ];

  return { roadsX, roadsY, nodes, neighbors, buildings, parks, trees, water, sand };
}

/** The district a point is in, or 'Sunport'. */
export function districtAt(city, x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d.name;
  }
  return 'Sunport';
}

/** A named place by name. */
export function placeNamed(name) {
  return PLACES.find((p) => p.name === name);
}

/** The nearest road-graph node to a point. */
export function nearestNode(city, x, y) {
  let best = 0;
  let bestD = Infinity;
  for (const n of city.nodes) {
    const d = (n.x - x) * (n.x - x) + (n.y - y) * (n.y - y);
    if (d < bestD) {
      bestD = d;
      best = n.id;
    }
  }
  return best;
}

/** Breadth-first path of node ids from `from` to `to`. */
export function bfsPath(city, from, to) {
  if (from === to) return [from];
  const prev = new Array(city.nodes.length).fill(-1);
  const queue = [from];
  prev[from] = from;
  while (queue.length > 0) {
    const cur = queue.shift();
    for (const nb of city.neighbors[cur]) {
      if (prev[nb] !== -1) continue;
      prev[nb] = cur;
      if (nb === to) {
        const path = [to];
        let p = cur;
        while (p !== from) {
          path.unshift(p);
          p = prev[p];
        }
        path.unshift(from);
        return path;
      }
      queue.push(nb);
    }
  }
  return [from];
}

/** The closest point on any road centreline to (x, y). */
export function nearestRoadPoint(city, x, y) {
  let bestX = x;
  let bestY = y;
  let bestD = Infinity;
  for (const rx of city.roadsX) {
    const cy = clamp(y, 0, WORLD);
    const d = (rx - x) * (rx - x) + (cy - y) * (cy - y);
    if (d < bestD) {
      bestD = d;
      bestX = rx;
      bestY = cy;
    }
  }
  for (const ry of city.roadsY) {
    const cx = clamp(x, 0, WORLD);
    const d = (cx - x) * (cx - x) + (ry - y) * (ry - y);
    if (d < bestD) {
      bestD = d;
      bestX = cx;
      bestY = ry;
    }
  }
  return { x: bestX, y: bestY };
}

/** A random point on a road, with a heading along it. */
export function randomRoadPoint(rng, city) {
  const vertical = rng() < 0.5;
  if (vertical) {
    const rx = pick(rng, city.roadsX);
    return { x: rx, y: randRange(rng, 200, 3400), angle: rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2 };
  }
  const ry = pick(rng, city.roadsY);
  return { x: randRange(rng, 200, 3400), y: ry, angle: rng() < 0.5 ? 0 : Math.PI };
}

/** Is a circle (x, y, r) inside a building or the water? Returns the building or 'water' or null. */
export function solidHit(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  for (const w of city.water) {
    if (x + r > w.x && x - r < w.x + w.w && y + r > w.y && y - r < w.y + w.h) return 'water';
  }
  if (x - r < 0 || x + r > WORLD || y - r < 0 || y + r > WORLD) return 'edge';
  return null;
}

/** Push a circle out of a solid it overlaps. Returns true when it was pushed. */
export function resolveSolid(city, body, r) {
  const hit = solidHit(city, body.x, body.y, r);
  if (!hit) return false;
  if (hit === 'water' || hit === 'edge') {
    body.x = clamp(body.x, r, WORLD - r);
    body.y = clamp(body.y, r, WORLD - r);
    return true;
  }
  // Push out along the smallest penetration axis.
  const left = body.x + r - hit.x;
  const right = hit.x + hit.w - (body.x - r);
  const top = body.y + r - hit.y;
  const bottom = hit.y + hit.h - (body.y - r);
  const m = Math.min(left, right, top, bottom);
  if (m === left) body.x = hit.x - r;
  else if (m === right) body.x = hit.x + hit.w + r;
  else if (m === top) body.y = hit.y - r;
  else body.y = hit.y + hit.h + r;
  return true;
}

/** A sidewalk point near a road, for pedestrians. */
export function sidewalkPoint(rng, city) {
  const p = randomRoadPoint(rng, city);
  const off = 44;
  if (Math.abs(Math.sin(p.angle)) > 0.5) return { x: p.x + (rng() < 0.5 ? off : -off), y: p.y, angle: p.angle };
  return { x: p.x, y: p.y + (rng() < 0.5 ? off : -off), angle: p.angle };
}
