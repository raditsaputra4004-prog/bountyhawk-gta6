// Screenshot staging: deterministic scenes for the four screenshots. Each
// scene is built from the real game state (a real car, real police, a real
// mission objective) and then played forward by a small autopilot that
// presses the same keys a player would, so the screenshot shows the game
// mid-action instead of a posed still.

import { PLACES } from './city.js';
import { CAMERA } from './config.js';
import { makeCar, initCarVelocity } from './vehicles.js';
import { makeRng, range } from './rng.js';
import { addHeat } from './police.js';
import { MISSION_DEFS, spawnGuards } from './missions.js';
import { makePed } from './peds.js';
import { input } from './input.js';

export const SHOT_NAMES = ['cover', 'street', 'mission', 'combat'];

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function normAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Put the player in a car at a road position, moving, with the engine on.
function placeDriver(world, x, y, angle, modelKey, speed) {
  const car = makeCar(x, y, angle, modelKey, 'player');
  initCarVelocity(car);
  car.vx = Math.cos(angle) * speed;
  car.vy = Math.sin(angle) * speed;
  car.speed = speed;
  car.driver = 'player';
  car.isPlayerCar = true;
  world.cars.push(car);
  world.player.car = car;
  world.player.onFoot = false;
  world.player.x = x;
  world.player.y = y;
  return car;
}

// Spawn a police cruiser behind the player on the same road, already
// chasing, with its siren running.
function placeChaser(world, x, y, angle) {
  const car = makeCar(x, y, angle, 'police', 'police');
  initCarVelocity(car);
  car.vx = Math.cos(angle) * 260;
  car.vy = Math.sin(angle) * 260;
  car.speed = 260;
  car.siren = 0;
  world.cars.push(car);
  world.policeCars.push(car);
  return car;
}

function setObjective(world, def, objectiveIndex) {
  world.missions.active = { def, startedAt: world.time, lootTaken: false };
  world.missions.objectiveIndex = objectiveIndex;
  const obj = def.objectives[objectiveIndex];
  const place = obj.place ? PLACES[obj.place] : null;
  world.objective = {
    text: obj.text,
    target: place ? { x: place.x, y: place.y, label: place.label } : null,
    kind: obj.type,
  };
  if (obj.heatOnStart) addHeat(world.wanted, obj.heatOnStart, world.time);
}

