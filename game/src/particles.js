// Particles, skid marks, floating texts and screen shake for Sunport Heat.
// All visual feedback lives here; nothing here touches game logic.

import { randRange } from './util.js';

/** Spawn a burst of particles at (x, y). */
export function burst(S, x, y, opts) {
  const o = opts || {};
  const n = o.count || 12;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = randRange(Math.random, o.speedMin || 40, o.speedMax || 220);
    S.particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: randRange(Math.random, 0.25, o.life || 0.7),
      maxLife: o.life || 0.7,
      size: randRange(Math.random, o.sizeMin || 2, o.sizeMax || 6),
      color: o.color || '#ffcc66',
      drag: o.drag || 2.2,
      kind: o.kind || 'dot',
    });
  }
}

/** A puff of smoke (grey, slow, growing). */
export function smoke(S, x, y, big) {
  S.particles.push({
    x: x + randRange(Math.random, -8, 8),
    y: y + randRange(Math.random, -8, 8),
    vx: randRange(Math.random, -14, 14),
    vy: randRange(Math.random, -30, -8),
    life: randRange(Math.random, 0.6, 1.2),
    maxLife: 1.2,
    size: big ? randRange(Math.random, 10, 18) : randRange(Math.random, 5, 10),
    color: '#8a8a8a',
    drag: 0.6,
    kind: 'smoke',
  });
}

/** A short-lived tracer line from a gunshot. */
export function tracer(S, x1, y1, x2, y2) {
  S.tracers.push({ x1, y1, x2, y2, life: 0.09, maxLife: 0.09 });
}

/** A muzzle flash at a gun's tip. */
export function muzzle(S, x, y, angle) {
  S.particles.push({
    x, y,
    vx: Math.cos(angle) * 120,
    vy: Math.sin(angle) * 120,
    life: 0.06,
    maxLife: 0.06,
    size: 9,
    color: '#ffe9a8',
    drag: 0,
    kind: 'flash',
  });
}

/** A skid mark where a tyre slid. */
export function skid(S, x, y, angle) {
  S.skids.push({ x, y, angle, life: 5 });
  if (S.skids.length > 400) S.skids.splice(0, S.skids.length - 400);
}

/** A floating text label that rises and fades (damage, cash, tips). */
export function floatText(S, x, y, text, color) {
  S.floats.push({ x, y, text, color: color || '#ffffff', life: 1.1, maxLife: 1.1 });
}

/** Add screen shake. */
export function shake(S, amount) {
  S.camera.shake = Math.min(22, S.camera.shake + amount);
}

/** Step particles, tracers, skids and floats forward. */
export function updateParticles(S, dt) {
  for (let i = S.particles.length - 1; i >= 0; i--) {
    const p = S.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      S.particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const damp = Math.max(0, 1 - p.drag * dt);
    p.vx *= damp;
    p.vy *= damp;
  }
  for (let i = S.tracers.length - 1; i >= 0; i--) {
    S.tracers[i].life -= dt;
    if (S.tracers[i].life <= 0) S.tracers.splice(i, 1);
  }
  for (let i = S.skids.length - 1; i >= 0; i--) {
    S.skids[i].life -= dt;
    if (S.skids[i].life <= 0) S.skids.splice(i, 1);
  }
  for (let i = S.floats.length - 1; i >= 0; i--) {
    const f = S.floats[i];
    f.life -= dt;
    f.y -= 34 * dt;
    if (f.life <= 0) S.floats.splice(i, 1);
  }
  S.camera.shake = Math.max(0, S.camera.shake - dt * 34);
}
