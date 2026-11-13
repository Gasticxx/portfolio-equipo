import test from 'node:test';
import assert from 'node:assert/strict';
import { escenarioOndas, campoOndas, aporteOnda, limitarOnda } from '../../src/ui-i3/demos/ondas-motor.js';

const parametros = { frecuencia: .9, velocidad: 30, amplitud: .75, aspecto: 1.5 };
test('Ondas: un frente no afecta puntos que todavía no alcanzó', () => {
  const fuente = { nacimiento: 0, fase: 0 };
  assert.equal(aporteOnda(60, 1, fuente, 1, 30), 0);
  assert.notEqual(aporteOnda(60, 2.25, fuente, 1, 30), 0);
});
test('Ondas: superposición suma fuentes y una inversión de fase cancela el eje central', () => {
  const fuentes = escenarioOndas();
  const tiempo = 21 / parametros.velocidad + .25 / parametros.frecuencia;
  const sola = campoOndas(.5, .5, tiempo, fuentes.slice(0, 1), parametros);
  const juntas = campoOndas(.5, .5, tiempo, fuentes, parametros);
  assert.ok(Math.abs(sola - parametros.amplitud / (1 + 21 * .012)) < 1e-12);
  assert.ok(Math.abs(juntas - 2 * sola) < 1e-12);
  const opuestas = campoOndas(.5, .5, tiempo, escenarioOndas('oposicion'), parametros);
  assert.ok(Math.abs(opuestas) < 1e-12);
  assert.equal(Math.abs(campoOndas(.2, .4, 3, fuentes, { ...parametros, amplitud: 0 })), 0);
});
test('Ondas: escenarios independientes, seis fuentes acotadas y valores finitos de controles', () => {
  const original = escenarioOndas(); original[0].x = 0;
  assert.equal(escenarioOndas()[0].x, .36); assert.equal(escenarioOndas('una').length, 1);
  assert.equal(escenarioOndas('seis').length, 6);
  assert.ok(escenarioOndas('seis').every(f => f.x >= .05 && f.x <= .95 && f.y >= .05 && f.y <= .95));
  assert.equal(limitarOnda(NaN, .2, 3), .2); assert.equal(limitarOnda(Infinity, .2, 3), .2);
  assert.equal(limitarOnda(9, .2, 3), 3); assert.equal(limitarOnda(-1, .2, 3), .2);
});
