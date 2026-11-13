import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import request from 'supertest';
import { app } from '../../src/app.js';
import { pool } from '../../src/config/db.js';
import { env } from '../../src/config/env.js';

after(() => pool.end());
const firma = createHmac('sha256', env.SESSION_SECRET).update('demo-test').digest('base64').replace(/=+$/, '');
const cookie = `equipo.sid=${encodeURIComponent(`s:demo-test.${firma}`)}`;
const demo = { id: 2, titulo: 'Visualizador de algoritmos', descripcion: 'Búsqueda y ordenamiento', proyecto_slug: 'portfolio-equipo' };
function baseSimulada(t, { rol = 'registrado', publicada = true, fallarDemos = false, nombre = 'Prueba', tipo = 'algoritmos' } = {}) {
  return t.mock.method(pool, 'query', async sql => {
    if (sql.includes('SELECT sess')) return { rows: [{ sess: {
      cookie: { originalMaxAge: 1800000, expires: new Date(Date.now() + 1800000).toISOString(), httpOnly: true, path: '/' },
      usuarioId: 1, versionSesion: 1, autenticadoEn: Date.now(),
    } }] };
    if (sql.includes('FROM app.usuarios')) return { rows: [{ id: 1, nombre, email: 'prueba@example.com', rol, activo: true, version_sesion: 1 }] };
    if (sql.includes('FROM app.proyectos')) return { rows: [{ id: 1, titulo: 'Portfolio del equipo', descripcion: 'Proyecto colectivo' }] };
    if (sql.includes('FROM app.demos')) {
      if (fallarDemos) throw Object.assign(new Error('conexión de prueba'), { code: 'ECONNREFUSED' });
      assert.match(sql, /publicada = true/);
      if (sql.includes('JOIN')) assert.match(sql, /p.publicado = true/);
      return { rows: publicada ? [{ ...demo, tipo }] : [] };
    }
    return { rows: [] };
  });
}

test('Las páginas de proyecto y demo requieren sesión; el recurso privado responde 401', async () => {
  for (const ruta of ['/js/tablero.js', '/js/tablero.adapter.js']) {
    await request(app).get(ruta).expect(401);
  }
  await request(app).get('/js/%74ablero.js').expect(404);
  for (const ruta of ['/proyectos/portfolio-equipo', '/demos/2']) {
    const res = await request(app).get(ruta).expect(302);
    assert.equal(res.headers.location, `/login?next=${encodeURIComponent(ruta)}`);
  }
  await request(app).get('/demos/2/recurso.js').expect(401);
  await request(app).get('/ui-i3/demos/algoritmos-motor.js').expect(404);
});

test('scripts del tablero se sirven con sesión y no se cachean', async t => {
  baseSimulada(t);
  for (const ruta of ['/js/tablero.js', '/js/tablero.adapter.js']) {
    const res = await request(app).get(ruta).set('Cookie', cookie).expect(200);
    assert.match(res.headers['content-type'], /javascript/);
    assert.equal(res.headers['cache-control'], 'no-store');
  }
});

test('Un registrado puede recorrer proyecto, visualizador y motor publicado', async t => {
  baseSimulada(t);
  const proyecto = await request(app).get('/proyectos/portfolio-equipo').set('Cookie', cookie).expect(200);
  assert.match(proyecto.text, /href="\/demos\/2"/);
  const pagina = await request(app).get('/demos/2').set('Cookie', cookie).expect(200);
  assert.match(pagina.text, /type="module" src="\/demos\/2\/recurso.js"/);
  assert.doesNotMatch(pagina.text, /Prototipo de I3|\/i3\/muestras/);
  const script = await request(app).get('/demos/2/recurso.js').set('Cookie', cookie).expect(200);
  assert.match(script.headers['content-type'], /javascript/);
  assert.match(script.text, /export function generarPasos/);
  assert.equal(script.headers['cache-control'], 'no-store');
});

test('Operador y administrador también requieren sesión y pueden acceder al proyecto, demo y recurso publicado', async t => {
  for (const rol of ['operador', 'administrador']) {
    baseSimulada(t, { rol });
    await request(app).get('/proyectos/portfolio-equipo').set('Cookie', cookie).expect(200);
    await request(app).get('/demos/2').set('Cookie', cookie).expect(200);
    await request(app).get('/demos/2/recurso.js').set('Cookie', cookie).expect(200);
    t.mock.restoreAll();
  }
});

