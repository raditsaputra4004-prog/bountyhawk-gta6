// Pedestrians: Sunport's residents, strolling the sidewalks, crossing at
// corners, and running for cover when the shooting starts. They are also
// the taxi fares and the victims the wanted system cares about.

import { WORLD } from './config.js';
import { randomIntersection, neighboursOf, onRoad, hitsBuilding } from './city.js';
import { pick, range } from './rng.js';

const SHIRTS = ['#d96a4a', '#4a7dd9', '#5aa84f', '#c9a13c', '#8a5fc0', '#3fb8a6', '#e8e4da', '#b0435a'];
const SKINS = ['#e8b88a', '#c98d5f', '#8a5a3b', '#f0c8a0', '#6b4423'];

export function makePed(x, y, rng) {
  return {
    x, y,
    angle: rng() * Math.PI * 2,
    speed: range(rng, 30, 55),
    target: null,
    state: 'walk', // walk | flee | wait | hail
    fear: 0,
    shirt: pick(rng, SHIRTS),
    skin: pick(rng, SKINS),
    bob: rng() * Math.PI * 2,
    wait: 0,
    fare: null, // set when this ped is hailing a taxi
  };
}

export function spawnPeds(rng, count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const spot = randomIntersection(rng);
    const ped = makePed(spot.x + range(rng, -60, 60), spot.y + range(rng, -60, 60), rng);
    // Start on a sidewalk, not in the middle of the road.
    ped.x = Math.max(40, Math.min(WORLD.size - 40, ped.x));
    ped.y = Math.max(40, Math.min(WORLD.size - 40, ped.y));
    peds.push(ped);
  }
  return peds;
}

// A pedestrian walks between nearby intersections, pausing at corners, and
// runs away from loud danger (gunfire, a speeding car, a police chase).
export function stepPed(ped, dt, rng, world) {
  ped.bob += dt * 8;
  if (ped.fear > 0) ped.fear -= dt;
  if (ped.state === 'riding') {
    // Sitting in the player's car: ride along, hidden from the street.
    ped.x = world.player.x;
    ped.y = world.player.y;
    return;
  }
  if (ped.state === 'flee') {
    if (ped.fear <= 0) ped.state = 'walk';
    const dx = ped.x - world.dangerX;
    const dy = ped.y - world.dangerY;
    const d = Math.hypot(dx, dy) || 1;
    ped.angle = Math.atan2(dy / d, dx / d);
    ped.x += Math.cos(ped.angle) * ped.speed * 2.1 * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * 2.1 * dt;
  } else if (ped.state === 'wait') {
    ped.wait -= dt;
    if (ped.wait <= 0) ped.state = 'walk';
  } else {
    if (!ped.target) {
      const near = { x: Math.round(ped.x / 400) * 400, y: Math.round(ped.y / 400) * 400 };
      ped.target = pick(rng, neighboursOf(near.x, near.y));
    }
    const dx = ped.target.x - ped.x;
    const dy = ped.target.y - ped.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 18) {
      if (rng() < 0.3) {
        ped.state = 'wait';
        ped.wait = range(rng, 1, 4);
      }
      ped.target = null;
    } else {
      ped.angle = Math.atan2(dy, dx);
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
    }
  }
  // Stay out of buildings and inside the city.
  const hit = hitsBuilding(world.city, ped.x, ped.y, 10);
  if (hit) {
    ped.x -= Math.cos(ped.angle) * ped.speed * dt * 2;
    ped.y -= Math.sin(ped.angle) * ped.speed * dt * 2;
    ped.target = null;
  }
  ped.x = Math.max(16, Math.min(WORLD.size - 16, ped.x));
  ped.y = Math.max(16, Math.min(WORLD.size - 16, ped.y));
}

// Frighten every pedestrian near a point (a gunshot, a crash, a siren).
export function scarePeds(world, x, y, radius) {
  world.dangerX = x;
  world.dangerY = y;
  for (const ped of world.peds) {
    const d = Math.hypot(ped.x - x, ped.y - y);
    if (d < radius && ped.state !== 'flee') {
      ped.state = 'flee';
      ped.fear = 2.5 + Math.random() * 2;
      ped.target = null;
    }
  }
}
