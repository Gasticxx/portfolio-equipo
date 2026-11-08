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