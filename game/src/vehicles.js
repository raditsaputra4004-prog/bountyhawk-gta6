// Cars for Sunport Heat: the models, arcade driving physics, traffic AI,
// parked cars to steal, and damage with explosions.

import { angleDiff, clamp, dist, pick, randRange } from './util.js';
import { nearestNode, nearestRoadPoint, resolveSolid } from './city.js';
import { burst, shake, skid, smoke } from './particles.js';
import { sfx } from './audio.js';

/** The seven car models. topSpeed is world units/second. */
export const CAR_MODELS = {
  sedan: { name: 'Sunport Sedan', top: 330, accel: 300, grip: 5.2, len: 46, wid: 22, hp: 180, color: '#5b7fa6' },
  comet: { name: 'Comet GT', top: 520, accel: 430, grip: 6.4, len: 46, wid: 21, hp: 160, color: '#c0392b' },
  van: { name: 'Box Van', top: 300, accel: 240, grip: 4.6, len: 58, wid: 24, hp: 220, color: '#d8d3c8' },
  bullion: { name: 'Bullion Van', top: 270, accel: 200, grip: 4.4, len: 60, wid: 25, hp: 400, color: '#3a3f4a' },
  taxi: { name: 'Sunport Taxi', top: 350, accel: 310, grip: 5.4, len: 46, wid: 22, hp: 180, color: '#f1c40f' },
  pickup: { name: 'Dune Pickup', top: 360, accel: 320, grip: 5.0, len: 50, wid: 23, hp: 200, color: '#7d8c5c' },
  cruiser: { name: 'Police Cruiser', top: 430, accel: 380, grip: 6.0, len: 48, wid: 22, hp: 240, color: '#1c2733' },
};

let nextCarId = 1;

/** Make a car entity. kind: 'traffic' | 'parked' | 'police' | 'mission' | 'player'. */
export function makeCar(S, modelKey, x, y, angle, kind) {
  const model = CAR_MODELS[modelKey];
  const car = {
    id: nextCarId++,
    model: modelKey,
    name: model.name,
    x, y,
    angle,
    vx: 0, vy: 0,
    speed: 0,
    steer: 0,
    hp: model.hp,
    maxHp: model.hp,
    kind: kind || 'traffic',
    stolen: false,
    driver: kind === 'traffic',
    // Traffic AI state.
    node: nearestNode(S.city, x, y),
    targetNode: null,
    cruise: randRange(S.rng, 150, 250),
    stuckFor: 0,
    hitCd: 0, // cooldown between collision damage ticks
    ramCd: 0, // cooldown between rams (police cruisers)
    dead: false,
    burning: false,
    color: model.color,
  };
  return car;
}

