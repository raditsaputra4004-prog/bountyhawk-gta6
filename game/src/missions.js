// The story: Rex Vane owes Mara Quinn $50,000, and five jobs pay it down.
// Each mission is a short list of objectives the world checks every frame;
// the taxi fares are the repeatable side work between jobs.

import { PLACES } from './city.js';
import { MISSIONS } from './config.js';
import { addHeat } from './police.js';
import { floatText } from './particles.js';

export const STORY = {
  hero: 'Rex Vane',
  boss: 'Mara Quinn',
  debt: MISSIONS.debt,
  intro:
    'Sunport, 2026. Rex Vane is back after three years away, and Mara Quinn owns his debt: $50,000, due in full. Five jobs. No excuses.',
};

export const MISSION_DEFS = [
  {
    id: 'm1',
    title: 'Back in Sunport',
    brief: 'Mara is waiting at the Neon Palms Club. Go see her — on foot, the club is just up the road.',
    reward: 500,
    objectives: [
      { type: 'goto', place: 'club', text: 'Go to the Neon Palms Club' },
      { type: 'goto', place: 'garage', text: 'Get a car and drive to the garage', needsCar: true },
    ],
  },
  {
    id: 'm2',
    title: 'Wheels for Hire',
    brief: 'Mara needs a fast car, no questions asked. Steal a sports car and get it to the chop shop in one piece — 150 seconds, damage costs you.',
    reward: 1200,
    objectives: [
      { type: 'steal', model: 'sport', text: 'Steal a sports car' },
      { type: 'deliver', place: 'chopShop', text: 'Deliver the car to the Chop Shop', timer: 150, needsCar: true },
    ],
  },
  {
    id: 'm3',
    title: 'Harbor Drop',
    brief: 'Pick up the package at the docks. The moment you take it, the SPPD will be watching — lose the heat, then drop it at the Sunset Motel.',
    reward: 2000,
    objectives: [
      { type: 'goto', place: 'docks', text: 'Pick up the package at the Docks' },
      { type: 'escape', stars: 2, text: 'Lose the heat', heatOnStart: 40 },
      { type: 'deliver', place: 'motel', text: 'Deliver the package to the Sunset Motel', needsCar: false },
    ],
  },
  {
    id: 'm4',
    title: 'Payday Smash',
    brief: 'The Gilded Cage keeps its diamonds behind glass and two guards. Smash the case, grab the stones, and get to the safehouse with the whole department behind you.',
    reward: 3500,
    objectives: [
      { type: 'goto', place: 'jewelers', text: 'Get to the Gilded Cage Jewelers' },
      { type: 'smash', text: 'Smash the display case and grab the diamonds', guards: 2 },
      { type: 'escape', stars: 3, text: 'Escape to the Safehouse', heatOnStart: 60, place: 'safehouse' },
    ],
  },
  {
    id: 'm5',
    title: 'The Last Score',
    brief: 'One armored van, one last job. Take the Bullion Van from the depot, hold off the escort, and bring it to Mara. Do this and the debt is gone.',
    reward: 10000,
    objectives: [
      { type: 'steal', model: 'armored', text: 'Steal the Bullion Van' },
      { type: 'chase', place: 'club', text: 'Bring the van to Mara at the Neon Palms', heatOnStart: 80 },
    ],
  },
];

export function makeMissions() {
  return {
    index: 0, // which mission is current
    completed: [],
    active: null, // the running mission state
    objectiveIndex: 0,
    timer: 0,
    timerLimit: 0,
    failed: false,
    done: false,
    taxi: null, // active taxi fare
    cashEarned: 0,
  };
}

export function currentMission(missions) {
  if (missions.index >= MISSION_DEFS.length) return null;
  return MISSION_DEFS[missions.index];
}

export function startMission(world) {
  const def = currentMission(world.missions);
  if (!def) return;
  world.missions.active = { def, startedAt: world.time };
  world.missions.objectiveIndex = 0;
  world.missions.timer = 0;
  world.missions.timerLimit = 0;
  world.missions.failed = false;
  world.message(`Mission: ${def.title}`, '#ffd34d');
  world.message(def.brief, '#ffffff');
  world.audio.pickup();
  setupObjective(world);
}

