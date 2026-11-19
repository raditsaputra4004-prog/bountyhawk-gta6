// Sunport Heat — the world, the loop, and the wiring between every system.
// This is the only file that knows about all the others: it builds the
// world, steps it every frame, and draws it.

import { WORLD, CAMERA, TRAFFIC, WANTED, PLAYER } from './config.js';
import { buildCity, PLACES } from './city.js';
import { makeRng } from './rng.js';
import { input, bindInput } from './input.js';
import { audio } from './audio.js';
import { makeParticles, burst, smoke, addSkid, stepParticles } from './particles.js';
import { spawnTraffic, spawnParked, driveCar, stepTrafficCar } from './vehicles.js';
import { spawnPeds, stepPed, scarePeds } from './peds.js';
import { makeWanted, addHeat, maintainPolice, stepPoliceCar, stepCop, stepWanted } from './police.js';
import { makePlayer, stepPlayerOnFoot, nearestEnterableCar, enterCar, exitCar, punch, shoot, hurtPlayer } from './player.js';
import { makeMissions, currentMission, startMission, stepMissions, stepTaxi, startTaxi } from './missions.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { drawWorld, drawHUD } from './render.js';
import { stageShot, shotInput, SHOT_NAMES } from './shots.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');
const SEED = Number(params.get('seed') || 1337);
const SHOT_MODE = SHOT_NAMES.includes(SHOT);

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();
bindInput(canvas);

// ---- world ---------------------------------------------------------------

function buildWorld(seed) {
  const rng = makeRng(seed);
  const city = buildCity(seed);
  const world = {
    seed,
    time: 0,
    city,
    gameRng: makeRng(seed + 777), // live gameplay randomness, separate from the city seed
    player: makePlayer(),
    cars: [],
    policeCars: [],
    cops: [],
    peds: [],
    guards: [],
    particles: makeParticles(),
    wanted: makeWanted(),
    missions: makeMissions(),
    messages: [],
    objective: null,
    tracer: null,
    camera: { x: PLAYER.startX, y: PLAYER.startY, zoom: CAMERA.zoomFoot, shakeX: 0, shakeY: 0, shake: 0 },
    state: 'title',
    input,
    audio,
    dangerX: 0,
    dangerY: 0,
    storyComplete: false,
    shotName: SHOT || null,
  };
  world.cars.push(...spawnTraffic(rng, TRAFFIC.count));
  world.cars.push(...spawnParked(rng, 14));
  world.peds.push(...spawnPeds(rng, TRAFFIC.pedCount));
  // A few pedestrians are hailing a taxi.
  for (let i = 0; i < world.peds.length; i += 1) {
    if (i % 6 === 0) {
      world.peds[i].fare = true;
      world.peds[i].state = 'wait';
      world.peds[i].wait = 999;
    }
  }
  world.message = (text, color = '#ffffff') => {
    world.messages.push({ text, color, life: 4 });
    if (world.messages.length > 5) world.messages.shift();
  };
  world.save = () => saveGame(world);
  world.onPlayerHurt = (amount) => hurtPlayer(world, amount, 'cop');
  world.explodeCar = (car) => explodeCar(world, car);
  return world;
}

const world = buildWorld(SEED);
window.__game = world; // handy for playtesting and debugging

// ---- explosions and collisions -------------------------------------------

function explodeCar(w, car) {
  burst(w.particles, car.x, car.y, 42, '#ff9a3c', 300, 0.9, 5);
  burst(w.particles, car.x, car.y, 24, '#3a3a40', 180, 1.2, 6);
  smoke(w.particles, car.x, car.y);
  w.audio.explosion();
  w.camera.shake = 14;
  scarePeds(w, car.x, car.y, 420);
  const idx = w.cars.indexOf(car);
  if (idx >= 0) w.cars.splice(idx, 1);
  const pi = w.policeCars.indexOf(car);
  if (pi >= 0) w.policeCars.splice(pi, 1);
  if (w.player.car === car) {
    w.player.car = null;
    w.player.onFoot = true;
    w.player.x = car.x + 40;
    w.player.y = car.y + 40;
    hurtPlayer(w, 25, 'explosion');
    w.message('Your car blew up!', '#ff6b5c');
  }
  addHeat(w.wanted, WANTED.crimeHeat.crash, w.time);
}

