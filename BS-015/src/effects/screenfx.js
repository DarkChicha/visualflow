/* ═══════════════════════════════════════════════════════════════
   BS-015 — effects/screenfx.js
   Vibración por onda grave (kick) + zoom-pulso + vignette.
   Uso: beginFrame(ctx) → dibujar todo → endFrame(ctx).
   El HUD DOM queda fuera: NO vibra.
   amp = kick² × 30 + energy/100 × 2.6 ; zoom = 1 + kick × 0.006
   ═══════════════════════════════════════════════════════════════ */

import { W, H, SCREENFX, MOTION, CHARGE } from '../config.js';

const kicks = [];
let ampActual = 0;

// Vignette pre-renderizada (gradiente radial, alpha 0.55 en bordes)
const vig = document.createElement('canvas');
vig.width = W;
vig.height = H;
(function prerenderVignette() {
  const vc = vig.getContext('2d');
  const g = vc.createRadialGradient(
    W / 2, H / 2, H * SCREENFX.VIGNETTE_R_IN,
    W / 2, H / 2, H * SCREENFX.VIGNETTE_R_OUT);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${SCREENFX.VIGNETTE_ALPHA})`);
  vc.fillStyle = g;
  vc.fillRect(0, 0, W, H);
})();

/** Dispara una onda grave (kick del audio, pinch fuerte, tecla B). */
export function triggerKick() {
  kicks.push({ t: 1 });
}

export function update(dt, state) {
  for (let i = kicks.length - 1; i >= 0; i--) {
    kicks[i].t -= SCREENFX.KICK_DECAY * dt;
    if (kicks[i].t <= 0) kicks.splice(i, 1);
  }
  // M10: sin auto-kicks si prefers-reduced-motion (solo los reales del audio)
  if (!MOTION.AUTO_KICK_OFF && !state.motionReduced &&
      state.energy > SCREENFX.AUTO_KICK_ENERGY && Math.random() < SCREENFX.AUTO_KICK_PROB) {
    triggerKick();
  }
}

/** Kick actual (0-1): el máximo vivo. */
export function kickActual() {
  let k = 0;
  for (const kk of kicks) k = Math.max(k, kk.t);
  return k;
}

/**
 * Abre el frame: save + vibración + zoom. Todo el dibujo de la
 * pieza va entre beginFrame y endFrame (el HUD DOM no vibra).
 * @param {number} motionReduced  prefers-reduced-motion (M10)
 */
export function beginFrame(ctx, energy, motionReduced, carga = 0) {
  const kick = kickActual();
  // carga Kamehameha: suma vibración proporcional (tope = SCREEN_SHAKE_MAX px)
  const cargaN = Math.max(0, Math.min(1, carga / CHARGE.MAX));
  const ampCarga = cargaN * CHARGE.SCREEN_SHAKE_MAX;
  let amp = kick * kick * SCREENFX.AMP_KICK + (energy / 100) * SCREENFX.AMP_ENERGY + ampCarga;
  if (motionReduced) amp *= MOTION.SCREENFX_AMP;
  ampActual = amp;
  const zoom = 1 + kick * SCREENFX.ZOOM_KICK;
  ctx.save();
  if (ampActual > SCREENFX.AMP_MIN) {
    ctx.translate(
      (Math.random() - 0.5) * ampActual * 2,
      (Math.random() - 0.5) * ampActual * 2);
  }
  if (zoom !== 1) {
    ctx.translate(W / 2, H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-W / 2, -H / 2);
  }
}

/** Cierra el frame: la viñeta se dibuja con la matriz base (M1: sin ghosting) + restore. */
export function endFrame(ctx) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(vig, 0, 0);
  ctx.restore();
  ctx.restore(); // cierra el save de beginFrame
}

export function reset() {
  kicks.length = 0;
}
