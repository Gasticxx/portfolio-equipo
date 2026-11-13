import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import request from 'supertest';
import { app } from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import { env } from '../../src/config/env.js';
import { CONSTANTS } from '../../src/config/constants.js';

const ruta = '/api/tablero/tareas';
const usuarios = [];
const sesiones = [];
let proyectoCreado;
let demoCreada = false;
let baseLocalValidada = false;
let publicacionOriginal;

async function sesion(usuario, { autenticadoEn = Date.now(), vencida = false } = {}) {
  const sid = crypto.randomUUID();
  const csrf = crypto.randomBytes(32).toString('hex');
  const expire = new Date(Date.now() + (vencida ? -60_000 : 1_800_000));
  const { rows } = await pool.query('SELECT version_sesion FROM app.usuarios WHERE id=$1', [usuario.id]);
  await pool.query('INSERT INTO app.sesiones (sid,sess,expire) VALUES ($1,$2,$3)', [sid, {
    cookie: { originalMaxAge: 1_800_000, expires: expire.toISOString(), httpOnly: true, path: '/', sameSite: 'lax' },
    usuarioId: usuario.id, versionSesion: rows[0].version_sesion, autenticadoEn, csrfToken: csrf,
  }, expire]);
  sesiones.push(sid);
  const firma = crypto.createHmac('sha256', env.SESSION_SECRET).update(sid).digest('base64').replace(/=+$/, '');
  return { cookie: `equipo.sid=${encodeURIComponent(`s:${sid}.${firma}`)}`, csrf };
}

function enviar(metodo, destino, auth, datos) {
  const peticion = request(app)[metodo](destino).set('Cookie', auth.cookie)
    .set('Origin', env.APP_ORIGIN).set('X-CSRF-Token', auth.csrf);
  return datos === undefined ? peticion : peticion.send(datos);
}

before(async () => {
  const destino = new URL(env.TEST_DATABASE_URL || env.DATABASE_URL);
  assert.ok(env.IS_TEST && ['localhost', '127.0.0.1', '[::1]'].includes(destino.hostname)
    && destino.pathname === '/portfolio_test', 'Estas pruebas requieren portfolio_test local.');
  baseLocalValidada = true;
  for (const rol of ['registrado', 'registrado', 'operador', 'administrador', 'registrado']) {
    const { rows } = await pool.query(`INSERT INTO app.usuarios (nombre,email,password_hash,rol)
      VALUES ('Fixture tablero I4',$1,'scrypt$fixture',$2) RETURNING id,rol`,
    [`i4-tablero-${crypto.randomUUID()}@test.invalid`, rol]);
    usuarios.push(rows[0]);
  }
  // La ruta heredada usa la demo 1; se conserva y restaura su publicación.
  const existente = await pool.query('SELECT id FROM app.demos WHERE id=1');
  if (!existente.rows.length) {
    const { rows } = await pool.query(`INSERT INTO app.proyectos
      (slug,titulo,resumen,descripcion,estado,publicado) VALUES ($1,'Fixture I4','Pruebas',
      'Proyecto temporal para validar permisos del tablero.','desarrollo',false) RETURNING id`,
    [`i4-tablero-${crypto.randomUUID()}`]);
    proyectoCreado = rows[0].id;
    const nueva = await pool.query(`INSERT INTO app.demos (proyecto_id,titulo,descripcion,tipo,publicada)
      VALUES ($1,'Fixture tablero','Demo temporal.','tablero',false) RETURNING id`, [proyectoCreado]);
    if (nueva.rows[0].id !== 1) {
      await pool.query('DELETE FROM app.demos WHERE id=$1', [nueva.rows[0].id]);
      await pool.query(`INSERT INTO app.demos (id,proyecto_id,titulo,descripcion,tipo,publicada)
        OVERRIDING SYSTEM VALUE VALUES (1,$1,'Fixture tablero','Demo temporal.','tablero',false)`, [proyectoCreado]);
    }
    demoCreada = true;
  }
  const actual = await pool.query('SELECT d.publicada,d.proyecto_id,p.publicado FROM app.demos d JOIN app.proyectos p ON p.id=d.proyecto_id WHERE d.id=1');
  publicacionOriginal = actual.rows[0];
  await pool.query('UPDATE app.demos SET publicada=true WHERE id=1');
  await pool.query('UPDATE app.proyectos SET publicado=true WHERE id=$1', [publicacionOriginal.proyecto_id]);
});