function collideCars(w) {
  const cars = w.cars;
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = 44;
      if (d > 0.01 && d < min) {
        const push = (min - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        const rel = Math.hypot(a.vx - b.vx, a.vy - b.vy);
        if (rel > 140) {
          w.audio.crash(Math.min(1, rel / 400));
          a.health -= 4;
          b.health -= 4;
          burst(w.particles, (a.x + b.x) / 2, (a.y + b.y) / 2, 6, '#ffd34d', 120, 0.3, 3);
          if (a.isPlayerCar || b.isPlayerCar) w.camera.shake = Math.max(w.camera.shake, 6);
        }
        // Exchange a little velocity so they do not stick.
        const ax = a.vx; const ay = a.vy;
        a.vx = a.vx * 0.7 + b.vx * 0.3;
        a.vy = a.vy * 0.7 + b.vy * 0.3;
        b.vx = b.vx * 0.7 + ax * 0.3;
        b.vy = b.vy * 0.7 + ay * 0.3;
      }
    }
  }
  for (const car of [...cars]) {
    if (car.health <= 0) explodeCar(w, car);
  }
}

function collideCarPed(w, dt) {
  const player = w.player;
  for (const car of w.cars) {
    if (car.speed < 40) continue;
    for (const ped of w.peds) {
      const d = Math.hypot(ped.x - car.x, ped.y - car.y);
      if (d < 26) {
        ped.state = 'flee';
        ped.fear = 4;
        ped.x += Math.cos(car.angle) * 40;
        ped.y += Math.sin(car.angle) * 40;
        burst(w.particles, ped.x, ped.y, 8, '#ffd34d', 140, 0.4, 3);
        if (car.isPlayerCar) {
          addHeat(w.wanted, WANTED.crimeHeat.hitPed, w.time);
          w.message('You hit a pedestrian!', '#ff6b5c');
          w.audio.crash(0.7);
        }
        scarePeds(w, ped.x, ped.y, 260);
      }
    }
    // A moving car that runs the player over on foot hurts — but only once
    // per hit: a brief invulnerability window stops a car sitting on the
    // player from dealing damage every frame.
    if (player.onFoot && !player.car) {
      const d = Math.hypot(player.x - car.x, player.y - car.y);
      if (d < 26 && car.kind !== 'parked' && player.invulnerable <= 0) {
        hurtPlayer(w, 12, 'run over');
        player.invulnerable = 0.6;
        player.x += (player.x - car.x) * 0.6;
        player.y += (player.y - car.y) * 0.6;
      }
    }
  }
}

// Guards shoot at the player when close enough; the player is the only
// target they care about.
function stepGuards(w, dt) {
  const player = w.player;
  for (const guard of w.guards) {
    if (guard.down) continue;
    guard.shootTimer -= dt;
    const d = Math.hypot(player.x - guard.x, player.y - guard.y);
    if (d < 340 && guard.shootTimer <= 0) {
      guard.shootTimer = 1.15;
      guard.angle = Math.atan2(player.y - guard.y, player.x - guard.x);
      w.tracer = {
        x1: guard.x + Math.cos(guard.angle) * 20,
        y1: guard.y + Math.sin(guard.angle) * 20,
        x2: player.x,
        y2: player.y,
        life: 0.08,
      };
      w.audio.gunshot();
      if (Math.random() < 0.65) hurtPlayer(w, 5, 'guard');
      burst(w.particles, player.x, player.y, 3, '#ff8a5c', 90, 0.2, 2);
    }
  }
}

// ---- the per-frame step ---------------------------------------------------

