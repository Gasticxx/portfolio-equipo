import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import request from 'supertest';
import { app } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { pool } from '../../src/config/db.js';
import { CONSTANTS } from '../../src/config/constants.js';
import { generarHash, verificarContrasena } from '../../src/services/contrasenas.service.js';

const sufijo = crypto.randomUUID();
const ids = {};
const sesiones = [];

function cookieSesion(sid) {
  const firma = crypto.createHmac('sha256', env.SESSION_SECRET).update(sid).digest('base64').replace(/=+$/, '');
  return `equipo.sid=${encodeURIComponent(`s:${sid}.${firma}`)}`;
}

async function sesion(id, autenticadoEn = Date.now()) {
  const sid = crypto.randomBytes(18).toString('base64url');
  const csrfToken = crypto.randomBytes(32).toString('hex');
  const { rows: usuarios } = await pool.query('SELECT version_sesion FROM app.usuarios WHERE id=$1', [id]);
  const expira = new Date(Date.now() + 30 * 60_000);
  await pool.query(
    'INSERT INTO app.sesiones (sid, sess, expire) VALUES ($1, $2, to_timestamp($3))',
    [sid, { cookie: { originalMaxAge: 1800000, expires: expira.toISOString(), httpOnly: true, path: '/', sameSite: 'lax' }, usuarioId: id, versionSesion: usuarios[0].version_sesion, autenticadoEn, csrfToken }, Math.floor(expira.getTime() / 1000)],
  );
  sesiones.push(sid);
  return { cookie: cookieSesion(sid), csrfToken };
}

before(async () => {
  for (const rol of ['administrador', 'operador', 'registrado', 'registrado']) {
    const email = `i4-${rol}-${crypto.randomUUID()}@test.invalid`;
    const { rows } = await pool.query(
      `INSERT INTO app.usuarios (nombre,email,password_hash,rol)
       VALUES ($1,$2,'scrypt$fixture',$3) RETURNING id`,
      [`Fixture ${rol}`, email, rol],
    );
    ids[rol] ??= [];
    ids[rol].push(rows[0].id);
  }
});

after(async () => {
  if (sesiones.length) await pool.query('DELETE FROM app.sesiones WHERE sid = ANY($1::varchar[])', [sesiones]);
  const userIds = Object.values(ids).flat();
  await pool.query('DELETE FROM app.accesos WHERE usuario_id = ANY($1::int[])', [userIds]);
  await pool.query('DELETE FROM app.usuarios WHERE id = ANY($1::int[])', [userIds]);
  await pool.end();
});

test('GET usuarios: 401 anónimo; 403 operador y registrado; 200 administrador, filtros y paginación', async () => {
  assert.equal((await request(app).get('/api/admin/usuarios')).status, 401);
  for (const rol of ['operador', 'registrado']) {
    const auth = await sesion(ids[rol][0]);
    const response = await request(app).get('/api/admin/usuarios').set('Cookie', auth.cookie);
    assert.equal(response.status, 403, rol);
  }
  const auth = await sesion(ids.administrador[0]);
  const panel = await request(app).get('/admin').set('Cookie', auth.cookie);
  assert.equal(panel.status, 200);
  for (const ruta of ['/admin/usuarios', '/admin/servicios', '/admin/metricas', '/operador/consultas']) assert.ok(panel.text.includes(`href="${ruta}"`));
  assert.match(panel.text, /Proyectos y demos/);
  const panelUsuarios = await request(app).get('/admin/usuarios').set('Cookie', auth.cookie);
  assert.equal(panelUsuarios.status, 200);
  assert.match(panelUsuarios.text, /Cuentas registradas/);
  const response = await request(app).get('/api/admin/usuarios?page=1&pageSize=1&q=Fixture&activo=true').set('Cookie', auth.cookie);
  assert.equal(response.status, 200);
  assert.equal(response.body.meta.pageSize, 1);
  assert.equal(response.body.meta.total, 2);
  assert.equal(response.body.data.length, 1);
  assert.ok(response.body.data.every(user => user.email.endsWith('@test.invalid')));
});

test('detalle y bloqueo exigen administrador y CSRF; el bloqueo revoca la sesión y rehabilitar no la restaura', async () => {
  const auth = await sesion(ids.administrador[0]);
  const id = ids.registrado[0];
  const userAuth = await sesion(id);
  assert.equal((await request(app).get(`/api/admin/usuarios/${id}`).set('Cookie', auth.cookie)).status, 200);
  const sinCsrf = await request(app).patch(`/api/admin/usuarios/${id}`).set('Cookie', auth.cookie).set('Origin', env.APP_ORIGIN).send({ activo: false });
  assert.equal(sinCsrf.status, 403);
  const bloqueado = await request(app).patch(`/api/admin/usuarios/${id}`).set('Cookie', auth.cookie).set('Origin', env.APP_ORIGIN).set('X-CSRF-Token', auth.csrfToken).send({ activo: false });
  assert.equal(bloqueado.status, 200);
  const protegida = await request(app).get('/api/auth/me').set('Cookie', userAuth.cookie);
  assert.equal(protegida.status, 401);
  const rehabilitado = await request(app).patch(`/api/admin/usuarios/${id}`).set('Cookie', auth.cookie).set('Origin', env.APP_ORIGIN).set('X-CSRF-Token', auth.csrfToken).send({ activo: true });
  assert.equal(rehabilitado.status, 200);
  assert.equal((await request(app).get('/api/auth/me').set('Cookie', userAuth.cookie)).status, 401);
});

