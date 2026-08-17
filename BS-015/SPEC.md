# BS-015 — Cámara + Manos (pieza AR interactiva)

Pieza web de realidad aumentada de pantalla (vertical 9:16, 1080×1920): la cámara ve las manos y la cara del usuario y genera visuales generativos en tiempo real (hilos neón, gotas glitch, logo BARRETT elástico flotante con rayos de energía, sonrisa que convoca energía, vibración de pantalla por onda grave) con un loop de acid house generado por ElevenLabs. Es el registro del área AV en el dashboard interno de Henri Barrett y pieza-showcase en GitHub (repo `DarkChicha/visualflow`, carpeta `BS-015/`).

**Stack**: Vite + vanilla JS (ES modules, sin framework) + MediaPipe Tasks API (CDN). Deploy: Firebase Hosting (`video-editorial.web.app/BS-015/`). Render 60fps; inferencia ML desacoplada con cap de FPS.

**NO incluir el lema del evento en la pieza** (decisión del usuario: la pieza va sin texto de marca adicional).

---

## Estructura de archivos

```
BS-015/
├── index.html              # 1080×1920; overlay inicial "BARRETT SESSIONS" + botón ENTRAR
├── package.json            # vite build
├── vite.config.js          # base './' (se sirve desde subcarpeta)
├── SPEC.md                 # este documento
├── public/
│   ├── assets/logo-barrett.png        # logo real (blanco sobre negro)
│   └── assets/music/acid-loop.mp3     # track acid house 45s (lo genera Hermes)
└── src/
    ├── main.js             # bootstrap: DOM, overlay ENTRAR, init tracker, game loop, wire de módulos
    ├── config.js           # TODAS las constantes (nada de números mágicos fuera de aquí)
    ├── tracker.js          # MediaPipe Tasks: HandLandmarker + FaceLandmarker (GPU, caps de FPS)
    ├── smoothing.js        # filtro One-Euro (clase OneEuroFilter)
    ├── gestures.js         # pinch, spread, velocidad de manos, handedness
    ├── energy.js           # motor de energía 0-100 (fuentes, decay, picos)
    ├── audio.js            # loop acid house con crossfade + AnalyserNode (kick→vibración) + filtro del bajo modulado por spread + zap en pinch + silencio
    ├── hud.js              # HUD DOM: energía, rayos, silencio (M), modo limpio (H), modo demo (D)
    ├── demo.js             # simulador de manos con mouse (fallback sin cámara)
    └── effects/
        ├── sparks.js       # partículas (bursts y chispas de yemas)
        ├── threads.js      # hilos neón
        ├── drops.js        # gotas glitch
        ├── bolts.js        # rayos finos logo↔manos
        ├── logo.js         # logo elástico (spring mesh) + flotación + pulso
        ├── facehud.js      # marco de esquinas rojas alrededor del rostro (SIN texto)
        └── screenfx.js     # vibración por kick + zoom-pulso + vignette
```

## Pipeline de datos

```
Cámara getUserMedia (1280×720, espejo) — o simulador (demo.js)
   ↓ caps: hands ~20fps · face ~10fps
MediaPipe Tasks (HandLandmarker GPU + FaceLandmarker con blendshapes, 2 manos, 1 cara)
   ↓ landmarks normalizados [0-1] (x invertido por espejo: 1-x)
One-Euro filter (suavizado)
   ↓
gestures.js → velocidad / pinch / spread  ·  smile (blendshape suavizado)
   ↓
energy.js → 0-100 (decay 9/s)
   ↓
effects/* dibujan en canvas 'screen' — el render loop NO bloquea a MediaPipe
audio.js → AnalyserNode banda <150Hz → kick → screenfx.vibración
```

---

## Módulos (especificación)

