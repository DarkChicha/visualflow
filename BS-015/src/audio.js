/* ═══════════════════════════════════════════════════════════════
   BS-015 — audio.js
   Loop de acid house reactivo:
   · Crossfade circular 0.8s (2 fuentes desfasadas, sin clic).
   · Filtro lowpass del bajo modulado por la distancia entre manos
     (spread): juntas = sub grave cerrado, abiertas = 303 ácido.
   · AnalyserNode: banda 20–150Hz → kick → vibración de pantalla.
   · Zap (sawtooth 800→40Hz) + sweep del filtro en cada pinch.
   · Silencio con tecla M / botón (gain master).
   · Fallback elegante: si falta el mp3, un drone sub mínimo
     pasa por el mismo filtro (la pieza sigue reactiva).
   ═══════════════════════════════════════════════════════════════ */

import { AUDIO, ASSETS } from './config.js';
import { OneEuroFilter } from './smoothing.js';

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.filtro = null;
    this.analyser = null;
    this.buffer = null;
    this.silenciado = false;
    this.usandoFallback = false;
    this.freqData = null;
    this.filtroCutoff = new OneEuroFilter(AUDIO.FILTER_SMOOTH, 0.007, 1.0);
    this.prevCutoff = null;
    this.lastKick = 0;
    this.sweepHasta = 0;     // M2: durante el sweep del pinch no automatizar por frame
    this.bandaMedia = 0;     // C3: media móvil de la banda grave (detección por flujo)
    this._programados = [];  // fuentes activas del loop
    this._timer = null;
    this._proximoInicio = 0;
  }

  /** Crea el AudioContext (llamar desde el gesto de usuario: ENTRAR). */
  async init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    // Cadena: fuentes → filtro lowpass (bajo reactivo) → analyser → master → out
    this.filtro = this.ctx.createBiquadFilter();
    this.filtro.type = 'lowpass';
    this.filtro.frequency.value = AUDIO.CUTOFF_MAX;
    this.filtro.Q.value = AUDIO.FILTER_Q;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = AUDIO.FFT_SIZE;
    this.master = this.ctx.createGain();
    this.master.gain.value = AUDIO.MASTER_GAIN;
    this.filtro.connect(this.analyser);
    this.analyser.connect(this.master);
    this.master.connect(this.ctx.destination);
    this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
    // m2: Safari/iOS suele entregar el contexto en 'suspended'
    if (this.ctx.state !== 'running') await this.ctx.resume();
    await this._cargarLoop();
    if (this.ctx.state !== 'running') await this.ctx.resume();
  }

  /** Descarga y decodifica el mp3; si no existe, activa el fallback. */
  async _cargarLoop() {
    try {
      const res = await fetch(ASSETS.MUSIC);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.buffer = await this.ctx.decodeAudioData(await res.arrayBuffer());
      this._arrancarLoop();
    } catch (err) {
      console.warn('BS-015 audio: no se pudo cargar el loop, usando fallback.', err);
      this._arrancarFallback();
    }
  }

  /* ── Loop con crossfade circular ──
     El punto de loop musical es AUDIO.LOOP_DUR (23 compases ≈ 44.16 s);
     el mp3 de 45.02 s deja ~0.86 s de cola que se solapa con el fade-in
     de la vuelta siguiente → loop sin clic y sin perder groove (M3). */
  _arrancarLoop() {
    this._proximoInicio = this.ctx.currentTime + 0.1;
    this._programarFuente(this._proximoInicio);
    this._timer = setInterval(() => {
      while (this._proximoInicio < this.ctx.currentTime + AUDIO.LOOKAHEAD) {
        this._programarFuente(this._proximoInicio);
      }
    }, AUDIO.TICK_MS);
  }

  _programarFuente(t) {
    const dur = this.buffer.duration;
    const loop = AUDIO.LOOP_DUR;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    const g = this.ctx.createGain();
    // Envolvente: fade-in al entrar; la cola musical suena hasta LOOP_DUR
    // y el fade-out cae sobre la cola real del mp3
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(1, t + AUDIO.CROSSFADE);
    g.gain.setValueAtTime(1, t + loop - AUDIO.CROSSFADE);
    g.gain.linearRampToValueAtTime(0, t + loop);
    src.connect(g);
    g.connect(this.filtro);
    src.start(t);
    src.stop(t + dur + 0.05);
    this._programados.push(src);
    src.onended = () => {
      const i = this._programados.indexOf(src);
      if (i >= 0) this._programados.splice(i, 1);
    };
    // La próxima vuelta entra en el punto de loop musical (no antes)
    this._proximoInicio = t + loop;
  }

  /* ── Fallback elegante: drone sub mínimo por el mismo filtro ── */
  _arrancarFallback() {
    this.usandoFallback = true;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = AUDIO.FALLBACK_FREQ;
    const g = this.ctx.createGain();
    g.gain.value = AUDIO.FALLBACK_GAIN;
    // LFO lento sobre el gain: respiración del drone
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.5;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = AUDIO.FALLBACK_GAIN * 0.4;
    lfo.connect(lfoGain);
    lfoGain.connect(g.gain);
    osc.connect(g);
    g.connect(this.filtro);
    osc.start();
    lfo.start();
  }

  /**
   * Actualización por frame:
   * · cutoff del filtro ← spread (suavizado One-Euro; se salta durante
   *   el sweep del pinch, M2)
   * · detección de kick por FLUJO (C3): banda 20–150Hz vs media móvil
   * @param {object} state  estado compartido (lee state.spread)
   * @param {object} hooks  { onKick() }
   */
  update(dt, state, hooks) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Filtro del bajo: map spread [0.10, 0.60] → [180, 3000] Hz
    if (t < this.sweepHasta) {
      // M2: durante el sweep del pinch NO pisar la automatización por frame
    } else {
      const s = Math.max(AUDIO.FILTER_SPREAD_MIN,
        Math.min(AUDIO.FILTER_SPREAD_MAX, state.spread));
      const tt = (s - AUDIO.FILTER_SPREAD_MIN) / (AUDIO.FILTER_SPREAD_MAX - AUDIO.FILTER_SPREAD_MIN);
      const objetivo = AUDIO.CUTOFF_MIN + tt * (AUDIO.CUTOFF_MAX - AUDIO.CUTOFF_MIN);
      const suave = this.filtroCutoff.filter(this.prevCutoff, objetivo, Math.max(dt, 0.001));
      this.prevCutoff = suave;
      this.filtro.frequency.setTargetAtTime(suave, t, 0.03);
    }
    // Kick por flujo (C3): energía de la banda grave vs media móvil
    this.analyser.getByteFrequencyData(this.freqData);
    const binHz = this.ctx.sampleRate / AUDIO.FFT_SIZE;
    const b0 = Math.max(0, Math.floor(AUDIO.BAND_LOW / binHz));
    const b1 = Math.min(this.freqData.length - 1, Math.ceil(AUDIO.BAND_HIGH / binHz));
    let suma = 0;
    for (let i = b0; i <= b1; i++) suma += this.freqData[i];
    const banda = suma / ((b1 - b0 + 1) * 255); // 0-1
    this.bandaMedia = this.bandaMedia * 0.95 + banda * 0.05;
    if (banda > this.bandaMedia * AUDIO.KICK_FLOW_MULT && banda > AUDIO.KICK_MIN &&
        t - this.lastKick > AUDIO.KICK_COOLDOWN) {
      this.lastKick = t;
      if (hooks && hooks.onKick) hooks.onKick(); // E4: guarda
    }
  }

  /** Pinch: zap (sawtooth 800→40Hz, 0.1s) + sweep del filtro (×2 y vuelta). */
  pinch() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Zap
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(AUDIO.ZAP_FREQ_START, t);
    osc.frequency.exponentialRampToValueAtTime(AUDIO.ZAP_FREQ_END, t + AUDIO.ZAP_DUR);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(AUDIO.ZAP_GAIN, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + AUDIO.ZAP_DUR);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + AUDIO.ZAP_DUR + 0.02);
    // Sweep del cutoff: sensación de release del bajo (M2: se protege del
    // setTargetAtTime por frame marcando sweepHasta)
    const actual = this.filtro.frequency.value;
    const pico = Math.min(actual * AUDIO.PINCH_SWEEP_MULT, AUDIO.CUTOFF_MAX);
    this.filtro.frequency.cancelScheduledValues(t);
    this.filtro.frequency.setValueAtTime(actual, t);
    this.filtro.frequency.exponentialRampToValueAtTime(pico, t + AUDIO.PINCH_SWEEP_TIME / 2);
    this.filtro.frequency.exponentialRampToValueAtTime(Math.max(actual, AUDIO.CUTOFF_MIN), t + AUDIO.PINCH_SWEEP_TIME);
    this.sweepHasta = t + AUDIO.PINCH_SWEEP_TIME;
  }

  /** Silencio (M / botón): conmute del gain master. */
  toggleMute() {
    if (!this.ctx) return this.silenciado; // m1: sin contexto no marcar como activo
    this.silenciado = !this.silenciado;
    this.master.gain.setTargetAtTime(
      this.silenciado ? 0 : AUDIO.MASTER_GAIN, this.ctx.currentTime, 0.05);
    return this.silenciado;
  }
}

export const audio = new AudioEngine();
