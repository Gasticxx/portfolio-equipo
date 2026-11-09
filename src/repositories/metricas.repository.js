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