// Señales de control por tiempo t (s). Interfaz única: en el MP4 se alimenta del análisis offline
// del audio; en vivo, de faders / AnalyserNode. Fase 1: solo envolvente automática + intensidad.
export function controlAt(t, p) {
  let env = 1;
  if (p.auto) {
    const phase = (t * p.autoRate) % 1;
    if (phase < p.autoClean) env = 0;
    else {
      const u = (phase - p.autoClean) / (1 - p.autoClean);
      env = Math.pow(Math.sin(Math.PI * u), 0.55);
    }
  }
  return { intensity: Math.min(1, Math.max(0, p.intensity * env)) };
}
