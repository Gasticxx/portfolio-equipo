import test from 'node:test';
import assert from 'node:assert/strict';
import { generarPasos } from '../../src/ui-i3/demos/algoritmos-motor.js';

test('Búsqueda lineal: duplicados, primera coincidencia, extremos y ausencia', () => {
  for (const [datos, objetivo, posicion] of [
    [[4, 2, 4], 4, 0], [[-99, 0, 99], 99, 2], [[0], 0, 0], [[1, 2], 3, undefined],
  ]) {
    const pasos = generarPasos({ algoritmo: 'lineal', datos, objetivo });
    assert.equal(pasos.at(-1).encontrado, posicion);
    assert.equal(pasos.length, posicion === undefined ? datos.length : posicion + 1);
    assert.match(pasos.at(-1).resultado, posicion === undefined ? /no se encuentra/ : /Encontrado/);
  }
});

test('Burbuja ordena negativos, ceros, duplicados y listas de uno a veinte valores sin modificar la entrada', () => {
  for (const datos of [[3, 1, 2], [7], [0, -99, 99, 0, -8], [1, 2, 3], Array.from({ length: 20 }, (_, i) => 10 - i)]) {
    const original = [...datos];
    const pasos = generarPasos({ algoritmo: 'burbuja', datos });
    assert.deepEqual(pasos.at(-1).valores, [...datos].sort((a, b) => a - b));
    assert.deepEqual(datos, original);
    for (const paso of pasos) {
      assert.equal(paso.valores.length, datos.length);
      assert.ok(paso.activos.every(indice => indice >= 0 && indice < datos.length));
    }
    if (pasos.length > 1) assert.notEqual(pasos[0].valores, pasos[1].valores);
  }
});

test('El motor rechaza entradas fuera del contrato', () => {
  for (const datos of [[], [1.2], [100], [-100], ['1'], Array(21).fill(1), null]) {
    assert.throws(() => generarPasos({ algoritmo: 'burbuja', datos }));
  }
  assert.throws(() => generarPasos({ algoritmo: 'otro', datos: [1] }));
  for (const objetivo of [undefined, '', 1.2, 100]) {
    assert.throws(() => generarPasos({ algoritmo: 'lineal', datos: [1], objetivo }));
  }
});
