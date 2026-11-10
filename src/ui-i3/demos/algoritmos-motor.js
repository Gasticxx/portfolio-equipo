export function generarPasos({ algoritmo, datos, objetivo }) {
  if (!Array.isArray(datos) || datos.length < 1 || datos.length > 20
      || datos.some(valor => !Number.isInteger(valor) || valor < -99 || valor > 99)) {
    throw new Error('Ingresá de 1 a 20 enteros entre -99 y 99.');
  }
  const valores = [...datos];
  const pasos = [];
  if (algoritmo === 'lineal') {
    if (!Number.isInteger(objetivo) || objetivo < -99 || objetivo > 99) {
      throw new Error('Ingresá un objetivo entero entre -99 y 99.');
    }
    for (let i = 0; i < valores.length; i++) {
      const coincide = valores[i] === objetivo;
      const paso = {
        valores: [...valores], activos: [i],
        comparacion: `Posición ${i + 1}: ${valores[i]} ${coincide ? '=' : '≠'} ${objetivo}.`,
      };
      pasos.push(paso);
      if (coincide) {
        paso.encontrado = i;
        paso.resultado = `Encontrado en posición ${i + 1}.`;
        return pasos;
      }
    }
    pasos.at(-1).resultado = `El valor ${objetivo} no se encuentra en la lista.`;
    return pasos;
  }
  if (algoritmo !== 'burbuja') throw new Error('Elegí un algoritmo válido.');
  for (let fin = valores.length - 1; fin > 0; fin--) {
    let huboIntercambio = false;
    for (let i = 0; i < fin; i++) {
      const izquierda = valores[i], derecha = valores[i + 1];
      const intercambiar = izquierda > derecha;
      if (intercambiar) {
        [valores[i], valores[i + 1]] = [derecha, izquierda];
        huboIntercambio = true;
      }
      pasos.push({
        valores: [...valores], activos: [i, i + 1],
        comparacion: `${izquierda} ${intercambiar ? '>' : '≤'} ${derecha}: ${intercambiar ? 'intercambio' : 'sin intercambio'}.`,
      });
    }
    if (!huboIntercambio) break;
  }
  if (!pasos.length) pasos.push({ valores: [...valores], activos: [], comparacion: 'La lista ya está ordenada.' });
  pasos.at(-1).resultado = `Orden ascendente: ${valores.join(', ')}.`;
  return pasos;
}
