// Everything the player sees: the city, the cars, the people, the effects,
// and the HUD with its minimap. Drawing is split into a world pass (in
// world coordinates, under the camera) and a HUD pass (in screen pixels).

import { WORLD, PALETTE, WANTED } from './config.js';
import { PLACES } from './city.js';

// ---- world pass -----------------------------------------------------------

export function drawWorld(ctx, world, cam, vw, vh) {
  const city = world.city;
  const left = cam.x - vw / 2 / cam.zoom;
  const top = cam.y - vh / 2 / cam.zoom;
  const right = cam.x + vw / 2 / cam.zoom;
  const bottom = cam.y + vh / 2 / cam.zoom;

  ctx.save();
  ctx.translate(vw / 2, vh / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x + (cam.shakeX || 0), -cam.y + (cam.shakeY || 0));

  // Ground.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(left, top, right - left, bottom - top);
  // Parks.
  ctx.fillStyle = PALETTE.park;
  for (const park of city.parks) {
    if (park.x > right || park.x + park.w < left || park.y > bottom || park.y + park.h < top) continue;
    ctx.fillRect(park.x, park.y, park.w, park.h);
  }
  // Beach and bay along the south edge.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(city.beach.x, city.beach.y, city.beach.w, city.beach.h);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(city.water.x, city.water.y, city.water.w, city.water.h);
  ctx.fillStyle = PALETTE.waterDeep;
  ctx.fillRect(city.water.x, city.water.y + 60, city.water.w, city.water.h - 60);

  drawRoads(ctx, city, left, top, right, bottom);
  drawTrees(ctx, city, left, top, right, bottom);
  drawBuildings(ctx, city, left, top, right, bottom);
  drawSkids(ctx, world);
  drawMissionMarker(ctx, world);
  drawCars(ctx, world, left, top, right, bottom);
  drawPeds(ctx, world, left, top, right, bottom);
  drawPlayer(ctx, world);
  drawBullets(ctx, world);
  drawParticles(ctx, world);

  ctx.restore();
}

function drawRoads(ctx, city, left, top, right, bottom) {
  const hw = WORLD.roadWidth / 2;
  // Sidewalks: a pale band under each road.
  ctx.fillStyle = PALETTE.sidewalk;
  for (const line of city.lines) {
    if (line > top - hw - 14 && line < bottom + hw + 14) {
      ctx.fillRect(left, line - hw - WORLD.sidewalk, right - left, WORLD.roadWidth + WORLD.sidewalk * 2);
    }
    if (line > left - hw - 14 && line < right + hw + 14) {
      ctx.fillRect(line - hw - WORLD.sidewalk, top, WORLD.roadWidth + WORLD.sidewalk * 2, bottom - top);
    }
  }
  // Asphalt.
  ctx.fillStyle = PALETTE.road;
  for (const line of city.lines) {
    if (line > top - hw && line < bottom + hw) {
      ctx.fillRect(left, line - hw, right - left, WORLD.roadWidth);
    }
    if (line > left - hw && line < right + hw) {
      ctx.fillRect(line - hw, top, WORLD.roadWidth, bottom - top);
    }
  }
  // Centre dashes.
  ctx.fillStyle = PALETTE.lane;
  ctx.save();
  ctx.globalAlpha = 0.85;
  for (const line of city.lines) {
    for (let d = 0; d < WORLD.size; d += 64) {
      if (line > top - hw && line < bottom + hw && d > left && d < right) {
        ctx.fillRect(d, line - 2, 30, 4);
      }
      if (line > left - hw && line < right + hw && d > top && d < bottom) {
        ctx.fillRect(line - 2, d, 4, 30);
      }
    }
  }
  ctx.restore();
  // Crosswalks at intersections.
  ctx.fillStyle = PALETTE.crosswalk;
  for (const ix of city.lines) {
    for (const iy of city.lines) {
      if (ix < left - 60 || ix > right + 60 || iy < top - 60 || iy > bottom + 60) continue;
      for (let s = -3; s <= 3; s += 1) {
        ctx.fillRect(ix - 26 + s * 8, iy - hw - 8, 5, 8);
        ctx.fillRect(ix - 26 + s * 8, iy + hw, 5, 8);
        ctx.fillRect(ix - hw - 8, iy - 26 + s * 8, 8, 5);
        ctx.fillRect(ix + hw, iy - 26 + s * 8, 8, 5);
      }
    }
  }
}