function setupObjective(world) {
  const state = world.missions.active;
  if (!state) return;
  const obj = state.def.objectives[world.missions.objectiveIndex];
  if (!obj) {
    completeMission(world);
    return;
  }
  world.missions.timer = 0;
  world.missions.timerLimit = obj.timer || 0;
  if (obj.heatOnStart) addHeat(world.wanted, obj.heatOnStart, world.time);
  if (obj.type === 'smash') {
    spawnGuards(world, obj.guards || 2);
  }
  if (obj.type === 'steal' && obj.model === 'armored') {
    spawnArmoredVan(world);
  }
  if (obj.type === 'steal' && obj.model === 'sport') {
    spawnMarkedSport(world);
  }
  const place = obj.place ? PLACES[obj.place] : null;
  world.objective = {
    text: obj.text,
    target: place ? { x: place.x, y: place.y, label: place.label } : null,
    kind: obj.type,
  };
}

export function spawnGuards(world, count) {
  const spot = PLACES.jewelers;
  for (let i = 0; i < count; i += 1) {
    world.guards.push({
      x: spot.x + (i === 0 ? -60 : 60),
      y: spot.y + 40,
      angle: 0,
      health: 60,
      down: false,
      shootTimer: 1 + i * 0.5,
      speed: 120,
    });
  }
  world.message('Guards! They are armed — fight or run', '#ff6b5c');
}

export function spawnArmoredVan(world) {
  const spot = PLACES.armory;
  const car = {
    id: 9001,
    x: spot.x + 46, y: spot.y - 36,
    vx: 0, vy: 0,
    angle: 0,
    speed: 0,
    model: 'armored',
    modelName: 'Bullion Van',
    color: '#5a6b52',
    top: 330,
    accel: 260,
    kind: 'parked',
    driver: null,
    health: 220,
    isPlayerCar: false,
    marked: true,
  };
  world.cars.push(car);
  world.message('The Bullion Van is at the depot — take it', '#ffd34d');
  // Two guards watch the depot.
  for (let i = 0; i < 2; i += 1) {
    world.guards.push({
      x: spot.x + (i === 0 ? -50 : 50),
      y: spot.y + 34,
      angle: 0,
      health: 60,
      down: false,
      shootTimer: 1 + i,
      speed: 120,
    });
  }
}

export function spawnMarkedSport(world) {
  // A red sports car parked on the road by the club, marked for the job.
  const spot = PLACES.club;
  const car = {
    id: 9002,
    x: spot.x + 120, y: spot.y - 30,
    vx: 0, vy: 0,
    angle: 0,
    speed: 0,
    model: 'sport',
    modelName: 'Comet GT',
    color: '#c22e3d',
    top: 520,
    accel: 420,
    kind: 'parked',
    driver: null,
    health: 100,
    isPlayerCar: false,
    marked: true,
  };
  world.cars.push(car);
  world.message('A Comet GT is parked by the club — take it', '#ffd34d');
}

function completeObjective(world) {
  world.missions.objectiveIndex += 1;
  world.audio.cash();
  const state = world.missions.active;
  if (world.missions.objectiveIndex >= state.def.objectives.length) {
    completeMission(world);
  } else {
    setupObjective(world);
  }
}

export function completeMission(world) {
  const def = currentMission(world.missions);
  if (!def) return;
  world.player.cash += def.reward;
  world.missions.cashEarned += def.reward;
  world.missions.completed.push(def.id);
  world.missions.index += 1;
  world.missions.active = null;
  world.objective = null;
  world.audio.missionDone();
  world.message(`Mission complete: ${def.title} — $${def.reward}`, '#7ddc7d');
  floatText(world.particles, world.player.x, world.player.y - 30, `+$${def.reward}`, '#7ddc7d');
  const debtLeft = Math.max(0, MISSIONS.debt - world.missions.cashEarned);
  if (world.missions.index >= MISSION_DEFS.length) {
    world.missions.done = true;
    world.message(`Debt cleared. Sunport is yours, ${STORY.hero}.`, '#ffd34d');
    world.storyComplete = true;
  } else {
    world.message(`Debt remaining: $${debtLeft.toLocaleString('en-US')}`, '#ffffff');
  }
  world.save();
}

export function failMission(world, reason) {
  world.missions.failed = true;
  world.missions.active = null;
  world.objective = null;
  world.audio.missionFail();
  world.message(`Mission failed: ${reason}`, '#ff6b5c');
}

