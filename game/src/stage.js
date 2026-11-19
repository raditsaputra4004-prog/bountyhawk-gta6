// Staging for screenshots: pose a scene deterministically from a URL query
// (?shot=<name>&seed=<n>) so a screenshot is a real render of the game,
// taken the same way every time.

import { MISSION_DEFS } from './missions.js';
import { makeCar } from './vehicles.js';
import { spawnGuard } from './people.js';
import { muzzle, tracer } from './particles.js';

export const SHOT_NAMES = ['cover', 'mission', 'street', 'combat'];

/** Pose the scene named `name` in the fresh game state S. */
export function applyShot(S, name) {
  S.mode = 'play';
  S.toasts.length = 0;
  S.shot = name;
  const p = S.player;

  if (name === 'cover') {
    // Rex in a red Comet GT at speed, three stars, two cruisers on his tail,
    // the Harbor Drop marker ahead — the chase, the minimap and the job.
    const car = makeCar(S, 'comet', 1500, 1800, 0, 'player');
    car.vx = 380;
    car.speed = 380;
    S.cars.push(car);
    p.car = car;
    p.onFoot = false;
    p.x = 1500;
    p.y = 1800;
    p.angle = 0;
    p.cash = 4820;
    p.ammo = 18;
    S.wanted.heat = 55;
    S.wanted.stars = 3;
    const c1 = makeCar(S, 'cruiser', 1180, 1800, 0, 'police');
    c1.vx = 340;
    c1.speed = 340;
    const c2 = makeCar(S, 'cruiser', 980, 1832, 0, 'police');
    c2.vx = 330;
    c2.speed = 330;
    S.cars.push(c1, c2);
    S.missions.current = { def: MISSION_DEFS[2], step: 1, timer: 0, car: null };
    S.camera.x = p.x;
    S.camera.y = p.y;
    return;
  }

  if (name === 'mission') {
    // The Box Van at the docks, two stars, a cruiser closing in.
    const car = makeCar(S, 'van', 760, 2960, -Math.PI / 2, 'player');
    car.vx = 0;
    S.cars.push(car);
    p.car = car;
    p.onFoot = false;
    p.x = 760;
    p.y = 2960;
    p.angle = -Math.PI / 2;
    p.cash = 2950;
    S.wanted.heat = 35;
    S.wanted.stars = 2;
    const c1 = makeCar(S, 'cruiser', 1000, 2800, Math.PI * 0.75, 'police');
    S.cars.push(c1);
    S.missions.current = { def: MISSION_DEFS[2], step: 0, timer: 0, car: null };
    S.camera.x = p.x;
    S.camera.y = p.y;
    return;
  }

  if (name === 'street') {
    // Rex on foot in Downtown, no heat, pedestrians and traffic around.
    p.x = 1800;
    p.y = 1900;
    p.angle = -Math.PI / 2;
    p.onFoot = true;
    p.car = null;
    p.cash = 640;
    S.wanted.heat = 0;
    S.wanted.stars = 0;
    S.missions.current = { def: MISSION_DEFS[0], step: 0, timer: 0, car: null };
    // A few pedestrians right by the camera.
    for (let i = 0; i < 4; i++) {
      S.peds[i].x = 1740 + i * 46;
      S.peds[i].y = 1860 + (i % 2) * 60;
    }
    S.camera.x = p.x;
    S.camera.y = p.y;
    return;
  }

  if (name === 'combat') {
    // A shootout at The Gilded Cage: five stars, guards with health bars,
    // cruisers closing in, Rex firing.
    p.x = 1720;
    p.y = 1880;
    p.angle = Math.PI / 4;
    p.onFoot = true;
    p.car = null;
    p.cash = 7310;
    p.ammo = 14;
    S.wanted.heat = 88;
    S.wanted.stars = 5;
    const g1 = spawnGuard(S, 1830, 1800);
    const g2 = spawnGuard(S, 1690, 1760);
    g1.hp = 62;
    g2.hp = 100;
    const c1 = makeCar(S, 'cruiser', 1560, 1700, Math.PI / 4, 'police');
    const c2 = makeCar(S, 'cruiser', 1980, 1980, -Math.PI * 0.75, 'police');
    S.cars.push(c1, c2);
    muzzle(S, p.x + 24, p.y + 24, p.angle);
    tracer(S, p.x + 24, p.y + 24, g1.x, g1.y);
    S.missions.current = { def: MISSION_DEFS[3], step: 1, timer: 0, car: null };
    S.missions.guardsDown = 0;
    S.camera.x = p.x;
    S.camera.y = p.y;
    return;
  }
}
