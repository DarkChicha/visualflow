import { Pane } from 'tweakpane';
import { defaults } from './params.js';
import { generateLayout } from './layout.js';
import { mapCells, zoneFor } from './mapping.js';
import { drawFrame, drawDebug } from './render.js';
import { controlAt } from './signals.js';
import { analyzeVideo, faceAt } from './face.js';

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const video = document.getElementById('v');
const W = canvas.width, H = canvas.height;

const p = { ...defaults };
try { Object.assign(p, JSON.parse(localStorage.getItem('10a-face-params-v2') || '{}')); } catch {}

// ---------- fuente de video ----------
let track = null, faceStatus = 'sin analizar';
const status = { face: faceStatus };
async function loadSource(url) {
  track = null; status.face = 'analizando…'; cache = { key: '', cells: null };
  video.src = url;
  video.play().catch(() => {});
  try {
    const tr = await analyzeVideo(url, 12, (f) => { status.face = `analizando ${(f * 100) | 0}%`; paneRefresh(); });
    if (video.src && url) track = tr;
    const hit = tr.samples.filter((s) => !s.none).length;
    status.face = `cara en ${hit}/${tr.samples.length} muestras`;
  } catch (e) {
    status.face = 'error: ' + e.message;
  }
  paneRefresh();
}
let paneRefresh = () => {};
const qs = new URLSearchParams(location.search);
const startUrl = qs.get('src') || './video/clip.mp4';

const drop = document.getElementById('drop');
addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('on'); });
addEventListener('dragleave', () => drop.classList.remove('on'));
addEventListener('drop', (e) => {
  e.preventDefault(); drop.classList.remove('on');
  const f = e.dataTransfer.files[0];
  if (f) loadSource(URL.createObjectURL(f));
});

// ---------- loop ----------
let paused = false, cache = { key: '', cells: null }, lastStats = { cells: 0, g: 0 };

function frame() {
  requestAnimationFrame(frame);
  render();
}

// Vista del video en el canvas: cover + zoom fijo sobre la cara media (px canvas = px video * s + offset)
function viewFor(vw, vh) {
  const cover = Math.max(W / vw, H / vh);
  const z = Math.max(1, p.frameZoom);
  const s = cover * z;
  let ox = (W - vw * s) / 2, oy = (H - vh * s) / 2;
  const m = track && track.mean;
  if (z > 1 && m) {
    ox = W / 2 - m.cx * vw * s;
    oy = H * p.frameY - m.cy * vh * s;
  }
  ox = Math.min(0, Math.max(W - vw * s, ox));
  oy = Math.min(0, Math.max(H - vh * s, oy));
  return { s, ox, oy };
}

function render() {
  if (video.readyState < 2) return;
  const vw = video.videoWidth, vh = video.videoHeight;
  const t = video.currentTime;
  const g = controlAt(t, p).intensity;
  const step = Math.floor(t * p.holdFps);

  const view = viewFor(vw, vh);
  const face = faceAt(track, t);
  const zone = zoneFor(p, view, vw, vh, face, W, H);

  let cells = null;
  if (g > 0.04) {
    const depth = g * p.maxDepth;
    const key = [step, p.seed, depth.toFixed(2), p.minCell, p.splitMin, p.pZoom, p.pShift, p.pStreak,
      p.zoomMax, p.shiftMax, p.streakW, p.subjX, p.subjY, p.subjSize, p.zoneW, p.zoneUp, p.zoneDown,
      p.frameZoom, p.frameY,
      face ? face.t : 'x', vw, vh].join('|');
    if (cache.key !== key) {
      const layout = generateLayout(p.seed * 100003 + step, p, zone, depth, W / 1080);
      cache = { key, cells: mapCells(layout, p.seed * 100003 + step, p, view, vw, vh, face) };
    }
    cells = cache.cells;
  }
  drawFrame(ctx, video, vw, vh, view, cells, p, W, H, step);
  if (p.debug) drawDebug(ctx, face, zone, view, vw, vh, cells);
  lastStats = { cells: cells ? cells.length : 0, g, face: !!face, zone };
  window.__stats = lastStats;
}
requestAnimationFrame(frame);
Object.assign(window, { __p: p, __render: render, __status: status, __track: () => track });

