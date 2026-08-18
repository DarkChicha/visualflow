/* ═══════════════════════════════════════════════════════════════
   BS-015 — config.js
   TODAS las constantes de la pieza. Nada de números mágicos fuera
   de este archivo: los effects solo importan de aquí.
   ═══════════════════════════════════════════════════════════════ */

// ── Assets (importados por Vite → URLs correctas con base './') ──
import logoUrl from './assets/logo-barrett.png';
import acidUrl from './assets/music/acid-loop.mp3';
export const ASSETS = { LOGO: logoUrl, MUSIC: acidUrl };

// ── Canvas interno (CSS escala al viewport) ──
export const W = 1080;
export const H = 1920;
export const DPR_CAP = 2; // documentado: el canvas se dibuja a W×H sin dpr (ver M8 revisión Opus)

// ── Paletas (sin amarillo/verde). Teclas 1/2 ──
export const PALETTES = {
  ROJA: { cian: '#FF2A2A', magenta: '#FF2A2A', rojo: '#FF2A2A', blanco: '#FFFFFF', nombre: 'ROJA' },
  NEON: { cian: '#00F0FF', magenta: '#FF00CC', rojo: '#FF003C', blanco: '#FFFFFF', nombre: 'NEÓN' }
};
export const PALETA_DEFAULT = 'ROJA';

// ── Energía (motor 0-100) ──
export const ENERGY = {
  MAX: 100,
  DECAY: 9,              // puntos por segundo
  PINCH_BOOST: 22,       // golpe instantáneo por pinch
  SMILE_ENERGY: 9,       // +9 × smile por segundo (si smile > umbral)
  SMILE_THRESHOLD: 0.08, // umbral de sonrisa para convocar
  BOLT_ENERGY: 20,       // umbral a partir del cual aparecen rayos
  VELOCIDAD_FACTOR: 35,  // energía/s por velocidad normalizada de yemas (tunable)
  INICIAL: 12,           // energía de arranque (que se vea vivo)
  SPREAD_REPOSO: 0.30,   // spread al que vuelve el filtro sin dos manos
  SPREAD_RELAX: 0.05     // velocidad de relajación hacia el reposo (por frame)
};

// ── Carga Kamehameha (manos juntas) ──
export const CHARGE = {
  NEAR_DIST_PX: 260,      // distancia palma-palma para empezar a cargar
  RISE: 38,               // puntos por segundo juntas
  DECAY: 22,              // puntos por segundo al separar
  MAX: 100,
  // Multiplicadores a carga máxima (1 = sin cambio)
  THREAD_WIDTH_MULT: 2.8,   // hilos entre manos más gruesos
  THREAD_GLOW_MULT: 2.2,
  THREAD_VIBRA_MULT: 1.6,   // vibración de los hilos entre manos
  BOLT_WIDTH_MULT: 2.5,     // rayos logo↔manos más gruesos
  BOLT_GLOW_MULT: 2.0,
  BOLT_SPAWN_MULT: 3.0,     // más rayos
  SPARK_SIZE_MULT: 2.2,   // chispas más grandes
  SPARK_SPAWN_MULT: 2.5,    // más chispas
  DROP_SIZE_MULT: 1.6,      // gotas más grandes
  SCREEN_SHAKE_MAX: 10,    // vibración extra de pantalla (px) a carga máxima
  LOGO_GLOW_MULT: 1.8       // halo del logo más intenso
};

// ── Tracker MediaPipe Tasks ──
export const TRACKER = {
  CDN: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14',
  WASM_BASE: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
  HAND_MODEL: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
  FACE_MODEL: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  // Constraints: ideal 720p landscape SIN aspectRatio forzado.
  // En móviles el sensor selfie es landscape físico; forzar 9:16 hace que
  // el navegador recorte/zoom (efecto teleobjetivo). El cover mapping de
  // tracker.js adapta cualquier resolución real al lienzo 9:16.
  CAM_W: 1280,
  CAM_H: 720,
  HANDS_CAP_MS: 50,   // ~20 fps de inferencia de manos
  FACE_CAP_MS: 100,   // ~10 fps de inferencia de cara
  NUM_HANDS: 2,
  NUM_FACES: 1,
  MODEL_TIMEOUT: 30000, // si el CDN no responde → modo demo
  // One-Euro para landmarks de manos
  ONE_EURO_MIN_CUTOFF: 1.0,
  ONE_EURO_BETA: 0.007,
  ONE_EURO_D_CUTOFF: 1.0,
  // Suavizado del blendshape de sonrisa
  SMILE_MIN_CUTOFF: 1.6
};