after(async () => {
  try {
    if (!baseLocalValidada) return;
    if (sesiones.length) await pool.query('DELETE FROM app.sesiones WHERE sid=ANY($1::varchar[])', [sesiones]);
    const ids = usuarios.map(usuario => usuario.id);
    await pool.query('DELETE FROM app.tareas_demo WHERE usuario_id=ANY($1::int[])', [ids]);
    await pool.query('DELETE FROM app.accesos WHERE usuario_id=ANY($1::int[])', [ids]);
    await pool.query('DELETE FROM app.usuarios WHERE id=ANY($1::int[])', [ids]);
    if (publicacionOriginal) {
      await pool.query('UPDATE app.demos SET publicada=$1 WHERE id=1', [publicacionOriginal.publicada]);
      await pool.query('UPDATE app.proyectos SET publicado=$1 WHERE id=$2', [publicacionOriginal.publicado, publicacionOriginal.proyecto_id]);
    }
    if (demoCreada) await pool.query('DELETE FROM app.demos WHERE id=1');
    if (proyectoCreado) await pool.query('DELETE FROM app.proyectos WHERE id=$1', [proyectoCreado]);
  } finally {
    await pool.end();
  }
});

test('Tablero: todos los endpoints rechazan acceso sin sesión', async () => {
  for (const [metodo, destino] of [['get', ruta], ['post', ruta], ['patch', `${ruta}/1`], ['delete', `${ruta}/1`]]) {
    await request(app)[metodo](destino).expect(401);
  }
});

test('Tablero: CRUD persistido en PostgreSQL y usuario tomado de la sesión', async () => {
  const auth = await sesion(usuarios[0]);
  const creada = await enviar('post', ruta, auth, { titulo: '  Tarea persistida I4  ', usuario_id: usuarios[1].id, demo_id: 999 }).expect(201);
  const id = creada.body.data.id;
  const { rows } = await pool.query('SELECT usuario_id,demo_id,titulo,estado FROM app.tareas_demo WHERE id=$1', [id]);
  assert.deepEqual(rows[0], { usuario_id: usuarios[0].id, demo_id: 1, titulo: 'Tarea persistida I4', estado: 'pendiente' });
  // Otra petición y otra sesión del mismo usuario recuperan los datos guardados.
  const renovada = await sesion(usuarios[0]);
  const listado = await enviar('get', ruta, renovada).expect(200);
  assert.ok(listado.body.data.some(tarea => tarea.id === id));
  await enviar('patch', `${ruta}/${id}`, auth, { estado: 'progreso' }).expect(200);
  assert.equal((await enviar('get', ruta, renovada)).body.data.find(tarea => tarea.id === id).estado, 'progreso');
  await enviar('delete', `${ruta}/${id}`, auth).expect(200);
  assert.ok(!(await enviar('get', ruta, renovada)).body.data.some(tarea => tarea.id === id));
});

test('Tablero: otra cuenta, incluso administradora, no lista ni modifica tareas ajenas', async () => {
  const titular = await sesion(usuarios[0]);
  const creada = await enviar('post', ruta, titular, { titulo: 'Privada del titular' }).expect(201);
  const id = creada.body.data.id;
  for (const usuario of [usuarios[1], usuarios[3]]) {
    const auth = await sesion(usuario);
    const listado = await enviar('get', `${ruta}?usuario_id=${usuarios[0].id}`, auth).expect(200);
    assert.ok(!listado.body.data.some(tarea => tarea.id === id));
    await enviar('patch', `${ruta}/${id}`, auth, { estado: 'completada' }).expect(404);
    await enviar('delete', `${ruta}/${id}`, auth).expect(404);
  }
  assert.equal((await pool.query('SELECT estado FROM app.tareas_demo WHERE id=$1', [id])).rows[0].estado, 'pendiente');
});

