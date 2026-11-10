import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../../src/app.js';
import { pool } from '../../src/config/db.js';

after(async () => {
    await pool.end();
});

test('Navegación pública: acceso único, rutas reales y scripts sin duplicar', async () => {
    for (const ruta of ['/', '/equipo', '/servicios', '/proyectos', '/login', '/registro']) {
        const { text } = await request(app).get(ruta).expect(200);
        const nav = text.match(/<nav id="navegacion"[\s\S]*?<\/nav>/)?.[0];
        assert.ok(nav, `Falta navegación en ${ruta}`);
        assert.equal((nav.match(/>Ingresar\s*</g) || []).length, 1, ruta);
        assert.equal((nav.match(/>Registrarse<\/a>/g) || []).length, 1, ruta);
        assert.match(nav, /href="\/login"/);
        assert.match(nav, /href="\/registro"/);
        assert.doesNotMatch(text, /href="\/i3(?:\/|")/);
        const scripts = [...text.matchAll(/<script[^>]*src="([^"]+)"/g)].map(match => match[1]);
        assert.equal(scripts.length, new Set(scripts).size, `Scripts duplicados en ${ruta}`);
    }
});

test('Seguridad base: GET / devuelve 200, X-Request-Id, CSP estricta y oculta X-Powered-By', async () => {
    const res = await request(app).get('/');

    assert.equal(res.status, 200);
    assert.equal(res.headers['x-powered-by'], undefined);
    assert.ok(res.headers['x-request-id'], 'Debe incluir cabecera X-Request-Id');

    const csp = res.headers['content-security-policy'];
    assert.ok(csp, 'Debe incluir cabecera Content-Security-Policy');
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /script-src 'self'/);
    assert.match(csp, /style-src 'self'/);
    assert.match(csp, /img-src 'self' data:/);
    assert.match(csp, /connect-src 'self'/);
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /base-uri 'self'/);
    assert.match(csp, /frame-ancestors 'none'/);
});

test('Manejo de errores API: ruta inexistente /api/no-existe devuelve 404 con formato oficial y requestId', async () => {
    const res = await request(app)
        .get('/api/no-existe')
        .set('Accept', 'application/json');

    assert.equal(res.status, 404);
    assert.equal(res.body.ok, false);
    assert.equal(res.body.error.code, 'NO_ENCONTRADO');
    assert.equal(typeof res.body.error.message, 'string');
    assert.ok(res.body.error.requestId);
    assert.equal(res.body.error.stack, undefined);
});

test('Limite de parser JSON: rechaza cuerpos mayores a 32 KiB con 413 ARCHIVO_GRANDE', async () => {
    const payloadGigante = { texto: 'a'.repeat(35 * 1024) };

    const res = await request(app)
        .post('/api/no-existe')
        .set('Content-Type', 'application/json')
        .send(payloadGigante);

    assert.equal(res.status, 413);
    assert.equal(res.body.ok, false);
    assert.equal(res.body.error.code, 'ARCHIVO_GRANDE');
    assert.ok(res.body.error.requestId);
});

test('Proteccion de metricas (I2 07): GET /api/admin/metricas sin sesion devuelve 401 NO_AUTENTICADO y Cache-Control no-store', async () => {
    const res = await request(app)
        .get('/api/admin/metricas')
        .set('Accept', 'application/json');

    assert.equal(res.status, 401);
    assert.equal(res.headers['cache-control'], 'no-store');
    assert.equal(res.body.ok, false);
    assert.equal(res.body.error.code, 'NO_AUTENTICADO');
    assert.ok(res.body.error.requestId);
});

test('Health check (Apartado 21): GET /health responde JSON 200 {"ok":true} con BD sana y 503 {"ok":false} si falla la consulta, sin depender de la sesion', async (t) => {
  // 1. Simulamos BD sana (SELECT 1 responde una fila) -> debe dar 200 y {"ok": true}
    const mockQuery = t.mock.method(pool, 'query', async () => ({
        rows: [{ ok: 1 }],
        rowCount: 1,
    }));

    const resSana = await request(app).get('/health');
    assert.equal(resSana.status, 200);
    assert.deepEqual(resSana.body, { ok: true });

  // 2. Simulamos fallo de PostgreSQL en pool.query y enviamos cookie de sesion -> debe dar 503 JSON y no HTML
    mockQuery.mock.mockImplementation(async () => {
        throw new Error('ECONNREFUSED: PostgreSQL detenido');
    });

    const resCaida = await request(app)
        .get('/health')
        .set('Cookie', ['equipo.sid=s%3Asesion_simulada.firma']);

    assert.equal(resCaida.status, 503);
    assert.match(resCaida.headers['content-type'], /application\/json/);
    assert.deepEqual(resCaida.body, { ok: false });
});