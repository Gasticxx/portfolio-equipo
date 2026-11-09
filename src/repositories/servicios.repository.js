import { pool } from '../config/db.js';

function escaparLike(texto) {
  return texto.replace(/[\\%_]/g, '\\$&');
}

export const serviciosRepository = {
  /**
   * Lista servicios activos para el público ordenados por orden ASC, id ASC (Apartado 7 y 11.1)
   */
  async listarActivos() {
    const sql = `
      SELECT id, nombre, descripcion, categoria, orden
      FROM app.servicios
      WHERE activo = true
      ORDER BY orden ASC, id ASC;
    `;
    const { rows } = await pool.query(sql);
    return rows;
  },

  /**
   * Lista servicios para el panel de administración con paginación y filtros (Apartado 11 y 13)
   */
  async listarAdmin({ page = 1, pageSize = 10, q, activo }) {
    const condiciones = [];
    const valores = [];

    if (typeof activo === 'boolean') {
      valores.push(activo);
      condiciones.push(`activo = $${valores.length}`);
    }

    if (q && q.length >= 2) {
      valores.push(`%${escaparLike(q)}%`);
      condiciones.push(`nombre ILIKE $${valores.length} ESCAPE '\\'`);
    }

    const whereSql = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    const sqlCount = `SELECT COUNT(*)::int AS total FROM app.servicios ${whereSql};`;
    const { rows: countRows } = await pool.query(sqlCount, valores);
    const total = countRows[0].total;
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

    const offset = (page - 1) * pageSize;
    const valoresPaginados = [...valores, pageSize, offset];

    const sqlDatos = `
      SELECT
        id,
        nombre,
        descripcion,
        categoria,
        activo,
        orden,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM app.servicios
      ${whereSql}
      ORDER BY orden ASC, id ASC
      LIMIT $${valores.length + 1} OFFSET $${valores.length + 2};
    `;
    const { rows } = await pool.query(sqlDatos, valoresPaginados);

    return {
      data: rows,
      meta: { page, pageSize, total, totalPages }
    };
  },

  /**
   * Obtiene un servicio por ID para administración (Apartado 13)
   */
  async obtenerPorId(id) {
    const sql = `
      SELECT
        id,
        nombre,
        descripcion,
        categoria,
        activo,
        orden,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM app.servicios
      WHERE id = $1;
    `;
    const { rows } = await pool.query(sql, [id]);
    return rows[0] || null;
  },

  /**
   * Crea un nuevo servicio (POST /api/admin/servicios)
   */
  async crear({ nombre, descripcion, categoria, activo, orden }) {
    const sql = `
      INSERT INTO app.servicios (nombre, descripcion, categoria, activo, orden)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING
        id,
        nombre,
        descripcion,
        categoria,
        activo,
        orden,
        created_at AS "createdAt",
        updated_at AS "updatedAt";
    `;
    const { rows } = await pool.query(sql, [nombre, descripcion, categoria, activo, orden]);
    return rows[0];
  },

  /**
   * Actualiza un servicio existente (PUT /api/admin/servicios/:id)
   */
  async actualizar(id, { nombre, descripcion, categoria, activo, orden }) {
    const sql = `
      UPDATE app.servicios
      SET
        nombre = $1,
        descripcion = $2,
        categoria = $3,
        activo = $4,
        orden = $5,
        updated_at = now()
      WHERE id = $6
      RETURNING
        id,
        nombre,
        descripcion,
        categoria,
        activo,
        orden,
        created_at AS "createdAt",
        updated_at AS "updatedAt";
    `;
    const { rows } = await pool.query(sql, [nombre, descripcion, categoria, activo, orden, id]);
    return rows[0] || null;
  },

  /**
   * Elimina un servicio asegurando en la misma transacción el snapshot en consultas (Apartado 10.2)
   */
  async eliminar(id) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        'SELECT id, nombre FROM app.servicios WHERE id = $1 FOR UPDATE;',
        [id]
      );
      if (rows.length === 0) {
        await client.query('ROLLBACK');
        return false;
      }

      const servicio = rows[0];

      // Garantiza que las consultas vinculadas conserven el nombre antes del ON DELETE SET NULL
      await client.query(
        `UPDATE app.consultas
         SET servicio_nombre_snapshot = COALESCE(servicio_nombre_snapshot, $1),
             servicio_id = NULL,
             updated_at = now()
         WHERE servicio_id = $2;`,
        [servicio.nombre, id]
      );

      await client.query('DELETE FROM app.servicios WHERE id = $1;', [id]);
      await client.query('COMMIT');
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
};