test('Tablero: registrado, operador y administrador acceden a sus propias tareas', async () => {
  for (const usuario of [usuarios[1], usuarios[2], usuarios[3]]) {
    const auth = await sesion(usuario);
    const creada = await enviar('post', ruta, auth, { titulo: `Tarea de ${usuario.rol}` }).expect(201);
    await enviar('get', ruta, auth).expect(200);
    await enviar('delete', `${ruta}/${creada.body.data.id}`, auth).expect(200);
  }
});

test('Tablero: POST, PATCH y DELETE exigen CSRF y origen correcto sin modificar datos', async () => {
  const auth = await sesion(usuarios[1]);
  const creada = await enviar('post', ruta, auth, { titulo: 'Protegida por CSRF' }).expect(201);
  const id = creada.body.data.id;
  for (const [metodo, destino, datos] of [['post', ruta, { titulo: 'No debe crearse' }], ['patch', `${ruta}/${id}`, { estado: 'completada' }], ['delete', `${ruta}/${id}`, {}]]) {
    await request(app)[metodo](destino).set('Cookie', auth.cookie).set('Origin', env.APP_ORIGIN).send(datos).expect(403);
    await request(app)[metodo](destino).set('Cookie', auth.cookie).set('Origin', 'https://ajeno.invalid')
      .set('X-CSRF-Token', auth.csrf).send(datos).expect(403);
  }
  assert.equal((await pool.query('SELECT estado FROM app.tareas_demo WHERE id=$1', [id])).rows[0].estado, 'pendiente');
  const listado = await enviar('get', ruta, auth).expect(200);
  assert.ok(!listado.body.data.some(tarea => tarea.titulo === 'No debe crearse'));
});

test('Tablero: rechaza títulos, estados e identificadores inválidos', async () => {
  const auth = await sesion(usuarios[1]);
  for (const titulo of ['AB', ' '.repeat(5), 'x'.repeat(81), 123, null]) {
    await enviar('post', ruta, auth, { titulo }).expect(400);
  }
  await enviar('patch', `${ruta}/1`, auth, { estado: 'inexistente' }).expect(400);
  for (const id of ['0', '-1', 'abc', '2147483648']) {
    await enviar('patch', `${ruta}/${id}`, auth, { estado: 'progreso' }).expect(400);
    await enviar('delete', `${ruta}/${id}`, auth).expect(400);
  }
});

test('Tablero: dos altas concurrentes desde 49 tareas dejan exactamente 50', async () => {
  const usuario = usuarios[4];
  await pool.query(`INSERT INTO app.tareas_demo (demo_id,usuario_id,titulo)
    SELECT 1,$1,'Tarea temporal ' || n FROM generate_series(1,49) AS n`, [usuario.id]);
  const authA = await sesion(usuario);
  const authB = await sesion(usuario);
  const respuestas = await Promise.all([
    enviar('post', ruta, authA, { titulo: 'Alta concurrente A' }),
    enviar('post', ruta, authB, { titulo: 'Alta concurrente B' }),
  ]);
  assert.deepEqual(respuestas.map(res => res.status).sort(), [201, 409]);
  assert.equal(respuestas.find(res => res.status === 409).body.error.code, 'LIMITE_TAREAS');
  assert.equal((await pool.query('SELECT count(*)::int AS total FROM app.tareas_demo WHERE demo_id=1 AND usuario_id=$1', [usuario.id])).rows[0].total, 50);
});

