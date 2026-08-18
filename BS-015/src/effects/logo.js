/* ═══════════════════════════════════════════════════════════════
   BS-015 — effects/logo.js
   El logo BARRETT elástico flotante (NUNCA se rompe):
   · Malla 18×9 vértices con física spring (K/DAMP/MASS) al reposo.
   · Fuerzas externas: repulsión de manos (<260px), shockwaves
     (anillo del pinch) y vibración proporcional a la energía.
   · Render por triángulo: clip() + transform afín (3 pares UV→XY)
     + drawImage, con blend 'screen' (el negro del PNG desaparece).
   · Flotación (deriva senoidal) aplicada como translate en el
     render: la física no se entera.
   · Pulso de escala alrededor del centro según energía.
   ═══════════════════════════════════════════════════════════════ */

import { LOGO, ASSETS, CHARGE } from '../config.js';

const img = new Image();
let imgW = 0, imgH = 0, ready = false;
let logoH = 0;      // alto real (por ratio del PNG)
let verts = [];     // vértices de la malla
let off = null;     // offscreen: malla renderizada UNA vez por frame (glow único, sin shadow por triángulo)
const waves = [];   // shockwaves (anillos del pinch)

/** Carga la imagen, construye la malla y el offscreen. Resolver cuando esté lista. */
export function init() {
  return new Promise(resolve => {
    img.onload = () => {
      imgW = img.naturalWidth;
      imgH = img.naturalHeight;
      logoH = Math.round(LOGO.W * (imgH / imgW));
      // Offscreen del logo + margen para el halo (el glow se aplica UNA vez al final)
      off = document.createElement('canvas');
      off.width = LOGO.W + LOGO.GLOW_MARGIN * 2;
      off.height = logoH + LOGO.GLOW_MARGIN * 2;
      buildMesh();
      ready = true;
      resolve();
    };
    img.onerror = () => {
      console.error('BS-015: no se pudo cargar el logo', ASSETS.LOGO);
      resolve(); // la pieza sigue sin logo (no bloquea)
    };
    img.src = ASSETS.LOGO;
  });
}

/** ¿El logo está listo para dibujarse? (los rayos lo consultan) */
export function listo() {
  return ready;
}

export function logoRect() {
  return {
    x: LOGO.CENTER_X - LOGO.W / 2,
    y: LOGO.CENTER_Y - logoH / 2,
    w: LOGO.W,
    h: logoH
  };
}

function buildMesh() {
  const r = logoRect();
  verts = [];
  for (let j = 0; j <= LOGO.GRID.rows; j++) {
    for (let i = 0; i <= LOGO.GRID.cols; i++) {
      const rx = r.x + (i / LOGO.GRID.cols) * r.w;
      const ry = r.y + (j / LOGO.GRID.rows) * r.h;
      verts.push({ rx, ry, x: rx, y: ry, vx: 0, vy: 0 });
    }
  }
}

function vAt(i, j) {
  return verts[j * (LOGO.GRID.cols + 1) + i];
}

/** Centro del logo CON deriva de flotación (para los rayos). */
export function logoCenter(time) {
  return {
    x: LOGO.CENTER_X + Math.sin(time * LOGO.DRIFT_X_FREQ) * LOGO.DRIFT_X_AMP,
    y: LOGO.CENTER_Y + Math.cos(time * LOGO.DRIFT_Y_FREQ) * LOGO.DRIFT_Y_AMP
  };
}

/** Tamaño actual del logo (los rayos lo usan para el borde). */
export function logoSize() {
  return { w: LOGO.W, h: logoH };
}

/** Shockwave (anillo) desde el punto del pinch. */
export function addWave(x, y, strength = LOGO.WAVE_STRENGTH) {
  waves.push({ x, y, r: 10, strength, t: LOGO.WAVE_LIFE });
}

