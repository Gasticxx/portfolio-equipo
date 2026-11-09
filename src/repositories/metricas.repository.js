import { pool } from '../config/db.js';

export async function touchVisitaVigente(visitaId, db = pool) {
    const sql = `
        UPDATE app.visitas
        SET ultima_actividad_at = now()
        WHERE id = $1
            AND ultima_actividad_at >= now() - INTERVAL '30 minutes'
        RETURNING id, iniciada_at, ultima_actividad_at
    `;
    const result = await db.query(sql, [visitaId]);
    return result.rows[0] || null;
}

export async function insertNuevaVisita(visitaId, esPrueba = false, db = pool) {
    const sql = `
        INSERT INTO app.visitas (id, iniciada_at, ultima_actividad_at, es_prueba)
        VALUES ($1, now(), now(), $2)
        RETURNING id, iniciada_at, ultima_actividad_at, es_prueba
    `;
    const result = await db.query(sql, [visitaId, Boolean(esPrueba)]);
    return result.rows[0];
}

export async function insertAccesoAutenticado(visitaId, usuarioId, db = pool) {
    const sql = `
        INSERT INTO app.accesos (visita_id, usuario_id, created_at)
        VALUES ($1, $2, now())
        ON CONFLICT (visita_id, usuario_id) DO NOTHING
        RETURNING id, visita_id AS "visitaId", usuario_id AS "usuarioId", created_at AS "createdAt"
    `;
    const result = await db.query(sql, [visitaId, usuarioId]);
    return result.rows[0] || null;
}

export async function obtenerAgregacionesMetricas(
    { inicioUtc, finExclusivoUtc, tipo = null },
    db = pool
) {
    const sqlVisitasPorDia = `
        SELECT
            to_char(iniciada_at AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD') AS fecha,
            COUNT(*)::int AS cantidad,
                COALESCE(BOOL_OR(es_prueba), false) AS "hayPrueba"
        FROM app.visitas
        WHERE iniciada_at >= $1::timestamptz
            AND iniciada_at < $2::timestamptz
        GROUP BY 1
        ORDER BY 1 ASC
    `;

    const sqlAccesosPorDia = `
        SELECT
            to_char(created_at AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD') AS fecha,
            COUNT(*)::int AS cantidad
        FROM app.accesos
        WHERE created_at >= $1::timestamptz
            AND created_at < $2::timestamptz
        GROUP BY 1
        ORDER BY 1 ASC
    `;

    const sqlRegistrosPorDia = `
        SELECT
            to_char(created_at AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD') AS fecha,
            COUNT(*)::int AS cantidad
        FROM app.usuarios
        WHERE created_at >= $1::timestamptz
            AND created_at < $2::timestamptz
        GROUP BY 1
        ORDER BY 1 ASC
    `;

    let consultasPorTipoRows = [];
    const paramsConsultas = [inicioUtc, finExclusivoUtc];
    let filtroTipoSql = '';
    if (tipo) {
        paramsConsultas.push(tipo);
        filtroTipoSql = 'AND tipo = $3';
    }

    const sqlConsultasPorTipo = `
        SELECT
            tipo,
            COUNT(*)::int AS cantidad
        FROM app.consultas
        WHERE created_at >= $1::timestamptz
            AND created_at < $2::timestamptz
            ${filtroTipoSql}
        GROUP BY tipo
    `;

    const [visitasRes, accesosRes, registrosRes] = await Promise.all([
        db.query(sqlVisitasPorDia, [inicioUtc, finExclusivoUtc]),
        db.query(sqlAccesosPorDia, [inicioUtc, finExclusivoUtc]),
        db.query(sqlRegistrosPorDia, [inicioUtc, finExclusivoUtc]),
    ]);

    try {
        const consultasRes = await db.query(sqlConsultasPorTipo, paramsConsultas);
        consultasPorTipoRows = consultasRes.rows;
    } catch (err) {
    // Si la tabla app.consultas (de I6) aún no fue migrada en un entorno parcial, devuelve 0
        if (err?.code !== '42P01') {
            throw err;
        }
    }

    return {
        visitasPorDia: visitasRes.rows,
        accesosPorDia: accesosRes.rows,
        registrosPorDia: registrosRes.rows,
        consultasPorTipo:   consultasPorTipoRows,
    };
}