// ── Gestos ──
export const GESTURES = {
  PINCH_ON: 0.05,    // distancia pulgar-índice (normalizada) para cerrar pinch
  PINCH_OFF: 0.07,   // histéresis: no re-disparar hasta abrir por encima de esto
  TIP_INDICES: [4, 8, 12, 16, 20], // pulgar, índice, medio, anular, meñique
  PALM_INDEX: 9,     // landmark centro de palma
  INDEX_TIP: 8,
  PINKY_TIP: 20,
  THUMB_TIP: 4
};

// ── Manos simuladas (demo): anillo elíptico de 5 yemas ──
export const HANDS = {
  FINGER_ANGLES: [-62, -31, 0, 31, 62], // grados
  RADIUS_X: 92,   // semi-eje horizontal del anillo elíptico (px)
  RADIUS_Y: 44,   // semi-eje vertical (px)
  PALM_HALO_R: 180,   // halo radial de la palma (px)
  TIP_R: 6.8,         // radio del punto de yema (px)
  TIP_GLOW: 36,       // shadowBlur de yemas
  WOBBLE_AMP: 12,     // vaivén vertical de las manos simuladas (px)
  WOBBLE_FREQ: 1.7,
  // spread del simulador (px, distancia palma→centro)
  SPREAD_MIN: 56,
  SPREAD_MAX: 460,
  SPREAD_INIT: 180,
  SPREAD_STEP: 28,
  Y_DEMO: 0.62 // altura relativa de las manos en el simulador
};

// ── Logo elástico flotante (nunca se rompe) ──
export const LOGO = {
  W: 320,               // ancho en px (altura por ratio del PNG)
  CENTER_X: W / 2,
  CENTER_Y: 0.36 * H,
  GRID: { cols: 18, rows: 9 },
  K: 150,               // resorte hacia el reposo
  DAMP: 22,             // ~crítico (ζ≈0.9): sin sobreimpulso → no invierte celdas
  MASS: 1,
  REPULSE_RADIUS: 260,  // repulsión de manos dentro de este radio (px)
  REPULSE_FORCE: 1800,  // fuerza máxima de repulsión
  VIBRATION_FORCE: 0.06, // (rand-0.5) × energy × 0.06 × 60
  CELL_CLAMP: 0.45,     // tope de desplazamiento por vértice (fracción de celda) → nunca se rompe
  GLOW_MARGIN: 80,      // margen del offscreen del logo para el halo (px)
  // Flotación (deriva aplicada en render, la física no se entera)
  DRIFT_X_AMP: 28, DRIFT_X_FREQ: 0.8,
  DRIFT_Y_AMP: 20, DRIFT_Y_FREQ: 0.6,
  // Pulso de escala alrededor del centro
  PULSE_BASE_AMP: 0.014, PULSE_BASE_FREQ: 1.4,
  PULSE_ENERGY: 0.04,
  PULSE_FAST_AMP: 0.005, PULSE_FAST_FREQ: 5.2, PULSE_FAST_CAP: 40,
  // Glow
  SHADOW_BASE: 52, SHADOW_ENERGY: 0.7,
  // Shockwaves (anillos del pinch)
  WAVE_RING_WIDTH: 68,   // ancho del anillo que empuja la malla (px)
  WAVE_FORCE: 2.2,
  WAVE_SPEED: 680,       // expansión del anillo (px/s)
  WAVE_LIFE: 1,
  WAVE_FADE: 2.2,
  WAVE_STRENGTH: 400     // fuerza del anillo de pinch
};

