import test from 'node:test';
import assert from 'node:assert/strict';
import { ejecutarLimpiezaConservacion } from '../../scripts/limpiar.js';

test('ejecutarLimpiezaConservacion (Apartado 10.5): ejecuta transaccion respetando el orden envios -> respuestas -> consultas y cascada de visitas', async () => {
    const sentenciasEjecutadas = [];
    let liberado = false;

    const fakePool = {
        async connect() {
            return {
                async query(sql) {
                    const limpio = sql.trim().replace(/\s+/g, ' ');
                    sentenciasEjecutadas.push(limpio);
                    return { rowCount: 2 };
                },
                release() {
                    liberado = true;
                },
            };
        },
    };

    const resultado = await ejecutarLimpiezaConservacion(fakePool);

    assert.equal(liberado, true);
    assert.equal(sentenciasEjecutadas[0], 'BEGIN');
    assert.match(sentenciasEjecutadas[1], /DELETE FROM app\.sesiones/);
    assert.match(sentenciasEjecutadas[2], /DELETE FROM app\.limites/);
    assert.match(sentenciasEjecutadas[3], /DELETE FROM app\.envios_email/);
    assert.match(sentenciasEjecutadas[4], /DELETE FROM app\.respuestas/);
    assert.match(sentenciasEjecutadas[5], /DELETE FROM app\.consultas/);
    assert.match(sentenciasEjecutadas[6], /DELETE FROM app\.visitas/);
    assert.equal(sentenciasEjecutadas[7], 'COMMIT');
    assert.equal(resultado.visitasEliminadas, 2);
});