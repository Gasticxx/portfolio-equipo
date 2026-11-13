import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import request from 'supertest';
import sharp from 'sharp';
import { app } from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import { env } from '../../src/config/env.js';
import { archivosService } from '../../src/services/archivos.service.js';
import { proyectosRepository } from '../../src/repositories/proyectos.repository.js';

const sufijo = crypto.randomUUID();
const prefix = `i4-proyecto-${sufijo}`;
const users = [], sids = [], techs = [], membersCreated = [], files = [];
let members = [], validada = false;
async function sesion(rol) {
  const usuario = users.find(u => u.rol === rol);
  const sid = crypto.randomUUID(), csrf = crypto.randomBytes(32).toString('hex');
  const expira = new Date(Date.now() + 1_800_000);
  await pool.query('INSERT INTO app.sesiones(sid,sess,expire) VALUES($1,$2,$3)', [sid, { cookie: { expires: expira.toISOString(), originalMaxAge: 1_800_000, httpOnly: true, path: '/' }, usuarioId: usuario.id, versionSesion: 1, autenticadoEn: Date.now(), csrfToken: csrf }, expira]);
  sids.push(sid);
  const firma = crypto.createHmac('sha256', env.SESSION_SECRET).update(sid).digest('base64').replace(/=+$/, '');
  return { cookie: `equipo.sid=${encodeURIComponent(`s:${sid}.${firma}`)}`, csrf };
}
const enviar = (method, path, auth, body) => {
  const r = request(app)[method](path).set('Cookie', auth.cookie).set('Origin', env.APP_ORIGIN).set('X-CSRF-Token', auth.csrf);
  return body === undefined ? r : r.send(body);
};
const datos = (extra = {}) => ({ titulo: 'Proyecto de prueba I4', slug: `${prefix}-${crypto.randomBytes(3).toString('hex')}`, resumen: 'Resumen de prueba para comprobar la gestión.', descripcion: 'Descripción de prueba del proyecto con contenido suficiente para validar el contrato completo.', estado: 'desarrollo', publicado: false, portadaId: null, repositorioUrl: null, tecnologiaIds: [techs[0]], aportes: [{ miembroId: members[0].id, titulo: 'Aporte de prueba', descripcion: 'Implementación documentada del aporte para este proyecto.', estado: 'desarrollo', evidenciaUrl: null, tecnologiaIds: [techs[0]] }], ...extra });

before(async () => {
  const url = new URL(env.TEST_DATABASE_URL || env.DATABASE_URL);
  assert.ok(env.IS_TEST && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && url.pathname === '/portfolio_test', 'Solo portfolio_test local.');
  validada = true;
  for (const rol of ['administrador', 'operador', 'registrado']) {
    const { rows } = await pool.query("INSERT INTO app.usuarios(nombre,email,password_hash,rol) VALUES('Fixture proyectos',$1,'scrypt$fixture',$2) RETURNING id,rol", [`${rol}-${sufijo}@test.invalid`, rol]); users.push(rows[0]);
  }
  for (let i = 0; i < 2; i++) techs.push((await pool.query('INSERT INTO app.tecnologias(nombre) VALUES($1) RETURNING id', [`Prueba ${sufijo.slice(0, 12)} ${i}`])).rows[0].id);
  members = (await pool.query('SELECT id,orden FROM app.miembros ORDER BY orden LIMIT 2')).rows;
  while (members.length < 2) {
    const orden = [1, 2, 3, 4, 5, 6].find(n => !members.some(m => m.orden === n));
    const { rows } = await pool.query(`INSERT INTO app.miembros(slug,nombre,especialidad,presentacion,formacion,orden) VALUES($1,'Integrante de prueba','Pruebas','Fixture de prueba','Fixture de prueba',$2) RETURNING id,orden`, [`fixture-${sufijo.slice(0, 12)}-${orden}`, orden]);
    members.push(rows[0]); membersCreated.push(rows[0].id);
  }
});
after(async () => {
  try {
    if (!validada) return;
    await pool.query('DELETE FROM app.demos WHERE proyecto_id IN (SELECT id FROM app.proyectos WHERE slug LIKE $1)', [`${prefix}%`]);
    await pool.query('DELETE FROM app.proyectos WHERE slug LIKE $1', [`${prefix}%`]);
    await pool.query('DELETE FROM app.archivos WHERE id=ANY($1::int[])', [files]);
    await pool.query('DELETE FROM app.miembros WHERE id=ANY($1::int[])', [membersCreated]);
    await pool.query('DELETE FROM app.tecnologias WHERE id=ANY($1::int[])', [techs]);
    await pool.query('DELETE FROM app.sesiones WHERE sid=ANY($1::varchar[])', [sids]);
    await pool.query('DELETE FROM app.accesos WHERE usuario_id=ANY($1::int[])', [users.map(u => u.id)]);
    await pool.query('DELETE FROM app.usuarios WHERE id=ANY($1::int[])', [users.map(u => u.id)]);
  } finally { await pool.end(); }
});