function drawTrees(ctx, city, left, top, right, bottom) {
  for (const t of city.trees) {
    if (t.x < left - 30 || t.x > right + 30 || t.y < top - 30 || t.y > bottom + 30) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.arc(t.x + 4, t.y + 5, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.tree;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.treeDark;
    ctx.beginPath();
    ctx.arc(t.x - t.r * 0.25, t.y - t.r * 0.25, t.r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBuildings(ctx, city, left, top, right, bottom) {
  for (const b of city.buildings) {
    if (b.x > right || b.x + b.w < left || b.y > bottom || b.y + b.h < top) continue;
    // Long late-afternoon shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
    ctx.fillStyle = b.wall;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    if (b.style === 'towers') {
      // Glass windows in a grid.
      ctx.fillStyle = b.glass;
      const cols = Math.max(2, Math.floor(b.w / 22));
      const rows = Math.max(2, Math.floor(b.h / 22));
      for (let i = 0; i < cols; i += 1) {
        for (let j = 0; j < rows; j += 1) {
          ctx.fillRect(b.x + 10 + i * ((b.w - 20) / cols), b.y + 10 + j * ((b.h - 20) / rows), 9, 9);
        }
      }
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, 4);
    } else {
      // Roof details: a vent and a skylight.
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.25, b.w * 0.18, b.h * 0.18);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(b.x + b.w * 0.6, b.y + b.h * 0.6, b.w * 0.2, b.h * 0.15);
    }
  }
}

function drawSkids(ctx, world) {
  if (world.particles.skids.length === 0) return;
  ctx.strokeStyle = 'rgba(20,20,20,0.45)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (const s of world.particles.skids) {
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
  }
  ctx.stroke();
}

function drawMissionMarker(ctx, world) {
  const obj = world.objective;
  if (!obj || !obj.target) return;
  const pulse = 1 + Math.sin(world.time * 4) * 0.15;
  const t = obj.target;
  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.strokeStyle = '#ffd34d';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -52);
  ctx.lineTo(0, -30);
  ctx.stroke();
  ctx.fillStyle = '#ffd34d';
  ctx.beginPath();
  ctx.moveTo(0, -30);
  ctx.lineTo(-9, -48);
  ctx.lineTo(9, -48);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // A vertical beacon so the marker reads from far away.
  ctx.save();
  ctx.globalAlpha = 0.16 + 0.08 * Math.sin(world.time * 4);
  ctx.fillStyle = '#ffd34d';
  ctx.fillRect(t.x - 3, t.y - 320, 6, 320);
  ctx.restore();
}

