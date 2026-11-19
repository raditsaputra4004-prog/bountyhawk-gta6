// Save and load: the whole campaign state in one localStorage key. The
// game saves when a mission ends, when a fare pays out, and when the player
// saves from the pause menu. Nothing leaves the machine.

import { SAVE_KEY } from './config.js';

export function saveGame(world) {
  try {
    const data = {
      version: 1,
      cash: world.player.cash,
      health: world.player.health,
      ammo: world.player.ammo,
      x: Math.round(world.player.x),
      y: Math.round(world.player.y),
      missionIndex: world.missions.index,
      completed: world.missions.completed,
      cashEarned: world.missions.cashEarned,
      time: Math.round(world.time),
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (e) { /* storage unavailable */ }
}
