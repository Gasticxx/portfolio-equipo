import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  servicioBodySchema,
  servicioPutBodySchema,
  servicioQuerySchema,
  idParamSchema
} from '../../src/validators/servicios.validator.js';

describe('Validadores del módulo Servicios (I1)', () => {
  it('acepta un servicio válido en POST y aplica valores por defecto', () => {
    const resultado = servicioBodySchema.safeParse({
      nombre: '  Desarrollo de sitios web  ',
      descripcion: 'Construcción de sitios adaptables con presentación institucional y gestión.',
      categoria: 'web'
    });

    assert.equal(resultado.success, true);
    assert.equal(resultado.data.nombre, 'Desarrollo de sitios web');
    assert.equal(resultado.data.activo, true);
    assert.equal(resultado.data.orden, 1);
  });

  it('rechaza campos desconocidos por modo strict()', () => {
    const resultado = servicioBodySchema.safeParse({
      nombre: 'Desarrollo web',
      descripcion: 'Construcción de sitios adaptables con presentación institucional.',
      categoria: 'web',
      precio: 5000
    });

    assert.equal(resultado.success, false);
  });

  it('rechaza nombres cortos (< 3) o descripciones cortas (< 20)', () => {
    const resultado = servicioBodySchema.safeParse({
      nombre: 'AB',
      descripcion: 'Muy corta',
      categoria: 'asesoria'
    });

    assert.equal(resultado.success, false);
  });

  it('exige todos los campos editables en PUT', () => {
    const incompleto = servicioPutBodySchema.safeParse({
      nombre: 'Mantenimiento de aplicaciones',
      descripcion: 'Revisión y mejora de interfaces, corrección de errores y funciones.',
      categoria: 'mantenimiento'
    });

    assert.equal(incompleto.success, false);
  });

  it('valida parámetros de búsqueda y paginación en GET /api/admin/servicios', () => {
    const valido = servicioQuerySchema.safeParse({
      page: '2',
      pageSize: '15',
      q: 'Desarrollo',
      activo: 'true'
    });

    assert.equal(valido.success, true);
    assert.equal(valido.data.page, 2);
    assert.equal(valido.data.pageSize, 15);
    assert.equal(valido.data.activo, true);
  });

  it('valida que el parámetro :id sea un entero positivo válido', () => {
    assert.equal(idParamSchema.safeParse({ id: '12' }).success, true);
    assert.equal(idParamSchema.safeParse({ id: '0' }).success, false);
    assert.equal(idParamSchema.safeParse({ id: '-5' }).success, false);
    assert.equal(idParamSchema.safeParse({ id: 'abc' }).success, false);
  });
});