function drawCarShape(ctx, car, highlight) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const L = 46;
  const W = 22;
  // Wheels.
  ctx.fillStyle = '#151515';
  ctx.fillRect(-L / 2 + 4, -W / 2 - 3, 10, 5);
  ctx.fillRect(L / 2 - 14, -W / 2 - 3, 10, 5);
  ctx.fillRect(-L / 2 + 4, W / 2 - 2, 10, 5);
  ctx.fillRect(L / 2 - 14, W / 2 - 2, 10, 5);
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -L / 2, -W / 2, L, W, 7);
  ctx.fill();
  // Roof and windshield.
  ctx.fillStyle = 'rgba(20,28,38,0.85)';
  roundRect(ctx, -6, -W / 2 + 4, 16, W - 8, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(8, -W / 2 + 4, 3, W - 8);
  // Headlights.
  ctx.fillStyle = '#fff6c9';
  ctx.fillRect(L / 2 - 2, -W / 2 + 3, 3, 4);
  ctx.fillRect(L / 2 - 2, W / 2 - 7, 3, 4);
  if (car.kind === 'police') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-14, -W / 2 + 2, 22, W - 4);
    const phase = Math.floor(car.siren * 6) % 2 === 0;
    ctx.fillStyle = phase ? '#ff2e2e' : '#2e7dff';
    ctx.fillRect(-4, -W / 2 - 1, 8, 5);
    ctx.fillStyle = phase ? '#2e7dff' : '#ff2e2e';
    ctx.fillRect(-4, W / 2 - 4, 8, 5);
  }
  if (car.marked) {
    ctx.strokeStyle = '#ffd34d';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    roundRect(ctx, -L / 2 - 4, -W / 2 - 4, L + 8, W + 8, 9);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (highlight) {
    ctx.strokeStyle = '#ffd34d';
    ctx.lineWidth = 2.5;
    roundRect(ctx, -L / 2 - 3, -W / 2 - 3, L + 6, W + 6, 9);
    ctx.stroke();
  }
  ctx.restore();
  // Damage smoke.
  if (car.health < 45) {
    ctx.fillStyle = 'rgba(90,90,90,0.5)';
    ctx.beginPath();
    ctx.arc(car.x - Math.cos(car.angle) * 14, car.y - Math.sin(car.angle) * 14, 6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCars(ctx, world, left, top, right, bottom) {
  for (const car of world.cars) {
    if (car.x < left - 60 || car.x > right + 60 || car.y < top - 60 || car.y > bottom + 60) continue;
    drawCarShape(ctx, car, car.isPlayerCar);
  }
}

function drawPeds(ctx, world, left, top, right, bottom) {
  for (const ped of world.peds) {
    if (ped.x < left - 20 || ped.x > right + 20 || ped.y < top - 20 || ped.y > bottom + 20) continue;
    const bob = Math.sin(ped.bob) * 1.5;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(ped.x, ped.y + 8, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y + bob * 0.3, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y - 4 + bob * 0.3, 5, 0, Math.PI * 2);
    ctx.fill();
    if (ped.fare) {
      ctx.fillStyle = '#7ddc7d';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', ped.x, ped.y - 20);
    }
  }
  for (const cop of world.cops) {
    if (cop.x < left - 20 || cop.x > right + 20 || cop.y < top - 20 || cop.y > bottom + 20) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(cop.x, cop.y + 8, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b5fb5';
    ctx.beginPath();
    ctx.arc(cop.x, cop.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d8d8d8';
    ctx.beginPath();
    ctx.arc(cop.x, cop.y - 4, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#101014';
    ctx.fillRect(cop.x - 6, cop.y - 10, 12, 3);
  }
  for (const guard of world.guards) {
    if (guard.down) continue;
    if (guard.x < left - 20 || guard.x > right + 20 || guard.y < top - 20 || guard.y > bottom + 20) continue;
    ctx.fillStyle = '#3a2a2a';
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b88a';
    ctx.beginPath();
    ctx.arc(guard.x, guard.y - 4, 5, 0, Math.PI * 2);
    ctx.fill();
    // Health bar.
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(guard.x - 14, guard.y - 24, 28, 4);
    ctx.fillStyle = '#ff5c5c';
    ctx.fillRect(guard.x - 14, guard.y - 24, 28 * (guard.health / 60), 4);
  }
}

function drawPlayer(ctx, world) {
  const player = world.player;
  if (!player.onFoot) return;
  const flash = player.hurtFlash > 0 && Math.floor(world.time * 20) % 2 === 0;
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(2, 9, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = flash ? '#ffffff' : '#e8b13c';
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = flash ? '#ffffff' : '#2e5d8a';
  ctx.beginPath();
  ctx.arc(4, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  // Facing tick.
  ctx.fillStyle = '#101014';
  ctx.fillRect(8, -2, 8, 4);
  ctx.restore();
}

function drawBullets(ctx, world) {
  if (world.tracer && world.tracer.life > 0) {
    ctx.strokeStyle = 'rgba(255,224,138,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(world.tracer.x1, world.tracer.y1);
    ctx.lineTo(world.tracer.x2, world.tracer.y2);
    ctx.stroke();
  }
}

function drawParticles(ctx, world) {
  const p = world.particles;
  for (const q of p.list) {
    ctx.globalAlpha = Math.max(0, q.life / q.max);
    ctx.fillStyle = q.color;
    ctx.beginPath();
    ctx.arc(q.x, q.y, q.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  for (const t of p.texts) {
    ctx.globalAlpha = Math.max(0, t.life / t.max);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
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

// ---- HUD pass (screen pixels) --------------------------------------------

export function drawHUD(ctx, world, vw, vh) {
  const player = world.player;
  const wanted = world.wanted;
  ctx.save();
  // Damage vignette.
  if (player.hurtFlash > 0) {
    ctx.fillStyle = `rgba(200,30,30,${player.hurtFlash * 0.45})`;
    ctx.fillRect(0, 0, vw, vh);
  }
  // Top-left: health, cash, ammo.
  ctx.fillStyle = 'rgba(16,16,20,0.72)';
  roundRect(ctx, 14, 14, 250, 84, 10);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('REX VANE', 26, 36);
  ctx.fillStyle = '#3a3a40';
  ctx.fillRect(26, 44, 150, 10);
  ctx.fillStyle = player.health > 30 ? '#7ddc7d' : '#ff5c5c';
  ctx.fillRect(26, 44, 150 * (player.health / 100), 10);
  ctx.fillStyle = '#ffd34d';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText(`$${player.cash.toLocaleString('en-US')}`, 26, 78);
  ctx.fillStyle = '#ffffff';
  ctx.font = '13px sans-serif';
  ctx.fillText(`Ammo ${player.ammo}`, 196, 78);
  // Wanted stars, top centre.
  const stars = wanted.stars;
  ctx.textAlign = 'center';
  ctx.font = '26px sans-serif';
  for (let i = 0; i < WANTED.maxStars; i += 1) {
    ctx.fillStyle = i < stars ? '#ffd34d' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', vw / 2 - 60 + i * 30, 44);
  }
  if (stars > 0) {
    ctx.fillStyle = '#ff6b5c';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('WANTED', vw / 2, 62);
  }
  // Objective, under the stars.
  if (world.objective) {
    ctx.fillStyle = 'rgba(16,16,20,0.72)';
    const text = world.objective.text;
    ctx.font = 'bold 14px sans-serif';
    const w = Math.min(vw - 40, ctx.measureText(text).width + 28);
    roundRect(ctx, vw / 2 - w / 2, 92, w, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#ffd34d';
    ctx.fillText(text, vw / 2, 112);
    if (world.objective.hint) {
      ctx.fillStyle = '#ffb13c';
      ctx.font = '12px sans-serif';
      ctx.fillText(world.objective.hint, vw / 2, 132);
    }
  }
  // Mission timer.
  if (world.missions.timerLimit > 0) {
    const left = Math.max(0, world.missions.timerLimit - world.missions.timer);
    ctx.fillStyle = left < 20 ? '#ff5c5c' : '#ffffff';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`${Math.ceil(left)}s`, vw / 2, 156);
  }
  // Speedometer, bottom right (only while driving).
  if (player.car) {
    const kmh = Math.round(player.car.speed * 0.9);
    ctx.fillStyle = 'rgba(16,16,20,0.72)';
    roundRect(ctx, vw - 124, vh - 64, 110, 50, 10);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(`${kmh}`, vw - 69, vh - 28);
    ctx.font = '11px sans-serif';
    ctx.fillText('km/h', vw - 69, vh - 14);
  }
  // Toast messages, bottom centre, newest last.
  ctx.font = 'bold 14px sans-serif';
  let y = vh - 24;
  for (let i = world.messages.length - 1; i >= 0; i -= 1) {
    const m = world.messages[i];
    ctx.globalAlpha = Math.min(1, m.life);
    ctx.fillStyle = m.color || '#ffffff';
    ctx.fillText(m.text, vw / 2, y);
    y -= 22;
  }
  ctx.globalAlpha = 1;
  drawMinimap(ctx, world, vw, vh);
  // Off-screen objective arrow.
  drawObjectiveArrow(ctx, world, vw, vh);
  ctx.restore();
}

function drawMinimap(ctx, world, vw, vh) {
  const size = 178;
  const x0 = vw - size - 14;
  const y0 = 14;
  const scale = size / 3600;
  ctx.save();
  ctx.fillStyle = 'rgba(16,16,20,0.78)';
  roundRect(ctx, x0 - 6, y0 - 6, size + 12, size + 12, 10);
  ctx.fill();
  ctx.beginPath();
  ctx.rect(x0, y0, size, size);
  ctx.clip();
  ctx.fillStyle = '#5d9448';
  ctx.fillRect(x0, y0, size, size);
  ctx.fillStyle = '#2e7f9e';
  ctx.fillRect(x0, y0 + size - 8, size, 8);
  ctx.strokeStyle = '#3a3a40';
  ctx.lineWidth = 3;
  for (const line of world.city.lines) {
    const p = line * scale;
    ctx.beginPath();
    ctx.moveTo(x0, y0 + p);
    ctx.lineTo(x0 + size, y0 + p);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x0 + p, y0);
    ctx.lineTo(x0 + p, y0 + size);
    ctx.stroke();
  }
  const dot = (x, y, color, r = 3) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x0 + x * scale, y0 + y * scale, r, 0, Math.PI * 2);
    ctx.fill();
  };
  if (world.objective && world.objective.target) {
    const t = world.objective.target;
    const pulse = 3 + Math.sin(world.time * 5) * 1.5;
    dot(t.x, t.y, '#ffd34d', pulse);
  }
  for (const car of world.policeCars) dot(car.x, car.y, '#ff2e2e', 3.5);
  for (const car of world.cars) {
    if (car.isPlayerCar) continue;
    dot(car.x, car.y, '#9a9a92', 2);
  }
  const player = world.player;
  dot(player.x, player.y, '#ffd34d', 4.5);
  ctx.strokeStyle = '#101014';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x0 + player.x * scale, y0 + player.y * scale, 4.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SUNPORT', x0, y0 + size + 18);
}

function drawObjectiveArrow(ctx, world, vw, vh) {
  const obj = world.objective;
  if (!obj || !obj.target) return;
  const cam = world.camera;
  // Project the target into screen space.
  const sx = (obj.target.x - cam.x) * cam.zoom + vw / 2;
  const sy = (obj.target.y - cam.y) * cam.zoom + vh / 2;
  if (sx > 40 && sx < vw - 40 && sy > 40 && sy < vh - 40) return;
  const cx = Math.max(50, Math.min(vw - 50, sx));
  const cy = Math.max(90, Math.min(vh - 90, sy));
  const angle = Math.atan2(sy - vh / 2, sx - vw / 2);
  const dist = Math.round(Math.hypot(obj.target.x - world.player.x, obj.target.y - world.player.y));
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.fillStyle = '#ffd34d';
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-8, -10);
  ctx.lineTo(-8, 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#ffd34d';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${dist}m`, cx, cy + 26);
}
