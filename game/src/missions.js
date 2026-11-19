// The story of Sunport Heat: Rex Vane owes Mara Quinn $50,000, and five
// jobs clear the debt. Plus repeatable taxi fares for free-roam cash.

import { dist } from './util.js';
import { nearestRoadPoint } from './city.js';
import { makeCar } from './vehicles.js';
import { spawnGuard } from './people.js';
import { addHeat, clearWanted, setHeat } from './police.js';
import { floatText } from './particles.js';
import { sfx } from './audio.js';
import { wasPressed } from './input.js';
import { saveGame } from './save.js';

const DEBT = 50000;

/** The five jobs, in order. Steps run one after another. */
export const MISSION_DEFS = [
  {
    id: 'm1', title: 'Back in Sunport', reward: 500,
    briefing: 'Mara Quinn wants a word. Meet her at The Gilded Cage.',
    steps: [
      { kind: 'goto', text: 'Meet Mara at The Gilded Cage', x: 1800, y: 1800, radius: 100 },
      { kind: 'interact', text: 'Talk to Mara Quinn (E)', x: 1800, y: 1800, radius: 90 },
    ],
  },
  {
    id: 'm2', title: 'Wheels for Hire', reward: 1200, timer: 150,
    briefing: 'A Comet GT is waiting at Comet Motors. Take it to the chop shop.',
    steps: [
      { kind: 'goto', text: 'Steal the Comet GT at Comet Motors', x: 3000, y: 1000, radius: 110 },
      { kind: 'steal', text: 'Get in the Comet GT', x: 3000, y: 1000, radius: 120 },
      { kind: 'deliver', text: 'Deliver the Comet GT to the chop shop', x: 2800, y: 3000, radius: 100 },
    ],
  },
  {
    id: 'm3', title: 'Harbor Drop', reward: 2000,
    briefing: 'Pick up the package at the Harbor Docks, then lose the heat.',
    steps: [
      { kind: 'interact', text: 'Pick up the package at the Harbor Docks (E)', x: 600, y: 3000, radius: 90 },
      { kind: 'deliver', text: 'Deliver the package to The Palms Motel', x: 2600, y: 2600, radius: 110 },
    ],
  },
  {
    id: 'm4', title: 'Payday Smash', reward: 3500, loot: 800,
    briefing: 'The City Hall vault. Two guards. Get in, get the cash, get out.',
    steps: [
      { kind: 'goto', text: 'Reach the City Hall vault', x: 2200, y: 1400, radius: 100 },
      { kind: 'kill', text: 'Take out the guards (0/2)', x: 2200, y: 1400, radius: 200 },
      { kind: 'interact', text: 'Grab the loot (E)', x: 2200, y: 1400, radius: 90 },
      { kind: 'deliver', text: 'Escape to the safehouse', x: 500, y: 500, radius: 110 },
    ],
  },
  {
    id: 'm5', title: 'The Last Score', reward: 10000,
    briefing: 'The Bullion Van. Four stars. One drive. The debt ends tonight.',
    steps: [
      { kind: 'goto', text: 'Steal the Bullion Van at Northgate Mall', x: 1800, y: 600, radius: 120 },
      { kind: 'steal', text: 'Get in the Bullion Van', x: 1800, y: 600, radius: 130 },
      { kind: 'deliver', text: 'Bring the Bullion Van to The Gilded Cage', x: 1800, y: 1800, radius: 110 },
    ],
  },
];

/** A fresh missions state. */
export function makeMissions() {
  return {
    current: null, // { def, step, timer, car }
    done: [],
    guardsDown: 0,
    tookMissionCar: false,
    retryIn: 0,
    storyDone: false,
    startDelay: 0,
  };
}

/** Start the next undone job. */
export function startNextMission(S) {
  const next = MISSION_DEFS.find((d) => !S.missions.done.includes(d.id));
  if (!next) {
    S.missions.storyDone = true;
    return;
  }
  startMission(S, next.id);
}

