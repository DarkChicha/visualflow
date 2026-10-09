import { makeRng } from './rng.js';

const HEX = '0123456789ABCDEF';

// Dibuja un fotograma: video base + celdas fragmentadas. Independiente de la resolución (W,H).
export function drawFrame(ctx, video, vw, vh, view, cells, p, W, H, step) {
  const k = W / 1080;
  const { s, ox, oy } = view;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(video, ox, oy, vw * s, vh * s);
  if (!cells) return;

  const rng = makeRng(step * 7919 + 13);

  for (const c of cells) {
    if (c.mode === 'id' && c.depth < 2) continue; // celdas grandes sin cambio: no hace falta redibujar
    ctx.drawImage(video, c.sx, c.sy, c.sw, c.sh, c.x, c.y, c.w, c.h);
  }

  // bordes
  ctx.lineWidth = p.border * k;
  ctx.strokeStyle = `rgba(236,236,232,${p.borderAlpha})`;
  ctx.beginPath();
  for (const c of cells) ctx.rect(c.x + 0.5, c.y + 0.5, c.w - 1, c.h - 1);
  ctx.stroke();

  // texto técnico dentro de algunas celdas
  const fs = p.textSize * k;
  ctx.font = `${fs}px ui-monospace, Consolas, monospace`;
  ctx.textBaseline = 'top';
  ctx.fillStyle = `rgba(30,30,28,${p.textAlpha})`;
  for (const c of cells) {
    if (c.w < fs * 9 || c.h < fs * 3.2 || !rng.chance(p.textAmount)) continue;
    const lines = rng.chance(0.7)
      ? ['index  u  v  w  h', String((rng() * 900) | 0),
         (c.sx / vw).toFixed(6), (c.sy / vh).toFixed(6), (c.sw / vw).toFixed(6), (c.sh / vh).toFixed(6)]
      : hexDump(rng, Math.floor((c.h - fs) / (fs * 1.25)), c.w, fs);
    ctx.save();
    ctx.beginPath(); ctx.rect(c.x, c.y, c.w, c.h); ctx.clip();
    const maxLines = Math.floor((c.h - fs) / (fs * 1.25));
    lines.slice(0, Math.max(1, maxLines)).forEach((t, i) => ctx.fillText(t, c.x + fs * 0.6, c.y + fs * 0.5 + i * fs * 1.25));
    ctx.restore();
  }
}

function hexDump(rng, nLines, w, fs) {
  const out = [`proc[${(rng() * 99) | 0}]`];
  const cols = Math.max(2, Math.floor(w / (fs * 1.8)));
  for (let i = 0; i < Math.min(nLines, 10); i++) {
    let row = '';
    for (let j = 0; j < Math.min(cols, 4); j++) row += HEX[(rng() * 16) | 0] + HEX[(rng() * 16) | 0] + ' ';
    out.push(row);
  }
  return out;
}

// Ayuda visual: bbox de cara, puntos de interés y zona de fragmentación
export function drawDebug(ctx, face, zone, view, vw, vh, cells) {
  const X = (x) => x * vw * view.s + view.ox, Y = (y) => y * vh * view.s + view.oy;
  ctx.save();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#ff2d55'; ctx.strokeRect(zone.x, zone.y, zone.w, zone.h);
  if (face) {
    const b = face.bbox;
    ctx.strokeStyle = '#00e5ff'; ctx.strokeRect(X(b.x0), Y(b.y0), X(b.x1) - X(b.x0), Y(b.y1) - Y(b.y0));
    ctx.fillStyle = '#ffee00';
    for (const q of face.pts) { ctx.beginPath(); ctx.arc(X(q.x), Y(q.y), 6, 0, 7); ctx.fill(); }
  }
  ctx.restore();
}

export { };