### config.js
- `W=1080`, `H=1920` (canvas interno fijo; CSS escala al viewport; DPR cap 2).
- Paletas (sin amarillo/verde): `ROJA {rojo:'#FF2A2A', blanco:'#FFFFFF'}` (default) y `NEON {cian:'#00F0FF', magenta:'#FF00CC', rojo:'#FF003C', blanco:'#FFFFFF'}`. Teclas 1/2.
- Energía: `DECAY=9` (por segundo), `PINCH_BOOST=22`, `SMILE_ENERGY=9` (×smile si smile>0.08), umbral rayos `BOLT_ENERGY=20`, `VELOCIDAD_FACTOR` (tunable).
- Logo: `w=320`, centro `y=0.36H`, malla `GRID={cols:18, rows:9}`, física `K=150, DAMP=8, MASS=1`, repulsión manos `<260px`, fuerza vibración `0.06`.
- Manos: 5 yemas por mano, ángulos `[-62,-31,0,31,62]°`, radio elíptico `92×44`.
- Rayos: `prob = ((energy-20)/80)*0.55`, máx 14, 7 segmentos, offset 0.30×largo.
- Gotas: rate `energy*0.008` (solo `energy>5`), máx 140, cooldown 0.35s, glitch cada 0.7–2.9s durante 0.09–0.19s.
- Onda grave: decay 2.4, `amp = kick²×30 + energy/100×2.6`, zoom `1+kick×0.006`.

