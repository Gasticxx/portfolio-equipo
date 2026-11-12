// Pruebas unitarias del servicio de correo y de las huellas (I6). Brevo se
// sustituye por un doble; no se usa la red ni la base.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  crearEmailService,
  evaluarReintento,
  asuntoNotificacion,
  cuerpoNotificacion
} from '../../src/services/email.service.js';
import { huellaPayload, huellaActor } from '../../src/services/consultas.service.js';

const env = {
  BREVO_API_KEY: 'xkeysib-prueba',
  MAIL_FROM_EMAIL: 'equipo@equipo.test',
  MAIL_FROM_NAME: 'Equipo Seis',
  CONTACT_TO_EMAIL: 'casilla@equipo.test'
};

const respuestaJson = (status, cuerpo) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });

function servicioCon(fetchFalso, timeoutMs) {
  return crearEmailService({ pool: {}, env, fetch: fetchFalso, logger: {}, timeoutMs });
}

test('sin configuración de Brevo no llama al proveedor y devuelve error de configuración', async () => {
  let llamadas = 0;
  const avisos = [];
  const s = crearEmailService({
    pool: {},
    env: { ...env, BREVO_API_KEY: '' },
    fetch: async () => { llamadas += 1; return respuestaJson(201, { messageId: 'x' }); },
    logger: { warn: (m) => avisos.push(m) }
  });
  assert.deepEqual(await s.llamarBrevo({}), { estado: 'error', errorCodigo: 'CONFIGURACION_FALTANTE' });
  assert.equal(llamadas, 0);
  assert.match(avisos[0], /BREVO_API_KEY/);
  assert.ok(!avisos[0].includes('xkeysib'));
});

test('envía a /v3/smtp/email con api-key, sender verificado y texto plano', async () => {
  let llamada;
  const s = servicioCon(async (url, init) => {
    llamada = { url, init };
    return respuestaJson(201, { messageId: '<abc@smtp-relay.mailin.fr>' });
  });
  const mensaje = s.construirMensaje({
    clase: 'notificacion', asunto: 'A', cuerpo: '<b>no es HTML</b>', consulta_email: 'ana@example.com', consulta_nombre: 'Ana'
  });
  const r = await s.llamarBrevo(mensaje);
  assert.deepEqual(r, { estado: 'aceptado', proveedorId: '<abc@smtp-relay.mailin.fr>' });
  assert.equal(llamada.url, 'https://api.brevo.com/v3/smtp/email');
  assert.equal(llamada.init.method, 'POST');
  assert.equal(llamada.init.headers['api-key'], 'xkeysib-prueba');
  const body = JSON.parse(llamada.init.body);
  assert.deepEqual(body.sender, { email: 'equipo@equipo.test', name: 'Equipo Seis' });
  assert.deepEqual(body.to, [{ email: 'casilla@equipo.test' }]);
  assert.deepEqual(body.replyTo, { email: 'ana@example.com', name: 'Ana' });
  assert.equal(body.textContent, '<b>no es HTML</b>');
  assert.equal(body.htmlContent, undefined);
});

test('la respuesta va al email de la consulta con replyTo del equipo', () => {
  const s = servicioCon(async () => respuestaJson(201, {}));
  const m = s.construirMensaje({ clase: 'respuesta', asunto: 'R', cuerpo: 'x', destinatario: 'ana@example.com', consulta_nombre: 'Ana' });
  assert.deepEqual(m.to, [{ email: 'ana@example.com', name: 'Ana' }]);
  assert.deepEqual(m.replyTo, { email: 'equipo@equipo.test', name: 'Equipo Seis' });
});