export function stageShot(world, name, seed) {
  const rng = makeRng(seed);
  const player = world.player;
  // Every shot starts from a clean, known wanted state.
  world.wanted.heat = 0;
  world.wanted.stars = 0;
  world.wanted.quietFor = 0;
  world.messages.length = 0;

  if (name === 'cover') {
    // The money shot: Rex in a red Comet GT, three stars, two cruisers on
    // his tail, the Harbor Drop delivery still on the HUD. The road ahead
    // is cleared of traffic and pedestrians so the chase reads clean — a
    // pile-up is not a cover.
    placeDriver(world, 900, 1200, 0, 'sport', 300);
    placeChaser(world, 640, 1200, 0);
    placeChaser(world, 560, 1246, 0);
    addHeat(world.wanted, 60, world.time);
    setObjective(world, MISSION_DEFS[2], 2);
    world.message('Harbor Drop — deliver the package', '#ffd34d');
    world.cars = world.cars.filter((c) => {
      if (c.isPlayerCar || c.kind === 'police') return true;
      return !(c.y > 1100 && c.y < 1300 && c.x > 800 && c.x < 2800);
    });
    world.peds = world.peds.filter((p) => !(p.y > 1120 && p.y < 1280 && p.x > 800 && p.x < 2800));
  } else if (name === 'street') {
    // On foot in Downtown, walking up the sidewalk with traffic and
    // pedestrians around, no heat — the city at ease. A few pedestrians and
    // a couple of cars are placed on the player's route so the street
    // reads as lived-in.
    player.x = 1846;
    player.y = 1400;
    player.angle = -Math.PI / 2;
    player.onFoot = true;
    player.car = null;
    for (let i = 0; i < 5; i += 1) {
      const ped = makePed(1846 + range(rng, -30, 30), 1400 - i * 90 - range(rng, 0, 40), rng);
      ped.target = { x: 1846, y: 800 };
      world.peds.push(ped);
    }
    for (let i = 0; i < 2; i += 1) {
      const c = makeCar(1600 + i * 500, 1200, 0, 'sedan', 'traffic');
      initCarVelocity(c);
      c.target = { x: 2400, y: 1200 };
      world.cars.push(c);
    }
    world.objective = {
      text: 'Go to the Neon Palms Club',
      target: { x: PLACES.club.x, y: PLACES.club.y, label: PLACES.club.label },
      kind: 'goto',
    };
    world.message('Downtown Sunport — find a car, find work', '#ffffff');
  } else if (name === 'mission') {
    // Harbor Drop in progress: two stars, one cruiser behind, the Sunset
    // Motel marker on the HUD and the minimap.
    placeDriver(world, 1500, 1200, 0, 'van', 280);
    placeChaser(world, 1180, 1200, 0);
    addHeat(world.wanted, 40, world.time);
    setObjective(world, MISSION_DEFS[2], 2);
    world.message('Lose the heat, then drop the package', '#ffd34d');
    world.cars = world.cars.filter((c) => {
      if (c.isPlayerCar || c.kind === 'police') return true;
      return !(c.y > 1100 && c.y < 1300 && c.x > 1400 && c.x < 2800);
    });
    world.peds = world.peds.filter((p) => !(p.y > 1120 && p.y < 1280 && p.x > 1400 && p.x < 2800));
  } else if (name === 'combat') {
    // The Payday Smash going loud: Rex on foot at the Gilded Cage, two
    // armed guards, three stars, the SPPD closing in. The cruiser starts
    // further back so it arrives as the shooting starts, not on top of Rex.
    player.x = 1800;
    player.y = 1330;
    player.angle = -Math.PI / 2;
    player.onFoot = true;
    player.car = null;
    player.ammo = 60;
    addHeat(world.wanted, 60, world.time);
    setObjective(world, MISSION_DEFS[3], 1);
    spawnGuards(world, 2);
    for (const g of world.guards) g.health = 200;
    placeChaser(world, 1200, 1200, 0);
    world.message('The Gilded Cage — smash the case!', '#ff6b5c');
    // Keep bystanders out of the line of fire so the player's shots hit
    // the guards, not pedestrians.
    world.peds = world.peds.filter((p) => Math.hypot(p.x - 1800, p.y - 1236) > 450);
  }
  // Snap the camera to the player so the first frame is already framed.
  world.camera.x = player.x;
  world.camera.y = player.y;
  world.camera.zoom = player.car ? CAMERA.zoomCar : CAMERA.zoomFoot;
}

// The autopilot: each frame, press the keys a player would press to keep
// the scene moving. It only touches the shared input state, so the game
// itself never knows the difference.
export function shotInput(world, name, dt) {
  const player = world.player;
  input.keys.clear();
  input.mouse.down = false;
  if (name === 'cover' || name === 'mission') {
    // Drive east along the y=1200 road, steering back onto it when the car
    // drifts, and hold the throttle open.
    const car = player.car;
    if (!car) return;
    input.keys.add('KeyW');
    const want = Math.atan2(1200 - car.y, 600);
    const diff = normAngle(want - car.angle);
    if (diff > 0.06) input.keys.add('KeyD');
    else if (diff < -0.06) input.keys.add('KeyA');
    if (world.time > 1.2 && name === 'cover') input.keys.add('ShiftLeft');
  } else if (name === 'street') {
    // Stroll north up the sidewalk, drifting a little side to side.
    input.keys.add('KeyW');
    if (Math.sin(world.time * 0.9) > 0.55) input.keys.add('KeyD');
    else if (Math.sin(world.time * 0.9) < -0.55) input.keys.add('KeyA');
  } else if (name === 'combat') {
    // Aim at the nearest standing guard and fire in bursts, while strafing
    // in a tight circle so the foot cops cannot hold Rex long enough to
    // bust him mid-shot — and so the guards stay in frame.
    const mx = Math.cos(world.time * 2.2);
    const my = Math.sin(world.time * 2.2);
    if (mx > 0.3) input.keys.add('KeyD');
    else if (mx < -0.3) input.keys.add('KeyA');
    if (my > 0.3) input.keys.add('KeyS');
    else if (my < -0.3) input.keys.add('KeyW');
    let best = null;
    let bestD = Infinity;
    for (const g of world.guards) {
      if (g.down) continue;
      const d = Math.hypot(g.x - player.x, g.y - player.y);
      if (d < bestD) {
        bestD = d;
        best = g;
      }
    }
    if (best) {
      input.mouse.worldX = best.x;
      input.mouse.worldY = best.y;
      input.mouse.x = 640;
      input.mouse.y = 300;
      if (Math.floor(world.time * 1.4) % 2 === 0) input.mouse.down = true;
    }
  }
}