// ── Hilos neón ──
export const THREADS = {
  NODE_SEED: [ // 14 nodos, posiciones base fijas (fracción de pantalla)
    [0.15, 0.12], [0.5, 0.07], [0.85, 0.12], [0.09, 0.32], [0.91, 0.32],
    [0.18, 0.55], [0.82, 0.55], [0.12, 0.78], [0.88, 0.78], [0.4, 0.86],
    [0.6, 0.86], [0.3, 0.2], [0.7, 0.2], [0.5, 0.48]
  ],
  DRIFT_X: 32, DRIFT_Y: 24,     // deriva senoidal lenta (±px)
  DRIFT_FREQ_X: 0.33, DRIFT_FREQ_Y: 0.27,
  DIST_MIRROR: 840,  // yemas L↔R espejadas
  DIST_TIP_NODE: 480, // yema → 2 nodos más cercanos
  DIST_NODE_NODE: 300, // nodos vecinos
  LINE_WIDTH: 4.8,
  SHADOW: 26,
  NODE_R: 5.6,
  INTENSITY_BASE: 0.35,
  INTENSITY_ENERGY: 0.007,
  ALPHA_MIRROR: 0.85, ALPHA_MIRROR_DIST: 0.35,
  ALPHA_TIP_NODE: 0.5,
  ALPHA_NODE_NODE: 0.22,
  NODE_ALPHA: 0.8,

  /* ── Hilos entre manos (L↔R): presencia fuerte + carga ──
     Cuando las palmas están más cerca que MANOS_CERCA_DIST, los hilos
     entre yemas espejadas se dibujan SIEMPRE (sin corte por distancia)
     y dominan visualmente: trazo grueso, alpha alta y núcleo blanco. */
  MANOS_CERCA_DIST: 980,      // umbral de cercanía entre palmas (px): ~0.9×W
                              // (brazos extendidos en el encuadre real entran)
  ENTRE_MANOS_WIDTH: 7.2,     // grosor del hilo entre manos (px)
  ENTRE_MANOS_ALPHA: 0.92,    // alpha base (sube con la carga)
  ENTRE_MANOS_ALPHA_CARGA: 0.08, // alpha extra a carga máxima
  ENTRE_MANOS_SHADOW: 42,     // glow base del hilo
  ENTRE_MANOS_SHADOW_CARGA: 34, // glow extra a carga máxima
  ENTRE_MANOS_CORE_WIDTH: 3,   // grosor del núcleo blanco (efecto filo)
  ENTRE_MANOS_CORE_ALPHA: 0.98,
  ENTRE_MANOS_CORE_SHADOW: 22, // glow del núcleo blanco
  // Con las manos lejos el hilo L↔R se dibuja igual (nunca se pierde),
  // con piso de alpha y algo menos de grosor
  ENTRE_MANOS_LEJOS_WIDTH: 5.2,
  ENTRE_MANOS_LEJOS_ALPHA: 0.5,

  /* Carga: se acumula mientras las manos siguen cerca y decae al separarse.
     Cuanto más tiempo juntas, más vibran los hilos entre manos. */
  CARGA_RATE: 0.55,           // unidades de carga por segundo (juntas)
  CARGA_DECAY: 0.9,           // unidades por segundo (separadas)
  CARGA_MAX: 1,               // tope de carga
  VIBRACION_CARGA: 30,        // offset perpendicular máximo a carga tope (px)
  VIBRACION_SEGS: 8           // segmentos de la polilínea vibrante
};

// ── Sparks (partículas) ──
export const SPARKS = {
  MAX: 320,
  VEL: 180, VEL_UP: 40,
  DECAY_MIN: 1.4, DECAY_RAND: 1,
  SIZE_MIN: 3, SIZE_RAND: 5.6,
  GRAVITY: 80,
  GLOW: 18,
  TIP_SPAWN_PROB: 0.55,  // chispa continua de yemas (probabilidad por frame)
  PINCH_BURST: 26,      // ráfaga al hacer pinch
  PINCH_SCATTER: 80     // dispersión de la ráfaga de pinch (px)
};

// ── Rayos finos logo ↔ manos ──
export const BOLTS = {
  THRESHOLD: ENERGY.BOLT_ENERGY, // 20
  MAX: 14,
  SEGS: 7,
  OFFSET_FACTOR: 0.30,      // offset perpendicular × largo
  PROB_FACTOR: 0.55,        // prob = ((energy-20)/80) × 0.55 por frame
  PROB_RANGE: 80,           // (energy-20)/80
  LIFE_DECAY: 5.5,          // vida ~0.18 s
  HALO_WIDTH: 4.8, HALO_SHADOW: 34, HALO_ALPHA: 0.5,
  CORE_WIDTH: 2.4, CORE_ALPHA: 0.95,
  SPARK_R: 5.2,             // chispas en los extremos
  EDGE_FACTOR: 0.42         // borde del logo: radios w×0.42 / h×0.42
};

// ── Marco de cara (SIN texto) ──
export const FACEHUD = {
  CORNER_LEN: 36,   // largo de los corner brackets (px)
  PAD: 8,           // separación del marco respecto al faceBox (px)
  LINE_WIDTH: 6.0,
  GLOW: 26
};

