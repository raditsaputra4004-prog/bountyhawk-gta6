// Rex Vane: walking, driving, stealing cars, punching and shooting.
// The player is either on foot or in a car; everything else follows.

import { clamp, dist } from './util.js';
import { resolveSolid } from './city.js';
import { CAR_MODELS, damageCar, driveCar, nearestCar } from './vehicles.js';
import { hurtPerson, scarePeds } from './people.js';
import { HEAT, addHeat, knockCop } from './police.js';
import { burst, floatText, muzzle, tracer } from './particles.js';
import { sfx } from './audio.js';
import { moveAxis, steerAxis, throttleAxis, wasPressed } from './input.js';

const WALK_SPEED = 175;
const PUNCH_RANGE = 58;
const PUNCH_DAMAGE = 22;
const SHOT_RANGE = 430;
const SHOT_DAMAGE = 34;

/** A fresh player at The Rusty Anchor in the Harbor. */
export function makePlayer() {
  return {
    x: 1000, y: 2600,
    angle: 0,
    vx: 0, vy: 0,
    hp: 100, maxHp: 100,
    cash: 120,
    ammo: 24,
    onFoot: true,
    car: null,
    dead: false,
    punchCd: 0,
    shootCd: 0,
    hurtFlash: 0,
    runOverGuard: 0, // invulnerability window after running someone over
    bustedLost: 0,
    wastedLost: 0,
  };
}

/** Step the player: on foot or behind the wheel. */
export function updatePlayer(S, dt) {
  const p = S.player;
  if (p.dead) return;
  p.punchCd = Math.max(0, p.punchCd - dt);
  p.shootCd = Math.max(0, p.shootCd - dt);
  p.hurtFlash = Math.max(0, p.hurtFlash - dt);
  p.runOverGuard = Math.max(0, p.runOverGuard - dt);

  if (p.car && !p.car.dead) {
    // Driving.
    const throttle = throttleAxis(S.input);
    const steer = steerAxis(S.input);
    const handbrake = S.input.keys.has('Space');
    driveCar(S, p.car, throttle, steer, handbrake, dt);
    p.x = p.car.x;
    p.y = p.car.y;
    p.angle = p.car.angle;
    runOverCheck(S, dt);
    if (wasPressed(S.input, 'KeyE')) exitCar(S);
  } else {
    // On foot.
    if (p.car && p.car.dead) p.car = null;
    const mv = moveAxis(S.input);
    p.x += mv.x * WALK_SPEED * dt;
    p.y += mv.y * WALK_SPEED * dt;
    if (mv.x !== 0 || mv.y !== 0) p.angle = Math.atan2(mv.y, mv.x);
    resolveSolid(S.city, p, 13);
    p.x = clamp(p.x, 14, 3586);
    p.y = clamp(p.y, 14, 3586);
    if (wasPressed(S.input, 'KeyE')) tryEnterCar(S);
    if (wasPressed(S.input, 'KeyF') && p.punchCd <= 0) punch(S);
    if (S.input.clicked && p.shootCd <= 0) shootAt(S, S.mouseWorld.x, S.mouseWorld.y);
  }
}

/** Running someone over in a car: peds go down, cops get angry. */
function runOverCheck(S, dt) {
  void dt;
  const p = S.player;
  if (!p.car || p.runOverGuard > 0) return;
  for (const person of S.peds) {
    if (person.dead || person.downFor > 0) continue;
    if (dist(p.x, p.y, person.x, person.y) < 34) {
      p.runOverGuard = 0.6;
      hurtPerson(S, person, 100);
      addHeat(S, person.kind === 'guard' ? HEAT.runOverCop : HEAT.hitPed);
      burst(S, person.x, person.y, { count: 10, color: '#ff6b6b', speedMax: 200 });
      sfx('crash');
      break;
    }
  }
  for (const cop of S.cops) {
    if (cop.downFor > 0 || cop.dead) continue;
    if (dist(p.x, p.y, cop.x, cop.y) < 34) {
      p.runOverGuard = 0.6;
      cop.downFor = 3;
      addHeat(S, HEAT.runOverCop);
      burst(S, cop.x, cop.y, { count: 10, color: '#9db8d6', speedMax: 200 });
      sfx('crash');
      break;
    }
  }
}