test('Proyectos: lecturas y escrituras exclusivas de administrador; CSRF obligatorio', async () => {
  for (const [method, path] of [['get', '/admin/proyectos'], ['get', '/api/admin/proyectos'], ['get', '/api/admin/proyectos/1'], ['get', '/api/admin/proyectos/catalogos'], ['get', '/api/admin/tecnologias'], ['post', '/api/admin/proyectos'], ['put', '/api/admin/proyectos/1'], ['delete', '/api/admin/proyectos/1'], ['post', '/api/admin/archivos'], ['delete', '/api/admin/archivos/1']]) {
    await request(app)[method](path).expect(401);
    for (const rol of ['operador', 'registrado']) await enviar(method, path, await sesion(rol)).expect(403);
  }
  const auth = await sesion('administrador');
  const panel = await enviar('get', '/admin/proyectos', auth).expect(200);
  assert.match(panel.text, /proyecto-form/); assert.match(panel.text, /aporte-template/);
  for (const [method, path] of [['post', '/api/admin/proyectos'], ['put', '/api/admin/proyectos/1'], ['delete', '/api/admin/proyectos/1']]) {
    await request(app)[method](path).set('Cookie', auth.cookie).set('Origin', env.APP_ORIGIN).send(datos()).expect(403);
    await request(app)[method](path).set('Cookie', auth.cookie).set('Origin', 'https://ajeno.invalid').set('X-CSRF-Token', auth.csrf).send(datos()).expect(403);
  }
});

test('Proyectos: alta, detalle y actualización de todos los campos y relaciones persisten', async () => {
  const auth = await sesion('administrador');
  const inicial = datos();
  const creada = await enviar('post', '/api/admin/proyectos', auth, inicial).expect(201);
  const id = creada.body.data.id;
  assert.ok(creada.body.data.createdAt); assert.deepEqual(creada.body.data.aportes, inicial.aportes);
  const portada = (await pool.query("INSERT INTO app.archivos(object_path,mime,bytes,ancho,alto,creado_por) VALUES($1,'image/webp',100,64,64,$2) RETURNING id", [`portadas/${crypto.randomUUID()}.webp`, users[0].id])).rows[0].id; files.push(portada);
  const nuevos = datos({ slug: `${prefix}-editado`, titulo: 'Proyecto actualizado', resumen: 'Resumen actualizado desde el panel administrativo.', descripcion: 'Descripción completa actualizada y persistida con la totalidad de sus relaciones en PostgreSQL.', estado: 'terminado', publicado: true, portadaId: portada, repositorioUrl: 'https://github.com/equipo/proyecto', tecnologiaIds: [techs[1]], aportes: members.map((m, i) => ({ miembroId: m.id, titulo: `Contribución ${i}`, descripcion: 'Aporte comprobado con evidencia y tecnologías propias.', estado: 'comprobado', evidenciaUrl: `https://example.org/prueba/${i}`, tecnologiaIds: [techs[1]] })) });
  await enviar('put', `/api/admin/proyectos/${id}`, auth, nuevos).expect(200);
  const detalle = (await enviar('get', `/api/admin/proyectos/${id}`, auth).expect(200)).body.data;
  for (const key of Object.keys(nuevos)) assert.deepEqual(detalle[key], nuevos[key], key);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM app.aportes WHERE proyecto_id=$1', [id])).rows[0].n, 2);
  const catalogo = await request(app).get('/proyectos').expect(200); assert.match(catalogo.text, /Proyecto actualizado/); assert.doesNotMatch(catalogo.text, /Aporte comprobado/);
  await request(app).get(`/proyectos/${nuevos.slug}`).expect(302);
  const privado = await enviar('get', `/proyectos/${nuevos.slug}`, await sesion('registrado')).expect(200); assert.match(privado.text, /Contribución 0/); assert.match(privado.text, /Contribución 1/);
  const perfil = await request(app).get(`/equipo/I${members[0].orden}`).expect(200);
  assert.match(perfil.text, /Contribución 0/);
  await enviar('put', `/api/admin/proyectos/${id}`, auth, { ...nuevos, publicado: false }).expect(200);
  assert.doesNotMatch((await request(app).get(`/equipo/I${members[0].orden}`).expect(200)).text, /Contribución 0/);
  await enviar('get', `/proyectos/${nuevos.slug}`, auth).expect(404);
  await enviar('delete', `/api/admin/proyectos/${id}`, auth).expect(204);
  await enviar('get', `/api/admin/proyectos/${id}`, auth).expect(404);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM app.aportes WHERE proyecto_id=$1', [id])).rows[0].n, 0);
});

