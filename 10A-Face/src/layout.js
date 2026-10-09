import { makeRng } from './rng.js';

// Subdivisión recursiva tipo treemap dentro de un rectángulo `zone`. Devuelve hojas {x,y,w,h,depth,id}.
// `depthLimit` es continuo: la fracción decide la probabilidad de cortar en el último nivel.
// k = escala de resolución (W/1080) para los mínimos en px.
export function generateLayout(seed, p, zone, depthLimit, k) {
  const rng = makeRng(seed);
  const cells = [];
  const minCell = p.minCell * k;
  let id = 0;

  const split = (x, y, w, h, depth) => {
    const canSplit = depth < Math.ceil(depthLimit) && w > minCell * 2 && h > minCell * 2;
    const lastLevel = depth >= Math.floor(depthLimit);
    const stop = !canSplit || (lastLevel && rng() > depthLimit - Math.floor(depthLimit)) || (depth > 1 && rng() < 0.12);
    if (stop) { cells.push({ x, y, w, h, depth, id: id++ }); return; }

    // corta el lado más largo con sesgo, para que haya tiras largas como en la referencia
    const vertical = w * rng.range(0.7, 1.5) > h * rng.range(0.7, 1.5);
    const r = rng.chance(0.25) ? rng.range(0.5, 0.62) : rng.range(p.splitMin, 1 - p.splitMin);
    if (vertical) {
      const cw = Math.max(minCell, Math.min(w - minCell, w * r));
      split(x, y, cw, h, depth + 1);
      split(x + cw, y, w - cw, h, depth + 1);
    } else {
      const ch = Math.max(minCell, Math.min(h - minCell, h * r));
      split(x, y, w, ch, depth + 1);
      split(x, y + ch, w, h - ch, depth + 1);
    }
  };

  split(zone.x, zone.y, zone.w, zone.h, 0);
  return cells;
}
