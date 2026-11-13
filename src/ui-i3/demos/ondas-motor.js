// Modelo didáctico: superposición de fuentes sinusoidales radiales, sin reflexiones.
export const ONDAS_MAX_EMISORES = 6;
export function limitarOnda(valor, min, max) {
  return Number.isFinite(Number(valor)) ? Math.max(min, Math.min(max, Number(valor))) : min;
}
export function escenarioOndas(nombre = 'interferencia') {
  const fuente = (x, y, fase = 0) => ({ x, y, fase, nacimiento: 0 });
  if (nombre === 'una') return [fuente(.5, .5)];
  if (nombre === 'seis') return Array.from({ length: 6 }, (_, i) => fuente(.5 + Math.cos(i * Math.PI / 3) * .24, .5 + Math.sin(i * Math.PI / 3) * .28));
  return [fuente(.36, .5), fuente(.64, .5, nombre === 'oposicion' ? Math.PI : 0)];
}
export function aporteOnda(distancia, tiempo, fuente, frecuencia, velocidad) {
  const retardo = tiempo - fuente.nacimiento - distancia / velocidad;
  if (retardo < 0) return 0;
  // Entrada suave del frente y atenuación visual al alejarse del emisor.
  return Math.sin(2 * Math.PI * frecuencia * retardo + fuente.fase)
    * Math.min(1, retardo * 5) / (1 + distancia * .012);
}
export function campoOndas(x, y, tiempo, fuentes, { frecuencia, velocidad, amplitud, aspecto = 1 }) {
  let suma = 0;
  for (const fuente of fuentes) {
    const distancia = Math.hypot((x - fuente.x) * aspecto * 100, (y - fuente.y) * 100);
    suma += aporteOnda(distancia, tiempo, fuente, frecuencia, velocidad);
  }
  return suma * amplitud;
}
