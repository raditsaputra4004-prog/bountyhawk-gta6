// All sound is synthesized with WebAudio: no audio files, no network, no
// assets to ship. A small helper builds short effects from oscillators and
// filtered noise, and a quiet bass loop keeps the city humming.

let ctx = null;
let master = null;
let muted = false;
let engineNodes = null;
let musicTimer = null;
let musicStep = 0;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, type, gain, slideTo) {
  const c = ensure();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), c.currentTime + dur);
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  osc.connect(g);
  g.connect(master);
  osc.start();
  osc.stop(c.currentTime + dur + 0.02);
}

function noise(dur, gain, filterFreq, type = 'lowpass') {
  const c = ensure();
  if (!c) return;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buffer = c.createBuffer(1, len, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = filterFreq;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(filter);
  filter.connect(g);
  g.connect(master);
  src.start();
}

export const audio = {
  unlock() {
    ensure();
  },
  setMuted(m) {
    muted = m;
    if (master) master.gain.value = m ? 0 : 0.5;
  },
  isMuted() {
    return muted;
  },
  click() {
    tone(660, 0.06, 'square', 0.12);
  },
  punch() {
    tone(140, 0.12, 'sine', 0.35, 60);
    noise(0.08, 0.2, 500);
  },
  gunshot() {
    noise(0.14, 0.5, 2400, 'highpass');
    tone(180, 0.1, 'square', 0.2, 50);
  },
  pickup() {
    tone(880, 0.09, 'square', 0.14);
    setTimeout(() => tone(1320, 0.12, 'square', 0.14), 90);
  },
  cash() {
    tone(988, 0.1, 'triangle', 0.2);
    setTimeout(() => tone(1319, 0.14, 'triangle', 0.2), 100);
    setTimeout(() => tone(1568, 0.18, 'triangle', 0.2), 200);
  },
  crash(intensity = 1) {
    noise(0.25, 0.35 * intensity, 900);
    tone(90, 0.2, 'sine', 0.3, 40);
  },
  explosion() {
    noise(0.7, 0.6, 500);
    tone(70, 0.6, 'sine', 0.5, 28);
  },
  sirenBurst() {
    tone(720, 0.22, 'sine', 0.1, 950);
    setTimeout(() => tone(950, 0.22, 'sine', 0.1, 720), 220);
  },
  missionDone() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) => setTimeout(() => tone(n, 0.22, 'triangle', 0.22), i * 130));
  },
  missionFail() {
    tone(392, 0.25, 'sawtooth', 0.16, 300);
    setTimeout(() => tone(311, 0.4, 'sawtooth', 0.16, 220), 240);
  },
  busted() {
    tone(440, 0.3, 'sawtooth', 0.2, 220);
    setTimeout(() => tone(330, 0.5, 'sawtooth', 0.2, 180), 280);
  },
  // A looping engine drone whose pitch follows speed; call every frame.
  engine(speedRatio, on) {
    const c = ensure();
    if (!c) return;
    if (!on) {
      if (engineNodes) {
        try {
          engineNodes.gain.gain.setTargetAtTime(0, c.currentTime, 0.1);
        } catch (e) { /* already stopped */ }
        const nodes = engineNodes;
        setTimeout(() => {
          try { nodes.osc.stop(); } catch (e) { /* already stopped */ }
        }, 400);
        engineNodes = null;
      }
      return;
    }
    if (!engineNodes) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      const filter = c.createBiquadFilter();
      osc.type = 'sawtooth';
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      gain.gain.value = 0.0;
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      osc.start();
      engineNodes = { osc, gain };
    }
    const target = 0.05 + speedRatio * 0.06;
    engineNodes.gain.gain.setTargetAtTime(target, c.currentTime, 0.08);
    engineNodes.osc.frequency.setTargetAtTime(55 + speedRatio * 130, c.currentTime, 0.08);
  },
  // A lazy two-bar bass loop that starts once and keeps going.
  startMusic() {
    const c = ensure();
    if (!c || musicTimer) return;
    const bass = [55, 55, 65.41, 49, 55, 55, 73.42, 65.41];
    musicTimer = setInterval(() => {
      if (muted) return;
      const note = bass[musicStep % bass.length];
      tone(note, 0.42, 'triangle', 0.1);
      if (musicStep % 4 === 2) tone(note * 2, 0.1, 'square', 0.03);
      musicStep += 1;
    }, 430);
  },
  stopMusic() {
    if (musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
  },
};
