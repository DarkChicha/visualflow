/* ═══════════════════════════════════════════════════════════════
   BS-015 — gestures.js
   Gestos sobre landmarks ya suavizados: pinch (con histéresis),
   spread, velocidad de yemas y handedness estable.
   Las posiciones de trabajo son píxeles de canvas (W×H); las
   distancias umbral se normalizan dividiendo por W.
   ═══════════════════════════════════════════════════════════════ */

import { W, GESTURES } from './config.js';

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Distancia pulgar[4]–índice[8] normalizada (0-1 aprox).
 * @param {Array<{x,y}>} lm  landmarks en px
 */
export function distanciaPinch(lm) {
  return dist(lm[GESTURES.THUMB_TIP], lm[GESTURES.INDEX_TIP]) / W;
}

/** Las 5 yemas de una mano en px. */
export function yemas(lm) {
  return GESTURES.TIP_INDICES.map(i => ({ x: lm[i].x, y: lm[i].y }));
}

/** Centro de palma en px. */
export function palma(lm) {
  return { x: lm[GESTURES.PALM_INDEX].x, y: lm[GESTURES.PALM_INDEX].y };
}

/**
 * Procesador de gestos con estado (histéresis de pinch,
 * identidad estable de manos y velocidad de yemas).
 */
export class GestureProcessor {
  constructor() {
    this.pinchCerrado = { Left: false, Right: false };
    this.prevTips = { Left: null, Right: null }; // yemas del frame anterior
    this.prevTime = { Left: 0, Right: 0 };
  }

  /**
   * Pinch con histéresis: dispara onPinch(x, y) UNA vez al cerrar
   * (dist < PINCH_ON) y no re-dispara hasta abrir (> PINCH_OFF).
   * @returns {boolean} true si el pinch sigue cerrado
   */
  pinch(hand, onPinch) {
    const d = distanciaPinch(hand.landmarks);
    const lado = hand.handedness;
    if (!this.pinchCerrado[lado] && d < GESTURES.PINCH_ON) {
      this.pinchCerrado[lado] = true;
      const a = hand.landmarks[GESTURES.THUMB_TIP];
      const b = hand.landmarks[GESTURES.INDEX_TIP];
      onPinch((a.x + b.x) / 2, (a.y + b.y) / 2);
    } else if (this.pinchCerrado[lado] && d > GESTURES.PINCH_OFF) {
      this.pinchCerrado[lado] = false;
    }
    return this.pinchCerrado[lado];
  }

  /**
   * Velocidad media de las 5 yemas (pantallas por segundo).
   */
  velocidad(hand, now) {
    const lado = hand.handedness;
    const tips = yemas(hand.landmarks);
    const prev = this.prevTips[lado];
    const dt = (now - this.prevTime[lado]) / 1000;
    let v = 0;
    if (prev && dt > 0) {
      for (let i = 0; i < tips.length; i++) {
        v += dist(tips[i], prev[i]) / W / dt;
      }
      v /= tips.length;
    }
    this.prevTips[lado] = tips;
    this.prevTime[lado] = now;
    return v;
  }
}
