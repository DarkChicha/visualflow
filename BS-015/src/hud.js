/* ═══════════════════════════════════════════════════════════════
   BS-015 — hud.js
   HUD en DOM (NO vibra con la onda grave): barra de energía,
   estado de rayos, silencio (M), modo limpio (H) y modo demo (D).
   El badge "sin cámara" solo aparece en modo demo.
   ═══════════════════════════════════════════════════════════════ */

import { HUD, ENERGY } from './config.js';

class Hud {
  init(hooks) {
    this.hooks = hooks;
    this.fill = document.getElementById('energyFill');
    this.boltState = document.getElementById('boltState');
    this.stage = document.getElementById('stage');
    this.badge = document.getElementById('demoBadge');
    this.btnMute = document.getElementById('btnMute');
    this.btnLimpio = document.getElementById('btnLimpio');
    this.btnDemo = document.getElementById('btnDemo');
    this.limpio = false;

    this.btnMute.addEventListener('click', () => hooks.onMute());
    this.btnLimpio.addEventListener('click', () => this.toggleLimpio());
    this.btnDemo.addEventListener('click', () => hooks.onDemo());
  }

  /** Barra de energía + estado de rayos real (m17/m24: cache + solo si cambia). */
  update(nivel, rayosActivos) {
    const pct = Math.round(Math.min(nivel, ENERGY.MAX));
    if (pct !== this._lastPct) {
      this._lastPct = pct;
      this.fill.style.width = pct + '%';
    }
    const txt = rayosActivos ? HUD.BOLT_ON : HUD.BOLT_OFF;
    if (txt !== this._lastBolt) {
      this._lastBolt = txt;
      this.boltState.textContent = txt;
    }
  }

  /** Marca visual del botón de silencio. */
  setSilenciado(s) {
    this.btnMute.classList.toggle('activo', s);
  }

  /** Modo limpio (H): oculta todo el HUD para el evento. */
  toggleLimpio() {
    this.limpio = !this.limpio;
    this.stage.classList.toggle('limpio', this.limpio);
    this.btnLimpio.classList.toggle('activo', this.limpio);
    return this.limpio;
  }

  /** Badge "sin cámara": solo en modo demo. */
  setDemo(activo) {
    this.badge.style.display = activo ? 'block' : 'none';
    this.btnDemo.classList.toggle('activo', activo);
  }

  /** Mensaje del overlay inicial (cargando, error de cámara…). */
  setOverlayMsg(txt) {
    document.getElementById('overlayMsg').textContent = txt;
  }

  /** Oculta el overlay inicial (fade por CSS). */
  ocultarOverlay() {
    document.getElementById('overlay').classList.add('oculto');
  }
}

export const hud = new Hud();
