// Parámetros por defecto (todos expuestos como faders en main.js)
export const defaults = {
  seed: 7,

  // Intensidad: 0 = video limpio, 1 = fragmentación máxima
  intensity: 0.8,
  auto: true,          // envolvente automática limpio ↔ fragmentado
  autoRate: 0.35,      // ráfagas por segundo
  autoClean: 0.25,     // fracción de tiempo en que el video queda limpio

  // Layout (árbol de rectángulos)
  maxDepth: 7,
  splitMin: 0.22,      // ratio mínimo de corte
  minCell: 70,         // px mínimos de lado (a 1080 de ancho)
  holdFps: 12,         // cambios de layout por segundo (pasos secos)

  // Qué muestra cada celda
  pZoom: 0.35,
  pShift: 0.2,
  pStreak: 0.08,       // resto = identidad (el trozo de video donde está)
  zoomMax: 3.2,
  shiftMax: 0.18,      // fracción del ancho del video
  streakW: 2,          // px de fuente que se estiran

  // Encuadre virtual (para planos amplios): zoom fijo sobre la cara media del clip
  frameZoom: 1,        // 1 = el video tal cual; >1 acerca
  frameY: 0.35,        // altura (0..1) donde queda la cara al acercar

  // Zona de fragmentación alrededor de la cara (en múltiplos del tamaño de la cara)
  zoneW: 3.4,          // ancho / ancho de cara
  zoneUp: 0.9,         // alturas de cara por encima de la frente
  zoneDown: 3.2,      // alturas de cara hacia abajo desde la frente (cuello, pecho)
  debug: false,        // dibuja cara, puntos y zona

  // Sujeto de respaldo cuando no se detecta cara
  subjX: 0.5, subjY: 0.25, subjSize: 0.12,

  // Aspecto
  border: 2.5,         // px a 1080 de ancho
  borderAlpha: 0.85,
  textAmount: 0.45,
  textSize: 15,
  textAlpha: 0.75
};