/** Start one job by id. */
export function startMission(S, id) {
  const def = MISSION_DEFS.find((d) => d.id === id);
  if (!def) return;
  S.missions.current = { def, step: 0, timer: def.timer || 0, car: null };
  S.missions.guardsDown = 0;
  S.missions.tookMissionCar = false;
  toast(S, `${def.title} — ${def.briefing}`);
  sfx('mission');
  // Stage the job's car or guards.
  if (id === 'm2') {
    const car = makeCar(S, 'comet', 3000, 1000, Math.PI / 2, 'mission');
    car.missionCar = true;
    car.color = '#c0392b';
    // The job's car is toughened: it has to survive the delivery drive.
    car.hp = 350;
    car.maxHp = 350;
    S.cars.push(car);
    S.missions.current.car = car;
  }
  if (id === 'm5') {
    const car = makeCar(S, 'bullion', 1800, 600, 0, 'mission');
    car.missionCar = true;
    S.cars.push(car);
    S.missions.current.car = car;
  }
}

/** Step the active job and the taxi fares. */
export function updateMissions(S, dt) {
  const M = S.missions;
  if (M.startDelay > 0) {
    M.startDelay -= dt;
    if (M.startDelay <= 0) startNextMission(S);
    return;
  }
  if (M.retryIn > 0) {
    M.retryIn -= dt;
    if (M.retryIn <= 0) startNextMission(S);
    return;
  }
  if (M.current) {
    updateCurrentMission(S, dt);
  }
  updateTaxi(S, dt);
}

/** Advance the current job's step when its condition is met. */
function updateCurrentMission(S, dt) {
  const M = S.missions;
  const cur = M.current;
  const step = cur.def.steps[cur.step];
  if (!step) return;
  if (cur.timer > 0) {
    cur.timer -= dt;
    if (cur.timer <= 0) {
      failMission(S, 'Out of time');
      return;
    }
  }
  const p = S.player;
  const d = dist(p.x, p.y, step.x, step.y);
  switch (step.kind) {
    case 'goto':
      if (d < step.radius) advanceStep(S);
      break;
    case 'interact':
      if (d < step.radius && wasPressed(S.input, 'KeyE')) {
        onInteractStep(S);
        advanceStep(S);
      }
      break;
    case 'steal':
      if (M.tookMissionCar) advanceStep(S);
      break;
    case 'kill':
      if (M.guardsDown >= 2) advanceStep(S);
      break;
    case 'deliver':
      if (d < step.radius) completeMission(S);
      break;
    default:
      break;
  }
}

/** Side effects when a step is entered. */
function advanceStep(S) {
  const M = S.missions;
  const cur = M.current;
  cur.step += 1;
  const step = cur.def.steps[cur.step];
  if (!step) {
    completeMission(S);
    return;
  }
  if (cur.def.id === 'm3' && step.kind === 'deliver') {
    // The pickup put two stars on the player.
    setHeat(S, 35);
    toast(S, 'The cops are onto you — lose them!');
  }
  if (cur.def.id === 'm4' && step.kind === 'kill') {
    // Two guards stand between Rex and the vault.
    spawnGuard(S, 2160, 1360);
    spawnGuard(S, 2240, 1440);
    toast(S, 'Two guards. Take them out.');
  }
  if (cur.def.id === 'm4' && step.kind === 'deliver') {
    setHeat(S, 50);
    toast(S, 'Three stars! Get to the safehouse!');
  }
  if (cur.def.id === 'm5' && step.kind === 'deliver') {
    setHeat(S, 70);
    toast(S, 'Four stars! Bring the van to the club!');
  }
  if (cur.def.id === 'm2' && step.kind === 'deliver') {
    cur.timer = cur.def.timer;
  }
  if (step.kind === 'kill') {
    M.guardsDown = 0;
  }
  sfx('pickup');
}

/** What an interact step does when the player presses E. */
function onInteractStep(S) {
  const cur = S.missions.current;
  if (!cur) return;
  if (cur.def.id === 'm4') {
    // The loot from the vault.
    S.player.cash += cur.def.loot;
    floatText(S, S.player.x, S.player.y - 30, `+$${cur.def.loot} loot`, '#ffd24d');
    sfx('cash');
  }
  if (cur.def.id === 'm1') {
    toast(S, 'Mara: "Fifty grand, Rex. Five jobs. Don\'t keep me waiting."');
  }
}

