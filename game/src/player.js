// Rex Vane on foot: walking and running, punching, shooting, and getting
// in and out of cars. The player object also carries the persistent state
// (cash, health, wanted) that missions and the save file read.

import { PLAYER, WANTED, CAR } from './config.js';
import { resolveSolids, hitsBuilding } from './city.js';
import { addHeat } from './police.js';
import { burst, floatText } from './particles.js';

export function makePlayer() {
  return {
    x: PLAYER.startX,
    y: PLAYER.startY,
    vx: 0, vy: 0,
    angle: 0, // facing, radians
    radius: PLAYER.radius,
    health: PLAYER.health,
    cash: PLAYER.startCash,
    ammo: 24,
    car: null, // the car object Rex is driving, or null on foot
    onFoot: true,
    punchTimer: 0,
    shootTimer: 0,
    hurtFlash: 0,
    dead: false,
    busted: false,
    invulnerable: 0,
  };
}

// Move on foot: WASD/arrows, Shift to run. Returns nothing; the world
// reads player.x/y and player.angle afterwards.
export function stepPlayerOnFoot(player, move, dt, world) {
  const running = world.input.down('ShiftLeft') || world.input.down('ShiftRight');
  const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const mx = move.x;
  const my = move.y;
  if (mx !== 0 || my !== 0) {
    player.angle = Math.atan2(my, mx);
    player.x += mx * speed * dt;
    player.y += my * speed * dt;
  }
  player.vx = mx * speed;
  player.vy = my * speed;
  resolveSolids(world.city, player, player.radius);
  if (player.hurtFlash > 0) player.hurtFlash -= dt;
  if (player.invulnerable > 0) player.invulnerable -= dt;
  if (player.punchTimer > 0) player.punchTimer -= dt;
  if (player.shootTimer > 0) player.shootTimer -= dt;
}

