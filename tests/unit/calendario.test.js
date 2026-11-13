import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularMes, esBisiesto } from '../../src/ui-i3/demos/calendario-motor.js';

test('calendario aplica las excepciones de los años bisiestos', () => {
  assert.equal(esBisiesto(1900),false);
  assert.equal(esBisiesto(2000),true);
  assert.equal(esBisiesto(2100),false);
  assert.equal(esBisiesto(2400),true);
  assert.equal(calcularMes(2024,2).cantidad,29);
  assert.equal(calcularMes(2025,2).cantidad,28);
});
test('calendario ubica todos los meses entre 1900 y 2400 como el calendario UTC', () => {
  for(let anio=1900; anio<=2400; anio++) for(let mes=1; mes<=12; mes++) {
    const resultado=calcularMes(anio,mes);
    const esperado=(new Date(Date.UTC(anio,mes-1,1)).getUTCDay()+6)%7;
    assert.equal(resultado.inicio,esperado,`${anio}-${mes}`);
    assert.equal(resultado.cantidad,new Date(Date.UTC(anio,mes,0)).getUTCDate());
  }
});
test('calendario rechaza fechas fuera del rango', () => {
  for(const [anio,mes] of [[1899,1],[2401,1],[2026,0],[2026,13],[2026.1,1],[2026,NaN]])assert.throws(()=>calcularMes(anio,mes),RangeError);
});
