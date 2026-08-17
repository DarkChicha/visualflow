/* ═══════════════════════════════════════════════════════════════
   BS-015 — tracker.js
   MediaPipe Tasks API (CDN): HandLandmarker GPU (2 manos) +
   FaceLandmarker con blendshapes (1 cara). Inferencia desacoplada
   del render con caps de FPS (hands ~20fps, face ~10fps).

   Correcciones de la revisión Opus aplicadas:
   · C4  — mapeo tipo cover (sin estirar 16:9 → 9:16), con las
           dimensiones REALES del stream (videoWidth/Height).
   · M4  — identidad estable de manos resuelta ANTES de filtrar
           (asignación exclusiva por cercanía a los bancos de filtros).
   · M5  — try/catch en el bucle: un throw no mata el tracking;
           tras N fallos degrada a modo demo.
   · M9  — facingMode 'user' + constraints con ideal (sin fallar).
   · m4  — getUserMedia PRIMERO (el permiso decide) y los modelos
           se cargan después con timeout → modo demo.
   · m5  — stop() cierra los landmarkers (sin fugas WASM/GPU).
   · m7  — timestamps renombrados (lastManosTime / lastFaceTime).
   ═══════════════════════════════════════════════════════════════ */

import { W, H, TRACKER } from './config.js';
import { OneEuroFilter } from './smoothing.js';

const NUM_LANDMARKS_MANO = 21;
const DAMP_MS = 0.1; // techo del dt del filtro (s)

class Tracker {
  constructor() {
    this.handsCb = null;
    this.faceCb = null;
    this.onDegradacionCb = null;
    this.stream = null;
    this.video = null;
    this.handLandmarker = null;
    this.faceLandmarker = null;
    this.activo = false;
    this.lastManosTime = 0;
    this.lastFaceTime = 0;
    this.lastVideoTime = -1;
    this.camW = TRACKER.CAM_W;
    this.camH = TRACKER.CAM_H;
    this.fallos = 0;
    // Bancos de filtros con identidad estable (One-Euro por coordenada
    // y por landmark); la asignación mano→banco es por cercanía (M4).
    this.bancos = [this._banco(), this._banco()];
    this.filtroSmile = new OneEuroFilter(TRACKER.SMILE_MIN_CUTOFF, TRACKER.ONE_EURO_BETA, TRACKER.ONE_EURO_D_CUTOFF);
    this.prevSmile = null;
  }

  _banco() {
    return {
      filtros: Array.from({ length: NUM_LANDMARKS_MANO }, () => ({
        x: new OneEuroFilter(TRACKER.ONE_EURO_MIN_CUTOFF, TRACKER.ONE_EURO_BETA, TRACKER.ONE_EURO_D_CUTOFF),
        y: new OneEuroFilter(TRACKER.ONE_EURO_MIN_CUTOFF, TRACKER.ONE_EURO_BETA, TRACKER.ONE_EURO_D_CUTOFF)
      })),
      prev: null,       // landmarks filtrados del frame anterior
      handedness: null  // 'Left' | 'Right' (fijada en el primer frame)
    };
  }

  onHands(cb) { this.handsCb = cb; }
  onFace(cb) { this.faceCb = cb; }
  onDegradacion(cb) { this.onDegradacionCb = cb; }

