// Rendering Sunport Heat: the city, the cars, the people, the HUD with its
// live minimap, and every menu. One canvas, no images, no network.

import { clamp, dist } from './util.js';
import { WORLD, districtAt } from './city.js';
import { CAR_MODELS } from './vehicles.js';
import { currentObjective } from './missions.js';
import { hasSave } from './save.js';

export const VIEW_W = 1280;
export const VIEW_H = 720;

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Draw the whole frame for the current mode. */
export function render(S, ctx) {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  updateCamera(S);
  if (S.mode === 'title' || S.mode === 'howto') {
    drawWorld(S, ctx);
    drawTitle(S, ctx);
    if (S.mode === 'howto') drawHowTo(S, ctx);
    return;
  }
  drawWorld(S, ctx);
  drawHud(S, ctx);
  if (S.mode === 'pause') drawPause(S, ctx);
  if (S.mode === 'busted') drawEndCard(S, ctx, 'BUSTED', `The Sunport police took you in.\nYou lost $${S.player.bustedLost}.`, 'Press Enter to walk out of Police HQ');
  if (S.mode === 'wasted') drawEndCard(S, ctx, 'WASTED', `You woke up at Sunport General.\nYou lost $${S.player.wastedLost}.`, 'Press Enter to get back on your feet');
}

/** Ease the camera after the player (or the car). */
function updateCamera(S) {
  const t = S.player;
  const tx = t.x;
  const ty = t.y;
  S.camera.x += (tx - S.camera.x) * Math.min(1, 0.08);
  S.camera.y += (ty - S.camera.y) * Math.min(1, 0.08);
}

