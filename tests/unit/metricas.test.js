import test from 'node:test';
import assert from 'node:assert/strict';
import { validarQueryMetricas } from '../../src/validators/metricas.validator.js';
import { obtenerMetricasPanel } from '../../src/services/metricas.service.js';

// Reloj de prueba fijado por el Apartado 20.2: 3 de noviembre de 2026 a las 18:00 de Argentina
const RELOJ_PRUEBA_20_2 = new Date('2026-11-03T18:00:00.000-03:00');

test('validarQueryMetricas (Caso A30): convierte fechas en America/Argentina/Buenos_Aires e incluye el dia final completo', () => {
    const f = validarQueryMetricas(
        { desde: '2026-11-01', hasta: '2026-11-03' },
        RELOJ_PRUEBA_20_2
    );

    assert.equal(f.desde, '2026-11-01');
    assert.equal(f.hasta, '2026-11-03');
    assert.equal(f.tipo, null);
    assert.equal(f.zonaHoraria, 'America/Argentina/Buenos_Aires');
  // 2026-11-01 00:00:00 -03:00 === 2026-11-01T03:00:00.000Z
    assert.equal(f.inicioUtc, '2026-11-01T03:00:00.000Z');
  // Límite superior exclusivo: 2026-11-04 00:00:00 -03:00 === 2026-11-04T03:00:00.000Z
    assert.equal(f.finExclusivoUtc, '2026-11-04T03:00:00.000Z');
    assert.deepEqual(f.fechasRango, ['2026-11-01', '2026-11-02', '2026-11-03']);
});

test('validarQueryMetricas (Caso A31): usa ultimos 7 dias de Argentina por defecto y rechaza rangos o parametros invalidos con 400', () => {
    const porDefecto = validarQueryMetricas({}, RELOJ_PRUEBA_20_2);
    assert.equal(porDefecto.desde, '2026-10-28');
    assert.equal(porDefecto.hasta, '2026-11-03');
    assert.equal(porDefecto.fechasRango.length, 7);

  // Indicar solo una fecha -> 400
    assert.throws(
        () => validarQueryMetricas({ desde: '2026-11-01' }, RELOJ_PRUEBA_20_2),
        (err) => err.status === 400 && err.code === 'PARAMETRO_INVALIDO'
    );

  // hasta < desde -> 400
    assert.throws(
        () =>
            validarQueryMetricas(
                { desde: '2026-11-03', hasta: '2026-11-01' },
                RELOJ_PRUEBA_20_2
            ),
        (err) => err.status === 400 && err.code === 'PARAMETRO_INVALIDO'
    );

  // Fecha futura -> 400
    assert.throws(
        () =>
            validarQueryMetricas(
                { desde: '2026-11-01', hasta: '2026-11-04' },
                RELOJ_PRUEBA_20_2
            ),
        (err) => err.status === 400
    );

  // Fecha inexistente en el calendario -> 400
    assert.throws(
        () =>
            validarQueryMetricas(
                { desde: '2026-02-30', hasta: '2026-11-03' },
                RELOJ_PRUEBA_20_2
            ),
        (err) => err.status === 400
    );

  // Tipo inválido -> 400
    assert.throws(
        () =>
            validarQueryMetricas(
                { desde: '2026-11-01', hasta: '2026-11-03', tipo: 'otro' },
                RELOJ_PRUEBA_20_2
            ),
        (err) => err.status === 400
    );
});

test('obtenerMetricasPanel (Dataset exacto Apartado 20.2): devuelve 4/3/2/4 y al filtrar tipo=cotizacion conserva 4/3/2 y consultas=1', async () => {
    const fakeRepo20_2 = {
        async obtenerAgregacionesMetricas({ tipo }) {
            return {
                visitasPorDia: [
                    { fecha: '2026-11-01', cantidad: 2, hayPrueba: false },
                    { fecha: '2026-11-02', cantidad: 1, hayPrueba: false },
                    { fecha: '2026-11-03', cantidad: 1, hayPrueba: false },
                ],
                accesosPorDia: [
                    { fecha: '2026-11-01', cantidad: 1 },
                    { fecha: '2026-11-02', cantidad: 2 },
                ],
                registrosPorDia: [
                    { fecha: '2026-11-01', cantidad: 1 },
                    { fecha: '2026-11-02', cantidad: 1 },
                ],
                consultasPorTipo: tipo
                    ? [{ tipo: 'cotizacion', cantidad: 1 }]
                    : [
                        { tipo: 'general', cantidad: 2 },
                        { tipo: 'cotizacion', cantidad: 1 },
                        { tipo: 'asesoria', cantidad: 1 },
                    ],
            };
        },
    };

  // 1. Sin filtro de tipo -> visitas=4, accesosAutenticados=3, cuentasCreadas=2, consultas=4
    const filtrosTodos = validarQueryMetricas(
        { desde: '2026-11-01', hasta: '2026-11-03' },
        RELOJ_PRUEBA_20_2
    );
    const resTodos = await obtenerMetricasPanel(filtrosTodos, fakeRepo20_2);

    assert.deepEqual(resTodos.totales,{
        visitas: 4,
        accesosAutenticados: 3,
        cuentasCreadas: 2,
        consultas: 4,
    });
    assert.deepEqual(resTodos.traficoDiario, [
        { fecha: '2026-11-01', visitas: 2, accesos: 1 },
        { fecha: '2026-11-02', visitas: 1, accesos: 2 },
        { fecha: '2026-11-03', visitas: 1, accesos: 0 },
    ]);
    assert.deepEqual(resTodos.registrosDiarios, [
        { fecha: '2026-11-01', cuentas: 1 },
        { fecha: '2026-11-02', cuentas: 1 },
        { fecha: '2026-11-03', cuentas: 0 },
    ]);
    assert.deepEqual(resTodos.consultasPorTipo, [
        { tipo: 'general', cantidad: 2 },
        { tipo: 'cotizacion', cantidad: 1 },
        { tipo: 'asesoria', cantidad: 1 },
    ]);
    assert.equal(resTodos.incluyeDatosDePrueba, false);

  // 2. Con tipo=cotizacion -> visitas=4, accesos=3, cuentas=2 intactos; consultas=1 y resto en 0
    const filtrosCotizacion = validarQueryMetricas(
        { desde: '2026-11-01', hasta: '2026-11-03', tipo: 'cotizacion' },
        RELOJ_PRUEBA_20_2
    );
    const resCotizacion = await obtenerMetricasPanel(
        filtrosCotizacion,
        fakeRepo20_2
    );

    assert.deepEqual(resCotizacion.totales, {
        visitas: 4,
        accesosAutenticados: 3,
        cuentasCreadas: 2,
        consultas: 1,
    });
    assert.deepEqual(resCotizacion.consultasPorTipo, [
        { tipo: 'general', cantidad: 0 },
        { tipo: 'cotizacion', cantidad: 1 },
        { tipo: 'asesoria', cantidad: 0 },
    ]);
});