test('Proyectos: listado filtra publicación y título con paginación y q literal', async () => {
  const auth = await sesion('administrador'); const tag = `Filtro-${sufijo.slice(0, 8)}`;
  for (let i = 0; i < 3; i++) await enviar('post', '/api/admin/proyectos', auth, datos({ titulo: `${tag} ${i}%`, publicado: i < 2 })).expect(201);
  const result = await enviar('get', `/api/admin/proyectos?page=1&pageSize=1&q=${tag}&publicado=true`, auth).expect(200);
  assert.deepEqual(result.body.meta, { page: 1, pageSize: 1, total: 2, totalPages: 2 });
  assert.equal(result.body.data.length, 1); assert.equal(result.body.data[0].aportes, undefined);
  const vacio = await enviar('get', `/api/admin/proyectos?page=10&pageSize=1&q=${tag}`, auth).expect(200); assert.equal(vacio.body.meta.total, 3); assert.equal(vacio.body.data.length, 0);
  const literal = await enviar('get', `/api/admin/proyectos?q=${encodeURIComponent(tag + ' 0%')}`, auth).expect(200); assert.equal(literal.body.meta.total, 1);
  for (const query of ['page=0', 'pageSize=51', 'publicado=1', 'page=1&page=2', 'desconocido=1']) await enviar('get', `/api/admin/proyectos?${query}`, auth).expect(400);
});

test('El portfolio original se conserva destacado y comparte datos de PostgreSQL en inicio, catálogo y resumen', async () => {
  const auth = await sesion('administrador');
  let original = (await pool.query("SELECT id,titulo,resumen,publicado FROM app.proyectos WHERE slug='portfolio-equipo'")).rows[0];
  const crearOriginal = !original;
  if (crearOriginal) {
    const respuesta = await enviar('post', '/api/admin/proyectos', auth, datos({ slug: 'portfolio-equipo', titulo: 'Portfolio original', publicado: true })).expect(201);
    original = respuesta.body.data;
  }
  const titulo = `Portfolio sincronizado ${sufijo.slice(0, 8)}`;
  const resumen = 'Resumen del portfolio original leído directamente de PostgreSQL.';
  try {
    await pool.query('UPDATE app.proyectos SET titulo=$1,resumen=$2,publicado=true WHERE id=$3', [titulo, resumen, original.id]);
    await enviar('post', '/api/admin/proyectos', auth, datos({ titulo: 'Proyecto más reciente que el portfolio', publicado: true })).expect(201);
    for (const ruta of ['/', '/proyectos', '/detalle']) {
      const respuesta = await request(app).get(ruta).expect(200);
      assert.ok(respuesta.text.includes(titulo), ruta);
      assert.ok(respuesta.text.includes(resumen), ruta);
      assert.match(respuesta.text, /class="glass tarjeta-proyecto revelar"/);
      assert.match(respuesta.text, /href="\/proyectos\/portfolio-equipo"/);
      assert.doesNotMatch(respuesta.text, /Interfaz de administración|No se puede leer/);
    }
    assert.doesNotMatch((await request(app).get('/')).text, /Proyecto más reciente que el portfolio/);
    await pool.query('UPDATE app.proyectos SET publicado=false WHERE id=$1', [original.id]);
    assert.ok(!(await request(app).get('/')).text.includes(titulo));
    assert.ok(!(await request(app).get('/proyectos')).text.includes(titulo));
    await request(app).get('/detalle').expect(404);
  } finally {
    if (crearOriginal) await pool.query('DELETE FROM app.proyectos WHERE id=$1', [original.id]);
    else await pool.query('UPDATE app.proyectos SET titulo=$1,resumen=$2,publicado=$3 WHERE id=$4', [original.titulo, original.resumen, original.publicado, original.id]);
  }
});

