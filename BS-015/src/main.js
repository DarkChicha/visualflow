/* ═══════════════════════════════════════════════════════════════
   BS-015 — main.js
   Bootstrap: DOM, overlay ENTRAR, init de tracker (o demo si la
   cámara falla), game loop y cableado de módulos.
   El render loop NO espera a MediaPipe: lee el estado compartido
   que el tracker actualiza a su propio ritmo (caps de FPS).
   ═══════════════════════════════════════════════════════════════ */

import {
  W, H, PALETTES, PALETA_DEFAULT, BG_COLOR, DT_MAX,
  ENERGY, HANDS, LOGO, ASSETS
} from './config.js';
import { tracker } from './tracker.js';
import { GestureProcessor, yemas, palma } from './gestures.js';
import { EnergyEngine } from './energy.js';
import { audio } from './audio.js';
import { hud } from './hud.js';
import { demo } from './demo.js';
import * as sparks from './effects/sparks.js';
import * as threads from './effects/threads.js';
import * as drops from './effects/drops.js';
import * as bolts from './effects/bolts.js';
import * as logo from './effects/logo.js';
import * as facehud from './effects/facehud.js';
import * as screenfx from './effects/screenfx.js';

/* ── Estado compartido (lo escriben tracker/demo, lo leen effects) ── */
const state = {
  time: 0,
  modo: 'live',            // 'live' (cámara) | 'demo' (simulador)
  paleta: PALETTES[PALETA_DEFAULT],
  hands: [],               // [{ handedness, palm:{x,y}, tips:[{x,y}×5] }]
  face: { box: null, smile: 0, active: false },
  spread: ENERGY.SPREAD_REPOSO, // distancia entre manos / W → filtro del bajo
  velocidad: 0,            // velocidad media de yemas (pantallas/s)
  energy: ENERGY.INICIAL,
  motionReduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches // M10
};

const energy = new EnergyEngine();
const gestures = new GestureProcessor();

/* ── Canvas ── */
const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
// M8: canvas a W×H (1080 px ya supera el ancho CSS del stage; sin dpr el
// backing store no se sobredimensiona ~18× → 60 fps en cualquier equipo)
canvas.width = W;
canvas.height = H;

const videoEl = document.getElementById('cam');
// m19: el logo del overlay con la URL que resuelve Vite (base './')
document.getElementById('overlayLogo').src = ASSETS.LOGO;

/* ── Acciones compartidas ── */
function onPinch(x, y) {
  energy.boost(ENERGY.PINCH_BOOST);
  logo.addWave(x, y, LOGO.WAVE_STRENGTH);
  sparks.burstPinch(x, y, state.paleta);
  audio.pinch();
  if (energy.alerta(40)) screenfx.triggerKick();
}

const hooks = {
  onPinch,
  onKick: () => screenfx.triggerKick(),
  onEnergyDelta: n => energy.boost(n),
  onMute: () => hud.setSilenciado(audio.toggleMute()),
  onDemo: () => toggleDemo()
};

/* ── Tracker → estado ── */
tracker.onHands(hands => {
  if (state.modo !== 'live') return;
  const out = [];
  let vel = 0;
  for (const h of hands) {
    gestures.pinch(h, onPinch);
    vel += gestures.velocidad(h, performance.now());
    out.push({ handedness: h.handedness, palm: palma(h.landmarks), tips: yemas(h.landmarks) });
  }
  state.hands = out;
  // m8: media de la velocidad (no la suma: con dos manos no se duplica)
  state.velocidad = out.length ? vel / out.length : 0;
  if (out.length === 2) {
    // spread: distancia entre palmas normalizada (alimenta el filtro del bajo)
    state.spread = Math.hypot(
      out[0].palm.x - out[1].palm.x,
      out[0].palm.y - out[1].palm.y) / W;
  } else {
    // M7: sin dos manos el filtro relaja hacia el reposo (no se congela)
    state.spread += (ENERGY.SPREAD_REPOSO - state.spread) * ENERGY.SPREAD_RELAX;
  }
});

tracker.onFace(({ faceBox, smile }) => {
  if (state.modo !== 'live') return;
  state.face = { box: faceBox, smile, active: !!faceBox };
});

