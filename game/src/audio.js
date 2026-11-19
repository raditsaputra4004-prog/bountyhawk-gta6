// Synthesized sound for Sunport Heat: every effect is made with WebAudio,
// so the game ships no audio files and makes no network requests.

let ctx = null;
let master = null;
let engineOsc = null;
let engineGain = null;
let sirenOsc = null;
let sirenGain = null;
let muted = false;
let sirenPhase = 0;

/** Create the audio context on the first user gesture. Safe to call often. */
export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    // Engine drone: a sawtooth through a lowpass, pitch follows speed.
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 60;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
    // Police siren: a sine that swings between two notes.
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'sine';
    sirenOsc.frequency.value = 720;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
  } catch (e) {
    ctx = null;
  }
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.5;
}

export function isMuted() {
  return muted;
}

/** Keep the engine drone and siren in step with the game. Call every frame. */
export function updateEngineAudio(speed01, driving, stars, dt) {
  if (!ctx) return;
  if (engineOsc && engineGain) {
    engineOsc.frequency.value = 55 + speed01 * 165;
    const target = driving ? 0.05 + speed01 * 0.09 : 0.0;
    engineGain.gain.value += (target - engineGain.gain.value) * Math.min(1, dt * 8);
  }
  if (sirenOsc && sirenGain) {
    sirenPhase += dt;
    const high = Math.floor(sirenPhase / 0.42) % 2 === 0;
    sirenOsc.frequency.value = high ? 920 : 660;
    const target = stars > 0 ? 0.035 : 0;
    sirenGain.gain.value += (target - sirenGain.gain.value) * Math.min(1, dt * 6);
  }
}

function tone(freq, dur, type, vol, slideTo) {
  if (!ctx || muted) return;
  try {
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  } catch (e) {
    /* audio is decoration; never break the game */
  }
}

function noiseBurst(dur, vol, filterFreq) {
  if (!ctx || muted) return;
  try {
    const t0 = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t0);
  } catch (e) {
    /* audio is decoration; never break the game */
  }
}

/** Play a named one-shot effect. */
export function sfx(name) {
  if (!ctx || muted) return;
  switch (name) {
    case 'shot':
      noiseBurst(0.12, 0.5, 3200);
      tone(190, 0.08, 'square', 0.18, 70);
      break;
    case 'punch':
      noiseBurst(0.09, 0.35, 900);
      break;
    case 'crash':
      noiseBurst(0.25, 0.5, 700);
      tone(90, 0.2, 'sine', 0.3, 40);
      break;
    case 'explosion':
      noiseBurst(0.7, 0.7, 500);
      tone(70, 0.6, 'sine', 0.5, 28);
      break;
    case 'pickup':
      tone(660, 0.09, 'sine', 0.25);
      setTimeout(() => tone(990, 0.12, 'sine', 0.25), 90);
      break;
    case 'cash':
      tone(880, 0.1, 'triangle', 0.3);
      setTimeout(() => tone(1174, 0.14, 'triangle', 0.3), 100);
      break;
    case 'mission':
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.28), i * 110));
      break;
    case 'fail':
      tone(320, 0.25, 'sawtooth', 0.2, 140);
      break;
    case 'click':
      tone(1200, 0.05, 'square', 0.12);
      break;
    case 'door':
      noiseBurst(0.08, 0.25, 1200);
      break;
    case 'busted':
      tone(440, 0.3, 'sawtooth', 0.25, 220);
      setTimeout(() => tone(330, 0.4, 'sawtooth', 0.25, 165), 250);
      break;
    default:
      break;
  }
}