test('Sin proyectos en PostgreSQL, el sitio no inventa un portfolio estático', async t => {
  t.mock.method(proyectosRepository, 'listarPublicos', async () => []);
  const inicio = await request(app).get('/').expect(200);
  assert.match(inicio.text, /Todavía no hay proyectos publicados/);
  assert.doesNotMatch(inicio.text, /class="glass tarjeta-proyecto revelar"/);
  await request(app).get('/detalle').expect(404);
});

test('Proyectos: valida relaciones, duplicados, booleanos, HTTPS y estado terminado sin escrituras parciales', async () => {
  const auth = await sesion('administrador'), original = datos();
  const creada = await enviar('post', '/api/admin/proyectos', auth, original).expect(201); const id = creada.body.data.id;
  await enviar('post', '/api/admin/proyectos', auth, original).expect(409).expect(r => assert.equal(r.body.error.code, 'SLUG_DUPLICADO'));
  for (const cambio of [{ publicado: 'true' }, { slug: '../otro' }, { tecnologiaIds: [] }, { tecnologiaIds: [techs[0], techs[0]] }, { estado: 'terminado' }, { repositorioUrl: 'javascript:alert(1)' }, { portadaId: 2147483647 }, { tecnologiaIds: [2147483647] }, { aportes: [{ ...original.aportes[0], miembroId: 2147483647 }] }, { aportes: [{ ...original.aportes[0], estado: 'comprobado' }] }]) {
    await enviar('put', `/api/admin/proyectos/${id}`, auth, { ...original, ...cambio }).expect(422);
  }
  await enviar('put', `/api/admin/proyectos/${id}`, auth, { titulo: 'Incompleto' }).expect(422);
  const final = (await enviar('get', `/api/admin/proyectos/${id}`, auth)).body.data;
  assert.equal(final.titulo, original.titulo); assert.deepEqual(final.aportes, original.aportes);
  await enviar('get', '/api/admin/proyectos/1e2', auth).expect(400);
});

test('Proyectos: si falla una relación durante el reemplazo, toda la transacción se revierte', async t => {
  const auth = await sesion('administrador'), original = datos();
  const creada = await enviar('post', '/api/admin/proyectos', auth, original).expect(201); const id = creada.body.data.id;
  const originalConnect = pool.connect.bind(pool);
  const mock = t.mock.method(pool, 'connect', (...args) => {
    if (args.length) return originalConnect(...args);
    return originalConnect().then(client => {
      const query = client.query.bind(client); const release = client.release.bind(client);
      client.query = (sql, ...params) => String(sql).startsWith('INSERT INTO app.aporte_tecnologia') ? Promise.reject(Object.assign(new Error('Relación concurrente de prueba'), { code: '23503' })) : query(sql, ...params);
      client.release = (...params) => { client.query = query; client.release = release; release(...params); };
      return client;
    });
  });
  try { await enviar('put', `/api/admin/proyectos/${id}`, auth, { ...original, titulo: 'No debe quedar guardado' }).expect(422); }
  finally { mock.mock.restore(); }
  const final = (await enviar('get', `/api/admin/proyectos/${id}`, auth).expect(200)).body.data;
  assert.equal(final.titulo, original.titulo); assert.deepEqual(final.aportes, original.aportes);
});

