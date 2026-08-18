/* ═══════════════════════════════════════════════════════════════
   BS-015 — effects/sparks.js
   Partículas: chispas continuas de las yemas + bursts (pinch,
   impactos de gotas). Caen con gravedad leve y mueren por decay.
   ═══════════════════════════════════════════════════════════════ */

import { SPARKS, MOTION, CHARGE } from '../config.js';

const sparks = [];
let cargaActual = 0; // se lee en draw (el módulo no recibe state ahí)

function coloresPaleta(p) {
  return [p.cian, p.magenta, p.rojo];
}

export function spawnSpark(x, y, color) {
  if (sparks.length >= SPARKS.MAX) return;
  sparks.push({
    x, y,
    vx: (Math.random() - 0.5) * SPARKS.VEL,
    vy: (Math.random() - 0.5) * SPARKS.VEL - SPARKS.VEL_UP,
    life: 1,
    decay: SPARKS.DECAY_MIN + Math.random() * SPARKS.DECAY_RAND,
    color,
    size: SPARKS.SIZE_MIN + Math.random() * SPARKS.SIZE_RAND
  });
}

/** Burst de n sparks (impactos de gotas, pinch). */
export function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) spawnSpark(x, y, color);
}

/** Ráfaga dispersa de pinch (como el mockup: 26 chispas alrededor). */
export function burstPinch(x, y, paleta) {
  const cols = coloresPaleta(paleta);
  for (let i = 0; i < SPARKS.PINCH_BURST; i++) {
    spawnSpark(
      x + (Math.random() - 0.5) * SPARKS.PINCH_SCATTER,
      y + (Math.random() - 0.5) * SPARKS.PINCH_SCATTER,
      cols[Math.floor(Math.random() * cols.length)]
    );
  }
}

export function update(dt, state) {
  const f = state.motionReduced ? MOTION.EFFECTS_FACTOR : 1;
  const cargaN = Math.max(0, Math.min(1, state.carga / CHARGE.MAX));
  cargaActual = cargaN; // para el tamaño en draw
  const mSpawn = 1 + (CHARGE.SPARK_SPAWN_MULT - 1) * cargaN; // más chispas con carga
  // Chispas continuas de las yemas (m15: normalizada por dt; M10: reduced motion)
  if (state.hands.length && Math.random() < SPARKS.TIP_SPAWN_PROB * mSpawn * dt * 60 * f) {
    const tips = state.hands.flatMap(h => h.tips);
    if (tips.length) {
      const t = tips[Math.floor(Math.random() * tips.length)];
      const cols = coloresPaleta(state.paleta);
      spawnSpark(t.x, t.y, cols[Math.floor(Math.random() * cols.length)]);
    }
  }
  for (let i = sparks.length - 1; i >= 0; i--) {
    const p = sparks[i];
    p.life -= p.decay * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += SPARKS.GRAVITY * dt;
    if (p.life <= 0) sparks.splice(i, 1);
  }
}

export function draw(ctx) {
  if (!sparks.length) return;
  const mSize = 1 + (CHARGE.SPARK_SIZE_MULT - 1) * cargaActual; // más grandes con carga
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (const p of sparks) {
    ctx.globalAlpha = Math.max(p.life, 0);
    ctx.fillStyle = p.color;
    ctx.shadowBlur = SPARKS.GLOW * mSize;
    ctx.shadowColor = p.color;
    ctx.fillRect(p.x - p.size * mSize / 2, p.y - p.size * mSize / 2, p.size * mSize, p.size * mSize);
  }
  ctx.restore();
}

export function reset() {
  sparks.length = 0;
}