  /** Carga el runtime + los dos modelos desde CDN. */
  async _cargarModelos() {
    const vision = await import(/* @vite-ignore */ TRACKER.CDN);
    const fileset = await vision.FilesetResolver.forVisionTasks(TRACKER.WASM_BASE);
    this.handLandmarker = await vision.HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: TRACKER.HAND_MODEL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numHands: TRACKER.NUM_HANDS
    });
    this.faceLandmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: TRACKER.FACE_MODEL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      outputFaceBlendshapes: true,
      numFaces: TRACKER.NUM_FACES
    });
  }

  /**
   * Arranca cámara + modelos y empieza la inferencia en bucle.
   * Orden: cámara PRIMERO (el permiso decide), modelos después con
   * timeout (m4). Lanza excepción → main.js entra en modo demo.
   */
  async start(videoEl) {
    this.video = videoEl;
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: TRACKER.CAM_W },
        height: { ideal: TRACKER.CAM_H }
        // NO forzamos aspectRatio: el sensor selfie de muchos celulares es
        // landscape; forzar 9:16 provoca crop/zoom (teleobjetivo). El
        // tracker mapea con cover cualquier resolución real al lienzo 9:16.
      },
      audio: false
    });
    videoEl.srcObject = this.stream;
    await videoEl.play();
    // Dimensiones REALES del stream (el navegador puede conceder otra resolución)
    this.camW = videoEl.videoWidth || TRACKER.CAM_W;
    this.camH = videoEl.videoHeight || TRACKER.CAM_H;
    await Promise.race([
      this._cargarModelos(),
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error('timeout cargando modelos MediaPipe')), TRACKER.MODEL_TIMEOUT))
    ]);
    this.activo = true;
    this._bucle();
  }

  /** Detiene cámara, inferencia y cierra los landmarkers (sin fugas). */
  stop() {
    this.activo = false;
    try { if (this.handLandmarker) this.handLandmarker.close(); } catch (e) { /* noop */ }
    try { if (this.faceLandmarker) this.faceLandmarker.close(); } catch (e) { /* noop */ }
    this.handLandmarker = null;
    this.faceLandmarker = null;
    if (this.stream) {
      for (const t of this.stream.getTracks()) t.stop();
      this.stream = null;
    }
    if (this.video) this.video.srcObject = null;
  }

  /** Bucle de inferencia: rAF propio, caps por modalidad, try/catch (M5). */
  _bucle() {
    if (!this.activo) return;
    try {
      const v = this.video;
      if (v && v.readyState >= 2 && v.currentTime !== this.lastVideoTime) {
        this.lastVideoTime = v.currentTime;
        const now = performance.now();
        if (now - this.lastManosTime >= TRACKER.HANDS_CAP_MS) {
          const prev = this.lastManosTime;
          this.lastManosTime = now;
          this._inferirManos(now, prev);
        }
        if (now - this.lastFaceTime >= TRACKER.FACE_CAP_MS) {
          this.lastFaceTime = now;
          this._inferirCara(now);
        }
      }
      this.fallos = 0;
    } catch (e) {
      // Un throw de MediaPipe no debe congelar el tracking en silencio:
      // se registra y, si persiste, se degrada a modo demo.
      console.warn('BS-015 tracker:', e);
      this.fallos++;
      if (this.fallos >= 30) {
        this.stop();
        if (this.onDegradacionCb) this.onDegradacionCb();
        return;
      }
    }
    requestAnimationFrame(() => this._bucle());
  }

  /**
   * Mapeo tipo cover (C4): landmarks normalizados [0-1] → píxeles de
   * lienzo 9:16 SIN estirar; x espejado (1-x) por cámara frontal.
   */
  _mapa(p) {
    const s = Math.max(W / this.camW, H / this.camH);
    const offX = (W - this.camW * s) / 2;
    const offY = (H - this.camH * s) / 2;
    return { x: offX + (1 - p.x) * this.camW * s, y: offY + p.y * this.camH * s };
  }

  _inferirManos(now, lastTs) {
    const res = this.handLandmarker.detectForVideo(this.video, now);
    if (!res.landmarks || !res.landmarks.length) {
      if (this.handsCb) this.handsCb([]);
      return;
    }
    // M4: identidad estable ANTES de filtrar. Cada mano detectada se
    // asigna al banco de filtros cuyo historial esté más cerca (ref:
    // yema del índice), con exclusión mutua (una mano por banco).
    const candidatos = res.landmarks.map((lm, i) => ({
      lm,
      handednessRaw: res.handedness[i][0].categoryName,
      ref: { x: (1 - lm[8].x) * W, y: lm[8].y * H }
    }));
    const asignacion = [];
    const usados = new Set();
    for (const cand of candidatos) {
      let mejor = -1, mejorD = Infinity;
      for (let b = 0; b < this.bancos.length; b++) {
        if (usados.has(b)) continue;
        const prev = this.bancos[b].prev;
        if (!prev) { mejor = b; mejorD = -1; break; }
        const d = Math.hypot(cand.ref.x - prev[8].x, cand.ref.y - prev[8].y);
        if (d < mejorD) { mejorD = d; mejor = b; }
      }
      if (mejor >= 0) {
        usados.add(mejor);
        asignacion.push({ cand, banco: mejor });
      }
    }

    const dt = lastTs ? Math.min((now - lastTs) / 1000, DAMP_MS) : 0.05;
    const out = [];
    for (const { cand, banco } of asignacion) {
      const bn = this.bancos[banco];
      if (!bn.handedness) bn.handedness = cand.handednessRaw; // fijada en el 1er frame
      const lm = cand.lm.map((p, j) => {
        const m = this._mapa(p);
        const fx = bn.filtros[j].x.filter(bn.prev ? bn.prev[j].x : null, m.x, dt);
        const fy = bn.filtros[j].y.filter(bn.prev ? bn.prev[j].y : null, m.y, dt);
        return { x: fx, y: fy, z: p.z };
      });
      bn.prev = lm;
      out.push({ handedness: bn.handedness, landmarks: lm });
    }
    if (this.handsCb) this.handsCb(out);
  }

  _inferirCara(now) {
    const res = this.faceLandmarker.detectForVideo(this.video, now);
    if (!res.faceLandmarks || !res.faceLandmarks.length) {
      if (this.faceCb) this.faceCb({ faceBox: null, smile: 0 });
      return;
    }
    const lm = res.faceLandmarks[0];
    // Bounding box de la cara en px (cover + espejo)
    let minX = 1, maxX = 0, minY = 1, maxY = 0;
    for (const p of lm) {
      const x = 1 - p.x;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const a = this._mapa({ x: minX, y: minY });
    const b = this._mapa({ x: maxX, y: maxY });
    const faceBox = { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
    // Sonrisa: media de mouthSmileLeft/Right, suavizada
    let smile = 0;
    if (res.faceBlendshapes && res.faceBlendshapes.length) {
      const cats = res.faceBlendshapes[0].categories;
      const izq = cats.find(c => c.categoryName === 'mouthSmileLeft');
      const der = cats.find(c => c.categoryName === 'mouthSmileRight');
      smile = ((izq ? izq.score : 0) + (der ? der.score : 0)) / 2;
    }
    const dt = TRACKER.FACE_CAP_MS / 1000; // ~10 fps → dt real del cap
    smile = this.filtroSmile.filter(this.prevSmile, smile, dt);
    this.prevSmile = smile;
    if (this.faceCb) this.faceCb({ faceBox, smile });
  }
}

export const tracker = new Tracker();
