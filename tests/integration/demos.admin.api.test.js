import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import request from 'supertest';
import { app } from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import { env } from '../../src/config/env.js';
import { tableroRepository } from '../../src/repositories/tablero.repository.js';

const tag = crypto.randomUUID();
const usuarios = [], sesiones = [], proyectos = [];
let local = false;
async function proyecto(publicado = true) {
  const { rows } = await pool.query(`INSERT INTO app.proyectos(slug,titulo,resumen,descripcion,estado,publicado)
    VALUES($1,'Fixture demos I4','Proyecto temporal de pruebas','Proyecto temporal para validar cambios de las demos en PostgreSQL.','desarrollo',$2) RETURNING id`, [`i4-demos-${crypto.randomUUID()}`, publicado]);
  proyectos.push(rows[0].id); return rows[0].id;
}
async function sesion(rol = 'administrador') {
  const usuario = usuarios.find(u => u.rol === rol), sid = crypto.randomUUID(), csrf = crypto.randomBytes(32).toString('hex'), expires = new Date(Date.now() + 1800000);
  await pool.query('INSERT INTO app.sesiones(sid,sess,expire) VALUES($1,$2,$3)', [sid, { cookie: { originalMaxAge: 1800000, expires: expires.toISOString(), path: '/', httpOnly: true }, usuarioId: usuario.id, versionSesion: 1, autenticadoEn: Date.now(), csrfToken: csrf }, expires]);
  sesiones.push(sid); const firma = crypto.createHmac('sha256', env.SESSION_SECRET).update(sid).digest('base64').replace(/=+$/, '');
  return { cookie: `equipo.sid=${encodeURIComponent(`s:${sid}.${firma}`)}`, csrf };
}
const enviar = (method, path, auth, body) => {
  const r = request(app)[method](path).set('Cookie', auth.cookie).set('Origin', env.APP_ORIGIN).set('X-CSRF-Token', auth.csrf);
  return body === undefined ? r : r.send(body);
};
const datos = (proyectoId, extra = {}) => ({ proyectoId, titulo: 'Experiencia de prueba', descripcion: 'Una descripción de la experiencia guardada para estas pruebas.', tipo: 'tablero', publicada: false, orden: 1, ...extra });

test('Ondas: alta administrativa, persistencia, catálogo y ocultamiento al despublicar el proyecto', async () => {
  const auth = await sesion(), proyectoId = await proyecto();
  const body = datos(proyectoId, { tipo: 'ondas', titulo: 'Laboratorio de ondas', publicada: true });
  const creada = (await enviar('post', '/api/admin/demos', auth, body).expect(201)).body.data;
  assert.equal(creada.tipo, 'ondas');
  assert.ok((await enviar('get', '/api/admin/demos/catalogos', auth).expect(200)).body.data.tipos.includes('ondas'));
  const fila = (await pool.query('SELECT tipo,publicada FROM app.demos WHERE id=$1', [creada.id])).rows[0];
  assert.deepEqual(fila, { tipo: 'ondas', publicada: true });
  assert.match((await enviar('get', `/demos/${creada.id}`, auth).expect(200)).text, /data-ondas/);
  const editada = (await enviar('put', `/api/admin/demos/${creada.id}`, auth, { ...body, titulo: 'Ondas e interferencia', orden: 12 }).expect(200)).body.data;
  assert.equal(editada.titulo, 'Ondas e interferencia'); assert.equal(editada.orden, 12);
  await pool.query('UPDATE app.proyectos SET publicado=false WHERE id=$1', [proyectoId]);
  await enviar('get', `/demos/${creada.id}`, auth).expect(404);
  await enviar('get', `/demos/${creada.id}/recurso.js`, auth).expect(404);
});
before(async () => {
  const destino = new URL(env.TEST_DATABASE_URL || env.DATABASE_URL);
  assert.ok(env.IS_TEST && ['localhost', '127.0.0.1', '[::1]'].includes(destino.hostname) && destino.pathname === '/portfolio_test', 'Solo portfolio_test local.'); local = true;
  for (const rol of ['administrador', 'operador', 'registrado']) {
    const { rows } = await pool.query("INSERT INTO app.usuarios(nombre,email,password_hash,rol) VALUES('Fixture demos',$1,'scrypt$fixture',$2) RETURNING id,rol", [`${rol}-${tag}@test.invalid`, rol]); usuarios.push(rows[0]);
  }
});
after(async () => {
  try {
    if (!local) return;
    await pool.query('DELETE FROM app.demos WHERE proyecto_id=ANY($1::int[])', [proyectos]);
    await pool.query('DELETE FROM app.proyectos WHERE id=ANY($1::int[])', [proyectos]);
    await pool.query('DELETE FROM app.sesiones WHERE sid=ANY($1::varchar[])', [sesiones]);
    await pool.query('DELETE FROM app.accesos WHERE usuario_id=ANY($1::int[])', [usuarios.map(u => u.id)]);
    await pool.query('DELETE FROM app.usuarios WHERE id=ANY($1::int[])', [usuarios.map(u => u.id)]);
  } finally { await pool.end(); }
});