// ---------- faders ----------
const pane = new Pane({ title: '10A-Face · Fragment' });
const f = (folder, key, opts = {}) => folder.addBinding(p, key, opts);

const fMain = pane.addFolder({ title: 'Intensidad' });
f(fMain, 'intensity', { min: 0, max: 1, step: 0.01 });
f(fMain, 'auto'); f(fMain, 'autoRate', { min: 0.05, max: 2, step: 0.01 });
f(fMain, 'autoClean', { min: 0, max: 0.8, step: 0.01 });
f(fMain, 'seed', { min: 0, max: 999, step: 1 });

const fLay = pane.addFolder({ title: 'Layout' });
f(fLay, 'maxDepth', { min: 1, max: 10, step: 1 });
f(fLay, 'splitMin', { min: 0.05, max: 0.45, step: 0.01 });
f(fLay, 'minCell', { min: 20, max: 300, step: 1 });
f(fLay, 'holdFps', { min: 1, max: 30, step: 1 });

const fMap = pane.addFolder({ title: 'Contenido de celdas' });
f(fMap, 'pZoom', { min: 0, max: 1, step: 0.01 });
f(fMap, 'pShift', { min: 0, max: 1, step: 0.01 });
f(fMap, 'pStreak', { min: 0, max: 1, step: 0.01 });
f(fMap, 'zoomMax', { min: 1.2, max: 8, step: 0.1 });
f(fMap, 'shiftMax', { min: 0, max: 0.5, step: 0.01 });
f(fMap, 'streakW', { min: 1, max: 12, step: 1 });

const fFrame = pane.addFolder({ title: 'Encuadre' });
f(fFrame, 'frameZoom', { min: 1, max: 4, step: 0.05 });
f(fFrame, 'frameY', { min: 0.1, max: 0.7, step: 0.01 });

const fZone = pane.addFolder({ title: 'Zona alrededor de la cara' });
const stBind = fZone.addBinding(status, 'face', { readonly: true, label: 'análisis' });
paneRefresh = () => stBind.refresh();
f(fZone, 'zoneW', { min: 1, max: 8, step: 0.1 });
f(fZone, 'zoneUp', { min: 0, max: 3, step: 0.1 });
f(fZone, 'zoneDown', { min: 1, max: 12, step: 0.1 });
f(fZone, 'debug');
const fSub = pane.addFolder({ title: 'Sujeto de respaldo (sin cara)', expanded: false });
f(fSub, 'subjX', { min: 0, max: 1, step: 0.01 });
f(fSub, 'subjY', { min: 0, max: 1, step: 0.01 });
f(fSub, 'subjSize', { min: 0.02, max: 0.5, step: 0.01 });

const fLook = pane.addFolder({ title: 'Aspecto' });
f(fLook, 'border', { min: 0, max: 8, step: 0.1 });
f(fLook, 'borderAlpha', { min: 0, max: 1, step: 0.01 });
f(fLook, 'textAmount', { min: 0, max: 1, step: 0.01 });
f(fLook, 'textSize', { min: 8, max: 40, step: 1 });
f(fLook, 'textAlpha', { min: 0, max: 1, step: 0.01 });

pane.addButton({ title: 'Guardar preset (descargar JSON)' }).on('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' }));
  a.download = 'preset-fragment.json'; a.click();
});
pane.addButton({ title: 'Restablecer' }).on('click', () => {
  Object.assign(p, defaults); pane.refresh();
});
pane.on('change', () => { try { localStorage.setItem('10a-face-params-v2', JSON.stringify(p)); } catch {} });

loadSource(startUrl);

// ---------- teclado ----------
addEventListener('keydown', (e) => {
  if (e.key === ' ') { e.preventDefault(); paused = !paused; paused ? video.pause() : video.play(); }
  else if (e.key === 'r' || e.key === 'R') { p.seed = (Math.random() * 999) | 0; pane.refresh(); }
  else if (e.key === 's' || e.key === 'S') { video.muted = !video.muted; }
  else if (e.key === 'h' || e.key === 'H') {
    pane.hidden = !pane.hidden;
    document.getElementById('hint').style.display = pane.hidden ? 'none' : '';
  }
});