test('Tablero: logout, bloqueo y rehabilitación no conservan acceso con la sesión anterior', async () => {
  const usuario = usuarios[2];
  const logout = await sesion(usuario);
  await enviar('post', '/api/auth/logout', logout, {}).expect(200);
  await enviar('get', ruta, logout).expect(401);
  const auth = await sesion(usuarios[1]);
  const admin = await sesion(usuarios[3]);
  await enviar('patch', `/api/admin/usuarios/${usuarios[1].id}`, admin, { activo: false }).expect(200);
  await enviar('get', ruta, auth).expect(401);
  await enviar('post', ruta, auth, { titulo: 'Alta bloqueada' }).expect(401);
  await enviar('patch', `/api/admin/usuarios/${usuarios[1].id}`, admin, { activo: true }).expect(200);
  await enviar('get', ruta, auth).expect(401);
  const nueva = await sesion(usuarios[1]);
  await enviar('get', ruta, nueva).expect(200);
});

test('Tablero: sesiones vencidas por antigüedad o inactividad reciben 401', async () => {
  for (const opciones of [{ autenticadoEn: Date.now() - CONSTANTS.SESSION.ABSOLUTE_MAX_MS - 1000 }, { vencida: true }]) {
    const auth = await sesion(usuarios[0], opciones);
    await enviar('get', ruta, auth).expect(401);
  }
});

test('D-I4-TAB-01: demo no publicada no debe entregar tablero ni API', { todo: 'I5: comprobar publicación de demo y proyecto en página y API' }, async () => {
  const { rows } = await pool.query('SELECT publicada FROM app.demos WHERE id=1');
  await pool.query('UPDATE app.demos SET publicada=false WHERE id=1');
  try {
    const auth = await sesion(usuarios[0]);
    const pagina = await enviar('get', '/tablero', auth);
    const api = await enviar('get', ruta, auth);
    assert.deepEqual({ pagina: pagina.status, api: api.status }, { pagina: 404, api: 404 });
  } finally {
    await pool.query('UPDATE app.demos SET publicada=$1 WHERE id=1', [rows[0].publicada]);
  }
});

test('D-I4-TAB-02: los scripts del tablero integrado deben requerir sesión', { todo: 'I5/I3: servir scripts integrados desde un recurso protegido' }, async () => {
  const interfaz = await request(app).get('/js/tablero.js');
  const adaptador = await request(app).get('/js/tablero.adapter.js');
  assert.deepEqual([interfaz.status, adaptador.status], [401, 401]);
});

test('D-I4-TAB-03: tablero publicado debe abrir por /demos/:id y ofrecer recurso protegido', { todo: 'I5: integrar tablero en el catálogo y rutas canónicas de demos' }, async () => {
  const { rows } = await pool.query('SELECT d.publicada,d.tipo,d.proyecto_id,p.publicado FROM app.demos d JOIN app.proyectos p ON p.id=d.proyecto_id WHERE d.id=1');
  const original = rows[0];
  if (original.tipo !== 'tablero') assert.fail('La ruta fija DEMO_ID=1 no identifica un tablero en esta base.');
  await pool.query('UPDATE app.demos SET publicada=true WHERE id=1');
  await pool.query('UPDATE app.proyectos SET publicado=true WHERE id=$1', [original.proyecto_id]);
  try {
    const auth = await sesion(usuarios[0]);
    const catalogo = await enviar('get', '/demos', auth);
    const pagina = await enviar('get', '/demos/1', auth);
    const recurso = await enviar('get', '/demos/1/recurso.js', auth);
    assert.deepEqual({ catalogado: catalogo.text.includes('href="/demos/1"'), pagina: pagina.status, recurso: recurso.status },
      { catalogado: true, pagina: 200, recurso: 200 });
  } finally {
    await pool.query('UPDATE app.demos SET publicada=$1 WHERE id=1', [original.publicada]);
    await pool.query('UPDATE app.proyectos SET publicado=$1 WHERE id=$2', [original.publicado, original.proyecto_id]);
  }
});