test('Demos: listado, detalle, catálogos y escrituras requieren administrador y CSRF', async () => {
  for (const [method, ruta] of [['get', '/admin/demos'], ['get', '/api/admin/demos'], ['get', '/api/admin/demos/1'], ['get', '/api/admin/demos/catalogos'], ['post', '/api/admin/demos'], ['put', '/api/admin/demos/1']]) {
    await request(app)[method](ruta).expect(401);
    for (const rol of ['operador', 'registrado']) await enviar(method, ruta, await sesion(rol)).expect(403);
  }
  const auth = await sesion(), id = await proyecto();
  await request(app).post('/api/admin/demos').set('Cookie', auth.cookie).send(datos(id)).expect(403);
  await request(app).put('/api/admin/demos/1').set('Cookie', auth.cookie).set('Origin', 'https://ajeno.invalid').set('X-CSRF-Token', auth.csrf).send(datos(id)).expect(403);
  const panel = await enviar('get', '/admin/demos', auth).expect(200); assert.match(panel.text, /demos-admin.css/); assert.match(panel.text, /demo-confirmacion/);
});

test('Demos: actualiza los seis campos en PostgreSQL y sirve la página y el recurso correctos', async () => {
  const auth = await sesion(), p1 = await proyecto(), p2 = await proyecto();
  const creada = await enviar('post', '/api/admin/demos', auth, datos(p1, { tipo: 'algoritmos' })).expect(201), id = creada.body.data.id;
  const nueva = datos(p2, { titulo: 'Calendario actualizado I4', descripcion: 'Esta descripción se actualizó desde la gestión y debe verse en la demo.', tipo: 'calendario', publicada: true, orden: 19 });
  const r = await enviar('put', `/api/admin/demos/${id}`, auth, nueva).expect(200);
  for (const key of Object.keys(nueva)) assert.deepEqual(r.body.data[key], nueva[key], key);
  const fresca = await enviar('get', `/api/admin/demos/${id}`, await sesion()).expect(200);
  assert.equal(fresca.body.data.tipo, 'calendario'); assert.ok(fresca.body.data.updatedAt);
  assert.deepEqual((await pool.query('SELECT proyecto_id,titulo,descripcion,tipo,publicada,orden FROM app.demos WHERE id=$1', [id])).rows[0], { proyecto_id: p2, titulo: nueva.titulo, descripcion: nueva.descripcion, tipo: 'calendario', publicada: true, orden: 19 });
  const pagina = await enviar('get', `/demos/${id}`, await sesion('registrado')).expect(200);
  assert.match(pagina.text, /data-calendario/); assert.ok(pagina.text.includes(nueva.descripcion));
  const recurso = await enviar('get', `/demos/${id}/recurso.js`, auth).expect(200); assert.match(recurso.text, /export function calcularMes/); assert.doesNotMatch(recurso.text, /export function generarPasos/);
  await request(app).get(`/demos/${id}/recurso.js`).expect(401);
});

test('Demos con tareas: rechaza traslado y cambio de tipo; permite editar el resto sin perder datos', async () => {
  const auth = await sesion(), p1 = await proyecto(), p2 = await proyecto(), inicial = datos(p1, { publicada: true });
  const id = (await enviar('post', '/api/admin/demos', auth, inicial).expect(201)).body.data.id;
  const tarea = (await pool.query("INSERT INTO app.tareas_demo(demo_id,usuario_id,titulo) VALUES($1,$2,'Tarea a conservar') RETURNING id", [id, usuarios[2].id])).rows[0].id;
  for (const cambio of [{ proyectoId: p2 }, { tipo: 'algoritmos' }]) {
    const r = await enviar('put', `/api/admin/demos/${id}`, auth, { ...inicial, ...cambio, titulo: 'No debe guardarse' }).expect(409); assert.equal(r.body.error.code, 'DEMO_CON_DATOS');
  }
  const nueva = { ...inicial, titulo: 'Tablero que conserva sus tareas', descripcion: 'Nueva descripción válida que conserva todas las tareas guardadas.', publicada: false, orden: 12 };
  const r = await enviar('put', `/api/admin/demos/${id}`, auth, nueva).expect(200); assert.equal(r.body.data.tareasGuardadas, 1); assert.equal(r.body.data.titulo, nueva.titulo);
  assert.equal((await pool.query('SELECT demo_id FROM app.tareas_demo WHERE id=$1', [tarea])).rows[0].demo_id, id);
});

