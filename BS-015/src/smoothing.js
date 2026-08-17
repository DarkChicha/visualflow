/* ═══════════════════════════════════════════════════════════════
   BS-015 — smoothing.js
   Filtro One-Euro: suavizado adaptativo de señal ruidosa.
   Se usa por coordenada (x, y) de cada landmark y para el smile.
   ═══════════════════════════════════════════════════════════════ */

function alpha(cutoff, dt) {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}

export class OneEuroFilter {
  /**
   * @param {number} minCutoff  corte mínimo (Hz): más bajo = más suave
   * @param {number} beta       cuánto sube el corte con la velocidad
   * @param {number} dCutoff    corte del filtro de la derivada (Hz)
   */
  constructor(minCutoff = 1.0, beta = 0.007, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.dxPrev = 0;   // derivada filtrada anterior
    this.iniciado = false;
  }

  /**
   * Filtra un valor dado el valor filtrado anterior.
   * @param {number|null} prev  valor filtrado anterior (null en la primera muestra)
   * @param {number} value      valor crudo nuevo
   * @param {number} dt         segundos desde la muestra anterior
   * @returns {number} valor filtrado
   */
  filter(prev, value, dt) {
    if (prev === null || prev === undefined || !this.iniciado || dt <= 0) {
      this.iniciado = true;
      this.dxPrev = 0;
      return value;
    }
    // Derivada (velocidad) filtrada
    const dx = (value - prev) / dt;
    const aD = alpha(this.dCutoff, dt);
    const edx = this.dxPrev + aD * (dx - this.dxPrev);
    this.dxPrev = edx;
    // Corte adaptativo: más velocidad → menos suavizado (sin lag)
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    const a = alpha(cutoff, dt);
    return prev + a * (value - prev);
  }

  reset() {
    this.iniciado = false;
    this.dxPrev = 0;
  }
}