/** World-space drawing: ground, roads, buildings, cars, people, effects. */
function drawWorld(S, ctx) {
  const cam = S.camera;
  const shakeX = cam.shake > 0 ? (Math.random() - 0.5) * cam.shake : 0;
  const shakeY = cam.shake > 0 ? (Math.random() - 0.5) * cam.shake : 0;
  ctx.save();
  ctx.translate(VIEW_W / 2, VIEW_H / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x + shakeX, -cam.y + shakeY);

  // Ground.
  ctx.fillStyle = '#b3a06f';
  ctx.fillRect(0, 0, WORLD, WORLD);
  // Sand and water along the east and south edges.
  for (const s of S.city.sand) {
    ctx.fillStyle = '#e8d5a3';
    ctx.fillRect(s.x, s.y, s.w, s.h);
  }
  for (const w of S.city.water) {
    ctx.fillStyle = '#3d7ea6';
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = '#5a9bc2';
    for (let i = 0; i < 10; i++) {
      const wy = w.y + ((i * 173 + Math.floor(S.time * 20)) % Math.max(1, w.h));
      ctx.fillRect(w.x + 8, wy, w.w - 16, 3);
    }
  }
  // Parks.
  for (const p of S.city.parks) {
    ctx.fillStyle = '#6fa860';
    ctx.fillRect(p.x, p.y, p.w, p.h);
  }
  // Roads: asphalt with centre dashes.
  ctx.fillStyle = '#3d3d44';
  for (const rx of S.city.roadsX) ctx.fillRect(rx - 32, 0, 64, WORLD);
  for (const ry of S.city.roadsY) ctx.fillRect(0, ry - 32, WORLD, 64);
  ctx.fillStyle = '#f5d76e';
  for (const rx of S.city.roadsX) {
    for (let y = 0; y < WORLD; y += 80) ctx.fillRect(rx - 2, y, 4, 34);
  }
  for (const ry of S.city.roadsY) {
    for (let x = 0; x < WORLD; x += 80) ctx.fillRect(x, ry - 2, 34, 4);
  }
  // Trees.
  for (const t of S.city.trees) {
    ctx.fillStyle = '#2f6b33';
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4c8a3f';
    ctx.beginPath();
    ctx.arc(t.x - 3, t.y - 3, t.r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Buildings with a drop shadow and a roof.
  for (const b of S.city.buildings) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    if (b.kind === 'tower') {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(b.x + 10, b.y + 10, b.w - 20, 8);
    }
  }
  // Skid marks.
  for (const s of S.skids) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    ctx.globalAlpha = Math.min(0.5, s.life / 5 * 0.5);
    ctx.fillStyle = '#1c1c1c';
    ctx.fillRect(-14, -8, 28, 3);
    ctx.fillRect(-14, 5, 28, 3);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // Mission and fare markers: a pulsing beacon on the ground.
  const obj = currentObjective(S);
  if (obj && S.mode === 'play') {
    const pulse = 1 + Math.sin(S.time * 5) * 0.15;
    ctx.save();
    ctx.translate(obj.x, obj.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ffd24d';
    const s = 13 * pulse;
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.strokeStyle = '#7a5b00';
    ctx.lineWidth = 2;
    ctx.strokeRect(-s / 2, -s / 2, s, s);
    ctx.restore();
    ctx.fillStyle = 'rgba(255, 210, 77, 0.25)';
    ctx.beginPath();
    ctx.arc(obj.x, obj.y, 46 * pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  if (S.taxi.state === 'pickup' && S.taxi.fare) {
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath();
    ctx.arc(S.taxi.fare.x, S.taxi.fare.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0b3d1e';
    ctx.font = 'bold 14px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', S.taxi.fare.x, S.taxi.fare.y + 1);
  }

  // Cars.
  for (const car of S.cars) {
    if (car.dead) continue;
    drawCar(S, ctx, car);
  }
  // People.
  for (const p of S.peds) {
    if (p.dead) continue;
    drawPerson(ctx, p);
  }
  for (const cop of S.cops) {
    if (cop.dead) continue;
    drawCop(ctx, cop, S.time);
  }
  // The player on foot (in a car he is the car).
  if (S.player.onFoot && !S.player.dead) drawPlayerOnFoot(ctx, S.player);

  // Tracers.
  for (const t of S.tracers) {
    ctx.strokeStyle = `rgba(255, 233, 168, ${t.life / t.maxLife})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(t.x1, t.y1);
    ctx.lineTo(t.x2, t.y2);
    ctx.stroke();
  }
  // Particles.
  for (const p of S.particles) {
    const a = Math.max(0, p.life / p.maxLife);
    if (p.kind === 'smoke') {
      ctx.fillStyle = `rgba(120,120,120,${a * 0.5})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1.6 - a * 0.6), 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'flash') {
      ctx.fillStyle = `rgba(255, 233, 168, ${a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  // Floating texts.
  ctx.font = 'bold 15px ' + FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const f of S.floats) {
    ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

/** One car, top-down: shadow, body, windshield, wheels, lights. */
function drawCar(S, ctx, car) {
  const m = CAR_MODELS[car.model];
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  roundRect(ctx, -m.len / 2 + 3, -m.wid / 2 + 4, m.len, m.wid, 7);
  ctx.fill();
  // Wheels.
  ctx.fillStyle = '#151515';
  const wl = m.len * 0.28;
  const ww = 5;
  ctx.fillRect(-wl, -m.wid / 2 - 2, 12, ww);
  ctx.fillRect(-wl, m.wid / 2 - 3, 12, ww);
  ctx.fillRect(wl - 4, -m.wid / 2 - 2, 12, ww);
  ctx.fillRect(wl - 4, m.wid / 2 - 3, 12, ww);
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -m.len / 2, -m.wid / 2, m.len, m.wid, 7);
  ctx.fill();
  // Windshield and rear window.
  ctx.fillStyle = '#1f2a33';
  ctx.fillRect(m.len * 0.08, -m.wid / 2 + 3, 9, m.wid - 6);
  ctx.fillRect(-m.len * 0.3, -m.wid / 2 + 3, 6, m.wid - 6);
  // Model dressing.
  if (car.model === 'taxi') {
    ctx.fillStyle = '#111';
    for (let i = 0; i < 5; i++) ctx.fillRect(-m.len / 2 + 4 + i * 8, -2, 4, 4);
  }
  if (car.model === 'bullion') {
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(-m.len / 2 + 4, -2, m.len - 8, 4);
  }
  if (car.kind === 'police') {
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(-m.len * 0.1, -m.wid / 2, m.len * 0.22, m.wid);
    // Flashing light bar.
    const on = Math.floor(S.time * 4) % 2 === 0;
    ctx.fillStyle = on ? '#ff2d2d' : '#2d7dff';
    ctx.fillRect(-6, -m.wid / 2 - 1, 12, 6);
    ctx.fillStyle = on ? '#2d7dff' : '#ff2d2d';
    ctx.fillRect(-6, m.wid / 2 - 5, 12, 6);
  }
  if (car.missionCar) {
    ctx.strokeStyle = '#ffd24d';
    ctx.lineWidth = 3;
    roundRect(ctx, -m.len / 2 - 3, -m.wid / 2 - 3, m.len + 6, m.wid + 6, 9);
    ctx.stroke();
  }
  // Headlights.
  ctx.fillStyle = '#fff7c0';
  ctx.fillRect(m.len / 2 - 2, -m.wid / 2 + 3, 3, 4);
  ctx.fillRect(m.len / 2 - 2, m.wid / 2 - 7, 3, 4);
  // Damage smoke is handled by particles; a hurt car shows a crack.
  if (car.hp < car.maxHp * 0.4) {
    ctx.strokeStyle = 'rgba(20,20,20,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-m.len * 0.2, -m.wid / 2 + 4);
    ctx.lineTo(0, 0);
    ctx.lineTo(m.len * 0.25, m.wid / 2 - 4);
    ctx.stroke();
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** One person, top-down: shadow, body, head. */
function drawPerson(ctx, p) {
  if (p.downFor > 0) {
    // Lying down.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 12, 6, p.angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 11, 5, p.angle, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.arc(p.x + 2, p.y + 3, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8c39a';
  ctx.beginPath();
  ctx.arc(p.x + Math.cos(p.angle) * 3, p.y + Math.sin(p.angle) * 3, 4.5, 0, Math.PI * 2);
  ctx.fill();
  if (p.kind === 'guard') {
    // Health bar over a guard.
    ctx.fillStyle = '#222';
    ctx.fillRect(p.x - 14, p.y - 22, 28, 5);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(p.x - 13, p.y - 21, 26 * Math.max(0, p.hp / p.maxHp), 3);
  }
}

/** A foot cop: blue, with a cap. */
function drawCop(ctx, cop, time) {
  void time;
  if (cop.downFor > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(cop.x, cop.y, 12, 6, cop.angle, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.arc(cop.x + 2, cop.y + 3, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1e4fa3';
  ctx.beginPath();
  ctx.arc(cop.x, cop.y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0d2c5c';
  ctx.beginPath();
  ctx.arc(cop.x + Math.cos(cop.angle) * 3, cop.y + Math.sin(cop.angle) * 3, 5, 0, Math.PI * 2);
  ctx.fill();
  // Bust progress ring.
  if (cop.holdFor > 0) {
    ctx.strokeStyle = '#ff2d2d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cop.x, cop.y, 15, -Math.PI / 2, -Math.PI / 2 + (cop.holdFor / 1.2) * Math.PI * 2);
    ctx.stroke();
  }
}

/** Rex on foot: red jacket, easy to spot. */
function drawPlayerOnFoot(ctx, p) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.arc(p.x + 2, p.y + 3, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8c39a';
  ctx.beginPath();
  ctx.arc(p.x + Math.cos(p.angle) * 3, p.y + Math.sin(p.angle) * 3, 5, 0, Math.PI * 2);
  ctx.fill();
  // Aim line when the pistol is out.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + Math.cos(p.angle) * 22, p.y + Math.sin(p.angle) * 22);
  ctx.stroke();
}

// ---------------------------------------------------------------- HUD

function drawHud(S, ctx) {
  const p = S.player;
  const W = VIEW_W;
  const H = VIEW_H;
  ctx.textBaseline = 'alphabetic';

  // Health bar and cash, top left.
  ctx.fillStyle = 'rgba(10,10,14,0.55)';
  roundRect(ctx, 14, 14, 250, 64, 8);
  ctx.fill();
  ctx.fillStyle = '#e74c3c';
  ctx.fillRect(26, 26, 150 * Math.max(0, p.hp / p.maxHp), 14);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(26, 26, 150, 14);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px ' + FONT;
  ctx.textAlign = 'left';
  ctx.fillText(`HP ${Math.ceil(p.hp)}`, 184, 38);
  ctx.fillStyle = '#7dff8a';
  ctx.font = 'bold 20px ' + FONT;
  ctx.fillText(`$${p.cash.toLocaleString('en-US')}`, 26, 66);
  ctx.fillStyle = '#ffd24d';
  ctx.font = '13px ' + FONT;
  ctx.fillText(`Ammo ${p.ammo}  •  ${districtAt(S.city, p.x, p.y)}`, 120, 66);

  // Wanted stars, top right.
  const stars = S.wanted.stars;
  ctx.fillStyle = 'rgba(10,10,14,0.55)';
  roundRect(ctx, W - 214, 14, 200, 44, 8);
  ctx.fill();
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < stars ? '#ffd24d' : 'rgba(255,255,255,0.25)';
    drawStar(ctx, W - 194 + i * 38, 36, 13);
  }

  // Objective pill, top centre.
  const obj = currentObjective(S);
  if (obj) {
    ctx.font = 'bold 16px ' + FONT;
    const w = Math.min(560, ctx.measureText(obj.text).width + 56);
    ctx.fillStyle = 'rgba(10,10,14,0.6)';
    roundRect(ctx, (W - w) / 2, 14, w, 40, 20);
    ctx.fill();
    ctx.fillStyle = '#ffd24d';
    ctx.textAlign = 'center';
    ctx.fillText(obj.text, W / 2, 40);
    if (obj.timer !== undefined) {
      ctx.fillStyle = obj.timer <= 30 ? '#ff6b6b' : '#fff';
      ctx.font = 'bold 15px ' + FONT;
      ctx.fillText(`${obj.timer}s`, W / 2 + w / 2 + 26, 40);
    }
  }

  // Toasts, bottom left.
  ctx.textAlign = 'left';
  let ty = H - 24;
  for (let i = S.toasts.length - 1; i >= 0; i--) {
    const t = S.toasts[i];
    ctx.globalAlpha = Math.min(1, t.life);
    ctx.fillStyle = 'rgba(10,10,14,0.65)';
    ctx.font = '14px ' + FONT;
    const w = ctx.measureText(t.text).width + 20;
    roundRect(ctx, 14, ty - 18, w, 26, 6);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(t.text, 24, ty);
    ty -= 32;
  }
  ctx.globalAlpha = 1;

  // Speedometer, bottom right above the minimap.
  const speed = p.car ? Math.round(p.car.speed) : 0;
  ctx.fillStyle = 'rgba(10,10,14,0.55)';
  roundRect(ctx, W - 214, H - 252, 200, 34, 8);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px ' + FONT;
  ctx.textAlign = 'right';
  ctx.fillText(`${speed}`, W - 66, H - 228);
  ctx.font = '13px ' + FONT;
  ctx.fillStyle = '#bbb';
  ctx.fillText('km/h', W - 26, H - 228);

  drawMinimap(S, ctx);

  // Off-screen objective arrow.
  if (obj && S.mode === 'play') {
    const sx = (obj.x - S.camera.x) + W / 2;
    const sy = (obj.y - S.camera.y) + H / 2;
    if (sx < 60 || sx > W - 60 || sy < 90 || sy > H - 90) {
      const cx = clamp(sx, 70, W - 70);
      const cy = clamp(sy, 100, H - 70);
      const a = Math.atan2(sy - H / 2, sx - W / 2);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      ctx.fillStyle = '#ffd24d';
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-10, -10);
      ctx.lineTo(-10, 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#ffd24d';
      ctx.font = 'bold 12px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(dist(p.x, p.y, obj.x, obj.y))}m`, cx, cy + 26);
    }
  }

  // Damage vignette.
  const hurt = Math.max(p.hurtFlash, p.hp < 30 ? 0.35 : 0);
  if (hurt > 0) {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.75);
    g.addColorStop(0, 'rgba(255,0,0,0)');
    g.addColorStop(1, `rgba(255,0,0,${hurt * 0.55})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawStar(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

/** The live minimap: roads, water, player, police and the objective. */
function drawMinimap(S, ctx) {
  const size = 190;
  const x0 = VIEW_W - size - 14;
  const y0 = VIEW_H - size - 14;
  const k = size / WORLD;
  ctx.fillStyle = 'rgba(10,10,14,0.72)';
  roundRect(ctx, x0 - 4, y0 - 4, size + 8, size + 8, 8);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, size, size);
  ctx.clip();
  ctx.fillStyle = '#23231f';
  ctx.fillRect(x0, y0, size, size);
  for (const w of S.city.water) {
    ctx.fillStyle = '#3d7ea6';
    ctx.fillRect(x0 + w.x * k, y0 + w.y * k, w.w * k, w.h * k);
  }
  ctx.strokeStyle = '#8a8a8a';
  ctx.lineWidth = 2;
  for (const rx of S.city.roadsX) {
    ctx.beginPath();
    ctx.moveTo(x0 + rx * k, y0);
    ctx.lineTo(x0 + rx * k, y0 + size);
    ctx.stroke();
  }
  for (const ry of S.city.roadsY) {
    ctx.beginPath();
    ctx.moveTo(x0, y0 + ry * k);
    ctx.lineTo(x0 + size, y0 + ry * k);
    ctx.stroke();
  }
  const obj = currentObjective(S);
  if (obj) {
    const px = x0 + obj.x * k;
    const py = y0 + obj.y * k;
    ctx.fillStyle = '#ffd24d';
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-5, -5, 10, 10);
    ctx.restore();
  }
  for (const c of S.cars) {
    if (c.kind !== 'police' || c.dead) continue;
    ctx.fillStyle = '#2d7dff';
    ctx.beginPath();
    ctx.arc(x0 + c.x * k, y0 + c.y * k, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // The player, with a heading tick.
  const px = x0 + S.player.x * k;
  const py = y0 + S.player.y * k;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(px, py, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px + Math.cos(S.player.angle) * 9, py + Math.sin(S.player.angle) * 9);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- menus

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(8,8,12,0.82)';
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,210,77,0.5)';
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 12);
  ctx.stroke();
}

function menuButton(S, ctx, x, y, w, label, action, enabled) {
  const hover = S.input.mouseX >= x && S.input.mouseX <= x + w && S.input.mouseY >= y && S.input.mouseY <= y + 44;
  ctx.fillStyle = enabled === false ? 'rgba(255,255,255,0.12)' : hover ? '#ffd24d' : 'rgba(255,255,255,0.16)';
  roundRect(ctx, x, y, w, 44, 8);
  ctx.fill();
  ctx.fillStyle = enabled === false ? '#888' : hover ? '#111' : '#fff';
  ctx.font = 'bold 17px ' + FONT;
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + 29);
  S.menuButtons.push({ x, y, w, h: 44, action, enabled: enabled !== false });
}

function drawTitle(S, ctx) {
  ctx.fillStyle = 'rgba(5,5,10,0.55)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  S.menuButtons = [];
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd24d';
  ctx.font = 'bold 84px ' + FONT;
  ctx.fillText('SUNPORT HEAT', VIEW_W / 2, 190);
  ctx.fillStyle = '#fff';
  ctx.font = '22px ' + FONT;
  ctx.fillText('An original open-world crime game — owe $50,000, work five jobs, stay free.', VIEW_W / 2, 232);
  ctx.font = '15px ' + FONT;
  ctx.fillStyle = '#bbb';
  ctx.fillText('WASD drive & walk  •  E enter a car  •  F punch  •  mouse + click shoot  •  Space handbrake  •  Esc pause', VIEW_W / 2, 264);
  const bx = VIEW_W / 2 - 150;
  menuButton(S, ctx, bx, 310, 300, 'New Game', 'new');
  menuButton(S, ctx, bx, 366, 300, 'Continue', 'continue', hasSave());
  menuButton(S, ctx, bx, 422, 300, 'How to Play', 'howto');
  ctx.fillStyle = '#888';
  ctx.font = '13px ' + FONT;
  ctx.fillText('v1.0 — made with make.fun — all art, names and sounds are original', VIEW_W / 2, 500);
}

function drawHowTo(S, ctx) {
  S.menuButtons = [];
  panel(ctx, 290, 120, 700, 470);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd24d';
  ctx.font = 'bold 26px ' + FONT;
  ctx.fillText('How to Play', 320, 168);
  ctx.fillStyle = '#eee';
  ctx.font = '16px ' + FONT;
  const lines = [
    'Rex Vane owes Mara Quinn $50,000. Five jobs clear the debt.',
    '',
    'W A S D / arrows — walk and drive. E — enter or exit a car.',
    'Stealing a parked car raises your wanted level.',
    'F — punch. Mouse + click — aim and shoot the pistol.',
    'Space — handbrake for tight turns and drifts.',
    '',
    'Wanted 0–5 stars: cruisers chase and ram, foot cops chase',
    'and bust you after holding on for 1.2 seconds. Lay low',
    'for 12 seconds and the heat cools off.',
    '',
    'Follow the yellow marker: it is always your next job.',
    'Taxi fares ($) appear while you drive with no job on.',
    'Esc — pause and save. Progress saves in your browser.',
  ];
  let y = 200;
  for (const line of lines) {
    ctx.fillText(line, 320, y);
    y += 26;
  }
  menuButton(S, ctx, 540, 520, 200, 'Back', 'back');
}

function drawPause(S, ctx) {
  ctx.fillStyle = 'rgba(5,5,10,0.6)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  S.menuButtons = [];
  panel(ctx, 440, 170, 400, 330);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd24d';
  ctx.font = 'bold 34px ' + FONT;
  ctx.fillText('PAUSED', VIEW_W / 2, 226);
  ctx.fillStyle = '#ddd';
  ctx.font = '15px ' + FONT;
  ctx.fillText(`${S.missions.done.length}/5 jobs done  •  $${S.player.cash.toLocaleString('en-US')}`, VIEW_W / 2, 258);
  menuButton(S, ctx, 490, 290, 300, 'Resume', 'resume');
  menuButton(S, ctx, 490, 346, 300, 'Save Game', 'save');
  menuButton(S, ctx, 490, 402, 300, 'Quit to Title', 'quit');
}

function drawEndCard(S, ctx, big, body, hint) {
  ctx.fillStyle = 'rgba(5,5,10,0.62)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  S.menuButtons = [];
  ctx.textAlign = 'center';
  ctx.fillStyle = big === 'BUSTED' ? '#2d7dff' : '#ff6b6b';
  ctx.font = 'bold 72px ' + FONT;
  ctx.fillText(big, VIEW_W / 2, 300);
  ctx.fillStyle = '#fff';
  ctx.font = '19px ' + FONT;
  const lines = body.split('\n');
  let y = 344;
  for (const line of lines) {
    ctx.fillText(line, VIEW_W / 2, y);
    y += 28;
  }
  ctx.fillStyle = '#ffd24d';
  ctx.font = 'bold 17px ' + FONT;
  ctx.fillText(hint, VIEW_W / 2, y + 24);
  menuButton(S, ctx, VIEW_W / 2 - 150, y + 52, 300, 'Respawn (Enter)', 'respawn');
}