test('Demos: publicación exige proyecto publicado; conserva la ficha si después se oculta el proyecto', async () => {
  const auth = await sesion(), p = await proyecto(false), body = datos(p);
  const r = await enviar('post', '/api/admin/demos', auth, { ...body, publicada: true }).expect(422); assert.equal(r.body.error.code, 'PROYECTO_NO_PUBLICADO');
  const id = (await enviar('post', '/api/admin/demos', auth, body).expect(201)).body.data.id;
  await pool.query('UPDATE app.demos SET publicada=true WHERE id=$1', [id]);
  await enviar('put', `/api/admin/demos/${id}`, auth, { ...body, publicada: true, titulo: 'Título editable con proyecto oculto' }).expect(200);
  await enviar('get', `/demos/${id}`, auth).expect(404);
});

test('Demos: filtros, búsqueda literal y paginación; catálogos reflejan la base', async () => {
  const auth = await sesion(), p = await proyecto(), titulo = `Filtro ${tag.slice(0, 8)}`;
  for (const [i, tipo] of ['tablero', 'algoritmos', 'calendario'].entries()) await enviar('post', '/api/admin/demos', auth, datos(p, { titulo: `${titulo} ${i}%`, tipo, publicada: i < 2 })).expect(201);
  const r = await enviar('get', `/api/admin/demos?page=1&pageSize=1&proyectoId=${p}&q=${encodeURIComponent(titulo)}&publicada=true`, auth).expect(200);
  assert.deepEqual(r.body.meta, { page: 1, pageSize: 1, total: 2, totalPages: 2 }); assert.equal(r.body.data.length, 1);
  assert.equal((await enviar('get', `/api/admin/demos?proyectoId=${p}&q=${encodeURIComponent(titulo + ' 0%')}`, auth)).body.meta.total, 1);
  const catalogos = (await enviar('get', '/api/admin/demos/catalogos', auth)).body.data; assert.ok(catalogos.tipos.includes('calendario')); assert.ok(catalogos.proyectos.some(pr => pr.id === p));
  for (const query of ['page=0', 'pageSize=51', 'proyectoId=abc', 'publicada=1', 'tipo=arbitrario', 'page=1&page=2', 'campo=extra']) await enviar('get', `/api/admin/demos?${query}`, auth).expect(400);
});

test('Demos: duplicados y campos inválidos rechazan sin cambios parciales', async () => {
  const auth = await sesion(), p = await proyecto(), body = datos(p), id = (await enviar('post', '/api/admin/demos', auth, body)).body.data.id;
  await enviar('post', '/api/admin/demos', auth, body).expect(409);
  for (const cambio of [{ titulo: 'AB' }, { descripcion: 'corta' }, { tipo: 'codigo-subido' }, { publicada: 'true' }, { orden: 101 }, { proyectoId: 2147483647 }, { extra: 'no admitido' }]) await enviar('put', `/api/admin/demos/${id}`, auth, { ...body, ...cambio }).expect(422);
  await enviar('put', `/api/admin/demos/${id}`, auth, { titulo: 'Incompleta' }).expect(422);
  await enviar('get', '/api/admin/demos/2147483647', auth).expect(404);
  await enviar('put', '/api/admin/demos/1e2', auth, body).expect(400);
  const final = (await enviar('get', `/api/admin/demos/${id}`, auth)).body.data; assert.equal(final.titulo, body.titulo); assert.equal(final.tipo, body.tipo);
});

test('Demos: la creación de tareas vuelve a verificar el tipo tras una edición concurrente', async () => {
  const auth = await sesion(), p = await proyecto();
  const id = (await enviar('post', '/api/admin/demos', auth, datos(p, { publicada: true }))).body.data.id;
  const client = await pool.connect(); let pendiente;
  try {
    await client.query('BEGIN'); await client.query('SELECT id FROM app.demos WHERE id=$1 FOR UPDATE', [id]);
    pendiente = tableroRepository.crear(id, usuarios[2].id, 'Tarea concurrente').then(value => ({ value }), error => ({ error }));
    await client.query("UPDATE app.demos SET tipo='algoritmos' WHERE id=$1", [id]); await client.query('COMMIT');
    assert.equal((await pendiente).error?.status, 404);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM app.tareas_demo WHERE demo_id=$1', [id])).rows[0].n, 0);
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); if (pendiente) await pendiente; }
});