// The per-frame mission engine: checks the current objective and advances
// it when its condition is met. Returns nothing; the world reads
// world.objective and world.missions for the HUD.
export function stepMissions(world, dt) {
  const state = world.missions.active;
  if (!state) return;
  const obj = state.def.objectives[world.missions.objectiveIndex];
  if (!obj) return;
  const player = world.player;
  if (world.missions.timerLimit > 0) {
    world.missions.timer += dt;
    if (world.missions.timer > world.missions.timerLimit) {
      failMission(world, 'Out of time');
      return;
    }
  }
  const near = (x, y, r = 70) => Math.hypot(player.x - x, player.y - y) < r;
  if (obj.type === 'goto' || obj.type === 'deliver') {
    const place = PLACES[obj.place];
    if (obj.needsCar && !player.car) {
      world.objective.hint = 'You need a car for this';
    } else {
      world.objective.hint = null;
    }
    if (near(place.x, place.y, obj.type === 'deliver' ? 80 : 70)) {
      if (!obj.needsCar || player.car) completeObjective(world);
    }
  } else if (obj.type === 'steal') {
    if (player.car && player.car.model === obj.model) completeObjective(world);
  } else if (obj.type === 'escape') {
    const target = obj.place ? PLACES[obj.place] : null;
    if (world.wanted.stars === 0) {
      if (!target) {
        completeObjective(world);
      } else if (near(target.x, target.y, 80)) {
        completeObjective(world);
      }
    }
  } else if (obj.type === 'smash') {
    const allDown = world.guards.length > 0 && world.guards.every((g) => g.down);
    if (allDown && !state.lootTaken) {
      state.lootTaken = true;
      player.cash += 800;
      world.message('Diamonds grabbed — now run!', '#ffd34d');
      world.audio.cash();
    }
    if (state.lootTaken) completeObjective(world);
  } else if (obj.type === 'chase') {
    const place = PLACES[obj.place];
    if (player.car && player.car.model === 'armored' && near(place.x, place.y, 90)) {
      completeObjective(world);
    }
  }
}

// Taxi fares: a waiting pedestrian hails, the player drives them to a
// destination, and the fare pays out with a tip for speed. Destinations are
// road-side places only, so a fare is always reachable by car.
const TAXI_DESTS = ['club', 'garage', 'chopShop', 'motel', 'jewelers', 'safehouse', 'hospital', 'policeHq', 'taxiStand'];

export function startTaxi(world, ped) {
  const destKey = TAXI_DESTS[Math.floor(Math.random() * TAXI_DESTS.length)];
  const dest = PLACES[destKey];
  const fare = 90 + Math.floor(Math.random() * 230);
  world.missions.taxi = {
    ped,
    dest,
    fare,
    timer: 0,
    limit: 180,
    state: 'pickup',
  };
  ped.state = 'wait';
  ped.fare = true;
  world.message(`Taxi fare: pick up the passenger ($${fare})`, '#7ddc7d');
}

export function stepTaxi(world, dt) {
  const taxi = world.missions.taxi;
  if (!taxi) return;
  const player = world.player;
  taxi.timer += dt;
  if (taxi.timer > taxi.limit) {
    world.message('Fare cancelled — too slow', '#ff6b5c');
    if (taxi.ped) {
      taxi.ped.state = 'walk';
      taxi.ped.fare = false;
    }
    world.missions.taxi = null;
    return;
  }
  if (taxi.state === 'pickup') {
    const d = Math.hypot(player.x - taxi.ped.x, player.y - taxi.ped.y);
    if (d < 50 && player.car) {
      taxi.state = 'dropoff';
      taxi.ped.state = 'riding';
      world.message(`Drive them to ${taxi.dest.label}`, '#7ddc7d');
    }
  } else if (taxi.state === 'dropoff') {
    const d = Math.hypot(player.x - taxi.dest.x, player.y - taxi.dest.y);
    if (d < 80 && player.car) {
      const tip = Math.max(0, Math.round((1 - taxi.timer / taxi.limit) * 120));
      const total = taxi.fare + tip;
      player.cash += total;
      world.missions.cashEarned += total;
      world.audio.cash();
      floatText(world.particles, player.x, player.y - 30, `+$${total}`, '#7ddc7d');
      world.message(`Fare complete: $${total} (tip $${tip})`, '#7ddc7d');
      const idx = world.peds.indexOf(taxi.ped);
      if (idx >= 0) world.peds.splice(idx, 1);
      world.missions.taxi = null;
      world.save();
    }
  }
}
