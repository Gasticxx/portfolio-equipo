// Integración del módulo I6 con la app real (I2) y los middlewares de I4:
// sesión en PostgreSQL, requerirRol, verificarCsrf, vistas de I3 y errorHandler.
// No envía correos: solo prueba rutas que no llaman a Brevo.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import request from 'supertest';
import { app } from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import { env } from '../../src/config/env.js';

// Cierra el pool compartido al terminar el archivo: si quedan conexiones
// inactivas, el proceso de prueba espera su vencimiento (idleTimeout de 30 s).
after(async () => {
  await pool.end();
});

// ---------------------------------------------------------- Sin base de datos
test('API del operador sin sesión: 401 JSON con requestId', async () => {
  const r = await request(app).get('/api/operador/consultas').set('Accept', 'application/json');
  assert.equal(r.status, 401);
  assert.equal(r.body.error.code, 'NO_AUTENTICADO');
  assert.ok(r.body.error.requestId);
});

test('POST /api/consultas sin token CSRF: 403 sin guardar', async () => {
  const r = await request(app).post('/api/consultas').set('Origin', env.APP_ORIGIN)
    .set('Idempotency-Key', crypto.randomUUID()).send({ nombre: 'Ana' });
  assert.equal(r.status, 403);
  assert.equal(r.body.error.code, 'CSRF_INVALIDO');
});

test('páginas privadas sin sesión redirigen a /login?next=', async () => {
  for (const ruta of ['/operador/consultas', '/operador/consultas/1', '/admin/metricas']) {
    const r = await request(app).get(ruta);
    assert.equal(r.status, 302, ruta);
    assert.equal(r.headers.location, `/login?next=${encodeURIComponent(ruta)}`);
  }
});

// ---------------------------------------------------------- Con base migrada
async function hayEsquema() {
  try {
    const { rows } = await pool.query(`SELECT to_regclass('app.envios_email') IS NOT NULL AND to_regclass('app.sesiones') IS NOT NULL AS ok`);
    return rows[0].ok ? false : 'la base de prueba no está migrada';
  } catch (err) {
    return `sin base de prueba (${err.code ?? err.message})`;
  }
}

/** Firma compatible con express-session (cookie-signature). */
function cookieSesion(sid) {
  const firma = crypto.createHmac('sha256', env.SESSION_SECRET).update(sid).digest('base64').replace(/=+$/, '');
  return `equipo.sid=${encodeURIComponent(`s:${sid}.${firma}`)}`;
}

/** Crea una sesión autenticada real en app.sesiones (como la deja el login de I4). */
async function sesionPara(usuarioId) {
  const sid = crypto.randomBytes(18).toString('base64url');
  const csrfToken = crypto.randomBytes(32).toString('hex');
  const expira = new Date(Date.now() + 30 * 60 * 1000);
  const sess = {
    cookie: { originalMaxAge: 1800000, expires: expira.toISOString(), httpOnly: true, path: '/', sameSite: 'lax' },
    usuarioId,
    versionSesion: 1,
    autenticadoEn: Date.now(),
    csrfToken
  };
  // Misma conversión que connect-pg-simple (to_timestamp): independiente de la zona horaria del servidor.
  await pool.query('INSERT INTO app.sesiones (sid, sess, expire) VALUES ($1, $2, to_timestamp($3))', [sid, sess, Math.floor(expira.getTime() / 1000)]);
  return { cookie: cookieSesion(sid), csrfToken };
}