// M5: si MediaPipe se degrada en runtime (fallos consecutivos) → demo
tracker.onDegradacion(() => entrarDemo());

/* ── Modo demo (fallback sin cámara o tecla D) ── */
function entrarDemo() {
  tracker.stop();
  demo.start(canvas, state, hooks);
  hud.setDemo(true);
  hud.ocultarOverlay(); // m3: el overlay se oculta cuando hay algo que ver
}

function toggleDemo() {
  if (demo.activo) {
    demo.stop();
    hud.setDemo(false);
    arrancarCamara(); // intento de volver a la cámara
  } else {
    entrarDemo();
  }
}

async function arrancarCamara() {
  try {
    hud.setOverlayMsg('activando cámara…');
    await tracker.start(videoEl);
    state.modo = 'live';
    hud.setOverlayMsg('');
    hud.ocultarOverlay(); // m3: recién cuando la cámara está viva
  } catch (err) {
    // getUserMedia o los modelos fallaron → modo demo
    console.warn('BS-015: sin cámara, entrando en modo demo.', err);
    hud.setOverlayMsg('');
    entrarDemo();
  }
}

/* ── Overlay ENTRAR (gesto de usuario: crea el AudioContext) ── */
document.getElementById('btnEntrar').addEventListener('click', async () => {
  hud.setOverlayMsg('cargando…');
  await audio.init();
  await logo.init();
  await arrancarCamara();
});

/* ── Teclas globales ── */
window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === '1') state.paleta = PALETTES.ROJA;
  if (k === '2') state.paleta = PALETTES.NEON;
  if (k === 'm') hooks.onMute();
  if (k === 'h') hud.toggleLimpio();
  if (k === 'd') hooks.onDemo();
});

/* ── Dibujo de las manos: halo de palma + yemas brillantes ── */
function drawHands() {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (const h of state.hands) {
    // halo de la palma
    const grad = ctx.createRadialGradient(h.palm.x, h.palm.y, 0, h.palm.x, h.palm.y, HANDS.PALM_HALO_R);
    grad.addColorStop(0, 'rgba(255,255,255,0.10)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(h.palm.x, h.palm.y, HANDS.PALM_HALO_R, 0, Math.PI * 2);
    ctx.fill();
    // yemas
    const cols = [state.paleta.cian, state.paleta.magenta, state.paleta.rojo,
                  state.paleta.cian, state.paleta.magenta];
    h.tips.forEach((t, i) => {
      const col = cols[i % cols.length];
      ctx.shadowBlur = HANDS.TIP_GLOW;
      ctx.shadowColor = col;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(t.x, t.y, HANDS.TIP_R, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  ctx.restore();
}

/* ── Game loop: lee estado → energy → effects (no espera a MediaPipe) ── */
let last = performance.now();
function loop(ts) {
  const dt = Math.min((ts - last) / 1000, DT_MAX);
  last = ts;
  state.time += dt;

  // Simulador (si está activo, escribe manos/cara en el estado)
  demo.update(dt, state.time);

  // Energía (decay + fuentes; el spread no alimenta energía — E3)
  state.energy = energy.update(dt, {
    velocidad: state.velocidad,
    smile: state.face.smile
  });

  // Audio reactivo (filtro por spread + kick → vibración)
  audio.update(dt, state, hooks);

  // Updates de efectos
  sparks.update(dt, state);
  threads.update(dt, state);
  drops.update(dt, state);
  bolts.update(dt, state);
  logo.update(dt, state);
  screenfx.update(dt, state);

  // M1: limpiar el fondo con la matriz base (fuera del shake → sin ghosting
  // en los bordes del canvas al vibrar por la onda grave)
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // Dibujo (envuelto en vibración/zoom de la onda grave)
  screenfx.beginFrame(ctx, state.energy, state.motionReduced);
  threads.draw(ctx, state);
  drops.draw(ctx, state);
  drawHands();
  logo.draw(ctx, state);
  bolts.draw(ctx, state);
  sparks.draw(ctx);
  facehud.draw(ctx, state);
  screenfx.endFrame(ctx);

  // HUD DOM (no vibra)
  hud.update(state.energy, bolts.activos());

  requestAnimationFrame(loop);
}

hud.init(hooks);
requestAnimationFrame(loop);
