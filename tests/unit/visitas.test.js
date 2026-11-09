import test from 'node:test';
import assert from 'node:assert/strict';
import {
    esRutaContableDeVisita,
    registrarActividadVisita,
} from '../../src/services/metricas.service.js';

test('esRutaContableDeVisita: incluye exactamente las 8 rutas publicas/protegidas del Apartado 15', () => {
    const incluidas = [
        '/',
        '/equipo',
        '/equipo/integrante-2',
        '/servicios',
        '/proyectos',
        '/proyectos/portfolio-equipo',
        '/demos/1',
        '/contacto',
    ];

    for (const ruta of incluidas) {
        assert.equal(
            esRutaContableDeVisita('GET', ruta),
            true,
            `La ruta GET ${ruta} deberia contar visita`
        );
    }
});

test('esRutaContableDeVisita: excluye APIs, estaticos, health, auth, paneles y metodos POST', () => {
    const excluidas = [
        '/api/equipo',
        '/media/1',
        '/assets/img/equipo/I2.svg',
        '/login',
        '/registro',
        '/mi-cuenta',
        '/operador/consultas',
        '/admin',
        '/admin/metricas',
        '/health',
        '/demos/1/recurso.js',
    ];

    for (const ruta of excluidas) {
        assert.equal(
            esRutaContableDeVisita('GET', ruta),
            false,
            `La ruta GET ${ruta} NO deberia contar visita`
        );
    }

    assert.equal(esRutaContableDeVisita('POST', '/contacto'), false);
});

test('registrarActividadVisita (Caso A28): recargar dentro de 30 min mantiene 1 sola visita', async () => {
    const visitasEnMemoria = new Map();
    let ahoraMs = Date.now();

    const fakeRepo = {
        async touchVisitaVigente(id) {
            const v = visitasEnMemoria.get(id);
            if (!v) return null;
            if (ahoraMs - v.ultimaActividadMs <= 30 * 60 * 1000) {
                v.ultimaActividadMs = ahoraMs;
                return { id: v.id };
            }
            return null;
        },
        async insertNuevaVisita(id) {
        visitasEnMemoria.set(id, { id, ultimaActividadMs: ahoraMs });
        return { id };
        },
    };

  // Primera navegacion sin cookie -> crea visita 1
    const primera = await registrarActividadVisita(undefined, fakeRepo);
    assert.equal(primera.esNueva, true);
    assert.equal(visitasEnMemoria.size, 1);

  // Tres recargas dentro de los 30 minutos -> mantienen el mismo contador (1)
    ahoraMs += 5 * 60 * 1000;
    const recarga1 = await registrarActividadVisita(primera.visitaId, fakeRepo);
    ahoraMs += 10 * 60 * 1000;
    const recarga2 = await registrarActividadVisita(primera.visitaId, fakeRepo);

    assert.equal(recarga1.esNueva, false);
    assert.equal(recarga1.visitaId, primera.visitaId);
    assert.equal(recarga2.esNueva, false);
    assert.equal(visitasEnMemoria.size, 1);

  // Pasan 31 minutos de inactividad -> genera una segunda visita nueva
    ahoraMs += 31 * 60 * 1000;
    const despuesDeExpirar = await registrarActividadVisita(primera.visitaId, fakeRepo);
    assert.equal(despuesDeExpirar.esNueva, true);
    assert.notEqual(despuesDeExpirar.visitaId, primera.visitaId);
    assert.equal(visitasEnMemoria.size, 2);
});

test('Caso A07 y A29: login conserva visita anonima, no duplica acceso en recargas y suma segundo acceso con otra cuenta', async () => {
    const { garantizarVisitaYAccesoEnLogin } = await import(
        '../../src/services/metricas.service.js'
    );

    const visitas = new Map();
    const accesos = new Set();

    const fakeDeps = {
        async touchVisitaVigente(id) {
            if (visitas.has(id)) {
                return { id };
            }
            return null;
        },
        async insertNuevaVisita(id) {
            visitas.set(id, { id });
            return { id };
        },
        async insertAccesoAutenticado(visitaId, usuarioId) {
            const clave = `${visitaId}:${usuarioId}`;
            if (accesos.has(clave)) {
                return null;
            }
            accesos.add(clave);
            return { id: accesos.size, visitaId, usuarioId };
        },
    };

  // 1. Visitante navega anónimo -> genera visita V1
    const navAnonima = await registrarActividadVisita(undefined, fakeDeps);
    assert.equal(visitas.size, 1);
    assert.equal(accesos.size, 0);

  // 2. Inicia sesión la Cuenta 1 (id=10) en esa misma visita -> conserva V1 y suma 1 acceso (Caso A07)
    const loginU1 = await garantizarVisitaYAccesoEnLogin(navAnonima.visitaId, 10, fakeDeps);
    assert.equal(loginU1.visitaId, navAnonima.visitaId);
    assert.equal(loginU1.esNuevaVisita, false);
    assert.equal(loginU1.accesoRegistrado, true);
    assert.equal(visitas.size, 1);
    assert.equal(accesos.size, 1);

  // 3. Cuenta 1 recarga varias veces -> mantiene 1 visita y 1 acceso (sin duplicar)
    const recargaU1 = await garantizarVisitaYAccesoEnLogin(navAnonima.visitaId, 10, fakeDeps);
    assert.equal(recargaU1.accesoRegistrado, false);
    assert.equal(visitas.size, 1);
    assert.equal(accesos.size, 1);

  // 4. Cuenta 1 cierra sesión y entra Cuenta 2 (id=20) en la misma visita -> 1 visita y 2 accesos (Caso A29)
    const loginU2 = await garantizarVisitaYAccesoEnLogin(navAnonima.visitaId, 20, fakeDeps);
    assert.equal(loginU2.visitaId, navAnonima.visitaId);
    assert.equal(loginU2.esNuevaVisita, false);
    assert.equal(loginU2.accesoRegistrado, true);
    assert.equal(visitas.size, 1);
    assert.equal(accesos.size, 2);
});