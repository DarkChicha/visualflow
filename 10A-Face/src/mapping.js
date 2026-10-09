import { makeRng } from './rng.js';

// Puntos de interés en coordenadas de video normalizadas (0..1).
// Con cara: rasgos reales (ojos, nariz, boca, orejas, mentón) + algunos puntos de cuello/hombros.
// Sin cara: nube gaussiana alrededor del sujeto de los faders.
export function pointsOfInterest(p, rng, face) {
  const pts = [];
  if (face) {
    const { x0, y0, x1, y1 } = face.bbox;
    const fw = x1 - x0, fh = y1 - y0, cx = (x0 + x1) / 2;
    for (const q of face.pts) pts.push({ x: q.x, y: q.y, k: q.k });
    for (let i = 0; i < 6; i++) { // cuello / hombros / pecho: textura de ropa y piel
      pts.push({ x: cx + rng.gauss() * fw * 1.2, y: y1 + fh * rng.range(0.15, 1.6), k: 'body' });
    }
    return pts;
  }
  for (let i = 0; i < 24; i++) {
    pts.push({ x: p.subjX + rng.gauss() * p.subjSize, y: p.subjY + rng.gauss() * p.subjSize * 1.2, k: 'free' });
  }
  return pts;
}

// Para cada celda decide qué región del video (en px del video) se dibuja.
// view = {s, ox, oy}: el video se ajusta con cover al canvas (px canvas = px video * s + offset).
export function mapCells(cells, seed, p, view, vw, vh, face) {
  const rng = makeRng(seed ^ 0x9e3779b9);
  const pois = pointsOfInterest(p, rng, face);
  const { s, ox, oy } = view;
  const jit = face ? (face.bbox.x1 - face.bbox.x0) * 0.08 : 0; // pequeño temblor alrededor del rasgo

  return cells.map((c) => {
    // región "natural": el trozo de video que hay bajo la celda
    let sx = (c.x - ox) / s, sy = (c.y - oy) / s;
    let sw = c.w / s, sh = c.h / s;
    let mode = 'id';
    const r = rng();
    const poi = pois[(rng() * pois.length) | 0];
    const px = (poi.x + rng.range(-1, 1) * jit) * vw, py = (poi.y + rng.range(-1, 1) * jit) * vh;

    if (r < p.pZoom) {
      mode = 'zoom';
      const z = rng.range(1.4, p.zoomMax);
      sw = c.w / s / z; sh = c.h / s / z;
      sx = px - sw / 2; sy = py - sh / 2;
    } else if (r < p.pZoom + p.pShift) {
      mode = 'shift';
      sx += rng.range(-1, 1) * p.shiftMax * vw;
      sy += rng.range(-1, 1) * p.shiftMax * vw;
    } else if (r < p.pZoom + p.pShift + p.pStreak) {
      mode = 'streak';
      if (c.w > c.h) { sh = p.streakW; sx = px - sw / 2; sy = py; } // tira horizontal: 1 línea estirada en vertical
      else { sw = p.streakW; sy = py - sh / 2; sx = px; }
    }

    // mantener la región dentro del video
    sw = Math.min(sw, vw); sh = Math.min(sh, vh);
    sx = Math.max(0, Math.min(vw - sw, sx));
    sy = Math.max(0, Math.min(vh - sh, sy));
    return { ...c, mode, poi: poi.k, sx, sy, sw, sh };
  });
}

// Zona rectangular (px canvas) donde se fragmenta: cabeza + torso alrededor de la cara.
export function zoneFor(p, view, vw, vh, face, W, H) {
  let cx, top, bot, halfW;
  if (face) {
    const { x0, y0, x1, y1 } = face.bbox;
    const fw = (x1 - x0) * vw * view.s, fh = (y1 - y0) * vh * view.s;
    cx = ((x0 + x1) / 2) * vw * view.s + view.ox;
    top = y0 * vh * view.s + view.oy - fh * p.zoneUp;
    bot = y0 * vh * view.s + view.oy + fh * p.zoneDown;
    halfW = fw * p.zoneW / 2;
  } else {
    cx = p.subjX * W; top = (p.subjY - p.subjSize * 1.6) * H; bot = (p.subjY + p.subjSize * 3) * H;
    halfW = p.subjSize * W * 1.5;
  }
  const x = Math.max(0, cx - halfW), x2 = Math.min(W, cx + halfW);
  const y = Math.max(0, top), y2 = Math.min(H, bot);
  return { x, y, w: Math.max(1, x2 - x), h: Math.max(1, y2 - y) };
}
