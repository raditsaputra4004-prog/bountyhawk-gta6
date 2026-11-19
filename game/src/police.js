// The wanted system and the Sunport Police Department. Heat rises when the
// player is seen committing crimes and falls when the player stays out of
// sight; police cars and foot cops spawn to match the star level and hunt
// the player until the heat is gone.

import { WANTED, WORLD } from './config.js';
import { makeCar, initCarVelocity, driveCar, nearestIntersection } from './vehicles.js';
import { randomIntersection } from './city.js';
import { range } from './rng.js';

export function makeWanted() {
  return {
    heat: 0,
    stars: 0,
    quietFor: 0, // seconds since the last crime or police sighting
    lastCrimeAt: -999,
    bustedTimer: 0, // seconds a foot cop has held the player
  };
}

export function starsOf(heat) {
  return Math.min(WANTED.maxStars, Math.floor(heat / WANTED.heatPerStar));
}

export function addHeat(wanted, amount, now) {
  wanted.heat = Math.min(WANTED.maxStars * WANTED.heatPerStar, wanted.heat + amount);
  wanted.stars = starsOf(wanted.heat);
  wanted.quietFor = 0;
  wanted.lastCrimeAt = now;
}

export function makeCop(x, y) {
  return {
    x, y,
    angle: 0,
    speed: WANTED.copSpeed,
    radius: 12,
    holdTime: 0, // how long this cop has been touching the player
    punchCooldown: 0,
    state: 'chase',
  };
}

// Spawn police cars at road intersections away from the player, and foot
// cops on the sidewalks nearby, to match the current star level.
export function maintainPolice(world, dt, rng) {
  const wanted = world.wanted;
  const targetCars = WANTED.carsForStars[wanted.stars] || 0;
  const targetFoot = WANTED.footForStars[wanted.stars] || 0;
  const player = world.player;

  while (world.policeCars.length < targetCars) {
    // Spawn two intersections away so they arrive with sirens, not on top
    // of the player.
    let spot = randomIntersection(rng);
    let tries = 0;
    while (Math.hypot(spot.x - player.x, spot.y - player.y) < 700 && tries < 12) {
      spot = randomIntersection(rng);
      tries += 1;
    }
    const car = makeCar(spot.x, spot.y, Math.atan2(player.y - spot.y, player.x - spot.x), 'police', 'police');
    initCarVelocity(car);
    car.siren = 0;
    world.policeCars.push(car);
    world.cars.push(car);
  }
  while (world.policeCars.length > targetCars) {
    const car = world.policeCars.pop();
    const idx = world.cars.indexOf(car);
    if (idx >= 0) world.cars.splice(idx, 1);
  }
  while (world.cops.length < targetFoot) {
    const angle = rng() * Math.PI * 2;
    const dist = range(rng, 260, 420);
    const cop = makeCop(
      Math.max(30, Math.min(WORLD.size - 30, player.x + Math.cos(angle) * dist)),
      Math.max(30, Math.min(WORLD.size - 30, player.y + Math.sin(angle) * dist)),
    );
    world.cops.push(cop);
  }
  while (world.cops.length > targetFoot) world.cops.pop();
}

// One police car chasing the player: steer toward the player's position
// with a little prediction, ram when close, and back off after a hard hit
// so it can come around again. Far away it drives intersection to
// intersection along the roads instead of cutting across blocks — a
// cruiser driving over rooftops looks wrong.
export function stepPoliceCar(car, dt, world) {
  const player = world.player;
  const target = player.car || player;
  const dx = target.x - car.x;
  const dy = target.y - car.y;
  const dist = Math.hypot(dx, dy);
  let aimX = target.x;
  let aimY = target.y;
  if (dist > 300) {
    // Aim at the intersection nearest the player: the roads lead there.
    const near = nearestIntersection(target.x, target.y);
    aimX = near.x;
    aimY = near.y;
  } else {
    // Close in: aim slightly ahead of a moving target.
    const lead = Math.min(0.6, dist / 600);
    aimX = target.x + (target.vx || 0) * lead;
    aimY = target.y + (target.vy || 0) * lead;
  }
  const want = Math.atan2(aimY - car.y, aimX - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.4));
  const throttle = dist > 60 ? 1 : 0.55;
  driveCar(car, throttle, steer, false, dt, false);
  car.siren = (car.siren || 0) + dt;
  if (dist < 90 && Math.random() < dt * 0.5) {
    // Siren wail in bursts.
    if (world.audio) world.audio.sirenBurst();
  }
}

// A foot cop runs at the player and, once close, holds on: if any cop holds
// the player for 1.2 seconds total, the player is busted.
export function stepCop(cop, dt, world) {
  const player = world.player;
  const dx = player.x - cop.x;
  const dy = player.y - cop.y;
  const dist = Math.hypot(dx, dy);
  if (dist > 14) {
    cop.angle = Math.atan2(dy, dx);
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    cop.holdTime = Math.max(0, cop.holdTime - dt);
  } else {
    cop.holdTime += dt;
    cop.punchCooldown -= dt;
    if (cop.punchCooldown <= 0) {
      cop.punchCooldown = 0.8;
      player.health -= 6;
      if (world.onPlayerHurt) world.onPlayerHurt(6, 'cop');
    }
  }
  world.wanted.bustedTimer = Math.max(...world.cops.map((c) => c.holdTime), 0);
}

// Heat decay: only when no police is near and no crime happened recently.
export function stepWanted(wanted, dt, world) {
  const player = world.player;
  let nearest = Infinity;
  for (const car of world.policeCars) {
    nearest = Math.min(nearest, Math.hypot(car.x - player.x, car.y - player.y));
  }
  for (const cop of world.cops) {
    nearest = Math.min(nearest, Math.hypot(cop.x - player.x, cop.y - player.y));
  }
  if (nearest > 520 && wanted.heat > 0) {
    wanted.quietFor += dt;
    if (wanted.quietFor > WANTED.decayDelay) {
      wanted.heat = Math.max(0, wanted.heat - WANTED.decayRate * dt);
      wanted.stars = starsOf(wanted.heat);
    }
  } else {
    wanted.quietFor = 0;
  }
  if (wanted.stars === 0) {
    wanted.bustedTimer = 0;
    for (const cop of world.cops) cop.holdTime = 0;
  }
}