test('PATCH password valida contraseña actual, aumenta versión y cierra la sesión vigente', async () => {
  const id = ids.registrado[1];
  const actual = 'clave-actual-segura-123';
  const nueva = 'clave-nueva-segura-456';
  const hash = await generarHash(actual);
  await pool.query('UPDATE app.usuarios SET password_hash=$2, activo=true, version_sesion=1 WHERE id=$1', [id, hash]);
  const auth = await sesion(id);
  const response = await request(app).patch('/api/auth/password').set('Cookie', auth.cookie)
    .set('Origin', env.APP_ORIGIN).set('X-CSRF-Token', auth.csrfToken)
    .send({ passwordActual: actual, password: nueva, passwordConfirm: nueva });
  assert.equal(response.status, 200);
  assert.equal((await request(app).get('/api/auth/me').set('Cookie', auth.cookie)).status, 401);
  const { rows } = await pool.query('SELECT password_hash, version_sesion FROM app.usuarios WHERE id=$1', [id]);
  assert.equal(rows[0].version_sesion, 2);
  assert.equal(await verificarContrasena(nueva, rows[0].password_hash), true);
});

test('login incorrecto responde 401 y sesión con antigüedad absoluta vencida no autoriza', async () => {
  const agent = request.agent(app);
  const csrf = await agent.get('/api/csrf').expect(200);
  const login = await agent.post('/api/auth/login').set('Origin', env.APP_ORIGIN)
    .set('X-CSRF-Token', csrf.body.data.csrfToken)
    .send({ email: `no-existe-${sufijo}@test.invalid`, password: 'Clave-valida-prueba-123' });
  assert.equal(login.status, 401);
  assert.equal(login.body.error.code, 'CREDENCIALES_INVALIDAS');
  const vencida = await sesion(ids.registrado[0], Date.now() - CONSTANTS.SESSION.ABSOLUTE_MAX_MS - 1);
  const response = await request(app).get('/api/auth/me').set('Cookie', vencida.cookie);
  assert.equal(response.status, 401);
});

test('GET /api/admin/metricas: operador y registrado reciben 403; administrador recibe 200', async () => {
  for (const rol of ['operador', 'registrado']) {
    const auth = await sesion(ids[rol][0]);
    const response = await request(app).get('/api/admin/metricas').set('Cookie', auth.cookie);
    assert.equal(response.status, 403, rol);
  }
  const auth = await sesion(ids.administrador[0]);
  const response = await request(app).get('/api/admin/metricas').set('Cookie', auth.cookie);
  assert.equal(response.status, 200);
});

test('demo semilla no publicada: recurso da 401 anónimo y página/recurso dan 404 con sesión', async () => {
  const { rows } = await pool.query("SELECT id FROM app.demos WHERE tipo='algoritmos' AND publicada=false ORDER BY id LIMIT 1");
  assert.ok(rows.length, 'portfolio_test debe conservar una demo semilla no publicada');
  const ruta = `/demos/${rows[0].id}`;
  assert.equal((await request(app).get(`${ruta}/recurso.js`)).status, 401);
  const auth = await sesion(ids.registrado[0]);
  assert.equal((await request(app).get(ruta).set('Cookie', auth.cookie)).status, 404);
  assert.equal((await request(app).get(`${ruta}/recurso.js`).set('Cookie', auth.cookie)).status, 404);
});

test('Servicios: API pública accesible; panel y CRUD exclusivos de administrador con CSRF en escrituras', async () => {
  assert.equal((await request(app).get('/api/servicios')).status, 200);
  assert.equal((await request(app).get('/api/admin/servicios')).status, 401);
  assert.equal((await request(app).post('/api/admin/servicios').send({})).status, 401);
  for (const rol of ['operador', 'registrado']) {
    const auth = await sesion(ids[rol][0]);
    assert.equal((await request(app).get('/api/admin/servicios').set('Cookie', auth.cookie)).status, 403, rol);
  }
  const auth = await sesion(ids.administrador[0]);
  assert.equal((await request(app).get('/admin/servicios').set('Cookie', auth.cookie)).status, 200);
  assert.equal((await request(app).get('/api/admin/servicios').set('Cookie', auth.cookie)).status, 200);
  assert.equal((await request(app).post('/api/admin/servicios').set('Cookie', auth.cookie).set('Origin', env.APP_ORIGIN).send({})).status, 403);
  const csrf = await request(app).post('/api/admin/servicios').set('Cookie', auth.cookie)
    .set('Origin', env.APP_ORIGIN).set('X-CSRF-Token', auth.csrfToken).send({});
  assert.equal(csrf.status, 422);
});
