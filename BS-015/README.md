# BS-015 — Cámara + Manos

Pieza de **realidad aumentada de pantalla** (vertical 9:16, 1080×1920) del área AV de Barrett Sessions: la cámara ve tus manos y tu cara y genera visuales generativos en tiempo real — hilos neón, gotas glitch, el logo BARRETT elástico flotante que **intercambia rayos de energía** con tus manos, la sonrisa que convoca energía y la pantalla que **vibra con la onda grave** del acid house.

- **Audio**: loop acid house (45 s, 125 BPM, TB-303 + drum machine de la época) generado con ElevenLabs Music API. El bajo pasa por un filtro cuyo **cutoff sigue la distancia entre tus manos** (juntas = sub grave cerrado, abiertas = 303 ácido); el pinch hace un sweep (release del bajo) y el kick real del track dispara la vibración de pantalla.
- **Stack**: Vite + vanilla JS (ES modules, sin frameworks) + MediaPipe Tasks API (GPU).
- **Flujo**: cámara → HandLandmarker (2 manos) + FaceLandmarker (1 cara, blendshape *smile*) con caps de FPS → One-Euro filter → motor de energía (movimiento + pinches + sonrisa) → effects en canvas 2D (composite `screen`).

## Probar

```bash
npm install
npm run dev      # dev server
npm run build    # build → dist/
```

Al entrar pide cámara y audio. **Sin cámara** entra automáticamente en **modo demo** (simulador con mouse). Teclas: `1/2` paleta · `M` silencio · `H` modo limpio (evento) · `D` modo demo · en demo: mouse = manos, click = pinch, rueda = separar, `E/Q` energía, `S/A` sonrisa, `B` onda grave.

## Proceso creativo

- Referencias analizadas: [Barrett Sessions — Interactive Brand Experience (Behance)](https://www.behance.net/gallery/251678487/Barrett-Sessions-Interactive-Brand-Experience) y el demo HandConnect (AR neón con manos).
- Mockups interactivos v1→v8 en `Developer/mockups-camara-manos/` (simulador con mouse; decisiones: paleta roja Barrett, logo nunca se rompe, rayos finos, sonrisa sin display, vibración por kick, sin lema de evento).
- Contrato técnico: `SPEC.md` (spec completa por módulo + correcciones de la doble revisión: Hermes + Claude Opus).
- Audio: track generado con ElevenLabs (`docs/spectrograma-acid-loop.png` muestra el perfil: subgraves masivos, kick 4/4, 303 en medios, hi-hats).

## Integración

- Sirve desde el dashboard interno: `video-editorial.web.app/BS-015/` (carpeta estática `Dashboard/BS-015/`).
- Repo del hub: `DarkChicha/visualflow` (este es el primer proyecto; vienen más piezas Barrett Sessions).
