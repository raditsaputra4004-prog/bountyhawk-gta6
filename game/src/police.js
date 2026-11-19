// The Sunport police: the wanted system, cruiser pursuit, foot cops and
// the bust. Heat is the currency; stars are what the player sees.

import { angleDiff, clamp, dist, randRange } from './util.js';
import { bfsPath, nearestNode, nearestRoadPoint } from './city.js';
import { damageCar, driveCar, makeCar } from './vehicles.js';
import { burst, shake } from './particles.js';
import { hurtPlayer } from './player.js';
import { sfx } from './audio.js';

// Heat gained by each crime.
export const HEAT = {
  steal: 22,
  hitPed: 12,
  shoot: 6,
  assaultCop: 30,
  runOverCop: 30,
};

/** Stars from heat: 0 below 15, then one star per band up to 5. */
export function starsFromHeat(heat) {
  if (heat < 15) return 0;
  if (heat < 30) return 1;
  if (heat < 45) return 2;
  if (heat < 60) return 3;
  if (heat < 80) return 4;
  return 5;
}

/** Add heat. Resets the quiet timer that lets the wanted level decay. */
export function addHeat(S, amount) {
  if (S.mode !== 'play') return;
  S.wanted.heat = clamp(S.wanted.heat + amount, 0, 100);
  S.wanted.quietFor = 0;
  S.wanted.stars = starsFromHeat(S.wanted.heat);
}

/** Set the heat outright: scripted mission moments pin the wanted level
 * (a 2-star escape stays a 2-star escape, whatever happened before). */
export function setHeat(S, value) {
  if (S.mode !== 'play') return;
  S.wanted.heat = clamp(value, 0, 100);
  S.wanted.quietFor = 0;
  S.wanted.stars = starsFromHeat(S.wanted.heat);
}

/** Decay the heat after 12 quiet seconds. */
export function updateWanted(S, dt) {
  S.wanted.quietFor += dt;
  if (S.wanted.quietFor > 12 && S.wanted.heat > 0) {
    S.wanted.heat = Math.max(0, S.wanted.heat - 3 * dt);
    S.wanted.stars = starsFromHeat(S.wanted.heat);
  }
}

/** How many cruisers the current stars want on the road. */
function wantedCruisers(stars) {
  return stars;
}

/** Step the police: spawn and despawn cruisers and foot cops, chase, bust. */
export function updatePolice(S, dt) {
  const stars = S.wanted.stars;
  // Cruisers.
  const cruisers = S.cars.filter((c) => c.kind === 'police' && !c.dead);
  const want = S.mode === 'play' ? wantedCruisers(stars) : 0;
  if (cruisers.length < want) {
    // Spawn a little way off, on a road near the player.
    const a = S.rng() * Math.PI * 2;
    const sx = clamp(S.player.x + Math.cos(a) * randRange(S.rng, 550, 800), 100, 3500);
    const sy = clamp(S.player.y + Math.sin(a) * randRange(S.rng, 550, 800), 100, 3500);
    const near = nearestRoadPoint(S.city, sx, sy);
    const cruiser = makeCar(S, 'cruiser', near.x, near.y, Math.atan2(S.player.y - near.y, S.player.x - near.x), 'police');
    cruiser.siren = true;
    S.cars.push(cruiser);
  }
  for (const c of cruisers) {
    if (dist(c.x, c.y, S.player.x, S.player.y) > 1500 && stars === 0) {
      c.dead = true;
      continue;
    }
    updateCruiser(S, c, dt);
  }
  // Foot cops join the chase at 2 stars and up.
  const cops = S.cops;
  const wantCops = S.mode === 'play' ? Math.max(0, stars - 1) : 0;
  if (cops.length < wantCops) {
    const a = S.rng() * Math.PI * 2;
    cops.push({
      kind: 'cop',
      x: clamp(S.player.x + Math.cos(a) * 260, 40, 3560),
      y: clamp(S.player.y + Math.sin(a) * 260, 40, 3560),
      angle: 0,
      hp: 100,
      holdFor: 0,
      downFor: 0,
      dead: false,
    });
  }
  for (const cop of cops) {
    updateCop(S, cop, dt);
  }
  for (let i = cops.length - 1; i >= 0; i--) {
    if (cops[i].dead || (stars === 0 && dist(cops[i].x, cops[i].y, S.player.x, S.player.y) > 1200)) {
      cops.splice(i, 1);
    }
  }
}

