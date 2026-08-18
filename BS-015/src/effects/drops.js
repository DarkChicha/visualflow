/* ═══════════════════════════════════════════════════════════════
   BS-015 — effects/drops.js
   Gotas glitch: nacen SOLO de las yemas (rate ∝ energía) y NO dan
   energía (anti-bucle: son atmósfera). Caen con gravedad y deriva
   senoidal; render con aberración cromática (rojo/cian + blanco)
   y glitch periódico de slices horizontales. Al impactar (manos
   o suelo): burst de sparks.
   ═══════════════════════════════════════════════════════════════ */

import { H, DROPS, MOTION, CHARGE } from '../config.js';
import { burst } from './sparks.js';

const drops = [];

function spawnDrop(origin) {
  if (drops.length >= DROPS.MAX) return;
  drops.push({
    x: origin.x, y: origin.y,
    vy: DROPS.VY_INIT + Math.random() * DROPS.VY_RAND,
    size: DROPS.SIZE_MIN + Math.random() * DROPS.SIZE_RAND,
    hue: Math.random(),
    glitchT: 0,
    glitchTimer: DROPS.GLITCH_TIMER_MIN + Math.random() * DROPS.GLITCH_TIMER_RAND,
    cd: DROPS.COOLDOWN // no impacta al nacer (anti-bucle)
  });
}

export function update(dt, state) {
  // Nacen SOLO de yemas, en proporción a la energía convocada (m15: por dt)
  const f = state.motionReduced ? MOTION.EFFECTS_FACTOR : 1;
  const cargaN = Math.max(0, Math.min(1, state.carga / CHARGE.MAX));
  const mSpawn = 1 + (CHARGE.SPARK_SPAWN_MULT - 1) * cargaN; // más gotas con carga
  if (state.energy > DROPS.MIN_ENERGY && state.hands.length &&
      Math.random() < state.energy * DROPS.RATE_FACTOR * mSpawn * dt * 60 * f) {
    const tips = state.hands.flatMap(h => h.tips);
    if (tips.length) spawnDrop(tips[Math.floor(Math.random() * tips.length)]);
  }

  const allTips = state.hands.flatMap(h => h.tips);
  for (let i = drops.length - 1; i >= 0; i--) {
    const dp = drops[i];
    dp.vy += DROPS.GRAVITY * dt;
    dp.y += dp.vy * dt;
    dp.x += Math.sin(state.time * DROPS.SWAY_FREQ + dp.size) * DROPS.SWAY_AMP * dt;
    dp.glitchTimer -= dt;
    if (dp.glitchTimer <= 0) {
      dp.glitchT = DROPS.GLITCH_DUR_MIN + Math.random() * DROPS.GLITCH_DUR_RAND;
      dp.glitchTimer = DROPS.GLITCH_TIMER_MIN + Math.random() * DROPS.GLITCH_TIMER_RAND;
    }
    if (dp.glitchT > 0) dp.glitchT -= dt;
    if (dp.cd > 0) dp.cd -= dt;

    // Impacto: suelo o manos cercanas (solo tras el cooldown — m14:
    // el suelo tampoco puede romper el cooldown de nacimiento)
    let hit = false;
    if (dp.cd <= 0) {
      hit = dp.y > H - DROPS.FLOOR_MARGIN;
      if (!hit) {
        for (const t of allTips) {
          if (Math.hypot(t.x - dp.x, t.y - dp.y) < DROPS.IMPACT_HAND) { hit = true; break; }
        }
      }
    }
    if (hit) {
      const n = DROPS.BURST_MIN + Math.floor(Math.random() * DROPS.BURST_RAND);
      burst(dp.x, dp.y, dp.hue > 0.5 ? state.paleta.cian : state.paleta.magenta, n);
      drops.splice(i, 1);
    }
  }
}

/** Silueta de la gota (punta arriba, panza abajo). */
function dropPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.quadraticCurveTo(x - s, y - s * 0.3, x - s * 0.55, y + s * 0.45);
  ctx.quadraticCurveTo(x - s * 0.55, y + s * 1.0, x, y + s * 0.95);
  ctx.quadraticCurveTo(x + s * 0.55, y + s * 1.0, x + s * 0.55, y + s * 0.45);
  ctx.quadraticCurveTo(x + s, y - s * 0.3, x, y - s);
  ctx.closePath();
}

export function draw(ctx, state) {
  if (!drops.length) return;
  const p = state.paleta;
  const cargaN = Math.max(0, Math.min(1, state.carga / CHARGE.MAX));
  const mSize = 1 + (CHARGE.DROP_SIZE_MULT - 1) * cargaN; // más grandes con carga
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (const dp of drops) {
    const x = dp.x, y = dp.y, s = dp.size * mSize;
    const col = dp.hue > 0.5 ? p.cian : p.magenta;

    if (dp.glitchT > 0) {
      // MODO GLITCH: 3–5 slices horizontales con RGB split
      const nSlices = DROPS.SLICES_MIN + Math.floor(Math.random() * DROPS.SLICES_RAND);
      for (let k = 0; k < nSlices; k++) {
        const sy = y + (Math.random() - 0.5) * s * 2.4;
        const sh = DROPS.SLICE_H_MIN + Math.random() * DROPS.SLICE_H_RAND;
        const off = (Math.random() - 0.5) * DROPS.SLICE_OFF;
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = p.rojo;
        ctx.fillRect(x - s * 0.6 + off - DROPS.CHROMA_OFFSET, sy, s * 1.2, sh);
        ctx.fillStyle = p.cian;
        ctx.fillRect(x - s * 0.6 + off + DROPS.CHROMA_OFFSET, sy, s * 1.2, sh);
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.fillRect(x - s * 0.6 + off, sy, s * 1.2, sh);
      }
    }

    // Cuerpo: 3 pasadas = aberración cromática
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = p.rojo;
    dropPath(ctx, x - DROPS.CHROMA_OFFSET, y, s);
    ctx.fill();
    ctx.fillStyle = p.cian;
    dropPath(ctx, x + DROPS.CHROMA_OFFSET, y, s);
    ctx.fill();
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = col;
    dropPath(ctx, x, y, s);
    ctx.fill();

    // brillo interior
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(x - s * 0.2, y - s * 0.2, s * 0.24, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function reset() {
  drops.length = 0;
}
