// The people of Sunport: pedestrians on the sidewalks and the armed guards
// who protect the M4 payday job.

import { clamp, dist, pick, randRange } from './util.js';
import { resolveSolid, sidewalkPoint } from './city.js';
import { burst, floatText, shake, tracer } from './particles.js';
import { damageCar } from './vehicles.js';
import { hurtPlayer } from './player.js';
import { sfx } from './audio.js';

const PED_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1', '#fd79a8', '#00cec9'];

/** Spawn the city's pedestrians. */
export function seedPeds(S) {
  S.peds = [];
  for (let i = 0; i < 34; i++) {
    const p = sidewalkPoint(S.rng, S.city);
    S.peds.push({
      kind: 'ped',
      x: p.x, y: p.y,
      angle: p.angle,
      speed: randRange(S.rng, 35, 75),
      color: pick(S.rng, PED_COLORS),
      hp: 100,
      state: 'walk',
      stateFor: randRange(S.rng, 0, 6),
      downFor: 0,
      scared: 0,
      dead: false,
    });
  }
}

/** A guard posted at a mission spot. Shoots at the player when close. */
export function spawnGuard(S, x, y) {
  const g = {
    kind: 'guard',
    x, y,
    angle: 0,
    speed: 0,
    color: '#2c2c34',
    hp: 100,
    maxHp: 100,
    state: 'guard',
    stateFor: 0,
    downFor: 0,
    scared: 0,
    shootCd: randRange(S.rng, 0.4, 1.0),
    dead: false,
  };
  S.peds.push(g);
  return g;
}

/** Step every pedestrian and guard. */
export function updatePeds(S, dt) {
  for (const p of S.peds) {
    if (p.dead) continue;
    if (p.downFor > 0) {
      p.downFor -= dt;
      if (p.downFor <= 0) {
        p.hp = 60;
        p.state = 'walk';
      }
      continue;
    }
    if (p.kind === 'guard') {
      updateGuard(S, p, dt);
      continue;
    }
    p.stateFor -= dt;
    if (p.scared > 0) {
      // Flee: run away from whatever scared them.
      p.scared -= dt;
      p.x += Math.cos(p.angle) * 150 * dt;
      p.y += Math.sin(p.angle) * 150 * dt;
      resolveSolid(S.city, p, 12);
      continue;
    }
    if (p.stateFor <= 0) {
      p.stateFor = randRange(S.rng, 3, 8);
      // Pick a new sidewalk heading.
      const sp = sidewalkPoint(S.rng, S.city);
      p.angle = Math.atan2(sp.y - p.y, sp.x - p.x);
    }
    p.x += Math.cos(p.angle) * p.speed * dt;
    p.y += Math.sin(p.angle) * p.speed * dt;
    resolveSolid(S.city, p, 12);
    // Keep pedestrians inside the world.
    p.x = clamp(p.x, 20, 3580);
    p.y = clamp(p.y, 20, 3580);
  }
  // Drop the dead.
  for (let i = S.peds.length - 1; i >= 0; i--) {
    if (S.peds[i].dead) S.peds.splice(i, 1);
  }
}

/** A guard stands his post and shoots the player when he gets close. */
function updateGuard(S, g, dt) {
  const d = dist(g.x, g.y, S.player.x, S.player.y);
  g.angle = Math.atan2(S.player.y - g.y, S.player.x - g.x);
  g.shootCd -= dt;
  if (d < 420 && S.mode === 'play' && g.shootCd <= 0 && !S.player.dead) {
    g.shootCd = randRange(S.rng, 0.9, 1.5);
    // Guards are poor shots: they usually miss by a little.
    const miss = randRange(S.rng, -0.16, 0.16);
    const a = g.angle + miss;
    const hit = d < 380 && Math.random() < 0.45;
    const reach = Math.min(d, 380);
    tracer(S, g.x, g.y, g.x + Math.cos(a) * reach, g.y + Math.sin(a) * reach);
    sfx('shot');
    if (hit) {
      // A bullet that finds the player hits the car first when the player
      // is driving — the car takes the damage, not Rex.
      if (S.player.car && !S.player.car.dead) {
        damageCar(S, S.player.car, 9, null);
        shake(S, 2);
      } else {
        hurtPlayer(S, 9);
      }
    }
  }
}

/** Scare every pedestrian near (x, y): they run away from it. */
export function scarePeds(S, x, y, radius) {
  for (const p of S.peds) {
    if (p.kind !== 'ped') continue;
    if (dist(p.x, p.y, x, y) < radius) {
      p.scared = randRange(S.rng, 2, 4);
      p.angle = Math.atan2(p.y - y, p.x - x);
    }
  }
}

/** Hurt a person; at zero hp a ped goes down, a guard dies. */
export function hurtPerson(S, p, amount) {
  if (p.dead || p.downFor > 0) return;
  p.hp -= amount;
  if (p.hp > 0) {
    if (p.kind === 'ped') {
      p.scared = 3;
      p.angle = Math.atan2(p.y - S.player.y, p.x - S.player.x);
    }
    return;
  }
  if (p.kind === 'guard') {
    p.dead = true;
    burst(S, p.x, p.y, { count: 10, color: '#ff6b6b', speedMax: 180 });
    floatText(S, p.x, p.y - 20, 'Guard down', '#ff6b6b');
    S.missions.guardsDown = (S.missions.guardsDown || 0) + 1;
  } else {
    p.downFor = 3.5;
    p.hp = 0;
    burst(S, p.x, p.y, { count: 8, color: '#ff6b6b', speedMax: 140 });
  }
}