### tracker.js
- CDN: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision` (runtime + wasm local en `public/` opcional; usar CDN con `delegate:'GPU'`).
- `HandLandmarker` (modelAssetPath oficial `hand_landmarker/float16/1/hand_landmarker.task`, `runningMode:'VIDEO'`, `numHands:2`).
- `FaceLandmarker` (`face_landmarker/float16/1/face_landmarker.task`, `outputFaceBlendshapes:true`, `numFaces:1`).
- Caps: hands cada ~50ms (20fps), face cada ~100ms (10fps) — medir y ajustar en config.
- API: `onHands(cb)` / `onFace(cb)`; expone `start(videoEl)`, `stop()`; datos: `[{handedness:'Left'|'Right', landmarks:[[x,y,z]×21]}]` (x ya espejado) y `{faceBox:{x,y,w,h}, smile:0-1}`.
- Si getUserMedia falla → llamar `demo.start()` (modo demo).

### smoothing.js
- Clase `OneEuroFilter(minCutoff=1.0, beta=0.007, dCutoff=1.0)`; método `filter(prev, value, dt)` — filtro por coordenada (x, y) de cada landmark.

### gestures.js
- `pinch(hand)`: dist(pulgar[4], índice[8]) < 0.05 normalizado, con histéresis (no re-disparar hasta que abra > 0.07). Callback `onPinch(x, y)` (posición en px del punto medio).
- `spread(hand)`: dist(índice[8], meñique[20]) normalizado.
- `velocidad`: media de deltas de las 5 yemas por segundo (normalizado).
- Handedness estable: usar `handedness` de MediaPipe; si se cruzan, mantener identidad por cercanía de la yema índice anterior.

### energy.js
- `energy` 0-100. `update(dt, {velocidad, smile, spread})`: decay `9×dt`; `+velocidad×VELOCIDAD_FACTOR×dt`; smile `>0.08 → +9×smile×dt`. `boost(n)` para pinches. Exponer `nivel`, `alerta(umbral)`.

### effects/logo.js — el logo elástico flotante (nunca se rompe)
- Imagen `assets/logo-barrett.png`, blend `'screen'` (el negro del PNG desaparece).
- Malla `18×9` vértices con física spring (K/DAMP/MASS) hacia su reposo; fuerzas externas: repulsión de manos (<260px), shockwaves (anillo), vibración por energía (`(rand-0.5)×energy×0.06×60`).
- Render: por triángulo → `clip()` + transform afín (3 pares UV→XY) + `drawImage`; `shadowBlur = 52 + energy×0.7`.
- Flotación: deriva `sin(t×0.8)×28` (x) y `cos(t×0.6)×20` (y) — aplicada como `ctx.translate` en el render (la física no se entera).
- Pulso de escala: `1 + sin(t×1.4)×0.014 + (energy/100)×0.04 + sin(t×5.2)×0.005×min(energy,40)/40`, aplicado a los vértices alrededor del centro.
- API: `update(dt, estado)`, `draw(ctx)`; exportar `logoCenter()` (centro con deriva) para los rayos.

### effects/threads.js — hilos neón
- 14 nodos con posiciones base fijas (seed) y deriva sin lenta (`±32×24`).
- Conexiones: (a) yemas L↔R espejadas (dist < 840), (b) cada yema → 2 nodos más cercanos (dist < 480), (c) nodos→nodos vecinos (dist < 300).
- Estilo: `lineWidth 3.2`, `shadowBlur 20`, colores `[rojo, rojo, blanco]` alternados, `globalAlpha` según `(1-d/distMax)×intensidad`, intensidad `0.35 + energy×0.007`, composite `'screen'`. Nodos como puntos brillantes (r 4.8).

### effects/drops.js — gotas glitch
- Nacen SOLO de yemas (rate `energy×0.008`, `energy>5`). **No dan energía** (anti-bucle: las gotas son atmósfera).
- Física: gravedad 600px/s², deriva lateral sin. Cooldown de nacimiento 0.35s (no impactan al nacer).
- Render gota: 3 pasadas de la silueta con offset ±4.8px en rojo y cian + centro blanco (aberración cromática), composite screen.
- Glitch periódico: 3–5 slices horizontales con RGB split y offset aleatorio.
- Impacto (manos <68px o suelo): burst de 6–14 sparks + eliminar.

### effects/bolts.js — rayos finos logo↔manos
- Spawn si `energy>20` y `bolts.length<14`: probabilidad `((energy-20)/80)×0.55` por frame.
- Origen alterno: borde del logo (elipse del `logoCenter()` con radios `w×0.42 / h×0.42`) ↔ yema aleatoria.
- Zigzag: 7 segmentos, offset perpendicular `(rand-0.5)×0.30×largo`.
- Trazo fino: halo color `lineWidth 3.2, shadowBlur 28` + núcleo blanco `lineWidth 1.6`; chispas en extremos.
- Vida: `life 1, decay 5.5` (~0.18s).

### effects/facehud.js — marco de cara
- Marco de esquinas (corner brackets, largo 36px) rojas con glow alrededor del `faceBox` real de la cara. **SIN texto** (se eliminó el lema).
- La sonrisa alimenta la energía en silencio (sin display).

### effects/screenfx.js — vibración + zoom + vignette
- `kicks[]` con decay 2.4/s; `amp = kick²×30 + energy/100×2.6`; cada frame `ctx.translate((rand-0.5)×amp×2, (rand-0.5)×amp×2)` + zoom `1+kick×0.006` alrededor del centro (todo el dibujo envuelto en save/restore).
- El HUD DOM NO vibra.
- Vignette pre-renderizada (gradiente radial, alpha 0.55 en bordes).

### audio.js — acid house reactivo
- `AudioContext` se crea en el click de ENTRAR (gesto de usuario).
- Loop: `public/assets/music/acid-loop.mp3` (~45s, generado por Hermes con ElevenLabs). Reproducción con **crossfade circular 0.8s** (2 AudioBufferSourceNode desfasados para loop sin clic).
- **Filtro del bajo modulado por distancia de manos**: `BiquadFilter lowpass` sobre la pista, `cutoff = map(spread, [0.10, 0.60] → [180, 3000] Hz)`, `Q=4`, suavizado One-Euro (minCutoff 2). Manos juntas = filtro cerrado (sub grave); abiertas = 303 ácido. En pinch: sweep rápido del cutoff (×2 y vuelta, ~0.3s) — sensación de release del bajo.
- `AnalyserNode fftSize 512`: energía de la banda 20–150Hz; si supera umbral (tunable) → `triggerKick()` (vibración síncrona con el kick).
- Zap en pinch: oscilador sawtooth 800→40Hz, 0.1s (mantener, suena bien).
- Silencio: tecla M o botón (gain master).

### hud.js + main.js
- Overlay inicial: logo BARRETT centrado + botón **ENTRAR** (inicia cámara + audio + tracker). Badge "sin cámara" SOLO en modo demo.
- HUD: barra de energía (gradiente rojo), estado "⚡ RAYOS: activos/en espera", botones: silencio (M), modo limpio (H — oculta HUD para evento), modo demo (D).
- `main.js`: `requestAnimationFrame` loop; por frame: leer estado de tracker → energy.update → effects.update/draw; NO esperar a MediaPipe (estado compartido).

### demo.js — simulador (fallback)
- Sin cámara: el mouse mueve 2 manos simuladas (spread por rueda), click = pinch, teclas E/Q energía, S/A sonrisa, B kick. Reutiliza la lógica de entrada del mockup `mockups-camara-manos/index.html` (referencia viva).

---

## Reglas de implementación
- ES modules, comentarios en español, constantes en `config.js` (nada de números mágicos en los effects).
- Nada de "after the mix" en textos.
- El logo PNG se versiona (marca pública); NO versionar claves ni emails.
- El mp3 del loop se genera aparte (no lo crea el agente).
- No tocar el repo Dashboard (la integración la hace Hermes después).
- Verificación obligatoria al terminar: `node --check` de cada módulo JS, `npm run build` sin errores, y reporte de archivos creados + resultado.

## Integración posterior (la hace Hermes, no el agente)
- Copiar el build a `Dashboard/BS-015/` + card 05 "Cámara + Manos" en `Dashboard/index.html` (accent `#FF2A2A`, icono ⚡, href `/BS-015/`).
- Deploy `deploy.ps1` + verificación post-deploy.
- GitHub: repo `DarkChicha/visualflow` (README hub + BS-015/ con capturas).

