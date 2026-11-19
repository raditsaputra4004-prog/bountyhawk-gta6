// Saving Sunport Heat: progress lives in localStorage under one key,
// written on mission complete, on a fare payout, and on pause-save.

export const SAVE_KEY = 'sunport-heat-save-v1';

/** Is there a saved game to continue? */
export function hasSave() {
  try {
    return localStorage.getItem(SAVE_KEY) !== null;
  } catch (e) {
    return false;
  }
}

/** Write the current progress. Never throws. */
export function saveGame(S) {
  try {
    const data = {
      version: 1,
      cash: S.player.cash,
      hp: S.player.hp,
      ammo: S.player.ammo,
      x: Math.round(S.player.x),
      y: Math.round(S.player.y),
      done: S.missions.done.slice(),
      storyDone: S.missions.storyDone,
      time: S.time,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) {
    /* storage may be unavailable; the game plays on without it */
  }
}

/** Read the saved progress, or null. */
export function loadSave() {
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

/** Wipe the save (New Game). */
export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (e) {
    /* ignore */
  }
}

/** Apply a loaded save to the game state. */
export function applySave(S, data) {
  S.player.cash = data.cash || 0;
  S.player.hp = data.hp || 100;
  S.player.ammo = data.ammo || 24;
  S.player.x = data.x || 1740;
  S.player.y = data.y || 1740;
  S.player.onFoot = true;
  S.player.car = null;
  S.missions.done = (data.done || []).slice();
  S.missions.storyDone = !!data.storyDone;
  S.camera.x = S.player.x;
  S.camera.y = S.player.y;
}
