import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEnv } from '../../src/config/env.js';

const baseValida = {
    NODE_ENV: 'development',
    PORT: '3000',
    APP_ORIGIN: 'http://localhost:3000/',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/portfolio_dev',
    DB_SSL: 'false',
    SESSION_SECRET: 'secreto_sesion_super_seguro_de_prueba_12345',
    VISIT_SECRET: 'secreto_visita_distinto_super_seguro_67890',
};

test('validateEnv: acepta configuracion valida y quita barra final de APP_ORIGIN', () => {
    const result = validateEnv(baseValida);
    assert.equal(result.PORT, 3000);
    assert.equal(result.APP_ORIGIN, 'http://localhost:3000');
    assert.equal(result.DB_SSL, false);
});

test('validateEnv: falla nombrando la variable faltante sin imprimir secretos', () => {
    const incompleta = { ...baseValida, SESSION_SECRET: '' };
    assert.throws(
        () => validateEnv(incompleta),
        (err) => {
            assert.match(err.message, /SESSION_SECRET/);
            assert.ok(!err.message.includes(baseValida.VISIT_SECRET));
            assert.ok(!err.message.includes(baseValida.DATABASE_URL));
            return true;
        }
    );
});

test('validateEnv: rechaza cuando VISIT_SECRET es igual a SESSION_SECRET', () => {
    const repetidos = {
        ...baseValida,
        VISIT_SECRET: baseValida.SESSION_SECRET,
    };
    assert.throws(() => validateEnv(repetidos), /VISIT_SECRET debe ser distinto/);
});