---

## Revisión doble aplicada (Hermes + Claude Opus, 2026-08-17)

Hallazgos de la revisión Opus corregidos en esta versión:

- **C1** — `setTransform` → `ctx.transform` en los triángulos del logo (el setTransform rompía el DPR/shake y descuadraba el logo).
- **C2** — el logo se renderiza en un canvas offscreen UNA vez por frame y el glow se aplica en un solo `drawImage` (antes: 324 shadowBlur por frame = FPS inviable y halo invisible).
- **C3** — detección de kick por **flujo** (banda 20–150 Hz vs media móvil) con `FFT_SIZE=2048` (a 48 kHz el fundamental del kick vive en el bin 0, que `FFT_SIZE=512` excluía; desviación anotada de la spec original).
- **C4** — mapeo tipo *cover* con `videoWidth/videoHeight` reales (antes las manos se estiraban 3.16× al mapear 16:9 → 9:16 y el pinch se descalibraba).
- **M1** — fondo y viñeta se dibujan con la matriz base (fuera del shake) → sin ghosting en los bordes con la vibración.
- **M2** — el sweep del filtro en el pinch queda protegido del `setTargetAtTime` por frame (`sweepHasta`).
- **M3** — loop con `LOOP_DUR=44.16 s` (23 compases a 125 BPM) + cola real del mp3 en el crossfade → el groove no se corre.
- **M4** — identidad de manos resuelta en el tracker ANTES de filtrar (asignación exclusiva por cercanía a los bancos One-Euro).
- **M5** — try/catch en el bucle de inferencia + degradación a demo tras fallos.
- **M6** — clamp de vértices (`CELL_CLAMP=0.45`) + `DAMP=22` (~crítico) → las celdas nunca se invierten, el logo **nunca se rompe**.
- **M7** — spread relaja al reposo sin dos manos (el filtro del bajo no se congela).
- **M8** — canvas a W×H sin dpr (el backing store no se sobredimensiona 18×).
- **M9** — `facingMode:'user'` + constraints con `ideal`.
- **M10** — `prefers-reduced-motion` reduce vibración y spawns (fotosensibilidad).
- **Menores**: assets importados por Vite (URLs correctas con `base:'./'`, sin 404 sin barra final), cámara antes que modelos + timeout, `close()` de landmarkers, `ctx.resume()`, overlay ocultado al final, velocidad media de manos, spawns normalizados por dt, colores de hilos estables, HUD con cache, radio del simulador correcto, accesibilidad (aria, contraste).

