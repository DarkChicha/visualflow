/* ═══════════════════════════════════════════════════════════════
   BS-015 — effects/threads.js
   Hilos neón: 14 nodos flotantes con deriva lenta; conexiones
   (a) yemas L↔R espejadas, (b) yema → 2 nodos más cercanos,
   (c) nodos vecinos. Colores [rojo, rojo, blanco] alternados.
   ═══════════════════════════════════════════════════════════════ */

import { W, H, THREADS } from '../config.js';

// Nodos flotantes (anclas de los hilos): posición base fija + deriva
const nodes = THREADS.NODE_SEED.map((s, i) => ({
  bx: s[0] * W, by: s[1] * H, i, x: 0, y: 0
}));

// Paleta de hilos: [rojo, rojo, blanco] alternados
function colHilo(p, i) {
  return [p.rojo, p.rojo, p.blanco][i % 3];
}

export function update(dt, state) {
  const t = state.time;
  for (const n of nodes) {
    n.x = n.bx + Math.sin(t * THREADS.DRIFT_FREQ_X + n.i * 1.9) * THREADS.DRIFT_X;
    n.y = n.by + Math.cos(t * THREADS.DRIFT_FREQ_Y + n.i * 2.3) * THREADS.DRIFT_Y;
  }
}

export function draw(ctx, state) {
  const p = state.paleta;
  const intensity = THREADS.INTENSITY_BASE + state.energy * THREADS.INTENSITY_ENERGY;
  const handL = state.hands.find(h => h.handedness === 'Left');
  const handR = state.hands.find(h => h.handedness === 'Right');
  const tipsL = handL ? handL.tips : [];
  const tipsR = handR ? handR.tips : [];

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.lineWidth = THREADS.LINE_WIDTH;

  // 1) hilos tensados entre yemas espejadas (L ↔ R)
  if (tipsL.length && tipsR.length) {
    for (let i = 0; i < Math.min(tipsL.length, tipsR.length); i++) {
      const a = tipsL[i], b = tipsR[i];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < THREADS.DIST_MIRROR) {
        const col = colHilo(p, i);
        ctx.strokeStyle = col;
        ctx.globalAlpha = Math.min(
          THREADS.ALPHA_MIRROR,
          intensity + (1 - d / THREADS.DIST_MIRROR) * THREADS.ALPHA_MIRROR_DIST);
        ctx.shadowBlur = THREADS.SHADOW;
        ctx.shadowColor = col;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  }
  ctx.shadowBlur = 0;

  // 2) yemas → 2 nodos más cercanos
  const allTips = [...tipsL, ...tipsR];
  for (const t of allTips) {
    const near = nodes
      .map(n => ({ n, d: Math.hypot(n.x - t.x, n.y - t.y) }))
      .filter(o => o.d < THREADS.DIST_TIP_NODE)
      .sort((a, b) => a.d - b.d)
      .slice(0, 2);
    for (const o of near) {
      const col = colHilo(p, o.n.i); // m22: color estable por nodo (sin parpadeo temporal)
      ctx.strokeStyle = col;
      ctx.globalAlpha = THREADS.ALPHA_TIP_NODE * (1 - o.d / THREADS.DIST_TIP_NODE) * intensity;
      ctx.shadowBlur = THREADS.SHADOW;
      ctx.shadowColor = col;
      ctx.beginPath();
      ctx.moveTo(t.x, t.y);
      ctx.lineTo(o.n.x, o.n.y);
      ctx.stroke();
    }
  }
  ctx.shadowBlur = 0;

  // 3) nodos → nodos vecinos
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
      if (d < THREADS.DIST_NODE_NODE) {
        const col = colHilo(p, i + j);
        ctx.strokeStyle = col;
        ctx.globalAlpha = THREADS.ALPHA_NODE_NODE * (1 - d / THREADS.DIST_NODE_NODE) * intensity;
        ctx.shadowBlur = THREADS.SHADOW / 2;
        ctx.shadowColor = col;
        ctx.beginPath();
        ctx.moveTo(nodes[i].x, nodes[i].y);
        ctx.lineTo(nodes[j].x, nodes[j].y);
        ctx.stroke();
      }
    }
  }
  ctx.shadowBlur = 0;

  // nodos como puntos brillantes
  for (const n of nodes) {
    const col = colHilo(p, n.i);
    ctx.fillStyle = col;
    ctx.globalAlpha = THREADS.NODE_ALPHA;
    ctx.shadowBlur = THREADS.SHADOW;
    ctx.shadowColor = col;
    ctx.beginPath();
    ctx.arc(n.x, n.y, THREADS.NODE_R, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
