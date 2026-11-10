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
function baseSimulada(t, { rol = 'registrado', publicada = true } = {}) {
  return t.mock.method(pool, 'query', async sql => {
    if (sql.includes('SELECT sess')) return { rows: [{ sess: {
      cookie: { originalMaxAge: 1800000, expires: new Date(Date.now() + 1800000).toISOString(), httpOnly: true, path: '/' },
      usuarioId: 1, versionSesion: 1, autenticadoEn: Date.now(),
    } }] };
    if (sql.includes('FROM app.usuarios')) return { rows: [{ id: 1, nombre: 'Prueba', rol, activo: true, version_sesion: 1 }] };
    if (sql.includes('FROM app.proyectos')) return { rows: [{ id: 1, titulo: 'Portfolio del equipo', descripcion: 'Proyecto colectivo' }] };
    if (sql.includes('FROM app.demos')) {
      assert.match(sql, /publicada = true/);
      if (sql.includes('JOIN')) assert.match(sql, /p.publicado = true/);
      return { rows: publicada ? [demo] : [] };
    }
    return { rows: [] };
  });
}

test('Las páginas de proyecto y demo requieren sesión; el recurso privado responde 401', async () => {
  for (const ruta of ['/proyectos/portfolio-equipo', '/demos/2']) {
    const res = await request(app).get(ruta).expect(302);
    assert.equal(res.headers.location, `/login?next=${encodeURIComponent(ruta)}`);
  }
  await request(app).get('/demos/2/recurso.js').expect(401);
  await request(app).get('/ui-i3/demos/algoritmos-motor.js').expect(404);
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