// ── Onda grave / screenfx ──
export const SCREENFX = {
  KICK_DECAY: 2.4,          // por segundo
  AMP_KICK: 30,             // amp = kick² × 30 + energy/100 × 2.6
  AMP_ENERGY: 2.6,
  ZOOM_KICK: 0.006,         // zoom = 1 + kick × 0.006
  AMP_MIN: 0.2,             // umbral para aplicar vibración
  VIGNETTE_ALPHA: 0.55,     // alpha en bordes
  VIGNETTE_R_IN: 0.35,      // radios del gradiente (fracción de H)
  VIGNETTE_R_OUT: 0.75,
  AUTO_KICK_ENERGY: 70,     // disparo automático de kick con energía alta
  AUTO_KICK_PROB: 0.035
};

// ── Audio (acid house reactivo) ──
export const AUDIO = {
  CROSSFADE: 0.8,         // crossfade circular (s)
  LOOP_DUR: 44.16,        // punto de loop musical (23 compases a 125 BPM ≈ 44.16 s);
                          // el mp3 de 45.02 s deja ~0.86 s de cola que se solapa con el fade-in
  FILTER_SPREAD_MIN: 0.10, // map spread [0.10, 0.60] → cutoff [180, 3000] Hz
  FILTER_SPREAD_MAX: 0.60,
  CUTOFF_MIN: 180,
  CUTOFF_MAX: 3000,
  FILTER_Q: 4,
  FILTER_SMOOTH: 2,       // One-Euro minCutoff del cutoff
  PINCH_SWEEP_MULT: 2,    // sweep del cutoff ×2 en pinch
  PINCH_SWEEP_TIME: 0.3,  // y vuelta en ~0.3 s
  FFT_SIZE: 2048,         // a 48 kHz: bin ≈ 23.4 Hz → banda 20-150 Hz = bins 0..6
  BAND_LOW: 20, BAND_HIGH: 150,
  KICK_FLOW_MULT: 1.7,    // kick si banda > media móvil × este factor
  KICK_MIN: 0.22,         // y banda normalizada mínima (evita disparos en silencio)
  KICK_COOLDOWN: 0.18,    // no re-disparar kick antes de esto (s)
  ZAP_FREQ_START: 800, ZAP_FREQ_END: 40, ZAP_DUR: 0.1, ZAP_GAIN: 0.18,
  MASTER_GAIN: 0.8,
  // Fallback elegante si falta el mp3: drone sub mínimo por el mismo filtro
  FALLBACK_FREQ: 55, FALLBACK_GAIN: 0.22,
  // Scheduler del loop
  LOOKAHEAD: 2,           // segundos de lookahead
  TICK_MS: 250            // intervalo del scheduler
};

// ── Movimiento reducido (fotosensibilidad: evento público) ──
export const MOTION = {
  EFFECTS_FACTOR: 0.2,  // multiplica spawn de bolts/sparks y la vibración de hilos si prefers-reduced-motion
  SCREENFX_AMP: 0.3,    // vibración reducida
  AUTO_KICK_OFF: true   // sin auto-kicks (solo los reales del audio)
};

// ── Simulador (demo) ──
export const DEMO = {
  SMILE_STEP: 0.12,     // tecla S
  SMILE_DECAY: 0.4,     // por segundo (antes 25 s en volver — demasiado)
  ENERGY_STEP: 15,      // tecla E/Q
  VELOCIDAD_SUAVE: 3,   // acumulación de velocidad del puntero
  VELOCIDAD_MAX: 2.5,
  VELOCIDAD_DECAY: 4    // decaimiento de la velocidad simulada (por s)
};

// ── HUD ──
export const HUD = {
  BOLT_ON: '⚡ RAYOS: activos',
  BOLT_OFF: '⚡ RAYOS: en espera'
};

// ── Fondo ──
export const BG_COLOR = '#000';

// ── Capa de cámara (video de fondo en modo live) ──
export const CAM = {
  // Video en blanco y negro con contraste extra: los efectos de color
  // cortan mejor y el velo puede ser más tenue
  FILTER: 'grayscale(1) contrast(1.15)',
  OVERLAY_ALPHA: 0.35 // velo negro sobre el video (baja = te ves más)
};

// ── Loop ──
export const DT_MAX = 0.033; // cap de delta-time (s)
