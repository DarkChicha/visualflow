/* ═══════════════════════════════════════════════════════════════
   BS-015 — effects/bolts.js
   Rayos finos logo ↔ manos: aparecen si energy > 20 (probabilidad
   proporcional), zigzag de 7 segmentos, halo de color + núcleo
   blanco, chispas en los extremos. Vida ~0.18s.
   ═══════════════════════════════════════════════════════════════ */

import { BOLTS, MOTION } from '../config.js';
import { logoCenter, logoSize, listo } from './logo.js';

const bolts = [];

function createBolt(x1, y1, x2, y2, color) {
  const pts = [];
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const perp = Math.atan2(dy, dx) + Math.PI / 2;
  for (let i = 0; i <= BOLTS.SEGS; i++) {
    const t = i / BOLTS.SEGS;
    let px = x1 + dx * t, py = y1 + dy * t;
    if (i > 0 && i < BOLTS.SEGS) {
      const mag = (Math.random() - 0.5) * len * BOLTS.OFFSET_FACTOR;
      px += Math.cos(perp) * mag;
      py += Math.sin(perp) * mag;
    }
    pts.push({ x: px, y: py });
  }
  bolts.push({ pts, color, life: 1 });
}

function pathBolt(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
}

export function update(dt, state) {
  if (!listo()) return; // m21: sin logo no hay borde de donde salir
  const energy = state.energy;
  const f = state.motionReduced ? MOTION.EFFECTS_FACTOR : 1; // M10
  // Spawn: prob = ((energy-20)/80) × 0.55 por frame (m15: normalizada por dt)
  if (energy > BOLTS.THRESHOLD && bolts.length < BOLTS.MAX && state.hands.length) {
    const prob = ((energy - BOLTS.THRESHOLD) / BOLTS.PROB_RANGE) * BOLTS.PROB_FACTOR * dt * 60 * f;
    if (Math.random() < prob) {
      const tips = state.hands.flatMap(h => h.tips);
      if (tips.length) {
        const t = tips[Math.floor(Math.random() * tips.length)];
        const ang = Math.random() * Math.PI * 2;
        const lc = logoCenter(state.time);
        const ls = logoSize();
        // Origen en el borde del logo (elipse de radios w×0.42 / h×0.42)
        const edge = {
          x: lc.x + Math.cos(ang) * ls.w * BOLTS.EDGE_FACTOR,
          y: lc.y + Math.sin(ang) * ls.h * BOLTS.EDGE_FACTOR
        };
        const cols = [state.paleta.cian, state.paleta.magenta, state.paleta.rojo];
        const col = cols[Math.floor(Math.random() * cols.length)];
        // Dirección alterna logo↔mano / mano↔logo
        if (Math.random() < 0.5) createBolt(edge.x, edge.y, t.x, t.y, col);
        else createBolt(t.x, t.y, edge.x, edge.y, col);
      }
    }
  }
  for (let i = bolts.length - 1; i >= 0; i--) {
    bolts[i].life -= BOLTS.LIFE_DECAY * dt;
    if (bolts[i].life <= 0) bolts.splice(i, 1);
  }
}

export function draw(ctx, state) {
  if (!bolts.length) return;
  const p = state.paleta;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const b of bolts) {
    const a = Math.max(b.life, 0);
    // halo de color
    ctx.globalAlpha = a * BOLTS.HALO_ALPHA;
    ctx.strokeStyle = b.color;
    ctx.lineWidth = BOLTS.HALO_WIDTH;
    ctx.shadowBlur = BOLTS.HALO_SHADOW;
    ctx.shadowColor = b.color;
    pathBolt(ctx, b.pts);
    // núcleo blanco (filo)
    ctx.globalAlpha = a * BOLTS.CORE_ALPHA;
    ctx.strokeStyle = p.blanco;
    ctx.lineWidth = BOLTS.CORE_WIDTH;
    ctx.shadowBlur = 0;
    pathBolt(ctx, b.pts);
    // chispas en los extremos
    ctx.globalAlpha = a;
    ctx.fillStyle = p.blanco;
    ctx.beginPath();
    ctx.arc(b.pts[0].x, b.pts[0].y, BOLTS.SPARK_R, 0, Math.PI * 2);
    ctx.fill();
    const ultimo = b.pts[b.pts.length - 1];
    ctx.beginPath();
    ctx.arc(ultimo.x, ultimo.y, BOLTS.SPARK_R, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** ¿Hay rayos activos? (para el HUD) */
export function activos() {
  return bolts.length > 0;
}

export function reset() {
  bolts.length = 0;
}
