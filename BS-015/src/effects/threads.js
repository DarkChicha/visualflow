/* ═══════════════════════════════════════════════════════════════
   BS-015 — effects/threads.js
   Hilos neón: 14 nodos flotantes con deriva lenta; conexiones
   (a) yemas L↔R espejadas, (b) yema → 2 nodos más cercanos,
   (c) nodos vecinos. Colores [rojo, rojo, blanco] alternados.

   Los hilos ENTRE MANOS son los protagonistas: si las palmas están
   cerca se dibujan siempre (sin corte por distancia), con trazo
   grueso, alpha alta y un núcleo blanco brillante (efecto filo).
   Además acumulan CARGA mientras las manos siguen juntas: cuanta
   más carga, más vibran (jitter perpendicular) y más glow tienen.
   ═══════════════════════════════════════════════════════════════ */

import { W, H, THREADS, MOTION, CHARGE } from '../config.js';

// Nodos flotantes (anclas de los hilos): posición base fija + deriva
const nodes = THREADS.NODE_SEED.map((s, i) => ({
  bx: s[0] * W, by: s[1] * H, i, x: 0, y: 0
}));

// Paleta de hilos: [rojo, rojo, blanco] alternados
function colHilo(p, i) {
  return [p.rojo, p.rojo, p.blanco][i % 3];
}

/** Distancia entre las dos palmas, o Infinity si no hay dos manos. */
function distPalmas(hands) {
  const l = hands.find(h => h.handedness === 'Left');
  const r = hands.find(h => h.handedness === 'Right');
  if (!l || !r) return Infinity;
  return Math.hypot(l.palm.x - r.palm.x, l.palm.y - r.palm.y);
}

/** Carga normalizada 0-1 (estado global Kamehameha). */
function cargaN(state) {
  return Math.max(0, Math.min(1, state.carga / CHARGE.MAX));
}

/**
 * Traza un hilo de a→b. Con amp > 0 lo dibuja como polilínea con
 * offset perpendicular aleatorio (vibración proporcional a la carga).
 */
function trazar(ctx, a, b, amp) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  if (amp > 0) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len; // normal unitaria del segmento
    for (let k = 1; k < THREADS.VIBRACION_SEGS; k++) {
      const f = k / THREADS.VIBRACION_SEGS;
      const off = (Math.random() - 0.5) * 2 * amp;
      ctx.lineTo(a.x + dx * f + nx * off, a.y + dy * f + ny * off);
    }
  }
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
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

  // 1) yemas → 2 nodos más cercanos
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

  // 2) nodos → nodos vecinos
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

  // 3) nodos como puntos brillantes
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
  ctx.shadowBlur = 0;

  /* 4) hilos ENTRE MANOS (yemas espejadas L↔R) — se dibujan los últimos
     para que queden por encima y dominen la lectura de la pieza. */
  const cerca = distPalmas(state.hands) < THREADS.MANOS_CERCA_DIST;
  const carga = cargaN(state); // 0-1, Kamehameha global
  // multiplicadores por carga (1 a carga 0 → crecen hasta el tope)
  const mGrosor = 1 + (CHARGE.THREAD_WIDTH_MULT - 1) * carga;
  const mGlow = 1 + (CHARGE.THREAD_GLOW_MULT - 1) * carga;
  const mVibra = 1 + (CHARGE.THREAD_VIBRA_MULT - 1) * carga;

  if (tipsL.length && tipsR.length) {
    // vibración proporcional a la carga (reducida si prefers-reduced-motion)
    const ampVibra = carga * THREADS.VIBRACION_CARGA * mVibra *
      (state.motionReduced ? MOTION.EFFECTS_FACTOR : 1);

    for (let i = 0; i < Math.min(tipsL.length, tipsR.length); i++) {
      const a = tipsL[i], b = tipsR[i];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const col = colHilo(p, i);

      if (cerca) {
        // MANOS CERCA: presencia fuerte y garantizada (sin corte por distancia)
        ctx.strokeStyle = col;
        ctx.globalAlpha = Math.min(1,
          THREADS.ENTRE_MANOS_ALPHA + carga * THREADS.ENTRE_MANOS_ALPHA_CARGA);
        ctx.lineWidth = THREADS.ENTRE_MANOS_WIDTH * mGrosor;
        ctx.shadowBlur = (THREADS.ENTRE_MANOS_SHADOW + carga * THREADS.ENTRE_MANOS_SHADOW_CARGA) * mGlow;
        ctx.shadowColor = col;
        trazar(ctx, a, b, ampVibra);

        // núcleo blanco brillante (efecto filo) sobre el mismo trazo
        ctx.strokeStyle = p.blanco;
        ctx.globalAlpha = THREADS.ENTRE_MANOS_CORE_ALPHA;
        ctx.lineWidth = THREADS.ENTRE_MANOS_CORE_WIDTH * mGrosor;
        ctx.shadowBlur = THREADS.ENTRE_MANOS_CORE_SHADOW * mGlow;
        ctx.shadowColor = p.blanco;
        trazar(ctx, a, b, ampVibra);

        ctx.lineWidth = THREADS.LINE_WIDTH; // se restaura para el resto
      } else {
        // MANOS LEJOS: hilo tensado clásico, pero NUNCA se pierde del todo
        // (piso de alpha) — con dos manos siempre hay hilos L↔R visibles
        ctx.strokeStyle = col;
        ctx.globalAlpha = Math.max(
          THREADS.ENTRE_MANOS_LEJOS_ALPHA,
          Math.min(THREADS.ALPHA_MIRROR,
            intensity + (1 - d / THREADS.DIST_MIRROR) * THREADS.ALPHA_MIRROR_DIST));
        ctx.lineWidth = THREADS.ENTRE_MANOS_LEJOS_WIDTH * mGrosor;
        ctx.shadowBlur = THREADS.SHADOW * mGlow;
        ctx.shadowColor = col;
        trazar(ctx, a, b, ampVibra); // la carga residual aún vibra al separarse
        ctx.lineWidth = THREADS.LINE_WIDTH;
      }
    }
  }

  ctx.restore();
}
