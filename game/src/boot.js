// Sunport Heat — bootstrap: build the world, run the loop, wire the menus.
// The entry point the page loads. Everything else is a module it calls.

import { makeRng } from './util.js';
import { buildCity } from './city.js';
import { createInput, endFrame, wasPressed } from './input.js';
import { initAudio, setMuted, isMuted, sfx, updateEngineAudio } from './audio.js';
import { makeCar, seedCars, updateCars } from './vehicles.js';
import { seedPeds, updatePeds } from './people.js';
import { clearWanted, updatePolice, updateWanted } from './police.js';
import { makePlayer, respawn, updatePlayer } from './player.js';
import { currentObjective, makeMissions, makeTaxi, startMission, toast, updateMissions } from './missions.js';
import { updateParticles } from './particles.js';
import { VIEW_H, VIEW_W, render } from './render.js';
import { applySave, clearSave, hasSave, loadSave, saveGame } from './save.js';
import { applyShot } from './stage.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

/** Build a fresh game state from a seed. */
export function createGame(seed) {
  const S = {
    seed,
    rng: makeRng(seed),
    time: 0,
    mode: 'title',
    city: null,
    player: makePlayer(),
    cars: [],
    peds: [],
    cops: [],
    wanted: { heat: 0, stars: 0, quietFor: 0 },
    missions: makeMissions(),
    taxi: makeTaxi(),
    particles: [],
    tracers: [],
    skids: [],
    floats: [],
    toasts: [],
    camera: { x: 1800, y: 1800, zoom: 1, shake: 0 },
    input: createInput(canvas),
    mouseWorld: { x: 1800, y: 1800 },
    menuButtons: [],
    shot: null,
    stats: { fps: 0, frames: 0, fpsTime: 0 },
  };
  S.city = buildCity(S.rng);
  seedCars(S);
  seedPeds(S);
  return S;
}

let S = createGame(1337);

// A staged screenshot run (?shot=cover&seed=1337) skips the title screen.
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = parseInt(params.get('seed') || '1337', 10);
if (shotName) {
  S = createGame(Number.isFinite(seedParam) ? seedParam : 1337);
  applyShot(S, shotName);
} else if (Number.isFinite(seedParam) && seedParam !== 1337) {
  S = createGame(seedParam);
}

/** Start a brand-new game. */
function newGame() {
  clearSave();
  const seed = (Math.random() * 1e9) | 0;
  S = createGame(seed);
  S.mode = 'play';
  startMission(S, 'm1');
  initAudio();
}

/** Continue the saved game. */
function continueGame() {
  const data = loadSave();
  if (!data) {
    newGame();
    return;
  }
  const seed = (Math.random() * 1e9) | 0;
  S = createGame(seed);
  applySave(S, data);
  S.mode = 'play';
  // Resume the next undone job.
  const next = ['m1', 'm2', 'm3', 'm4', 'm5'].find((id) => !S.missions.done.includes(id));
  if (next) startMission(S, next);
  initAudio();
}

/** Handle a menu button click. */
function menuAction(action) {
  sfx('click');
  switch (action) {
    case 'new':
      newGame();
      break;
    case 'continue':
      continueGame();
      break;
    case 'howto':
      S.mode = 'howto';
      break;
    case 'back':
      S.mode = 'title';
      break;
    case 'resume':
      S.mode = 'play';
      break;
    case 'save':
      saveGame(S);
      toast(S, 'Game saved');
      break;
    case 'quit':
      saveGame(S);
      S = createGame(1337);
      S.mode = 'title';
      break;
    case 'respawn': {
      const hq = { x: 1400, y: 2200 };
      const hospital = { x: 2600, y: 600 };
      const wasBusted = S.mode === 'busted';
      const spot = wasBusted ? hq : hospital;
      clearWanted(S);
      respawn(S, spot.x, spot.y);
      break;
    }
    default:
      break;
  }
}