describe('Módulo I6 montado en la app real', { skip: await hayEsquema() }, () => {
  const ids = {};
  let consultaId;

  before(async () => {
    for (const [rol, email] of [['operador', 'i6-rutas-op@prueba.test'], ['administrador', 'i6-rutas-admin@prueba.test'], ['registrado', 'i6-rutas-reg@prueba.test']]) {
      const { rows } = await pool.query(
        `INSERT INTO app.usuarios (nombre, email, password_hash, rol) VALUES ($1, $2, 'scrypt$prueba', $3)
         ON CONFLICT (lower(email)) DO UPDATE SET rol = EXCLUDED.rol, activo = true, version_sesion = 1 RETURNING id`,
        [`Rutas ${rol}`, email, rol]
      );
      ids[rol] = rows[0].id;
    }
    const { rows } = await pool.query(
      `INSERT INTO app.consultas (nombre, email, tipo, asunto, mensaje, consentimiento_at, idempotencia_id, idempotencia_actor, payload_sha256)
       VALUES ('Prueba rutas', 'rutas@example.com', 'general', 'Consulta de rutas', 'Mensaje de prueba de rutas con más de veinte caracteres.', now(), $1, repeat('a', 64), repeat('b', 64))
       RETURNING id`,
      [crypto.randomUUID()]
    );
    consultaId = rows[0].id;
  });

  after(async () => {
    await pool.query('DELETE FROM app.consultas WHERE id = $1', [consultaId]);
    await pool.query(`DELETE FROM app.sesiones WHERE (sess->>'usuarioId')::int = ANY($1)`, [Object.values(ids)]);
  });

  test('operador: lista y detalle en HTML y JSON; métricas le da 403', async () => {
    const { cookie } = await sesionPara(ids.operador);
    const html = await request(app).get('/operador/consultas').set('Cookie', cookie);
    assert.equal(html.status, 200);
    assert.match(html.text, /Consultas<span>\.<\/span>/);
    assert.match(html.text, /href="\/operador\/consultas"/); // cabecera de I3 con enlace Consultas
    assert.equal(html.headers['cache-control'], 'no-store');

    const api = await request(app).get('/api/operador/consultas?q=rutas').set('Cookie', cookie);
    assert.equal(api.status, 200);
    assert.ok(api.body.data.some((c) => c.id === consultaId));

    const detalle = await request(app).get(`/operador/consultas/${consultaId}`).set('Cookie', cookie);
    assert.equal(detalle.status, 200);
    assert.match(detalle.text, /rutas@example\.com/);

    assert.equal((await request(app).get('/operador/consultas/999999').set('Cookie', cookie)).status, 404);
    assert.equal((await request(app).get('/admin/metricas').set('Cookie', cookie)).status, 403);
  });

  test('registrado: 403 en API y página del operador, sin datos', async () => {
    const { cookie } = await sesionPara(ids.registrado);
    const api = await request(app).get('/api/operador/consultas').set('Cookie', cookie);
    assert.equal(api.status, 403);
    assert.equal(api.body.error.code, 'SIN_PERMISO');
    const pagina = await request(app).get('/operador/consultas').set('Cookie', cookie);
    assert.equal(pagina.status, 403);
    assert.doesNotMatch(pagina.text, /rutas@example\.com/);
  });

  test('administrador: vista de métricas con Chart.js local', async () => {
    const { cookie } = await sesionPara(ids.administrador);
    const r = await request(app).get('/admin/metricas').set('Cookie', cookie);
    assert.equal(r.status, 200);
    assert.match(r.text, /<script src="\/vendor\/chart\.umd\.js"><\/script>/);
    assert.match(r.text, /<script type="module" src="\/js\/metricas\.js"><\/script>/);
  });

  test('CSRF real de I4: PATCH sin token 403, con token y Origin 200', async () => {
    const { cookie, csrfToken } = await sesionPara(ids.operador);
    const sinToken = await request(app).patch(`/api/operador/consultas/${consultaId}`).set('Cookie', cookie)
      .set('Origin', env.APP_ORIGIN).send({ estado: 'en_proceso' });
    assert.equal(sinToken.status, 403);
    const ok = await request(app).patch(`/api/operador/consultas/${consultaId}`).set('Cookie', cookie)
      .set('Origin', env.APP_ORIGIN).set('X-CSRF-Token', csrfToken).send({ estado: 'en_proceso' });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(ok.body.data.estado, 'en_proceso');
  });

  test('/contacto renderiza con la cabecera de I3 y preselecciona un servicio activo', async () => {
    const { rows } = await pool.query(
      `INSERT INTO app.servicios (nombre, descripcion, categoria, orden) VALUES ('Servicio rutas I6', 'Servicio creado por la prueba de rutas.', 'web', 99) RETURNING id`
    );
    try {
      const r = await request(app).get(`/contacto?tipo=cotizacion&servicioId=${rows[0].id}`);
      assert.equal(r.status, 200);
      assert.match(r.text, /class="interfaz-i3"/);
      assert.match(r.text, new RegExp(`<option value="${rows[0].id}" selected>Servicio rutas I6</option>`));
      assert.match(r.text, /<option value="cotizacion" selected>/);
      assert.doesNotMatch(r.text, /<script>/); // sin scripts inline (CSP)
    } finally {
      await pool.query('DELETE FROM app.servicios WHERE id = $1', [rows[0].id]);
    }
  });
});