// The nearest car the player can enter (parked, traffic or police —
// stealing is the point, and the wanted system notices).
export function nearestEnterableCar(world, maxDist = 64) {
  let best = null;
  let bestD = maxDist;
  for (const car of world.cars) {
    if (car.driver) continue;
    const d = Math.hypot(car.x - world.player.x, car.y - world.player.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export function enterCar(world, car) {
  const player = world.player;
  const wasKind = car.kind;
  player.car = car;
  player.onFoot = false;
  car.driver = 'player';
  car.isPlayerCar = true;
  car.kind = 'player';
  // A stolen cruiser stops being a police car: take it off the SPPD roster
  // so the wanted system spawns a fresh one instead of driving this one.
  const pi = world.policeCars.indexOf(car);
  if (pi >= 0) world.policeCars.splice(pi, 1);
  player.x = car.x;
  player.y = car.y;
  if (wasKind === 'parked') {
    // Stealing a parked car is a crime the police notice.
    addHeat(world.wanted, WANTED.crimeHeat.steal, world.time);
    world.message('Car stolen — the SPPD is on to you', '#ffb13c');
    world.audio.pickup();
  }
  if (wasKind === 'traffic') {
    addHeat(world.wanted, WANTED.crimeHeat.steal, world.time);
    world.message('You jacked a moving car!', '#ffb13c');
  }
}

export function exitCar(world) {
  const player = world.player;
  const car = player.car;
  if (!car) return;
  // Step out beside the car, on the driver's side.
  const side = { x: -Math.sin(car.angle), y: Math.cos(car.angle) };
  player.x = car.x + side.x * 34;
  player.y = car.y + side.y * 34;
  resolveSolids(world.city, player, player.radius);
  player.car = null;
  player.onFoot = true;
  car.driver = null;
  car.isPlayerCar = false;
  car.kind = car.model === 'police' ? 'police' : 'parked';
  car.vx *= 0.2;
  car.vy *= 0.2;
}

// Punch: a short-range arc in front of the player. Hits peds, foot cops,
// and mission guards; hurting a pedestrian is a crime.
export function punch(world) {
  const player = world.player;
  if (player.punchTimer > 0) return;
  player.punchTimer = PLAYER.punchCooldown;
  world.audio.punch();
  const reach = PLAYER.punchRange + 14;
  const fx = Math.cos(player.angle);
  const fy = Math.sin(player.angle);
  let hitAnything = false;
  for (const ped of world.peds) {
    const dx = ped.x - player.x;
    const dy = ped.y - player.y;
    const d = Math.hypot(dx, dy);
    if (d < reach && dx * fx + dy * fy > 0) {
      hitAnything = true;
      ped.state = 'flee';
      ped.fear = 3;
      ped.x += fx * 26;
      ped.y += fy * 26;
      burst(world.particles, ped.x, ped.y, 6, '#ffd34d', 120, 0.4, 3);
      addHeat(world.wanted, WANTED.crimeHeat.hitPed, world.time);
    }
  }
  for (const cop of world.cops) {
    const dx = cop.x - player.x;
    const dy = cop.y - player.y;
    const d = Math.hypot(dx, dy);
    if (d < reach && dx * fx + dy * fy > 0) {
      hitAnything = true;
      cop.x += fx * 40;
      cop.y += fy * 40;
      cop.holdTime = 0;
      burst(world.particles, cop.x, cop.y, 8, '#9ec2ff', 140, 0.4, 3);
      addHeat(world.wanted, WANTED.crimeHeat.assaultCop, world.time);
    }
  }
  for (const guard of world.guards) {
    const dx = guard.x - player.x;
    const dy = guard.y - player.y;
    const d = Math.hypot(dx, dy);
    if (d < reach && dx * fx + dy * fy > 0) {
      hitAnything = true;
      guard.health -= PLAYER.punchDamage;
      guard.x += fx * 30;
      guard.y += fy * 30;
      burst(world.particles, guard.x, guard.y, 8, '#ff8a5c', 140, 0.4, 3);
      if (guard.health <= 0) {
        guard.down = true;
        floatText(world.particles, guard.x, guard.y - 20, 'Guard down', '#ffb13c');
      }
    }
  }
  if (!hitAnything) {
    // A whiff still swings, with a little dust puff for feedback.
    burst(world.particles, player.x + fx * 24, player.y + fy * 24, 3, 'rgba(255,255,255,0.5)', 60, 0.25, 2);
  }
}

// Shoot toward the mouse: a hitscan shot with a tracer, a muzzle flash and
// a crime if anyone sees it. Returns true when a shot was fired.
export function shoot(world) {
  const player = world.player;
  if (player.shootTimer > 0 || player.ammo <= 0) return false;
  player.shootTimer = PLAYER.gunCooldown;
  player.ammo -= 1;
  world.audio.gunshot();
  const mx = world.input.mouse.worldX;
  const my = world.input.mouse.worldY;
  const angle = Math.atan2(my - player.y, mx - player.x);
  player.angle = angle;
  const ex = player.x + Math.cos(angle) * 26;
  const ey = player.y + Math.sin(angle) * 26;
  burst(world.particles, ex, ey, 4, '#ffe08a', 200, 0.12, 3);
  // Find the closest thing the shot hits along its line.
  let bestT = PLAYER.gunRange;
  let bestTarget = null;
  let bestKind = null;
  const targets = [];
  for (const ped of world.peds) targets.push({ x: ped.x, y: ped.y, r: 12, kind: 'ped', ref: ped });
  for (const cop of world.cops) targets.push({ x: cop.x, y: cop.y, r: 13, kind: 'cop', ref: cop });
  for (const guard of world.guards) {
    if (!guard.down) targets.push({ x: guard.x, y: guard.y, r: 13, kind: 'guard', ref: guard });
  }
  for (const car of world.cars) {
    targets.push({ x: car.x, y: car.y, r: 18, kind: 'car', ref: car });
  }
  for (const t of targets) {
    const dx = t.x - player.x;
    const dy = t.y - player.y;
    const along = dx * Math.cos(angle) + dy * Math.sin(angle);
    if (along < 0 || along > bestT) continue;
    const perp = Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle));
    if (perp < t.r) {
      bestT = along;
      bestTarget = t.ref;
      bestKind = t.kind;
    }
  }
  const endX = player.x + Math.cos(angle) * bestT;
  const endY = player.y + Math.sin(angle) * bestT;
  world.tracer = { x1: ex, y1: ey, x2: endX, y2: endY, life: 0.08 };
  if (bestTarget) {
    burst(world.particles, endX, endY, 8, '#ff5c5c', 160, 0.35, 3);
    if (bestKind === 'ped') {
      bestTarget.state = 'flee';
      bestTarget.fear = 4;
      addHeat(world.wanted, WANTED.crimeHeat.shoot, world.time);
    } else if (bestKind === 'cop') {
      bestTarget.x += Math.cos(angle) * 18;
      bestTarget.y += Math.sin(angle) * 18;
      addHeat(world.wanted, WANTED.crimeHeat.assaultCop, world.time);
    } else if (bestKind === 'guard') {
      bestTarget.health -= PLAYER.gunDamage;
      if (bestTarget.health <= 0) {
        bestTarget.down = true;
        floatText(world.particles, bestTarget.x, bestTarget.y - 20, 'Guard down', '#ffb13c');
      }
    } else if (bestKind === 'car') {
      bestTarget.health -= 8;
      if (bestTarget.health <= 0) {
        world.explodeCar(bestTarget);
      }
    }
  }
  return true;
}

// Damage the player (crashes, bullets, fists). Returns true if the player
// just died.
export function hurtPlayer(world, amount, cause) {
  const player = world.player;
  if (player.invulnerable > 0 || player.dead) return false;
  player.health -= amount;
  player.hurtFlash = 0.35;
  if (player.health <= 0) {
    player.health = 0;
    player.dead = true;
    world.audio.explosion();
    burst(world.particles, player.x, player.y, 40, '#ff9a3c', 260, 0.9, 4);
    return true;
  }
  return false;
}
