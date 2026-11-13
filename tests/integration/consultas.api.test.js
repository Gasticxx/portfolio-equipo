// Pruebas de integración del módulo de I6 sobre portfolio_test (TEST_DATABASE_URL).
// Casos: T06, T07, T08, T09 de la guía y A20–A27 de la especificación.
// Brevo se sustituye por un doble; la recepción real se prueba a mano (docs/pruebas.md).
import { test, before, beforeEach, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { crearApp, crearBrevoFalso, crearPool, prepararBase, nuevaClave, ENV_PRUEBA } from '../helpers/app-consultas.js';

const pool = crearPool();
const omitir = await motivoParaOmitir(pool);

// Requiere portfolio_test migrada: node --env-file=.env.test scripts/migrate.js
async function motivoParaOmitir(p) {
  if (!p) return 'TEST_DATABASE_URL no está definida';
  try {
    const { rows } = await p.query(`SELECT to_regclass('app.envios_email') IS NOT NULL AS ok`);
    if (rows[0].ok) return false;
    await p.end();
    return 'la base de prueba no tiene la migración 003 (ejecutá scripts/migrate.js con .env.test)';
  } catch (err) {
    await p.end().catch(() => {});
    return `no se pudo conectar a TEST_DATABASE_URL (${err.code ?? err.message})`;
  }
}

const consultaValida = (extra = {}) => ({
  nombre: 'Ana Pérez',
  email: 'ana@example.com',
  tipo: 'general',
  asunto: 'Consulta de prueba',
  mensaje: 'Este es un mensaje de prueba con más de veinte caracteres.',
  consentimiento: true,
  servicioId: null,
  ...extra
});

describe('Módulo de consultas (I6)', { skip: omitir }, () => {
  let brevo;
  let app;
  let datos;

  const contar = async (tabla) => (await pool.query(`SELECT count(*)::int AS n FROM app.${tabla}`)).rows[0].n;
  const enviar = (agente, cuerpo, clave = nuevaClave()) =>
    agente.post('/api/consultas').set('x-csrf-token', 'ok').set('Idempotency-Key', clave).send(cuerpo);
  const como = (usuarioId) => ({
    get: (url) => request(app).get(url).set('x-prueba-usuario', String(usuarioId)),
    escribir: (metodo, url, cuerpo, clave) => {
      const r = request(app)[metodo](url).set('x-prueba-usuario', String(usuarioId)).set('x-csrf-token', 'ok');
      if (clave) r.set('Idempotency-Key', clave);
      return r.send(cuerpo);
    }
  });
  const atrasar = (envioId, segundos) =>
    pool.query(
      `UPDATE app.envios_email
          SET updated_at = now() - make_interval(secs => $2),
              bloqueo_hasta = bloqueo_hasta - make_interval(secs => $2)
        WHERE id = $1`,
      [envioId, segundos]
    );

  before(async () => {
    datos = await prepararBase(pool);
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE app.envios_email, app.respuestas, app.consultas RESTART IDENTITY CASCADE');
    brevo = crearBrevoFalso();
    app = crearApp({ pool, brevo, timeoutMs: 100 });
  });

  after(async () => {
    await pool.end();
  });

  // ------------------------------------------------------------ Contacto
  test('A20/T06: las tres categorías se registran y notifican; consentimiento falso se rechaza', async () => {
    const agente = request.agent(app);
    for (const tipo of ['general', 'cotizacion', 'asesoria']) {
      const r = await enviar(agente, consultaValida({ tipo, servicioId: tipo === 'cotizacion' ? datos.servicios.activo : null }));
      assert.equal(r.status, 201, JSON.stringify(r.body));
      assert.deepEqual(Object.keys(r.body.data).sort(), ['estado', 'id', 'notificacionEstado']);
      assert.equal(r.body.data.estado, 'nueva');
      assert.equal(r.body.data.notificacionEstado, 'aceptado');
    }
    const rechazo = await enviar(agente, consultaValida({ consentimiento: false }));
    assert.equal(rechazo.status, 422);
    assert.equal(rechazo.body.error.code, 'VALIDACION');
    assert.ok(rechazo.body.error.fields.consentimiento);
    assert.ok(rechazo.body.error.requestId);
    assert.equal(await contar('consultas'), 3);
    assert.equal(brevo.llamadas.length, 3);

    const notif = brevo.llamadas[0].body;
    assert.deepEqual(notif.to, [{ email: ENV_PRUEBA.CONTACT_TO_EMAIL }]);
    assert.deepEqual(notif.replyTo, { email: 'ana@example.com', name: 'Ana Pérez' });
    assert.equal(notif.subject, '[Reflection Tech] Consulta #1 - Consulta de prueba');
  });

  test('la respuesta pública nunca incluye email ni mensaje', async () => {
    const r = await enviar(request.agent(app), consultaValida());
    const texto = JSON.stringify(r.body);
    assert.ok(!texto.includes('ana@example.com'));
    assert.ok(!texto.includes('veinte caracteres'));
  });

  test('servicioId: solo cotización y servicio activo; se guarda snapshot', async () => {
    const agente = request.agent(app);
    const inactivo = await enviar(agente, consultaValida({ tipo: 'cotizacion', servicioId: datos.servicios.inactivo }));
    assert.equal(inactivo.status, 422);
    assert.ok(inactivo.body.error.fields.servicioId);
    const otroTipo = await enviar(agente, consultaValida({ tipo: 'asesoria', servicioId: datos.servicios.activo }));
    assert.equal(otroTipo.status, 422);
    const ok = await enviar(agente, consultaValida({ tipo: 'cotizacion', servicioId: datos.servicios.activo }));
    assert.equal(ok.status, 201);
    const { rows } = await pool.query('SELECT servicio_id, servicio_nombre_snapshot FROM app.consultas WHERE id = $1', [ok.body.data.id]);
    assert.deepEqual(rows[0], { servicio_id: datos.servicios.activo, servicio_nombre_snapshot: 'Servicio de prueba I6' });
  });

  test('A21: misma clave, sesión y payload devuelve 200 sin duplicar consulta ni email', async () => {
    const agente = request.agent(app);
    const clave = nuevaClave();
    const primero = await enviar(agente, consultaValida(), clave);
    const segundo = await enviar(agente, consultaValida({ email: ' ANA@example.com ' }), clave); // normaliza igual
    assert.equal(primero.status, 201);
    assert.equal(segundo.status, 200);
    assert.deepEqual(segundo.body.data, primero.body.data);
    assert.equal(await contar('consultas'), 1);
    assert.equal(await contar('envios_email'), 1);
    assert.equal(brevo.llamadas.length, 1);
  });

  test('A22: misma clave con otro mensaje u otra sesión devuelve 409 sin alta ni envío', async () => {
    const clave = nuevaClave();
    await enviar(request.agent(app), consultaValida(), clave);
    const otroPayload = await enviar(request.agent(app), consultaValida({ mensaje: 'Otro mensaje distinto con más de veinte caracteres.' }), clave);
    assert.equal(otroPayload.status, 409);
    assert.equal(otroPayload.body.error.code, 'IDEMPOTENCIA_CONFLICTO');
    assert.equal(await contar('consultas'), 1);
    assert.equal(brevo.llamadas.length, 1);
  });

  test('carrera de altas con la misma clave: una consulta y un email', async () => {
    const agente = request.agent(app);
    await agente.get('/api/consultas-inexistente'); // crea la cookie de sesión antes de las paralelas
    const clave = nuevaClave();
    brevo.demoraMs = 30;
    const respuestas = await Promise.all([enviar(agente, consultaValida(), clave), enviar(agente, consultaValida(), clave)]);
    assert.deepEqual(respuestas.map((r) => r.status).sort(), [200, 201]);
    assert.equal(await contar('consultas'), 1);
    assert.equal(brevo.llamadas.length, 1);
  });

  test('Idempotency-Key ausente o inválida es 400; sin CSRF es 403; sin JSON es 415', async () => {
    const sinClave = await request(app).post('/api/consultas').set('x-csrf-token', 'ok').send(consultaValida());
    assert.equal(sinClave.status, 400);
    assert.equal(sinClave.body.error.code, 'PARAMETRO_INVALIDO');
    const sinCsrf = await request(app).post('/api/consultas').set('Idempotency-Key', nuevaClave()).send(consultaValida());
    assert.equal(sinCsrf.status, 403);
    const texto = await request(app).post('/api/consultas').set('x-csrf-token', 'ok').set('Idempotency-Key', nuevaClave())
      .set('Content-Type', 'text/plain').send('hola');
    assert.equal(texto.status, 415);
    assert.equal(await contar('consultas'), 0);
  });

  test('A24/T07: Brevo rechaza, falla la red o agota el timeout: la consulta se conserva', async () => {
    const agente = request.agent(app);
    const esperados = { error: 'error', red: 'desconocido', timeout: 'desconocido' };
    for (const [modo, estado] of Object.entries(esperados)) {
      brevo.modo = modo;
      const r = await enviar(agente, consultaValida({ asunto: `Prueba ${modo}` }));
      assert.equal(r.status, 201, modo);
      assert.equal(r.body.data.notificacionEstado, estado, modo);
    }
    const { rows } = await pool.query(`SELECT estado, error_codigo, intentos FROM app.envios_email ORDER BY id`);
    assert.deepEqual(rows.map((r) => r.estado), ['error', 'desconocido', 'desconocido']);
    assert.equal(rows[0].error_codigo, 'HTTP_400_invalid_parameter');
    assert.equal(rows[2].error_codigo, 'TIMEOUT');
    assert.equal(await contar('consultas'), 3);
  });

  test('A23: base inaccesible antes del commit devuelve 503 y no llama a Brevo', async () => {
    const caida = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), { code: 'ECONNREFUSED' });
    const poolCaido = { connect: async () => { throw caida; }, query: async () => { throw caida; } };
    const appCaida = crearApp({ pool: poolCaido, brevo });
    const r = await request(appCaida).post('/api/consultas').set('x-csrf-token', 'ok').set('Idempotency-Key', nuevaClave()).send(consultaValida());
    assert.equal(r.status, 503);
    assert.equal(r.body.error.code, 'SERVICIO_NO_DISPONIBLE');
    assert.equal(brevo.llamadas.length, 0);
  });

  // ------------------------------------------------------------ Permisos
  test('A27/T08: visitante y registrado no ven ni responden consultas', async () => {
    const { body } = await enviar(request.agent(app), consultaValida());
    const id = body.data.id;
    assert.equal((await request(app).get('/api/operador/consultas')).status, 401);
    const reg = como(datos.usuarios.registrado);
    for (const r of [
      await reg.get('/api/operador/consultas'),
      await reg.get(`/api/operador/consultas/${id}`),
      await reg.escribir('patch', `/api/operador/consultas/${id}`, { estado: 'en_proceso' }),
      await reg.escribir('post', `/api/operador/consultas/${id}/respuestas`, { mensaje: 'Intento de respuesta' }, nuevaClave()),
      await reg.escribir('post', '/api/operador/envios/1/reintentar', {})
    ]) {
      assert.equal(r.status, 403);
      assert.ok(!JSON.stringify(r.body).includes('ana@example.com'));
    }
    assert.equal(await contar('respuestas'), 0);
    assert.equal((await como(datos.usuarios.admin).get('/api/operador/consultas')).status, 200);
  });

  // ------------------------------------------------------------ Listado
  test('listado: filtros, búsqueda literal, paginación y orden', async () => {
    const agente = request.agent(app);
    await enviar(agente, consultaValida({ asunto: 'Descuento del 100% ya' }));
    brevo.modo = 'error';
    await enviar(agente, consultaValida({ tipo: 'asesoria', asunto: 'Asesoría técnica', nombre: 'Beto' }));
    brevo.modo = 'ok';
    await enviar(agente, consultaValida({ tipo: 'asesoria', asunto: 'Otra asesoría', email: 'carla@example.com' }));
    const op = como(datos.usuarios.operador);

    const todas = await op.get('/api/operador/consultas');
    assert.deepEqual(todas.body.data.map((c) => c.id), [3, 2, 1]);
    assert.deepEqual(todas.body.meta, { page: 1, pageSize: 10, total: 3, totalPages: 1 });
    assert.deepEqual(Object.keys(todas.body.data[0]).sort(), ['asunto', 'createdAt', 'estado', 'id', 'nombre', 'notificacionEstado', 'tipo']);

    assert.equal((await op.get('/api/operador/consultas?tipo=asesoria')).body.meta.total, 2);
    assert.deepEqual((await op.get('/api/operador/consultas?notificacionEstado=error')).body.data.map((c) => c.id), [2]);
    assert.deepEqual((await op.get('/api/operador/consultas?q=100%25')).body.data.map((c) => c.id), [1]);
    assert.equal((await op.get('/api/operador/consultas?q=%25%25')).body.meta.total, 0); // % literal, no comodín
    assert.deepEqual((await op.get('/api/operador/consultas?q=carla')).body.data.map((c) => c.id), [3]);

    const pagina2 = await op.get('/api/operador/consultas?pageSize=2&page=2');
    assert.deepEqual(pagina2.body.data.map((c) => c.id), [1]);
    const fuera = await op.get('/api/operador/consultas?page=9');
    assert.deepEqual(fuera.body.data, []);
    assert.equal(fuera.body.meta.totalPages, 1);

    assert.equal((await op.get('/api/operador/consultas?tipo=x')).status, 400);
    assert.equal((await op.get('/api/operador/consultas?orden=id')).status, 400);
    assert.equal((await op.get('/api/operador/consultas?page=1&page=2')).status, 400);
    assert.equal((await op.get('/api/operador/consultas/abc')).status, 400);
    assert.equal((await op.get('/api/operador/consultas/999')).status, 404);
    assert.equal(todas.headers['cache-control'], 'no-store');
  });

  // ------------------------------------------------------------ Estados
  test('transiciones de estado: GET no cambia; respondida no es manual', async () => {
    const { body } = await enviar(request.agent(app), consultaValida());
    const id = body.data.id;
    const op = como(datos.usuarios.operador);
    await op.get(`/api/operador/consultas/${id}`);
    assert.equal((await pool.query('SELECT estado FROM app.consultas WHERE id = $1', [id])).rows[0].estado, 'nueva');

    assert.equal((await op.escribir('patch', `/api/operador/consultas/${id}`, { estado: 'respondida' })).status, 409);
    assert.equal((await op.escribir('patch', `/api/operador/consultas/${id}`, { estado: 'cerrada' })).status, 409);
    assert.equal((await op.escribir('patch', `/api/operador/consultas/${id}`, { estado: 'otro' })).status, 422);
    const ok = await op.escribir('patch', `/api/operador/consultas/${id}`, { estado: 'en_proceso' });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.estado, 'en_proceso');
  });

  // ------------------------------------------------------------ Respuestas
  test('A25/T09: respuesta con historial, autor de sesión y destinatario de la consulta', async () => {
    const { body } = await enviar(request.agent(app), consultaValida({ email: 'Cliente@Example.com' }));
    const id = body.data.id;
    const op = como(datos.usuarios.operador);
    const clave = nuevaClave();

    const r = await op.escribir('post', `/api/operador/consultas/${id}/respuestas`, { mensaje: 'Gracias por escribir, te contactamos pronto.' }, clave);
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.deepEqual(Object.keys(r.body.data).sort(), ['createdAt', 'envioEstado', 'id']);
    assert.equal(r.body.data.envioEstado, 'aceptado');

    const envio = brevo.llamadas.at(-1).body;
    assert.deepEqual(envio.to, [{ email: 'cliente@example.com', name: 'Ana Pérez' }]);
    assert.deepEqual(envio.replyTo, { email: ENV_PRUEBA.MAIL_FROM_EMAIL, name: ENV_PRUEBA.MAIL_FROM_NAME });
    assert.equal(envio.subject, `[Reflection Tech] Respuesta a consulta #${id}`);

    const detalle = (await op.get(`/api/operador/consultas/${id}`)).body.data;
    assert.equal(detalle.estado, 'respondida');
    assert.equal(detalle.respuestas.length, 1);
    assert.equal(detalle.respuestas[0].autor.id, datos.usuarios.operador);
    assert.equal(detalle.respuestas[0].envio.estado, 'aceptado');
    assert.deepEqual(detalle.envios.map((e) => e.clase), ['notificacion', 'respuesta']);
    const texto = JSON.stringify(detalle);
    assert.ok(!texto.includes('idempotencia') && !texto.includes('payload') && !texto.includes(clave));

    // Repetición correcta: 200, sin otro envío. Otro autor con la misma clave: 409.
    const llamadas = brevo.llamadas.length;
    const repetida = await op.escribir('post', `/api/operador/consultas/${id}/respuestas`, { mensaje: 'Gracias por escribir, te contactamos pronto.' }, clave);
    assert.equal(repetida.status, 200);
    assert.equal(repetida.body.data.id, r.body.data.id);
    const otroAutor = await como(datos.usuarios.operador2).escribir('post', `/api/operador/consultas/${id}/respuestas`, { mensaje: 'Gracias por escribir, te contactamos pronto.' }, clave);
    assert.equal(otroAutor.status, 409);
    assert.equal(brevo.llamadas.length, llamadas);
    assert.equal(await contar('respuestas'), 1);
  });

  test('respuesta: rechaza destinatario, mensaje corto y consulta cerrada; un fallo no marca respondida', async () => {
    const { body } = await enviar(request.agent(app), consultaValida());
    const id = body.data.id;
    const op = como(datos.usuarios.operador);
    const destinatario = await op.escribir('post', `/api/operador/consultas/${id}/respuestas`, { mensaje: 'Respuesta válida larga', destinatario: 'otro@x.com' }, nuevaClave());
    assert.equal(destinatario.status, 422);
    assert.ok(destinatario.body.error.fields.destinatario);
    assert.equal((await op.escribir('post', `/api/operador/consultas/${id}/respuestas`, { mensaje: 'corto' }, nuevaClave())).status, 422);

    brevo.modo = 'error';
    const fallida = await op.escribir('post', `/api/operador/consultas/${id}/respuestas`, { mensaje: 'Respuesta que el proveedor rechaza.' }, nuevaClave());
    assert.equal(fallida.status, 201);
    assert.equal(fallida.body.data.envioEstado, 'error');
    assert.equal((await pool.query('SELECT estado FROM app.consultas WHERE id = $1', [id])).rows[0].estado, 'nueva');

    // cerrar requiere respondida: se fuerza el estado para probar el bloqueo
    await pool.query(`UPDATE app.consultas SET estado = 'cerrada' WHERE id = $1`, [id]);
    const cerrada = await op.escribir('post', `/api/operador/consultas/${id}/respuestas`, { mensaje: 'Respuesta con consulta cerrada.' }, nuevaClave());
    assert.equal(cerrada.status, 409);
    assert.equal(cerrada.body.error.code, 'CONSULTA_CERRADA');
    assert.equal((await op.escribir('patch', `/api/operador/consultas/${id}`, { estado: 'en_proceso' })).status, 200);
  });

  // ------------------------------------------------------------ Reintentos
  test('A26: reintento con espera de 60 s, máximo 3 intentos y nunca reenvía aceptado', async () => {
    brevo.modo = 'error';
    await enviar(request.agent(app), consultaValida());
    const op = como(datos.usuarios.operador);

    const pronto = await op.escribir('post', '/api/operador/envios/1/reintentar', {});
    assert.equal(pronto.status, 409);
    assert.equal(pronto.body.error.code, 'ESPERA_REQUERIDA');
    assert.ok(Number(pronto.headers['retry-after']) > 0);

    await atrasar(1, 61);
    const segundo = await op.escribir('post', '/api/operador/envios/1/reintentar', {});
    assert.equal(segundo.status, 200);
    assert.equal(segundo.body.data.intentos, 2);
    assert.equal(segundo.body.data.estado, 'error');

    await atrasar(1, 61);
    assert.equal((await op.escribir('post', '/api/operador/envios/1/reintentar', {})).body.data.intentos, 3);

    await atrasar(1, 61);
    const cuarto = await op.escribir('post', '/api/operador/envios/1/reintentar', {});
    assert.equal(cuarto.status, 409);
    assert.equal(cuarto.body.error.code, 'INTENTOS_AGOTADOS');
    assert.equal(brevo.llamadas.length, 3);

    brevo.modo = 'ok';
    await enviar(request.agent(app), consultaValida({ asunto: 'Consulta aceptada' }));
    const aceptado = await op.escribir('post', '/api/operador/envios/2/reintentar', {});
    assert.equal(aceptado.status, 409);
    assert.equal(aceptado.body.error.code, 'ENVIO_ACEPTADO');
  });

  test('A26: dos reintentos simultáneos producen una sola llamada al proveedor', async () => {
    brevo.modo = 'error';
    await enviar(request.agent(app), consultaValida());
    await atrasar(1, 61);
    brevo.modo = 'ok';
    brevo.demoraMs = 60;
    const op = como(datos.usuarios.operador);
    const [a, b] = await Promise.all([
      op.escribir('post', '/api/operador/envios/1/reintentar', {}),
      op.escribir('post', '/api/operador/envios/1/reintentar', {})
    ]);
    assert.deepEqual([a.status, b.status].sort(), [200, 409]);
    assert.equal([a, b].find((r) => r.status === 409).body.error.code, 'ENVIO_EN_CURSO');
    assert.equal(brevo.llamadas.length, 2); // alta + un solo reintento
  });

  test('desconocido exige confirmarRiesgo; enviando vencido pasa a desconocido', async () => {
    brevo.modo = 'timeout';
    await enviar(request.agent(app), consultaValida());
    await atrasar(1, 61);
    const op = como(datos.usuarios.operador);
    const sinConfirmar = await op.escribir('post', '/api/operador/envios/1/reintentar', {});
    assert.equal(sinConfirmar.status, 409);
    assert.equal(sinConfirmar.body.error.code, 'CONFIRMACION_REQUERIDA');
    brevo.modo = 'ok';
    const confirmado = await op.escribir('post', '/api/operador/envios/1/reintentar', { confirmarRiesgo: true });
    assert.equal(confirmado.status, 200);
    assert.equal(confirmado.body.data.estado, 'aceptado');

    // Proceso terminado en "enviando" con bloqueo vencido
    await enviar(request.agent(app), consultaValida({ asunto: 'Proceso caído' }));
    await pool.query(`UPDATE app.envios_email SET estado = 'enviando', bloqueo_hasta = now() - interval '61 seconds', updated_at = now() - interval '2 minutes' WHERE id = 2`);
    const detalle = (await op.get('/api/operador/consultas/2')).body.data;
    assert.equal(detalle.envios[0].estado, 'desconocido');
    assert.equal(detalle.envios[0].reintento.requiereConfirmacion, true);
    assert.equal((await pool.query('SELECT estado FROM app.envios_email WHERE id = 2')).rows[0].estado, 'enviando'); // GET no escribe
    const r = await op.escribir('post', '/api/operador/envios/2/reintentar', {});
    assert.equal(r.body.error.code, 'CONFIRMACION_REQUERIDA');
    assert.equal((await pool.query('SELECT estado FROM app.envios_email WHERE id = 2')).rows[0].estado, 'desconocido');
  });
});
