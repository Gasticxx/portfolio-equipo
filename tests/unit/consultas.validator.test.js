// Pruebas unitarias de validación del módulo de consultas (I6). Sin base ni proveedores.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  crearConsultaSchema,
  respuestaSchema,
  listadoConsultasSchema,
  reintentoSchema,
  camposDesdeZod,
  validarIdRuta,
  validarIdempotencyKey
} from '../../src/validators/consultas.validator.js';

const valida = {
  nombre: 'Ana Pérez',
  email: 'ana@example.com',
  tipo: 'cotizacion',
  asunto: 'Sitio institucional',
  mensaje: 'Necesitamos un sitio para presentar nuestros servicios.',
  consentimiento: true,
  servicioId: 1
};

const campos = (schema, datos) => {
  const r = schema.safeParse(datos);
  return r.success ? {} : camposDesdeZod(r.error);
};

test('acepta el ejemplo del contrato y normaliza email y espacios', () => {
  const r = crearConsultaSchema.parse({ ...valida, nombre: '  Ana Pérez ', email: ' ANA@Example.COM ' });
  assert.equal(r.nombre, 'Ana Pérez');
  assert.equal(r.email, 'ana@example.com');
});

test('los tres tipos son válidos; otro tipo no', () => {
  for (const tipo of ['general', 'cotizacion', 'asesoria']) {
    assert.ok(crearConsultaSchema.safeParse({ ...valida, tipo, servicioId: null }).success, tipo);
  }
  assert.ok('tipo' in campos(crearConsultaSchema, { ...valida, tipo: 'reclamo' }));
});

test('consentimiento false o ausente es error de campo', () => {
  assert.ok('consentimiento' in campos(crearConsultaSchema, { ...valida, consentimiento: false }));
  const { consentimiento, ...sin } = valida;
  assert.ok('consentimiento' in campos(crearConsultaSchema, sin));
  assert.ok('consentimiento' in campos(crearConsultaSchema, { ...valida, consentimiento: 'true' }));
});

test('servicioId solo con cotización; ausente se normaliza a null', () => {
  assert.ok('servicioId' in campos(crearConsultaSchema, { ...valida, tipo: 'general' }));
  const { servicioId, ...sin } = valida;
  assert.equal(crearConsultaSchema.parse({ ...sin, tipo: 'general' }).servicioId, null);
  assert.ok('servicioId' in campos(crearConsultaSchema, { ...valida, servicioId: 1.5 }));
  assert.ok('servicioId' in campos(crearConsultaSchema, { ...valida, servicioId: '1' }));
});

test('límites de longitud medidos en caracteres Unicode tras trim', () => {
  assert.ok('nombre' in campos(crearConsultaSchema, { ...valida, nombre: ' A ' }));
  assert.ok(crearConsultaSchema.safeParse({ ...valida, nombre: 'Ñu' }).success);
  assert.ok('nombre' in campos(crearConsultaSchema, { ...valida, nombre: 'x'.repeat(81) }));
  assert.ok('asunto' in campos(crearConsultaSchema, { ...valida, asunto: 'Hola' }));
  assert.ok('mensaje' in campos(crearConsultaSchema, { ...valida, mensaje: 'x'.repeat(19) }));
  // 3000 emojis = 3000 caracteres (6000 unidades UTF-16): válido
  assert.ok(crearConsultaSchema.safeParse({ ...valida, mensaje: '😀'.repeat(3000) }).success);
  assert.ok('mensaje' in campos(crearConsultaSchema, { ...valida, mensaje: '😀'.repeat(3001) }));
});

test('rechaza NUL, saltos de línea en asunto y campos desconocidos', () => {
  assert.ok('mensaje' in campos(crearConsultaSchema, { ...valida, mensaje: 'Mensaje con NUL \u0000 adentro y largo' }));
  assert.ok('asunto' in campos(crearConsultaSchema, { ...valida, asunto: 'Línea uno\nLínea dos' }));
  const f = campos(crearConsultaSchema, { ...valida, rol: 'administrador', destinatario: 'x@y.z' });
  assert.equal(f.rol, 'Campo no admitido.');
  assert.equal(f.destinatario, 'Campo no admitido.');
});

test('normaliza CRLF a LF en el mensaje', () => {
  assert.equal(crearConsultaSchema.parse({ ...valida, mensaje: 'Línea uno larga\r\nLínea dos larga' }).mensaje, 'Línea uno larga\nLínea dos larga');
});

test('email inválido o de más de 254 caracteres', () => {
  assert.ok('email' in campos(crearConsultaSchema, { ...valida, email: 'sin-arroba' }));
  assert.ok('email' in campos(crearConsultaSchema, { ...valida, email: `${'a'.repeat(250)}@x.com` }));
});

test('respuesta del operador: 10 a 3000 y sin destinatario', () => {
  assert.ok(respuestaSchema.safeParse({ mensaje: '1234567890' }).success);
  assert.ok('mensaje' in campos(respuestaSchema, { mensaje: '123456789' }));
  assert.ok('mensaje' in campos(respuestaSchema, { mensaje: 'x'.repeat(3001) }));
  assert.ok('destinatario' in campos(respuestaSchema, { mensaje: '1234567890', destinatario: 'x@y.z' }));
});

test('reintento: objeto vacío o confirmarRiesgo booleano', () => {
  assert.ok(reintentoSchema.safeParse({}).success);
  assert.ok(reintentoSchema.safeParse({ confirmarRiesgo: true }).success);
  assert.ok(!reintentoSchema.safeParse({ confirmarRiesgo: 'si' }).success);
  assert.ok(!reintentoSchema.safeParse({ otro: 1 }).success);
});

test('query del listado: defaults, límites, repetidos y desconocidos', () => {
  assert.deepEqual(listadoConsultasSchema.parse({}), { page: 1, pageSize: 10 });
  assert.equal(listadoConsultasSchema.parse({ q: '  ana  ' }).q, 'ana');
  assert.ok(!listadoConsultasSchema.safeParse({ pageSize: '51' }).success);
  assert.ok(!listadoConsultasSchema.safeParse({ page: '0' }).success);
  assert.ok(!listadoConsultasSchema.safeParse({ page: ['1', '2'] }).success);
  assert.ok(!listadoConsultasSchema.safeParse({ q: 'a' }).success);
  assert.ok(!listadoConsultasSchema.safeParse({ orden: 'id' }).success);
  assert.ok(!listadoConsultasSchema.safeParse({ notificacionEstado: 'leido' }).success);
});

test('IDs de ruta y Idempotency-Key canónica', () => {
  assert.equal(validarIdRuta('25'), 25);
  for (const malo of ['0', '-1', '01', '1.5', 'abc', '2147483648']) assert.throws(() => validarIdRuta(malo), { status: 400 });
  const uuid = '3f0e1c9a-7b2d-4c1e-9a8b-0d1e2f3a4b5c';
  assert.equal(validarIdempotencyKey(uuid), uuid);
  assert.throws(() => validarIdempotencyKey(uuid.toUpperCase()), { status: 400 });
  assert.throws(() => validarIdempotencyKey(undefined), { status: 400 });
  assert.throws(() => validarIdempotencyKey('no-es-uuid'), { status: 400 });
});
