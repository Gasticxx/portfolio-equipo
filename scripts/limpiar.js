import { fileURLToPath } from 'node:url';
import { pool } from '../src/config/db.js';

export async function ejecutarLimpiezaConservacion(dbPool = pool) {
    const client = await dbPool.connect();
    try {
        await client.query('BEGIN');

    // 1. Sesiones vencidas (según expire)
        const sesionesRes = await client.query(`
            DELETE FROM app.sesiones
            WHERE expire < now()
        `);

    // 2. Límites de tasa: 24 horas después de vencer su ventana
        const limitesRes = await client.query(`
            DELETE FROM app.limites
            WHERE expira_at < now() - INTERVAL '24 hours'
        `);

    // 3. Consultas vencidas (> 180 días): primero envíos, después respuestas y luego consultas
        const enviosRes = await client.query(`
            DELETE FROM app.envios_email
            WHERE consulta_id IN (
                SELECT id FROM app.consultas
                WHERE created_at < now() - INTERVAL '180 days'
            )
        `);

        const respuestasRes = await client.query(`
            DELETE FROM app.respuestas
            WHERE consulta_id IN (
                SELECT id FROM app.consultas
                WHERE created_at < now() - INTERVAL '180 days'
            )
        `);

        const consultasRes = await client.query(`
            DELETE FROM app.consultas
            WHERE created_at < now() - INTERVAL '180 days'
        `);

    // 4. Visitas vencidas (> 90 días): elimina visitas y sus accesos por ON DELETE CASCADE
        const visitasRes = await client.query(`
            DELETE FROM app.visitas
            WHERE iniciada_at < now() - INTERVAL '90 days'
        `);

        await client.query('COMMIT');

        return {
            sesionesEliminadas: sesionesRes.rowCount ?? 0,
            limitesEliminados: limitesRes.rowCount ?? 0,
            enviosEliminados: enviosRes.rowCount ?? 0,
            respuestasEliminadas: respuestasRes.rowCount ?? 0,
            consultasEliminadas: consultasRes.rowCount ?? 0,
            visitasEliminadas: visitasRes.rowCount ?? 0,
        };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

const esEjecucionDirecta =
    process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (esEjecucionDirecta) {
    ejecutarLimpiezaConservacion()
        .then(async (resumen) => {
            console.info(
                JSON.stringify({
                    timestamp: new Date().toISOString(),
                    level: 'info',
                    action: 'db:limpiar',
                    resumen,
                })
            );
            await pool.end();
            process.exit(0);
        })
        .catch(async (err) => {
            console.error(
                JSON.stringify({
                    timestamp: new Date().toISOString(),
                    level: 'error',
                    action: 'db:limpiar',
                    message: err?.message || 'Error al ejecutar limpieza de conservacion',
                })
            );
            await pool.end();
            process.exit(1);
        });
}