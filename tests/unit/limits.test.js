import test from 'node:test';
import assert from 'node:assert/strict';
import {
    generarClaveHmacLimite,
    calcularVentanaFijaUtc,
    crearMiddlewareLimite,
    VENTANAS_MS,
} from '../../src/middlewares/limits.js';

test('generarClaveHmacLimite: devuelve HMAC hexadecimal de 64 caracteres sin exponer IP ni email en claro', () => {
    const ip = '192.168.1.55';
    const email = 'Estudiante@EquipoSeis.com';
    const claveIp = generarClaveHmacLimite('login_ip', ip, 'secreto_test');
    const claveEmail = generarClaveHmacLimite('login_email', email, 'secreto_test');

    assert.equal(claveIp.length, 64);
    assert.match(claveIp, /^[0-9a-f]{64}$/);
    assert.ok(!claveIp.includes(ip));
    assert.ok(!claveEmail.toLowerCase().includes('estudiante'));
});

test('calcularVentanaFijaUtc: calcula multiplo exacto de ventana UTC y Retry-After positivo', () => {
    const instanteFijo = Date.parse('2026-11-03T18:07:30.000Z');
    const v = calcularVentanaFijaUtc(VENTANAS_MS.QUINCE_MINUTOS, instanteFijo);

    assert.equal(v.ventanaInicioIso, '2026-11-03T18:00:00.000Z');
    assert.equal(v.expiraAtIso, '2026-11-03T18:15:00.000Z');
    assert.equal(v.retryAfterSegundos, 450);
});

test('crearMiddlewareLimite (Caso A36): bloquea con 429 LIMITE_EXCEDIDO y cabecera Retry-After al superar el tope', async () => {
    const tablaSimulada = new Map();

    const fakeConsumir = async ({ clave, ventanaInicioIso, expiraAtIso }) => {
        const pk = `${clave}:${ventanaInicioIso}`;
        const actual = (tablaSimulada.get(pk)?.contador || 0) + 1;
        const fila = { contador: actual, expiraAt: expiraAtIso };
        tablaSimulada.set(pk, fila);
        return fila;
    };

    const mw = crearMiddlewareLimite({
        categoria: 'contacto_ip',
        ventanaMs: VENTANAS_MS.QUINCE_MINUTOS,
        maxIntentos: 2,
        extractorIdentificador: () => '203.0.113.10',
        consumirFn: fakeConsumir,
    });

    const crearResMock = () => ({
        headers: {},
        statusCode: 200,
        body: null,
        setHeader(k, v) {
            this.headers[k] = v;
        },
        status(c) {
            this.statusCode = c;
            return this;
        },
        json(payload) {
        this.body = payload;
        return this;
        },
    });

  // Intentos 1 y 2 pasan
    let nextLlamado = 0;
    await mw({ requestId: 'req-1' }, crearResMock(), () => {
        nextLlamado += 1;
    });
    await mw({ requestId: 'req-2' }, crearResMock(), () => {
        nextLlamado += 1;
    });
    assert.equal(nextLlamado, 2);

  // Intento 3 supera maxIntentos (2) -> devuelve 429 LIMITE_EXCEDIDO con Retry-After
    const resBloqueado = crearResMock();
    await mw({ requestId: 'req-3' }, resBloqueado, () => {
        nextLlamado += 1;
    });

    assert.equal(nextLlamado, 2);
    assert.equal(resBloqueado.statusCode, 429);
    assert.equal(resBloqueado.body.ok, false);
    assert.equal(resBloqueado.body.error.code, 'LIMITE_EXCEDIDO');
    assert.equal(resBloqueado.body.error.requestId, 'req-3');
    assert.ok(Number(resBloqueado.headers['Retry-After']) > 0);
});