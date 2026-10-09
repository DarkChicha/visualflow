// Pre-análisis de cara: recorre el video por seek y guarda, por tiempo, bbox + puntos de interés.
// En vivo (cámara) esta misma salida se produce fotograma a fotograma.
const CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

// Índices de FaceMesh (478 pts con iris) que usamos como puntos de interés
const FEATURES = {
  eyeL: [468], eyeR: [473], nose: [1], mouth: [13, 14], lipL: [61], lipR: [291],
  earL: [234], earR: [454], chin: [152], brow: [10], cheekL: [50], cheekR: [280]
};

let landmarkerP = null;
async function getLandmarker() {
  if (!landmarkerP) {
    landmarkerP = (async () => {
      const vision = await import(/* @vite-ignore */ `${CDN}/vision_bundle.mjs`);
      const fileset = await vision.FilesetResolver.forVisionTasks(`${CDN}/wasm`);
      const make = (delegate) => vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL, delegate },
        runningMode: 'IMAGE', numFaces: 1
      });
      try { return await make('GPU'); } catch { return await make('CPU'); }
    })();
  }
  return landmarkerP;
}

function sampleFrom(lm, t) {
  let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
  for (const q of lm) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
  const pts = [];
  for (const [k, idx] of Object.entries(FEATURES)) {
    let x = 0, y = 0;
    for (const i of idx) { x += lm[i].x; y += lm[i].y; }
    pts.push({ k, x: x / idx.length, y: y / idx.length });
  }
  return { t, bbox: { x0, y0, x1, y1 }, pts };
}

// Devuelve [{t, bbox, pts}|null ...] a `fps` muestras por segundo.
export async function analyzeVideo(url, fps = 12, onProgress = () => {}) {
  const lmk = await getLandmarker();
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.crossOrigin = 'anonymous'; v.src = url;
  await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error('video')); });
  const n = Math.floor(v.duration * fps);
  const track = [];
  for (let i = 0; i < n; i++) {
    const t = i / fps;
    v.currentTime = t;
    await new Promise((r) => v.addEventListener('seeked', r, { once: true }));
    const res = lmk.detect(v);
    track.push(res.faceLandmarks && res.faceLandmarks[0] ? sampleFrom(res.faceLandmarks[0], t) : { t, none: true });
    if (i % 6 === 0) onProgress(i / n);
  }
  onProgress(1);
  // cara media de todo el clip → encuadre virtual estable (sin temblor)
  const hits = track.filter((s) => !s.none);
  let mean = null;
  if (hits.length) {
    const m = (f) => hits.reduce((a, s) => a + f(s.bbox), 0) / hits.length;
    mean = { cx: m((b) => (b.x0 + b.x1) / 2), cy: m((b) => (b.y0 + b.y1) / 2), w: m((b) => b.x1 - b.x0), h: m((b) => b.y1 - b.y0) };
  }
  return { fps, duration: v.duration, samples: track, mean };
}

// Muestra más cercana con cara (tolerancia 0.5 s); null si no hay
export function faceAt(track, t) {
  if (!track) return null;
  const i = Math.min(track.samples.length - 1, Math.max(0, Math.round(t * track.fps)));
  for (let d = 0; d <= track.fps * 0.5; d++) {
    for (const j of [i - d, i + d]) {
      const s = track.samples[j];
      if (s && !s.none) return s;
    }
  }
  return null;
}