function step(w, dt) {
  w.time += dt;
  if (SHOT_MODE) shotInput(w, w.shotName, dt);

  const player = w.player;

  // Mouse aim in world coordinates.
  const cam = w.camera;
  input.mouse.worldX = (input.mouse.x - canvas.width / 2) / cam.zoom + cam.x;
  input.mouse.worldY = (input.mouse.y - canvas.height / 2) / cam.zoom + cam.y;

  // Actions.
  if (input.hit('KeyE')) {
    if (player.car) {
      exitCar(w);
    } else {
      const car = nearestEnterableCar(w);
      if (car) enterCar(w, car);
    }
  }
  if (input.hit('KeyF') && player.onFoot) punch(w);
  if (input.hit('KeyT') && player.onFoot) {
    let best = null;
    let bestD = 80;
    for (const ped of w.peds) {
      if (!ped.fare) continue;
      const d = Math.hypot(ped.x - player.x, ped.y - player.y);
      if (d < bestD) {
        bestD = d;
        best = ped;
      }
    }
    if (best && !w.missions.taxi) {
      startTaxi(w, best);
    } else if (best) {
      w.message('Finish your current fare first', '#ffb13c');
    }
  }
  if (input.hit('KeyM')) {
    audio.setMuted(!audio.isMuted());
    w.message(audio.isMuted() ? 'Sound off' : 'Sound on', '#ffffff');
  }
  if (input.hit('Enter') && !w.missions.active && !w.missions.done) {
    if (currentMission(w.missions)) startMission(w);
  }

  // Player movement.
  if (player.car) {
    const car = player.car;
    const up = input.down('KeyW') || input.down('ArrowUp');
    const down = input.down('KeyS') || input.down('ArrowDown');
    const left = input.down('KeyA') || input.down('ArrowLeft');
    const right = input.down('KeyD') || input.down('ArrowRight');
    const throttle = up ? 1 : down ? -0.7 : 0;
    const steer = (right ? 1 : 0) - (left ? 1 : 0);
    const brake = input.down('Space');
    const result = driveCar(car, throttle, steer, brake, dt, brake);
    player.x = car.x;
    player.y = car.y;
    if (Math.abs(result.sideways) > 60 && Math.random() < dt * 20) {
      const bx = car.x - Math.cos(car.angle) * 16;
      const by = car.y - Math.sin(car.angle) * 16;
      addSkid(w.particles, bx, by, bx + (Math.random() - 0.5) * 4, by + (Math.random() - 0.5) * 4);
    }
    if (Math.random() < dt * 8) smoke(w.particles, car.x - Math.cos(car.angle) * 24, car.y - Math.sin(car.angle) * 24);
    audio.engine(Math.min(1, car.speed / 480), true);
  } else {
    stepPlayerOnFoot(player, input.move(), dt, w);
    if (input.mouse.down) {
      player.angle = Math.atan2(input.mouse.worldY - player.y, input.mouse.worldX - player.x);
      shoot(w);
    }
    audio.engine(0, false);
  }

  // Traffic.
  const rng = w.gameRng;
  for (const car of w.cars) {
    if (car.kind === 'traffic') {
      stepTrafficCar(car, dt, rng, w);
    }
  }
  // Police.
  maintainPolice(w, dt, rng);
  for (const car of w.policeCars) stepPoliceCar(car, dt, w);
  for (const cop of w.cops) stepCop(cop, dt, w);
  stepWanted(w.wanted, dt, w);
  stepGuards(w, dt);
  // Pedestrians.
  for (const ped of w.peds) stepPed(ped, dt, rng, w);
  // Missions and fares.
  stepMissions(w, dt);
  stepTaxi(w, dt);
  // Collisions and particles.
  collideCars(w);
  collideCarPed(w, dt);
  stepParticles(w.particles, dt);
  if (w.tracer) {
    w.tracer.life -= dt;
    if (w.tracer.life <= 0) w.tracer = null;
  }
  for (let i = w.messages.length - 1; i >= 0; i -= 1) {
    w.messages[i].life -= dt;
    if (w.messages[i].life <= 0) w.messages.splice(i, 1);
  }

  // Camera: follow the player, zoom out while driving, shake on impacts.
  const targetZoom = player.car ? CAMERA.zoomCar : CAMERA.zoomFoot;
  cam.zoom += (targetZoom - cam.zoom) * Math.min(1, dt * 2.5);
  const k = 1 - Math.exp(-CAMERA.follow * dt);
  cam.x += (player.x - cam.x) * k;
  cam.y += (player.y - cam.y) * k;
  if (cam.shake > 0) {
    cam.shake = Math.max(0, cam.shake - dt * 30);
    cam.shakeX = (Math.random() - 0.5) * cam.shake;
    cam.shakeY = (Math.random() - 0.5) * cam.shake;
  } else {
    cam.shakeX = 0;
    cam.shakeY = 0;
  }

  // Wasted / busted.
  if (player.dead && w.state === 'play') {
    w.state = 'wasted';
    showEnd('WASTED', 'Rex got taken down. The SPPD scraped him off the asphalt and the hospital patched him up — minus a chunk of his cash.');
    audio.busted();
  } else if (w.wanted.bustedTimer >= 1.2 && w.state === 'play') {
    w.state = 'busted';
    showEnd('BUSTED', 'The SPPD finally got their hands on Rex. He posted bail, lost some cash, and walked out of headquarters with a fresh grudge.');
    audio.busted();
  }
  if (w.storyComplete && w.state === 'play') {
    w.state = 'complete';
    showEnd('DEBT CLEARED', 'Five jobs, one last score, and Mara Quinn is paid in full. Sunport is Rex\'s now — and the next chapter is his to write.');
  }
}

// ---- screens (DOM overlays) ----------------------------------------------

const titleEl = document.getElementById('title');
const pauseEl = document.getElementById('pause');
const endEl = document.getElementById('end');
const endTitleEl = document.getElementById('end-title');
const endTextEl = document.getElementById('end-text');

function hideAll() {
  titleEl.classList.add('hidden');
  pauseEl.classList.add('hidden');
  endEl.classList.add('hidden');
}