/** Spawn the traffic and the parked cars of a fresh city. */
export function seedCars(S) {
  S.cars = [];
  for (let i = 0; i < 26; i++) {
    const p = nearestRoadPoint(S.city, S.rng() * 3600, S.rng() * 3600);
    const model = pick(S.rng, ['sedan', 'sedan', 'taxi', 'pickup', 'van']);
    const car = makeCar(S, model, p.x, p.y, S.rng() * Math.PI * 2, 'traffic');
    S.cars.push(car);
  }
  for (let i = 0; i < 14; i++) {
    const p = nearestRoadPoint(S.city, S.rng() * 3600, S.rng() * 3600);
    const model = pick(S.rng, ['sedan', 'comet', 'pickup', 'taxi', 'van']);
    const car = makeCar(S, model, p.x + randRange(S.rng, -20, 20), p.y + randRange(S.rng, -20, 20), 0, 'parked');
    // Face along the road it is parked on, so it can pull straight out.
    const onVertical = S.city.roadsX.some((rx) => Math.abs(p.x - rx) < 5);
    car.angle = onVertical ? (S.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (S.rng() < 0.5 ? 0 : Math.PI);
    S.cars.push(car);
  }
}

/** Arcade driving: throttle/steer a car for one step. */
export function driveCar(S, car, throttle, steer, handbrake, dt) {
  const m = CAR_MODELS[car.model];
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  // Forward speed along the car's nose.
  const fwd = car.vx * fx + car.vy * fy;
  // Steering bites harder at speed, and reverses when backing up.
  const steerPower = 3.0 * clamp(Math.abs(fwd) / 120, 0.25, 1) * (fwd < -5 ? -1 : 1);
  car.angle += steer * steerPower * dt * (handbrake ? 1.35 : 1);
  const nx = Math.cos(car.angle);
  const ny = Math.sin(car.angle);
  // Engine force along the nose.
  car.vx += nx * m.accel * throttle * dt;
  car.vy += ny * m.accel * throttle * dt;
  // Rolling drag, and a hard cap at the model's top speed.
  const drag = handbrake ? 1.6 : 0.55;
  car.vx -= car.vx * drag * dt;
  car.vy -= car.vy * drag * dt;
  const sp = Math.hypot(car.vx, car.vy);
  if (sp > m.top) {
    car.vx *= m.top / sp;
    car.vy *= m.top / sp;
  }
  // Grip: kill sideways slide. A handbrake loosens the grip so the car drifts.
  const lat = -car.vx * ny + car.vy * nx;
  const grip = handbrake ? 1.1 : m.grip;
  const latAfter = lat * Math.max(0, 1 - grip * dt);
  const fwdAfter = car.vx * nx + car.vy * ny;
  car.vx = nx * fwdAfter - ny * latAfter;
  car.vy = ny * fwdAfter + nx * latAfter;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  car.speed = Math.hypot(car.vx, car.vy);
  // Drifting leaves skid marks.
  if (Math.abs(lat) > 120 && car.speed > 140) skid(S, car.x, car.y, car.angle);
  // Smoke when badly hurt.
  if (car.hp < car.maxHp * 0.35 && Math.random() < dt * 8) smoke(S, car.x, car.y, true);
}

/** Step every car: the player's car, traffic AI, police cars, collisions. */
export function updateCars(S, dt) {
  for (const car of S.cars) {
    if (car.dead) continue;
    if (car === S.player.car) continue; // driven by the player update
    if (car.kind === 'police') continue; // driven by the police update
    if (car.kind === 'parked' || car.kind === 'mission') continue;
    updateTraffic(S, car, dt);
  }
  collideCars(S, dt);
  // Building and water hits for moving cars.
  for (const car of S.cars) {
    if (car.dead || car.speed < 20) continue;
    car.hitCd = Math.max(0, car.hitCd - dt);
    const before = { x: car.x, y: car.y };
    if (resolveSolid(S.city, car, CAR_MODELS[car.model].len * 0.42)) {
      const hitSpeed = car.speed;
      car.vx *= -0.25;
      car.vy *= -0.25;
      if (hitSpeed > 180 && car.hitCd <= 0) {
        car.hitCd = 0.6;
        damageCar(S, car, (hitSpeed - 180) * 0.07, null);
        burst(S, before.x, before.y, { count: 8, color: '#ffd27d', speedMax: 260 });
        sfx('crash');
        if (car === S.player.car) shake(S, 6);
      }
    }
  }
  // Remove wrecks that burned out.
  for (let i = S.cars.length - 1; i >= 0; i--) {
    if (S.cars[i].dead) S.cars.splice(i, 1);
  }
}

/** One traffic car following the road graph. */
function updateTraffic(S, car, dt) {
  let target = car.targetNode === null ? null : S.city.nodes[car.targetNode];
  if (!target) {
    const opts = S.city.neighbors[car.node];
    car.targetNode = pick(S.rng, opts);
    target = S.city.nodes[car.targetNode];
  }
  const d = dist(car.x, car.y, target.x, target.y);
  if (d < 26) {
    car.node = car.targetNode;
    car.targetNode = null;
    return;
  }
  // Drive toward the target intersection, on the right side of the road.
  const dx = target.x - car.x;
  const dy = target.y - car.y;
  const want = Math.atan2(dy, dx);
  const steer = clamp(angleDiff(car.angle, want) * 1.6, -1, 1);
  // Slow down for a car ahead.
  let throttle = 0.7;
  for (const other of S.cars) {
    if (other === car || other.dead) continue;
    const ox = other.x - car.x;
    const oy = other.y - car.y;
    const ahead = ox * Math.cos(car.angle) + oy * Math.sin(car.angle);
    const sideOff = Math.abs(-ox * Math.sin(car.angle) + oy * Math.cos(car.angle));
    if (ahead > 0 && ahead < 70 && sideOff < 26) {
      throttle = 0;
      break;
    }
  }
  driveCar(S, car, throttle, steer, false, dt);
}

/** Push overlapping cars apart and trade a little damage. */
function collideCars(S, dt) {
  void dt;
  const list = S.cars.filter((c) => !c.dead);
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      // A mission car is parked for its job: traffic must not shove it
      // out of place (the player can still ram it).
      if ((a.kind === 'mission' && b.kind === 'traffic') || (b.kind === 'mission' && a.kind === 'traffic')) continue;
      const ra = CAR_MODELS[a.model].len * 0.42;
      const rb = CAR_MODELS[b.model].len * 0.42;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = ra + rb;
      if (d >= min || d === 0) continue;
      const push = (min - d) / 2;
      const nx = dx / d;
      const ny = dy / d;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      const impact = Math.abs((a.vx - b.vx) * nx + (a.vy - b.vy) * ny);
      if (impact > 120 && a.hitCd <= 0 && b.hitCd <= 0) {
        a.hitCd = 0.5;
        b.hitCd = 0.5;
        damageCar(S, a, impact * 0.05, b);
        damageCar(S, b, impact * 0.05, a);
        burst(S, (a.x + b.x) / 2, (a.y + b.y) / 2, { count: 6, color: '#ffd27d', speedMax: 200 });
        sfx('crash');
      }
      // Swap a little velocity so the bump reads.
      const avx = a.vx;
      const avy = a.vy;
      a.vx = a.vx * 0.7 + b.vx * 0.3;
      a.vy = a.vy * 0.7 + b.vy * 0.3;
      b.vx = b.vx * 0.7 + avx * 0.3;
      b.vy = b.vy * 0.7 + avy * 0.3;
    }
  }
}

/** Damage a car; at zero it explodes and burns out. */
export function damageCar(S, car, amount, src) {
  if (car.dead || amount <= 0) return;
  car.hp -= amount;
  if (car === S.player.car && src) {
    // A ram from a cruiser shakes the camera.
    shake(S, 4);
  }
  if (car.hp > 0) return;
  car.hp = 0;
  car.dead = true;
  car.burning = true;
  burst(S, car.x, car.y, { count: 26, color: '#ff9a3c', speedMin: 60, speedMax: 380, life: 0.9, sizeMin: 3, sizeMax: 9 });
  burst(S, car.x, car.y, { count: 14, color: '#5a5a5a', speedMin: 20, speedMax: 120, life: 1.4, sizeMin: 6, sizeMax: 14, kind: 'smoke' });
  shake(S, 12);
  sfx('explosion');
  if (car === S.player.car) {
    S.player.car = null;
    S.player.onFoot = true;
    S.player.x = car.x + 40;
    S.player.y = car.y + 40;
  }
}

/** The nearest car to a point within range, or null. */
export function nearestCar(S, x, y, range) {
  let best = null;
  let bestD = range * range;
  for (const car of S.cars) {
    if (car.dead) continue;
    const d = (car.x - x) * (car.x - x) + (car.y - y) * (car.y - y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}