test('Demos sin publicar o IDs inválidos no entregan página ni código', async t => {
  baseSimulada(t, { publicada: false });
  for (const ruta of ['/demos/2', '/demos/2/recurso.js', '/demos/0', '/demos/no-existe/recurso.js']) {
    await request(app).get(ruta).set('Cookie', cookie).expect(404);
  }
});

test('Un rol sin acceso no puede obtener el motor de la demo', async t => {
  baseSimulada(t, { rol: 'otro' });
  await request(app).get('/demos/2/recurso.js').set('Cookie', cookie).expect(403);
});

test('Mi cuenta muestra datos escapados y enlaza al catálogo de demos', async t => {
  baseSimulada(t, { nombre: '<b>Prueba</b>' });
  const res = await request(app).get('/mi-cuenta').set('Cookie', cookie).expect(200);
  assert.match(res.text, /class="glass cuenta-perfil"/);
  assert.match(res.text, /&lt;b&gt;Prueba&lt;\/b&gt;/);
  assert.match(res.text, /class="cuenta-arte" aria-hidden="true"/);
  assert.match(res.text, /href="\/demos"/);
  assert.match(res.text, /href="\/css\/cuenta.css"/);
  assert.doesNotMatch(res.text, /href="\/proyectos\/portfolio-equipo"/);
});

test('Ondas: vista y motor correctos para todos los roles; recurso privado y publicación obligatoria', async t => {
  await request(app).get('/demos/2').expect(302);
  await request(app).get('/demos/2/recurso.js').expect(401);
  await request(app).get('/ui-i3/demos/ondas.js').expect(404);
  for (const rol of ['registrado', 'operador', 'administrador']) {
    baseSimulada(t, { rol, tipo: 'ondas' });
    const pagina = await request(app).get('/demos/2').set('Cookie', cookie).expect(200);
    assert.match(pagina.text, /data-ondas-canvas/); assert.match(pagina.text, /type="module" src="\/demos\/2\/recurso.js"/);
    assert.doesNotMatch(pagina.text, /data-visualizador|data-calendario/);
    const script = await request(app).get('/demos/2/recurso.js').set('Cookie', cookie).expect(200);
    assert.match(script.text, /export function campoOndas/); assert.equal(script.headers['cache-control'], 'no-store');
    t.mock.restoreAll();
  }
  baseSimulada(t, { tipo: 'ondas', publicada: false });
  await request(app).get('/demos/2').set('Cookie', cookie).expect(404);
  await request(app).get('/demos/2/recurso.js').set('Cookie', cookie).expect(404);
});

test('Catálogo protegido de demos no depende del slug fijo del portfolio', async t => {
  baseSimulada(t);
  const res = await request(app).get('/demos').set('Cookie', cookie).expect(200);
  assert.match(res.text, /href="\/demos\/2"/);
  assert.match(res.text, /Volver a mi cuenta/);
  await request(app).get('/demos').expect(302).expect('Location', '/login?next=%2Fdemos');
});

test('Sin demos publicadas, el catálogo responde con un estado vacío en lugar de 404', async t => {
  baseSimulada(t, { publicada: false });
  const res = await request(app).get('/demos').set('Cookie', cookie).expect(200);
  assert.match(res.text, /Todavía no hay demos publicadas/);
  assert.doesNotMatch(res.text, /href="\/demos\/2"/);
});

test('Base caída al consultar demos: devuelve 503 con navegación y reintento', async t => {
  baseSimulada(t, { fallarDemos: true });
  const res = await request(app).get('/demos').set('Cookie', cookie).expect(503);
  assert.match(res.text, /Las demos están temporalmente fuera de línea/);
  assert.match(res.text, /href="\/mi-cuenta"/);
  assert.equal(res.headers['retry-after'], '30');
});

test('Tras ingresar se conserva el destino al catálogo de demos', async t => {
  baseSimulada(t);
  const res = await request(app).get('/login?next=%2Fdemos').set('Cookie', cookie).expect(302);
  assert.equal(res.headers.location, '/demos');
});