function showEnd(title, text) {
  endTitleEl.textContent = title;
  endTextEl.textContent = text;
  endEl.classList.remove('hidden');
  audio.engine(0, false);
}

function applySave(data) {
  world.player.cash = data.cash;
  world.player.health = data.health;
  world.player.ammo = data.ammo;
  world.player.x = data.x;
  world.player.y = data.y;
  world.missions.index = data.missionIndex;
  world.missions.completed = data.completed || [];
  world.missions.cashEarned = data.cashEarned || 0;
  world.time = data.time || 0;
  world.camera.x = data.x;
  world.camera.y = data.y;
  world.message('Save loaded — welcome back to Sunport', '#7ddc7d');
}

function respawn() {
  const player = world.player;
  const lost = Math.floor(player.cash * (world.state === 'busted' ? 0.15 : 0.2));
  player.cash -= lost;
  player.health = 100;
  player.ammo = Math.max(player.ammo, 12);
  player.dead = false;
  player.busted = false;
  player.invulnerable = 3;
  player.car = null;
  player.onFoot = true;
  const spot = world.state === 'busted' ? PLACES.policeHq : PLACES.hospital;
  player.x = spot.x;
  player.y = spot.y;
  world.wanted.heat = 0;
  world.wanted.stars = 0;
  world.wanted.bustedTimer = 0;
  world.policeCars.length = 0;
  world.cops.length = 0;
  world.cars = world.cars.filter((c) => !c.isPlayerCar);
  world.missions.active = null;
  world.missions.failed = false;
  world.objective = null;
  world.camera.x = player.x;
  world.camera.y = player.y;
  hideAll();
  world.state = 'play';
  world.message(`Lost $${lost} — back on the streets`, '#ffb13c');
}

function startGame(fromSave) {
  audio.unlock();
  audio.startMusic();
  if (fromSave) {
    const data = loadGame();
    if (data) applySave(data);
  }
  hideAll();
  world.state = 'play';
  if (!world.missions.active && !world.missions.done) {
    const next = currentMission(world.missions);
    if (next) world.message(`Press ENTER to start: ${next.title}`, '#ffd34d');
  }
}

document.getElementById('btn-new').addEventListener('click', () => startGame(false));
document.getElementById('btn-continue').addEventListener('click', () => startGame(true));
document.getElementById('btn-how').addEventListener('click', () => {
  document.getElementById('howto').classList.toggle('hidden');
  audio.click();
});
document.getElementById('btn-resume').addEventListener('click', () => {
  hideAll();
  world.state = 'play';
  audio.click();
});
document.getElementById('btn-save').addEventListener('click', () => {
  if (world.save()) world.message('Game saved', '#7ddc7d');
  else world.message('Save failed — storage unavailable', '#ff6b5c');
  audio.click();
});
document.getElementById('btn-restart-mission').addEventListener('click', () => {
  world.missions.active = null;
  world.missions.failed = false;
  world.objective = null;
  hideAll();
  world.state = 'play';
  audio.click();
});
document.getElementById('btn-quit').addEventListener('click', () => {
  hideAll();
  world.state = 'title';
  titleEl.classList.remove('hidden');
  audio.click();
});
document.getElementById('btn-respawn').addEventListener('click', () => {
  respawn();
  audio.click();
});
document.getElementById('btn-end-title').addEventListener('click', () => {
  hideAll();
  world.state = 'title';
  titleEl.classList.remove('hidden');
  audio.click();
});

// Continue is only offered when a save exists.
if (!hasSave()) document.getElementById('btn-continue').style.display = 'none';

window.addEventListener('keydown', (event) => {
  audio.unlock();
  if (event.code === 'Escape' && world.state === 'play') {
    world.state = 'pause';
    pauseEl.classList.remove('hidden');
  } else if (event.code === 'Escape' && world.state === 'pause') {
    hideAll();
    world.state = 'play';
  }
});

// ---- the loop -------------------------------------------------------------

let last = performance.now();
function frame(now) {
  const dt = Math.min(1 / 30, Math.max(0.001, (now - last) / 1000));
  last = now;
  if (world.state === 'play') step(world, dt);
  drawWorld(ctx, world, world.camera, canvas.width, canvas.height);
  if (world.state === 'play' || world.state === 'pause') {
    drawHUD(ctx, world, canvas.width, canvas.height);
  }
  input.endFrame();
  requestAnimationFrame(frame);
}

if (SHOT_MODE) {
  // Screenshots skip the title screen: stage the scene and play it.
  stageShot(world, SHOT, SEED);
  world.state = 'play';
  hideAll();
} else {
  titleEl.classList.remove('hidden');
}

requestAnimationFrame(frame);