/** One cruiser: road-following pursuit when far, direct ramming when near. */
function updateCruiser(S, car, dt) {
  const d = dist(car.x, car.y, S.player.x, S.player.y);
  let wantAngle;
  if (d > 460) {
    // Follow the road graph toward the player's nearest intersection.
    const from = nearestNode(S.city, car.x, car.y);
    const to = nearestNode(S.city, S.player.x, S.player.y);
    const path = bfsPath(S.city, from, to);
    const next = path.length > 1 ? S.city.nodes[path[1]] : S.city.nodes[to];
    wantAngle = Math.atan2(next.y - car.y, next.x - car.x);
  } else {
    // Close in: aim straight at the player and ram.
    wantAngle = Math.atan2(S.player.y - car.y, S.player.x - car.x);
  }
  const steer = clamp(angleDiff(car.angle, wantAngle) * 2.2, -1, 1);
  // After a ram the cruiser backs off for a beat instead of grinding
  // against the player's car, so a chase is a series of hits, not a pin.
  let throttle = 1;
  if (car.ramCd > 0.5) {
    throttle = 0.25;
  }
  driveCar(S, car, throttle, steer, false, dt);
  // Ramming the player's car hurts it — one solid hit, then the cruiser
  // backs off for a moment instead of grinding the car down.
  car.ramCd = Math.max(0, car.ramCd - dt);
  if (S.player.car && !S.player.car.dead) {
    const pd = dist(car.x, car.y, S.player.car.x, S.player.car.y);
    if (pd < 46 && car.ramCd <= 0) {
      car.ramCd = 1.2;
      damageCar(S, S.player.car, 8, car);
      shake(S, 3);
    }
  }
  // Running the player down on foot.
  if (S.player.onFoot && !S.player.dead) {
    const pd = dist(car.x, car.y, S.player.x, S.player.y);
    if (pd < 40) {
      hurtPlayer(S, 30 * dt);
    }
  }
}

/** One foot cop: chase the player, punch up close, bust after a 1.2 s hold. */
function updateCop(S, cop, dt) {
  if (cop.downFor > 0) {
    cop.downFor -= dt;
    return;
  }
  const d = dist(cop.x, cop.y, S.player.x, S.player.y);
  cop.angle = Math.atan2(S.player.y - cop.y, S.player.x - cop.x);
  if (d > 34) {
    cop.x += Math.cos(cop.angle) * 205 * dt;
    cop.y += Math.sin(cop.angle) * 205 * dt;
    cop.holdFor = 0;
    return;
  }
  // On top of the player: hold to bust.
  cop.holdFor += dt;
  if (cop.holdFor > 0.5 && S.mode === 'play') {
    hurtPlayer(S, 14 * dt);
  }
  if (cop.holdFor >= 1.2) {
    bustPlayer(S);
  }
}

/** Knock a cop down (punch). Assaulting a cop is a serious crime. */
export function knockCop(S, cop) {
  if (cop.downFor > 0) return;
  cop.downFor = 3;
  cop.holdFor = 0;
  addHeat(S, HEAT.assaultCop);
  burst(S, cop.x, cop.y, { count: 8, color: '#9db8d6', speedMax: 160 });
}

/** The player is busted: jail, cash lost, wanted cleared, respawn at HQ. */
export function bustPlayer(S) {
  if (S.mode !== 'play') return;
  S.mode = 'busted';
  const lost = Math.min(500, Math.floor(S.player.cash * 0.2));
  S.player.cash -= lost;
  S.player.bustedLost = lost;
  S.wanted.heat = 0;
  S.wanted.stars = 0;
  // Clear the police off the street.
  for (const c of S.cars) if (c.kind === 'police') c.dead = true;
  S.cops.length = 0;
  sfx('busted');
}

/** Clear all wanted heat (mission script or respawn). */
export function clearWanted(S) {
  S.wanted.heat = 0;
  S.wanted.stars = 0;
  S.wanted.quietFor = 0;
  for (const c of S.cars) if (c.kind === 'police') c.dead = true;
  S.cops.length = 0;
}
