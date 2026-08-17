/* ═══════════════════════════════════════════════════════════════
   BS-015 — energy.js
   Motor de energía 0-100: decae con el tiempo, sube con la
   velocidad de las manos y con la sonrisa; el pinch da picos.
   ═══════════════════════════════════════════════════════════════ */

import { ENERGY } from './config.js';

export class EnergyEngine {
  constructor() {
    this.energy = ENERGY.INICIAL;
  }

  /**
   * Avanza el motor.
   * @param {number} dt  segundos desde el frame anterior
   * @param {object} fuentes  { velocidad, smile } (normalizados)
   */
  update(dt, { velocidad = 0, smile = 0 } = {}) {
    // Decay constante
    this.energy = Math.max(0, this.energy - ENERGY.DECAY * dt);
    // Velocidad de las yemas convoca energía
    this.energy += velocidad * ENERGY.VELOCIDAD_FACTOR * dt;
    // La sonrisa convoca energía en silencio (sin display)
    if (smile > ENERGY.SMILE_THRESHOLD) {
      this.energy += ENERGY.SMILE_ENERGY * smile * dt;
    }
    this.energy = Math.min(ENERGY.MAX, this.energy);
    return this.energy;
  }

  /** Golpe instantáneo (pinch). */
  boost(n = ENERGY.PINCH_BOOST) {
    this.energy = Math.min(ENERGY.MAX, this.energy + n);
  }

  /** Nivel actual (0-100). */
  get nivel() {
    return this.energy;
  }

  /** true si la energía supera el umbral dado. */
  alerta(umbral) {
    return this.energy > umbral;
  }
}
