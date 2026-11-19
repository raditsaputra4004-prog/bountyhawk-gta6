// Cars: the player's ride, the traffic that fills the roads, and the
// police cruisers. One arcade physics model serves them all; the traffic
// and police drivers differ only in what they steer toward.

import { CAR, WORLD } from './config.js';
import { neighboursOf, onRoad, randomIntersection } from './city.js';
import { makeRng, pick, range } from './rng.js';

let nextId = 1;

export function makeCar(x, y, angle, modelKey, kind = 'traffic') {
  const model = CAR.models.find((m) => m.key === modelKey) || CAR.models[0];
  return {
    id: nextId++,
    x, y,
    vx: 0, vy: 0,
    angle,
    speed: 0,
    model: model.key,
    modelName: model.name,
    color: model.color,
    top: model.top,
    accel: model.accel,
    kind, // 'traffic' | 'police' | 'player' | 'parked'
    driver: null, // 'player' when the player is behind the wheel
    health: 100,
    stuck: 0,
    target: null, // traffic waypoint {x, y}
    wait: 0,
    horn: 0,
    brakeLights: false,
    // The car the player is driving is flagged so the world can find it.
    isPlayerCar: false,
  };
}

// A parked car the player can steal. It sits beside a road, engine off.
export function makeParkedCar(rng, x, y, angle, modelKey) {
  const car = makeCar(x, y, angle, modelKey, 'parked');
  car.color = pick(rng, ['#c22e3d', '#2e5d8a', '#e8b13c', '#5a8a4a', '#8a4a7a', '#b8bcc4']);
  return car;
}

// Arcade driving: throttle along the heading, steering that bites harder
// the slower the car goes, drag, and a handbrake that slides the tail.
export function driveCar(car, throttle, steer, brake, dt, skidding) {
  const forward = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
  const speedAlong = car.vx * forward.x + car.vy * forward.y;
  if (throttle > 0) {
    car.vx += forward.x * car.accel * throttle * dt;
    car.vy += forward.y * car.accel * throttle * dt;
  }
  if (throttle < 0) {
    car.vx += forward.x * car.accel * 0.6 * throttle * dt;
    car.vy += forward.y * car.accel * 0.6 * throttle * dt;
  }
  if (brake) {
    const s = Math.hypot(car.vx, car.vy);
    if (s > 1) {
      car.vx -= (car.vx / s) * CAR.brake * dt;
      car.vy -= (car.vy / s) * CAR.brake * dt;
    }
  }
  // Steering: turn rate falls off with speed so fast cars stay stable.
  const speed = Math.hypot(car.vx, car.vy);
  const grip = CAR.grip * (1 - Math.min(0.55, speed / 1400));
  car.angle += steer * grip * dt * (speed > 8 ? 1 : speed / 8) * (speedAlong < 0 ? -1 : 1);
  // Split velocity into forward and sideways; sideways bleeds off (grip),
  // faster when the handbrake is held so the tail steps out.
  const fwd = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
  const side = { x: -fwd.y, y: fwd.x };
  let vF = car.vx * fwd.x + car.vy * fwd.y;
  let vS = car.vx * side.x + car.vy * side.y;
  const slide = skidding ? 0.86 : 0.94;
  vS *= Math.pow(slide, dt * 60);
  const drag = Math.pow(1 - CAR.drag * 0.12, dt * 60);
  vF *= drag;
  if (vF > car.top) vF = car.top;
  if (vF < -CAR.maxReverse) vF = -CAR.maxReverse;
  car.vx = fwd.x * vF + side.x * vS;
  car.vy = fwd.y * vF + side.y * vS;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  car.speed = Math.hypot(car.vx, car.vy);
  return { speedAlong: vF, sideways: vS };
}

export function initCarVelocity(car) {
  car.vx = 0;
  car.vy = 0;
}

// Traffic brains: follow the road grid from intersection to intersection,
// pausing a beat at some of them, and never leaving the roads.
export function stepTrafficCar(car, dt, rng, world) {
  if (car.wait > 0) {
    car.wait -= dt;
    return;
  }
  if (!car.target) {
    const near = nearestIntersection(car.x, car.y);
    car.target = pick(rng, neighboursOf(near.x, near.y));
  }
  const dx = car.target.x - car.x;
  const dy = car.target.y - car.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 26) {
    const next = neighboursOf(car.target.x, car.target.y);
    car.target = pick(rng, next);
    if (rng() < 0.25) car.wait = range(rng, 0.4, 1.6);
    return;
  }
  const want = Math.atan2(dy, dx);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.2));
  // Slow for the car ahead so traffic does not pile up.
  let throttle = 0.75;
  for (const other of world.cars) {
    if (other === car || other.kind === 'parked') continue;
    const ox = other.x - car.x;
    const oy = other.y - car.y;
    const ahead = ox * Math.cos(car.angle) + oy * Math.sin(car.angle);
    const side = Math.abs(-ox * Math.sin(car.angle) + oy * Math.cos(car.angle));
    if (ahead > 0 && ahead < 70 && side < 30) {
      throttle = 0;
      break;
    }
  }
  driveCar(car, throttle, steer, false, dt, false);
  // Keep traffic on the roads: if it drifts off, steer back to the nearest
  // intersection instead of cutting across blocks.
  if (!onRoad(car.x, car.y)) {
    car.target = nearestIntersection(car.x, car.y);
  }
}

export function nearestIntersection(x, y) {
  let best = null;
  let bestD = Infinity;
  for (let ix = 0; ix <= WORLD.size; ix += WORLD.roadEvery) {
    for (let iy = 0; iy <= WORLD.size; iy += WORLD.roadEvery) {
      const d = (ix - x) * (ix - x) + (iy - y) * (iy - y);
      if (d < bestD) {
        bestD = d;
        best = { x: ix, y: iy };
      }
    }
  }
  return best;
}

// Spawn a batch of traffic cars spread across the roads.
export function spawnTraffic(rng, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const spot = randomIntersection(rng);
    const model = pick(rng, ['sedan', 'sedan', 'taxi', 'muscle', 'van']);
    const angle = pick(rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]);
    const car = makeCar(spot.x + range(rng, -20, 20), spot.y + range(rng, -20, 20), angle, model, 'traffic');
    initCarVelocity(car);
    cars.push(car);
  }
  return cars;
}

// A few parked cars the player can steal, placed along road edges.
export function spawnParked(rng, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const spot = randomIntersection(rng);
    const along = pick(rng, ['x', 'y']);
    const off = range(rng, -120, 120);
    // Park in a lane, 20 units off the centre line: far enough from moving
    // traffic, never inside a building (buildings start 50 off the line).
    const x = along === 'x' ? spot.x + off : spot.x + (rng() < 0.5 ? -20 : 20);
    const y = along === 'y' ? spot.y + off : spot.y + (rng() < 0.5 ? -20 : 20);
    const angle = along === 'x' ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    const model = pick(rng, ['sedan', 'sport', 'muscle', 'taxi', 'van']);
    const car = makeParkedCar(rng, x, y, angle, model);
    initCarVelocity(car);
    cars.push(car);
  }
  return cars;
}