test('clasifica rechazos, timeout y fallos de red', async () => {
  const casos = [
    [async () => respuestaJson(401, { code: 'unauthorized', message: 'Key not found' }), { estado: 'error', errorCodigo: 'HTTP_401_unauthorized' }],
    [async () => respuestaJson(500, null), { estado: 'error', errorCodigo: 'HTTP_500' }],
    [async () => respuestaJson(201, {}), { estado: 'desconocido', errorCodigo: 'HTTP_201_SIN_MESSAGE_ID' }],
    [async () => { throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } }); }, { estado: 'error', errorCodigo: 'RED_ECONNREFUSED' }],
    [async () => { throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } }); }, { estado: 'desconocido', errorCodigo: 'RED_ECONNRESET' }],
    // El temporizador mantiene vivo el event loop (AbortSignal.timeout no lo hace por sí solo).
    [(url, init) => new Promise((_, no) => {
      const vivo = setTimeout(() => {}, 5000);
      init.signal.addEventListener('abort', () => { clearTimeout(vivo); no(init.signal.reason); });
    }), { estado: 'desconocido', errorCodigo: 'TIMEOUT' }]
  ];
  for (const [doble, esperado] of casos) {
    const r = await servicioCon(doble, 50).llamarBrevo({});
    assert.deepEqual(r, esperado);
  }
});

test('evaluarReintento aplica estados, máximo de 3 y espera de 60 s', () => {
  const ahora = '2026-11-03T12:00:00Z';
  const hace = (s) => new Date(Date.parse(ahora) - s * 1000).toISOString();
  assert.equal(evaluarReintento({ estado: 'aceptado', intentos: 1, ahora, updated_at: hace(100) }).code, 'ENVIO_ACEPTADO');
  assert.equal(evaluarReintento({ estado: 'enviando', intentos: 1, ahora, updated_at: hace(1) }).code, 'ENVIO_EN_CURSO');
  assert.equal(evaluarReintento({ estado: 'error', intentos: 3, ahora, updated_at: hace(100) }).code, 'INTENTOS_AGOTADOS');
  const espera = evaluarReintento({ estado: 'error', intentos: 1, ahora, updated_at: hace(20) });
  assert.equal(espera.code, 'ESPERA_REQUERIDA');
  assert.equal(espera.esperaSegundos, 40);
  // Con bloqueo_hasta se mide desde el inicio del intento (bloqueo − 30 s), no desde updated_at
  const conBloqueo = evaluarReintento({ estado: 'desconocido', intentos: 1, ahora, updated_at: hace(0), bloqueo_hasta: hace(31) });
  assert.equal(conBloqueo.permitido, true);
  assert.deepEqual(
    [evaluarReintento({ estado: 'error', intentos: 1, ahora, updated_at: hace(60) }).permitido,
     evaluarReintento({ estado: 'pendiente', intentos: 0, ahora, updated_at: hace(0) }).permitido],
    [true, true]
  );
  const desconocido = evaluarReintento({ estado: 'desconocido', intentos: 2, ahora, updated_at: hace(61) });
  assert.equal(desconocido.permitido, true);
  assert.equal(desconocido.requiereConfirmacion, true);
});

test('asunto de notificación con prefijo y máximo 160 caracteres', () => {
  assert.equal(asuntoNotificacion(25, 'Sitio institucional'), '[Reflection Tech] Consulta #25 - Sitio institucional');
  assert.equal(Array.from(asuntoNotificacion(25, 'á'.repeat(200))).length, 160);
});

test('cuerpo de notificación incluye datos y enlace al panel', () => {
  const cuerpo = cuerpoNotificacion(
    { id: 7, tipo: 'cotizacion', servicio_nombre_snapshot: 'Mantenimiento', nombre: 'Ana', email: 'ana@example.com', asunto: 'A', mensaje: 'Hola' },
    'https://equipo.example'
  );
  assert.match(cuerpo, /Tipo: Cotización/);
  assert.match(cuerpo, /Servicio: Mantenimiento/);
  assert.match(cuerpo, /https:\/\/equipo\.example\/operador\/consultas\/7/);
});

test('huella del payload: independiente del orden y con null explícito', () => {
  const a = huellaPayload({ b: 1, a: 'x', servicioId: null });
  const b = huellaPayload({ servicioId: null, a: 'x', b: 1 });
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notEqual(a, huellaPayload({ b: 1, a: 'x' }));
  assert.notEqual(a, huellaPayload({ b: 1, a: 'y', servicioId: null }));
});

test('huella del actor: HMAC de 64 hex distinto por sesión y secreto', () => {
  const h = huellaActor('secreto', 'sid-1');
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.notEqual(h, huellaActor('secreto', 'sid-2'));
  assert.notEqual(h, huellaActor('otro', 'sid-1'));
  assert.ok(!h.includes('sid-1'));
});
