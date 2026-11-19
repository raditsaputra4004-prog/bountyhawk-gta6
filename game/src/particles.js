// Short-lived visual feedback: sparks, smoke, muzzle flashes, floating
// score text, and the skid marks cars leave on the road. Nothing here has
// gameplay state — it is all garnish, so it can be dropped freely.

export function makeParticles() {
  return { list: [], skids: [], texts: [] };
}

export function burst(p, x, y, count, color, speed, life, size) {
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random() * 0.7);
    p.list.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: life * (0.6 + Math.random() * 0.4),
      max: life,
      color,
      size: size * (0.6 + Math.random() * 0.8),
    });
  }
}

export function smoke(p, x, y) {
  p.list.push({
    x: x + (Math.random() - 0.5) * 8,
    y: y + (Math.random() - 0.5) * 8,
    vx: (Math.random() - 0.5) * 14,
    vy: -18 - Math.random() * 16,
    life: 0.9,
    max: 0.9,
    color: 'rgba(120,120,120,0.5)',
    size: 7 + Math.random() * 6,
    grows: true,
  });
}

export function floatText(p, x, y, text, color = '#ffffff') {
  p.texts.push({ x, y, text, color, life: 1.4, max: 1.4 });
}

export function addSkid(p, x1, y1, x2, y2) {
  p.skids.push({ x1, y1, x2, y2, life: 6 });
  if (p.skids.length > 400) p.skids.splice(0, p.skids.length - 400);
}

export function stepParticles(p, dt) {
  for (let i = p.list.length - 1; i >= 0; i -= 1) {
    const q = p.list[i];
    q.life -= dt;
    if (q.life <= 0) {
      p.list.splice(i, 1);
      continue;
    }
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    q.vx *= 0.96;
    q.vy *= 0.96;
    if (q.grows) q.size += 14 * dt;
  }
  for (let i = p.skids.length - 1; i >= 0; i -= 1) {
    p.skids[i].life -= dt;
    if (p.skids[i].life <= 0) p.skids.splice(i, 1);
  }
  for (let i = p.texts.length - 1; i >= 0; i -= 1) {
    const t = p.texts[i];
    t.life -= dt;
    t.y -= 26 * dt;
    if (t.life <= 0) p.texts.splice(i, 1);
  }
}