/** Finish the current job: pay up, save, queue the next. */
function completeMission(S) {
  const M = S.missions;
  const cur = M.current;
  if (!cur) return;
  S.player.cash += cur.def.reward;
  M.done.push(cur.def.id);
  M.current = null;
  floatText(S, S.player.x, S.player.y - 30, `+$${cur.def.reward}`, '#ffd24d');
  toast(S, `${cur.def.title} complete — $${cur.def.reward}`);
  sfx('cash');
  // A clean getaway: the heat is off, the cops stand down, and the car
  // is patched up for the next job.
  clearWanted(S);
  if (S.player.car) {
    S.player.car.hp = S.player.car.maxHp;
  }
  if (cur.def.id === 'm5') {
    M.storyDone = true;
    toast(S, `Debt cleared. Sunport is yours, Rex. ($${DEBT} paid)`);
  }
  saveGame(S);
  M.startDelay = 3;
}

/** A job failed: it becomes available again shortly. */
function failMission(S, why) {
  const M = S.missions;
  const cur = M.current;
  if (!cur) return;
  M.current = null;
  toast(S, `${cur.def.title} failed — ${why}. Try again.`);
  sfx('fail');
  M.retryIn = 5;
}

/** The current objective for the HUD, minimap and arrow. */
export function currentObjective(S) {
  const M = S.missions;
  if (M.current) {
    const step = M.current.def.steps[M.current.step];
    if (step) {
      let text = step.text;
      if (step.kind === 'kill') text = `Take out the guards (${M.guardsDown}/2)`;
      const out = { text, x: step.x, y: step.y };
      if (M.current.timer > 0) out.timer = Math.ceil(M.current.timer);
      return out;
    }
  }
  if (S.taxi.state === 'pickup' && S.taxi.fare) {
    return { text: 'Pick up the fare', x: S.taxi.fare.x, y: S.taxi.fare.y };
  }
  if (S.taxi.state === 'dropoff' && S.taxi.fare) {
    return { text: 'Drop off the fare', x: S.taxi.fare.destX, y: S.taxi.fare.destY };
  }
  return null;
}

/** A fresh taxi state. */
export function makeTaxi() {
  return { state: 'idle', fare: null, cooldown: 8 };
}

/** Taxi fares: a waiting passenger, a ride, a payout with a speed tip. */
function updateTaxi(S, dt) {
  const T = S.taxi;
  const p = S.player;
  if (T.cooldown > 0) T.cooldown -= dt;
  if (S.missions.current) return; // fares wait while a job is on
  if (S.mode !== 'play' || p.onFoot || !p.car) {
    if (T.state !== 'idle') {
      T.state = 'idle';
      T.fare = null;
    }
    return;
  }
  if (T.state === 'idle') {
    if (T.cooldown <= 0) {
      // Fares wait on a road, so a driver can always reach them.
      const a = S.rng() * Math.PI * 2;
      const d = 300 + S.rng() * 400;
      const pick = nearestRoadPoint(S.city, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d);
      const b = S.rng() * Math.PI * 2;
      const d2 = 400 + S.rng() * 500;
      const drop = nearestRoadPoint(S.city, pick.x + Math.cos(b) * d2, pick.y + Math.sin(b) * d2);
      T.fare = {
        x: pick.x, y: pick.y,
        destX: drop.x,
        destY: drop.y,
        startedAt: S.time,
      };
      T.state = 'pickup';
    }
    return;
  }
  if (T.state === 'pickup') {
    if (dist(p.x, p.y, T.fare.x, T.fare.y) < 70) {
      T.state = 'dropoff';
      T.fare.startedAt = S.time;
      toast(S, 'Fare aboard — drive to the marker');
      sfx('pickup');
    }
    return;
  }
  if (T.state === 'dropoff') {
    if (dist(p.x, p.y, T.fare.destX, T.fare.destY) < 70) {
      const elapsed = S.time - T.fare.startedAt;
      const tip = elapsed < 60 ? 60 : elapsed < 120 ? 30 : 10;
      const pay = 40 + tip;
      p.cash += pay;
      floatText(S, p.x, p.y - 30, `+$${pay} fare`, '#ffd24d');
      toast(S, `Fare paid $${pay} (tip $${tip})`);
      sfx('cash');
      saveGame(S);
      T.state = 'idle';
      T.fare = null;
      T.cooldown = 15;
    }
  }
}

/** A toast message for the HUD. */
export function toast(S, text) {
  S.toasts.push({ text, life: 4.5 });
  if (S.toasts.length > 4) S.toasts.shift();
}