test('Proyectos: borrar con demos devuelve 409 sin perder aportes, tecnologías ni demo', async () => {
  const auth = await sesion('administrador');
  const creada = await enviar('post', '/api/admin/proyectos', auth, datos()).expect(201); const id = creada.body.data.id;
  await pool.query("INSERT INTO app.demos(proyecto_id,titulo,descripcion,tipo) VALUES($1,'Demo asociada','Demo de prueba','tablero')", [id]);
  const response = await enviar('delete', `/api/admin/proyectos/${id}`, auth).expect(409);
  assert.equal(response.body.error.code, 'PROYECTO_CON_DEMOS'); assert.match(response.body.error.fields.demos, /Demo asociada/);
  const final = (await enviar('get', `/api/admin/proyectos/${id}`, auth).expect(200)).body.data;
  assert.equal(final.aportes.length, 1); assert.equal(final.tecnologiaIds.length, 1); assert.equal(final.demos.length, 1);
  const demoId = final.demos[0].id;
  await pool.query("INSERT INTO app.tareas_demo(demo_id,usuario_id,titulo) VALUES($1,$2,'Tarea temporal')", [demoId, users[0].id]);
  await request(app).delete(`/api/admin/demos/${demoId}`).set('Cookie', auth.cookie).expect(403);
  await enviar('delete', `/api/admin/demos/${demoId}`, await sesion('operador')).expect(403);
  await enviar('delete', `/api/admin/demos/${demoId}`, auth).expect(204);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM app.tareas_demo WHERE demo_id=$1', [demoId])).rows[0].n, 0);
  await enviar('delete', `/api/admin/proyectos/${id}`, auth).expect(204);
});

test('Portadas: multipart válido, archivo falso, límite, CSRF y autorización de descarga', async t => {
  const auth = await sesion('administrador');
  const png = await sharp({ create: { width: 80, height: 80, channels: 3, background: '#4466aa' } }).png().toBuffer();
  let subidas = 0;
  t.mock.method(archivosService, 'crear', async (buffer, usuarioId) => { assert.equal(usuarioId, users[0].id); assert.ok(buffer.equals(png)); subidas++; return { id: 999, url: '/media/999', ancho: 80, alto: 80, bytes: 100 }; });
  await request(app).post('/api/admin/archivos').set('Cookie', auth.cookie).set('Origin', env.APP_ORIGIN).set('X-CSRF-Token', auth.csrf).attach('imagen', png, 'portada.png').expect(201);
  assert.equal(subidas, 1);
  await request(app).post('/api/admin/archivos').set('Cookie', auth.cookie).attach('imagen', png, 'portada.png').expect(403);
  await request(app).post('/api/admin/archivos').set('Cookie', auth.cookie).set('Origin', env.APP_ORIGIN).set('X-CSRF-Token', auth.csrf).attach('imagen', Buffer.alloc(6 * 1024 * 1024), 'grande.png').expect(413);
  await request(app).post('/api/admin/archivos').set('Cookie', auth.cookie).set('Origin', env.APP_ORIGIN).set('X-CSRF-Token', auth.csrf).attach('otro', png, 'portada.png').expect(422);
  assert.equal(subidas, 1);
  const archivo = (await pool.query("INSERT INTO app.archivos(object_path,mime,bytes,ancho,alto,creado_por) VALUES($1,'image/webp',100,80,80,$2) RETURNING id", [`portadas/${crypto.randomUUID()}.webp`, users[0].id])).rows[0].id; files.push(archivo);
  await request(app).get(`/media/${archivo}`).expect(404);
  const proyecto = await enviar('post', '/api/admin/proyectos', auth, datos({ portadaId: archivo })).expect(201);
  await enviar('delete', `/api/admin/archivos/${archivo}`, auth).expect(409);
  await enviar('put', `/api/admin/proyectos/${proyecto.body.data.id}`, auth, { ...datos(), portadaId: archivo, publicado: true }).expect(200);
});