/** E near a car: climb in. A parked car is a stolen car. */
function tryEnterCar(S) {
  const p = S.player;
  // The marked mission car wins over any traffic that happens to be
  // passing by — it is the car the job needs.
  let best = null;
  let bestD = 78;
  for (const car of S.cars) {
    if (car.dead || car.kind === 'police' || !car.missionCar) continue;
    const d = dist(p.x, p.y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  if (!best) {
    best = nearestCar(S, p.x, p.y, 78);
  }
  if (!best) return;
  const car = best;
  if (car.kind === 'police') {
    // Even Rex draws the line at stealing a cruiser.
    floatText(S, p.x, p.y - 24, 'Not that one', '#9db8d6');
    return;
  }
  p.car = car;
  p.onFoot = false;
  car.kind = 'player';
  sfx('door');
  if (!car.stolen) {
    car.stolen = true;
    addHeat(S, HEAT.steal);
    floatText(S, car.x, car.y - 30, 'Car stolen! +heat', '#ff9a3c');
  }
  // Mission cars notice being taken.
  if (car.missionCar) {
    S.missions.tookMissionCar = true;
    // Taken: it is the player's car now, no longer the marked one.
    car.missionCar = false;
  }
}

/** E while driving: step out beside the car. */
function exitCar(S) {
  const p = S.player;
  const car = p.car;
  if (!car) return;
  p.car = null;
  p.onFoot = true;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  resolveSolid(S.city, p, 13);
  car.kind = 'parked';
  car.vx *= 0.2;
  car.vy *= 0.2;
  sfx('door');
}

/** F: punch whatever is in front of the player. */
function punch(S) {
  const p = S.player;
  p.punchCd = 0.38;
  sfx('punch');
  const px = p.x + Math.cos(p.angle) * 40;
  const py = p.y + Math.sin(p.angle) * 40;
  burst(S, px, py, { count: 5, color: '#ffe9a8', speedMax: 160, life: 0.25 });
  for (const person of S.peds) {
    if (person.dead || person.downFor > 0) continue;
    if (dist(px, py, person.x, person.y) < PUNCH_RANGE) {
      hurtPerson(S, person, PUNCH_DAMAGE);
      if (person.kind === 'guard') addHeat(S, HEAT.assaultCop);
      return;
    }
  }
  for (const cop of S.cops) {
    if (cop.downFor > 0 || cop.dead) continue;
    if (dist(px, py, cop.x, cop.y) < PUNCH_RANGE) {
      knockCop(S, cop);
      return;
    }
  }
}

/** Click: fire the pistol toward a world point. */
function shootAt(S, wx, wy) {
  const p = S.player;
  if (p.ammo <= 0) {
    floatText(S, p.x, p.y - 24, 'Out of ammo', '#ff6b6b');
    sfx('click');
    p.shootCd = 0.3;
    return;
  }
  p.ammo -= 1;
  p.shootCd = 0.22;
  const a = Math.atan2(wy - p.y, wx - p.x);
  p.angle = a;
  const gx = p.x + Math.cos(a) * 26;
  const gy = p.y + Math.sin(a) * 26;
  muzzle(S, gx, gy, a);
  sfx('shot');
  addHeat(S, HEAT.shoot);
  scarePeds(S, p.x, p.y, 320);
  // Hitscan: the first person or car the bullet meets.
  let bestD = SHOT_RANGE;
  let hitPerson = null;
  let hitCar = null;
  for (const person of S.peds) {
    if (person.dead || person.downFor > 0) continue;
    const d = rayCircle(p.x, p.y, a, person.x, person.y, 16);
    if (d !== null && d < bestD) {
      bestD = d;
      hitPerson = person;
      hitCar = null;
    }
  }
  for (const cop of S.cops) {
    if (cop.downFor > 0 || cop.dead) continue;
    const d = rayCircle(p.x, p.y, a, cop.x, cop.y, 16);
    if (d !== null && d < bestD) {
      bestD = d;
      hitPerson = null;
      hitCar = null;
      // A shot cop goes down hard and counts as assault.
      cop.downFor = 3;
      addHeat(S, HEAT.assaultCop);
      burst(S, cop.x, cop.y, { count: 8, color: '#9db8d6', speedMax: 180 });
    }
  }
  for (const car of S.cars) {
    if (car.dead || car === p.car) continue;
    const d = rayCircle(p.x, p.y, a, car.x, car.y, CAR_MODELS[car.model].len * 0.45);
    if (d !== null && d < bestD) {
      bestD = d;
      hitPerson = null;
      hitCar = car;
    }
  }
  const ex = p.x + Math.cos(a) * bestD;
  const ey = p.y + Math.sin(a) * bestD;
  tracer(S, gx, gy, ex, ey);
  if (hitPerson) {
    hurtPerson(S, hitPerson, SHOT_DAMAGE);
    burst(S, ex, ey, { count: 6, color: '#ff6b6b', speedMax: 160 });
  } else if (hitCar) {
    damageCar(S, hitCar, 22, null);
    burst(S, ex, ey, { count: 6, color: '#ffd27d', speedMax: 160 });
  }
}

/** Distance along a ray to a circle, or null when the ray misses. */
function rayCircle(ox, oy, angle, cx, cy, r) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const lx = cx - ox;
  const ly = cy - oy;
  const along = lx * dx + ly * dy;
  if (along < 0) return null;
  const perp2 = lx * lx + ly * ly - along * along;
  if (perp2 > r * r) return null;
  return along - Math.sqrt(r * r - perp2);
}

/** Damage the player. At zero hp the player is wasted. */
export function hurtPlayer(S, amount) {
  const p = S.player;
  if (p.dead || S.mode !== 'play') return;
  p.hp -= amount;
  p.hurtFlash = 0.45;
  if (p.hp <= 0) {
    p.hp = 0;
    p.dead = true;
    wastePlayer(S);
  }
}

/** The player is wasted: hospital, cash lost, wanted cleared. */
export function wastePlayer(S) {
  const p = S.player;
  S.mode = 'wasted';
  const lost = Math.min(300, p.cash);
  p.cash -= lost;
  p.wastedLost = lost;
  // The police stand down.
  for (const c of S.cars) if (c.kind === 'police') c.dead = true;
  S.cops.length = 0;
  S.wanted.heat = 0;
  S.wanted.stars = 0;
  sfx('fail');
}

/** Put the player back on his feet at a place, healed, with a little ammo. */
export function respawn(S, x, y) {
  const p = S.player;
  p.x = x;
  p.y = y;
  p.hp = p.maxHp;
  p.dead = false;
  p.onFoot = true;
  p.car = null;
  p.ammo = Math.max(p.ammo, 12);
  p.angle = 0;
  S.mode = 'play';
  S.camera.x = x;
  S.camera.y = y;
}