/* Transformación afín: (u,v) → (x,y) para 3 pares de puntos */
function affine(u0, v0, x0, y0, u1, v1, x1, y1, u2, v2, x2, y2) {
  const det = u0 * (v1 - v2) + u1 * (v2 - v0) + u2 * (v0 - v1);
  if (Math.abs(det) < 1e-9) return null;
  const a = (x0 * (v1 - v2) + x1 * (v2 - v0) + x2 * (v0 - v1)) / det;
  const b = (y0 * (v1 - v2) + y1 * (v2 - v0) + y2 * (v0 - v1)) / det;
  const c = (x0 * (u2 - u1) + x1 * (u0 - u2) + x2 * (u1 - u0)) / det;
  const d = (y0 * (u2 - u1) + y1 * (u0 - u2) + y2 * (u1 - u0)) / det;
  const e = x0 - a * u0 - c * v0;
  const f = y0 - b * u0 - d * v0;
  return { a, b, c, d, e, f };
}

function drawTri(ctx, u0, v0, x0, y0, u1, v1, x1, y1, u2, v2, x2, y2) {
  const m = affine(u0, v0, x0, y0, u1, v1, x1, y1, u2, v2, x2, y2);
  if (!m) return;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.closePath();
  ctx.clip();
  // ctx.transform (NO setTransform): post-multiplica la matriz base
  // (DPR/shake/flotación) → el triángulo queda alineado con su clip.
  // setTransform reemplazaría la matriz y descuadraría el logo (C1 revisión Opus).
  ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

/* ── Física de la malla ── */
export function update(dt, state) {
  if (!ready) return;
  const energy = state.energy;
  const palms = state.hands.map(h => h.palm);

  for (const v of verts) {
    // resorte al reposo
    let ax = (v.rx - v.x) * LOGO.K;
    let ay = (v.ry - v.y) * LOGO.K;
    // repulsión de manos cercanas
    for (const h of palms) {
      const dx = v.x - h.x, dy = v.y - h.y;
      const d = Math.hypot(dx, dy);
      if (d < LOGO.REPULSE_RADIUS && d > 0.1) {
        const f = (1 - d / LOGO.REPULSE_RADIUS) * LOGO.REPULSE_FORCE;
        ax += (dx / d) * f;
        ay += (dy / d) * f;
      }
    }
    // shockwaves (anillo en expansión)
    for (const wv of waves) {
      const dx = v.x - wv.x, dy = v.y - wv.y;
      const d = Math.hypot(dx, dy);
      const distToRing = Math.abs(d - wv.r);
      if (distToRing < LOGO.WAVE_RING_WIDTH) {
        const f = (1 - distToRing / LOGO.WAVE_RING_WIDTH) * wv.strength * LOGO.WAVE_FORCE;
        ax += (dx / Math.max(d, 1)) * f;
        ay += (dy / Math.max(d, 1)) * f;
      }
    }
    // vibración por energía: (rand-0.5) × energy × 0.06 × 60
    ax += (Math.random() - 0.5) * energy * LOGO.VIBRATION_FORCE * 60;
    ay += (Math.random() - 0.5) * energy * LOGO.VIBRATION_FORCE * 60;

    v.vx += (ax / LOGO.MASS) * dt;
    v.vy += (ay / LOGO.MASS) * dt;
    v.vx *= Math.max(0, 1 - LOGO.DAMP * dt);
    v.vy *= Math.max(0, 1 - LOGO.DAMP * dt);
    v.x += v.vx * dt;
    v.y += v.vy * dt;
    // Clamp por vértice: sin tope la celda se invierte y el logo "se rompe" (M6)
    const cellW = LOGO.W / LOGO.GRID.cols;
    const cellH = logoH / LOGO.GRID.rows;
    const cw = cellW * LOGO.CELL_CLAMP;
    const ch = cellH * LOGO.CELL_CLAMP;
    v.x = v.rx + Math.max(-cw, Math.min(cw, v.x - v.rx));
    v.y = v.ry + Math.max(-ch, Math.min(ch, v.y - v.ry));
  }

  // shockwaves: expansión y decaimiento
  for (let i = waves.length - 1; i >= 0; i--) {
    const wv = waves[i];
    wv.r += LOGO.WAVE_SPEED * dt;
    wv.t -= dt;
    wv.strength *= Math.max(0, 1 - LOGO.WAVE_FADE * dt);
    if (wv.t <= -0.6) waves.splice(i, 1);
  }
}

export function draw(ctx, state) {
  const p = state.paleta;
  const energy = state.energy;
  const time = state.time;

  // anillos de shockwave (debajo del logo)
  if (waves.length) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const wv of waves) {
      const a = Math.max(wv.t, 0) * 1.6;
      ctx.globalAlpha = Math.max(a, 0);
      ctx.strokeStyle = p.blanco;
      ctx.lineWidth = 2.4 * a + 0.4;
      ctx.shadowBlur = 22;
      ctx.shadowColor = p.magenta;
      ctx.beginPath();
      ctx.arc(wv.x, wv.y, wv.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (!ready) return;

  // Pulso de escala: respiración + energía + tembleque rápido
  const pulse = 1
    + Math.sin(time * LOGO.PULSE_BASE_FREQ) * LOGO.PULSE_BASE_AMP
    + (energy / 100) * LOGO.PULSE_ENERGY
    + Math.sin(time * LOGO.PULSE_FAST_FREQ) * LOGO.PULSE_FAST_AMP
      * Math.min(energy, LOGO.PULSE_FAST_CAP) / LOGO.PULSE_FAST_CAP;
  const sxp = LOGO.CENTER_X, syp = LOGO.CENTER_Y;
  const m = LOGO.GLOW_MARGIN;
  const r = logoRect();

  // 1) Render de la malla deformada en el offscreen (SIN sombra por triángulo:
  //    el glow se aplica una sola vez abajo → 60 fps y halo visible, C2)
  const oc = off.getContext('2d');
  oc.clearRect(0, 0, off.width, off.height);
  oc.save();
  oc.translate(m, m); // margen del halo
  for (let j = 0; j < LOGO.GRID.rows; j++) {
    for (let i = 0; i < LOGO.GRID.cols; i++) {
      const a = vAt(i, j), b = vAt(i + 1, j), c = vAt(i, j + 1), d = vAt(i + 1, j + 1);
      // vértices escalados alrededor del centro (pulso) y relativos al rect + margen
      const ax = sxp + (a.x - sxp) * pulse, ay = syp + (a.y - syp) * pulse;
      const bx = sxp + (b.x - sxp) * pulse, by = syp + (b.y - syp) * pulse;
      const cx = sxp + (c.x - sxp) * pulse, cy = syp + (c.y - syp) * pulse;
      const dx = sxp + (d.x - sxp) * pulse, dy = syp + (d.y - syp) * pulse;
      // UV de la celda en el espacio de la imagen
      const au = (i / LOGO.GRID.cols) * imgW;
      const av = (j / LOGO.GRID.rows) * imgH;
      const bu = ((i + 1) / LOGO.GRID.cols) * imgW;
      const bv = av;
      const cu = au;
      const cvv = ((j + 1) / LOGO.GRID.rows) * imgH;
      const du = bu;
      const dv = cvv;
      drawTri(oc, au, av, ax - r.x + m, ay - r.y + m, bu, bv, bx - r.x + m, by - r.y + m, cu, cvv, cx - r.x + m, cy - r.y + m);
      drawTri(oc, bu, bv, bx - r.x + m, by - r.y + m, du, dv, dx - r.x + m, dy - r.y + m, cu, cvv, cx - r.x + m, cy - r.y + m);
    }
  }
  oc.restore();

  // 2) Un solo drawImage del offscreen en el canvas principal, con glow y 'screen'
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  // Flotación: deriva aplicada en el render (la física no se entera)
  const fc = logoCenter(time);
  ctx.translate(fc.x - LOGO.CENTER_X, fc.y - LOGO.CENTER_Y);
  // Glow base + energía + carga Kamehameha (halo más intenso al cargar)
  const cargaN = Math.max(0, Math.min(1, state.carga / CHARGE.MAX));
  const mGlow = 1 + (CHARGE.LOGO_GLOW_MULT - 1) * cargaN;
  ctx.shadowBlur = (LOGO.SHADOW_BASE + energy * LOGO.SHADOW_ENERGY) * mGlow;
  ctx.shadowColor = 'rgba(255,255,255,0.55)';
  ctx.drawImage(off, r.x - m, r.y - m);
  ctx.restore();
}

export function reset() {
  waves.length = 0;
  if (ready) buildMesh();
}
