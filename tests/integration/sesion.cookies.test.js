import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import request from 'supertest';
import { app } from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import { env } from '../../src/config/env.js';
import { CONSTANTS } from '../../src/config/constants.js';

after(() => pool.end());

const sid = 'sesion-regresion-cookies';
const firma = createHmac('sha256', env.SESSION_SECRET).update(sid).digest('base64').replace(/=+$/, '');
const cookie = `${CONSTANTS.SESSION.COOKIE_NAME}=${encodeURIComponent(`s:${sid}.${firma}`)}`;
const caida = () => Object.assign(new Error('base de prueba inaccesible'), { code: 'ECONNREFUSED' });
const sesion = {
  cookie: { originalMaxAge: 1800000, expires: new Date(Date.now() + 1800000).toISOString(), httpOnly: true, path: '/' },
  usuarioId: 1, versionSesion: 1, autenticadoEn: Date.now(),
};

test('Cookie guardada y base caída: las páginas públicas abren sin borrar ni renovar la sesión', async t => {
  t.mock.method(pool, 'query', async () => { throw caida(); });
  for (const ruta of ['/', '/equipo', '/equipo/I3', '/servicios', '/proyectos', '/detalle', '/login', '/registro']) {
    const res = await request(app).get(ruta).set('Cookie', cookie).expect(200);
    assert.match(res.text, /href="\/login"/);
    assert.equal(res.headers['cache-control'], 'no-store');
    assert.ok(!(res.headers['set-cookie'] || []).some(value => value.startsWith(`${CONSTANTS.SESSION.COOKIE_NAME}=`)));
  }
});

test('Una sesión no verificable no autoriza rutas privadas, CSRF ni escrituras', async t => {
  t.mock.method(pool, 'query', async () => { throw caida(); });
  for (const [metodo, ruta] of [
    ['get', '/mi-cuenta'], ['get', '/operador/consultas'], ['get', '/admin/metricas'],
    ['get', '/api/auth/me'], ['get', '/api/csrf'], ['post', '/api/auth/login'],
    ['post', '/api/auth/registro'], ['post', '/api/consultas'],
  ]) {
    const res = await request(app)[metodo](ruta).set('Cookie', cookie).expect(503);
    assert.equal(res.headers['retry-after'], '30');
    if (ruta.startsWith('/api')) assert.equal(res.body.error.code, 'SERVICIO_NO_DISPONIBLE');
  }
});

test('Contacto abre con o sin cookie si la base está caída y no habilita envíos', async t => {
  t.mock.method(pool, 'query', async () => { throw caida(); });
  for (const cookieActual of ['', cookie]) {
    const res = await request(app).get('/contacto').set('Cookie', cookieActual).expect(200);
    assert.match(res.text, /Contacto temporalmente no disponible/);
    assert.match(res.text, /data-disponible="0"/);
    assert.match(res.text, /<button[^>]+id="btn-enviar"[^>]+disabled/);
  }
});

test('Contacto conectado muestra servicios reales y habilita el formulario', async t => {
  t.mock.method(pool, 'query', async sql => {
    if (sql.includes('FROM app.servicios')) return { rows: [{ id: 7, nombre: 'Servicio de prueba' }] };
    return { rows: [] };
  });
  const res = await request(app).get('/contacto?tipo=cotizacion&servicioId=7').expect(200);
  assert.match(res.text, /data-disponible="1"/);
  assert.match(res.text, /value="7" selected>Servicio de prueba/);
  assert.doesNotMatch(res.text, /<button[^>]+id="btn-enviar"[^>]+disabled/);
  assert.doesNotMatch(res.text, /Contacto temporalmente no disponible/);
});

test('Si se carga la sesión pero falla verificar al usuario, el inicio sigue siendo anónimo', async t => {
  t.mock.method(pool, 'query', async sql => {
    if (sql.includes('SELECT sess')) return { rows: [{ sess: sesion }] };
    throw caida();
  });
  const res = await request(app).get('/').set('Cookie', cookie).expect(200);
  assert.match(res.text, /href="\/login"/);
  assert.doesNotMatch(res.text, />Mi cuenta<\/a>/);
});

test('La misma cookie recupera su usuario cuando la base vuelve a responder', async t => {
  t.mock.method(pool, 'query', async sql => {
    if (sql.includes('SELECT sess')) return { rows: [{ sess: sesion }] };
    if (sql.includes('FROM app.usuarios')) return { rows: [{
      id: 1, nombre: 'Prueba', email: 'prueba@example.com', rol: 'registrado', activo: true, version_sesion: 1,
    }] };
    return { rows: [] };
  });
  const res = await request(app).get('/api/auth/me').set('Cookie', cookie).expect(200);
  assert.equal(res.body.ok, true);
  const cuenta = await request(app).get('/mi-cuenta').set('Cookie', cookie).expect(200);
  assert.match(cuenta.text, />Mi cuenta<\/a>/);
});

test('Errores de programación al verificar sesión siguen llegando al manejador de errores', async t => {
  t.mock.method(pool, 'query', async () => { throw new TypeError('fallo simulado'); });
  await request(app).get('/').set('Cookie', cookie).expect(500);
});