/** One frame of simulation. */
function update(dt) {
  // Mouse position in world space (for aiming).
  S.mouseWorld.x = S.camera.x + (S.input.mouseX - VIEW_W / 2) / S.camera.zoom;
  S.mouseWorld.y = S.camera.y + (S.input.mouseY - VIEW_H / 2) / S.camera.zoom;

  if (S.mode === 'title') {
    // A slow pan over Downtown behind the title.
    S.time += dt;
    S.camera.x = 1800 + Math.cos(S.time * 0.05) * 500;
    S.camera.y = 1800 + Math.sin(S.time * 0.04) * 400;
    handleMenuClick();
    handleMenuKeys();
    return;
  }
  if (S.mode === 'howto' || S.mode === 'pause' || S.mode === 'busted' || S.mode === 'wasted') {
    handleMenuClick();
    handleMenuKeys();
    if (S.mode === 'pause' && wasPressed(S.input, 'Escape')) S.mode = 'play';
    return;
  }
  // Playing.
  S.time += dt;
  if (wasPressed(S.input, 'Escape')) {
    S.mode = 'pause';
    return;
  }
  if (wasPressed(S.input, 'KeyM')) {
    setMuted(!isMuted());
    toast(S, isMuted() ? 'Sound off' : 'Sound on');
  }
  updatePlayer(S, dt);
  updateCars(S, dt);
  updatePeds(S, dt);
  updatePolice(S, dt);
  updateWanted(S, dt);
  updateMissions(S, dt);
  updateParticles(S, dt);
  for (let i = S.toasts.length - 1; i >= 0; i--) {
    S.toasts[i].life -= dt;
    if (S.toasts[i].life <= 0) S.toasts.splice(i, 1);
  }
  const driving = !!S.player.car;
  const speed01 = driving ? Math.min(1, S.player.car.speed / 520) : 0;
  updateEngineAudio(speed01, driving, S.wanted.stars, dt);
  void currentObjective;
}

/** Mouse clicks on menu buttons. */
function handleMenuClick() {
  if (!S.input.clicked) return;
  for (const b of S.menuButtons) {
    if (!b.enabled) continue;
    if (S.input.mouseX >= b.x && S.input.mouseX <= b.x + b.w && S.input.mouseY >= b.y && S.input.mouseY <= b.y + b.h) {
      menuAction(b.action);
      return;
    }
  }
}

/** Keyboard shortcuts on menus. */
function handleMenuKeys() {
  if (S.mode === 'title') {
    if (wasPressed(S.input, 'Enter') || wasPressed(S.input, 'Digit1')) newGame();
    else if (wasPressed(S.input, 'Digit2') && hasSave()) continueGame();
    else if (wasPressed(S.input, 'Digit3')) S.mode = 'howto';
  } else if (S.mode === 'howto') {
    if (wasPressed(S.input, 'Escape') || wasPressed(S.input, 'Enter')) S.mode = 'title';
  } else if (S.mode === 'busted' || S.mode === 'wasted') {
    if (wasPressed(S.input, 'Enter')) menuAction('respawn');
  }
}

let last = performance.now();
let firstFrame = true;

/** The main loop: fixed clamp, render, count fps. */
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  update(dt);
  render(S, ctx);
  endFrame(S.input);
  // Fps meter.
  S.stats.frames += 1;
  S.stats.fpsTime += dt;
  if (S.stats.fpsTime >= 1) {
    S.stats.fps = Math.round(S.stats.frames / S.stats.fpsTime);
    S.stats.frames = 0;
    S.stats.fpsTime = 0;
  }
  if (firstFrame) {
    firstFrame = false;
    if (S.shot) window.__shotReady = true;
  }
  requestAnimationFrame(frame);
}

// Playtest and screenshot hooks: the game's live state, read-only-ish.
window.__sunport = {
  get state() {
    return S;
  },
  version: 1,
  newGame,
  continueGame,
};

window.addEventListener('pointerdown', () => initAudio(), { once: true });
window.addEventListener('keydown', () => initAudio(), { once: true });

requestAnimationFrame(frame);
