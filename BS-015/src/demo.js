/* ═══════════════════════════════════════════════════════════════
   BS-015 — demo.js
   Simulador de manos con mouse (fallback sin cámara).
   Reutiliza la lógica de entrada del mockup mockups-camara-manos
   (v8 final): mouse = manos, rueda = separar, click = pinch,
   E/Q = energía, S/A = sonrisa, B = onda grave.
   Escribe directamente en el estado compartido de main.js.
   ═══════════════════════════════════════════════════════════════ */

import { W, H, HANDS, DEMO, CHARGE } from './config.js';

class Demo {
  constructor() {
    this.activo = false;
    this.canvas = null;
    this.state = null;
    this.hooks = null;
    this.mouse = { x: W / 2, y: H * HANDS.Y_DEMO };
    this.spread = HANDS.SPREAD_INIT; // px: distancia palma→centro
    this.smile = 0;
    this.prevMouse = null;
    this.velocidad = 0;
    // Recuadro de cara simulado (posición fija, como en el mockup)
    this.faceBox = { x: W / 2 - 104, y: H * 0.155, w: 208, h: 296 };
    this._listeners = [];
  }

  /**
   * @param {HTMLCanvasElement} canvas  canvas 'screen' (para mapear coords)
   * @param {object} state  estado compartido de main.js
   * @param {object} hooks  { onPinch(x,y), onKick(), onEnergyDelta(n) }
   */
  start(canvas, state, hooks) {
    if (this.activo) return;
    this.activo = true;
    this.canvas = canvas;
    this.state = state;
    this.hooks = hooks;
    state.modo = 'demo';
    this._bind();
  }

  stop() {
    if (!this.activo) return;
    this.activo = false;
    for (const [target, tipo, fn, opts] of this._listeners) {
      target.removeEventListener(tipo, fn, opts);
    }
    this._listeners = [];
    if (this.state) this.state.modo = 'live';
  }

  _on(target, tipo, fn, opts) {
    target.addEventListener(tipo, fn, opts);
    this._listeners.push([target, tipo, fn, opts]);
  }

  _toCanvas(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width * W,
      y: (e.clientY - rect.top) / rect.height * H
    };
  }

  _bind() {
    // Mover: manos + energía pasiva por velocidad del puntero
    this._on(window, 'pointermove', e => {
      const p = this._toCanvas(e);
      if (this.prevMouse) {
        const dx = p.x - this.prevMouse.x, dy = p.y - this.prevMouse.y;
        const sp = Math.hypot(dx, dy);
        // velocidad normalizada (pantallas/s aprox. a 60fps de eventos)
        this.velocidad = Math.min(this.velocidad + sp / W * DEMO.VELOCIDAD_SUAVE, DEMO.VELOCIDAD_MAX);
      }
      this.prevMouse = { ...this.mouse };
      this.mouse = p;
    });
    // Click = pinch ⚡
    this._on(window, 'pointerdown', e => {
      const p = this._toCanvas(e);
      this.mouse = p;
      this.hooks.onPinch(p.x, p.y);
    });
    // Rueda = separar/juntar manos
    this._on(window, 'wheel', e => {
      e.preventDefault();
      const paso = e.deltaY > 0 ? HANDS.SPREAD_STEP : -HANDS.SPREAD_STEP;
      this.spread = Math.max(HANDS.SPREAD_MIN, Math.min(HANDS.SPREAD_MAX, this.spread + paso));
    }, { passive: false });
    // Teclas del simulador (las del mockup)
    this._on(window, 'keydown', e => {
      const k = e.key.toLowerCase();
      if (k === 'e') this.hooks.onEnergyDelta(DEMO.ENERGY_STEP);
      if (k === 'q') this.hooks.onEnergyDelta(-DEMO.ENERGY_STEP);
      if (k === 's') this.smile = Math.min(1, this.smile + DEMO.SMILE_STEP);
      if (k === 'a') this.smile = Math.max(0, this.smile - DEMO.SMILE_STEP);
      if (k === 'b') this.hooks.onKick();
    });
  }

  /** Posiciones de las 2 palmas simuladas (con vaivén del mockup). */
  _palmas(time) {
    const wob = Math.sin(time * HANDS.WOBBLE_FREQ) * HANDS.WOBBLE_AMP;
    return {
      Left:  { x: this.mouse.x - this.spread, y: this.mouse.y + wob, flip: -1 },
      Right: { x: this.mouse.x + this.spread, y: this.mouse.y - wob, flip: 1 }
    };
  }

  /** 5 yemas por mano: anillo elíptico con dedos abiertos (m12: RADIUS son semiejes). */
  _yemas(palma) {
    const pts = [];
    for (const a of HANDS.FINGER_ANGLES) {
      const rad = a * Math.PI / 180;
      pts.push({
        x: palma.x + Math.cos(rad) * HANDS.RADIUS_X * palma.flip,
        y: palma.y + Math.sin(rad) * HANDS.RADIUS_Y
      });
    }
    return pts;
  }

  /** Escribe las manos/cara simuladas en el estado compartido. */
  update(dt, time) {
    if (!this.activo || !this.state) return;
    const palmas = this._palmas(time);
    this.state.hands = ['Left', 'Right'].map(lado => ({
      handedness: lado,
      palm: palmas[lado],
      tips: this._yemas(palmas[lado])
    }));
    // spread normalizado: distancia entre palmas / ancho (alimenta el filtro)
    this.state.spread = (this.spread * 2) / W;
    // Carga Kamehameha simulada: misma regla que live (palmas juntas = cargar)
    const distPalmas = this.spread * 2;
    if (distPalmas < CHARGE.NEAR_DIST_PX) {
      this.state.carga = Math.min(CHARGE.MAX, this.state.carga + CHARGE.RISE * dt);
    } else {
      this.state.carga = Math.max(0, this.state.carga - CHARGE.DECAY * dt);
    }
    // velocidad decae sola (la alimenta el pointermove) — DEMO.VELOCIDAD_DECAY
    this.velocidad = Math.max(0, this.velocidad - DEMO.VELOCIDAD_DECAY * dt);
    this.state.velocidad = this.velocidad;
    // sonrisa simulada decae (se mantiene con la tecla S) — DEMO.SMILE_DECAY
    this.smile = Math.max(0, this.smile - DEMO.SMILE_DECAY * dt);
    this.state.face = { box: this.faceBox, smile: this.smile, active: true };
  }
}

export const demo = new Demo();
