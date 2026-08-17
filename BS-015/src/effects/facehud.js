/* ═══════════════════════════════════════════════════════════════
   BS-015 — effects/facehud.js
   Marco de esquinas (corner brackets) rojas con glow alrededor del
   faceBox real de la cara. SIN texto (se eliminó el lema).
   La sonrisa alimenta la energía en silencio (sin display).
   ═══════════════════════════════════════════════════════════════ */

import { FACEHUD } from '../config.js';

export function draw(ctx, state) {
  const f = state.face.box;
  if (!f) return;
  const p = state.paleta;
  const c = FACEHUD.CORNER_LEN;
  const pad = FACEHUD.PAD;
  const x0 = f.x - pad, y0 = f.y - pad;
  const x1 = f.x + f.w + pad, y1 = f.y + f.h + pad;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = p.rojo;
  ctx.shadowBlur = FACEHUD.GLOW;
  ctx.shadowColor = p.rojo;
  ctx.lineWidth = FACEHUD.LINE_WIDTH;
  ctx.lineCap = 'round';
  ctx.beginPath();
  // superior izquierda
  ctx.moveTo(x0 - c, y0); ctx.lineTo(x0, y0); ctx.lineTo(x0, y0 - c);
  // superior derecha
  ctx.moveTo(x1, y0 - c); ctx.lineTo(x1, y0); ctx.lineTo(x1 + c, y0);
  // inferior derecha
  ctx.moveTo(x1 + c, y1); ctx.lineTo(x1, y1); ctx.lineTo(x1, y1 + c);
  // inferior izquierda
  ctx.moveTo(x0, y1 + c); ctx.lineTo(x0, y1); ctx.lineTo(x0 - c, y1);
  ctx.stroke();
  ctx.restore();
}
