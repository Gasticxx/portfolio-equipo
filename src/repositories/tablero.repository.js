import { pool } from '../config/db.js';

export const tableroRepository = {

  // Obtiene las tareas de un usuario en una demo.
  async listar(demoId, usuarioId) {
    const sql = `
      SELECT id, titulo, estado
      FROM app.tareas_demo
      WHERE demo_id = $1 AND usuario_id = $2
      ORDER BY id ASC
    `;

    const { rows } = await pool.query(sql, [demoId, usuarioId]);
    return rows;
  },

  // Crea una tarea nueva.

  // Crea una tarea respetando el límite de 50.
  async crear(demoId, usuarioId, titulo) {
    const cliente = await pool.connect();

    try {
      // Iniciar una transacción.
      await cliente.query('BEGIN');

      // Bloquear las creaciones simultáneas
      // para este usuario y esta demostración.
      await cliente.query(
        'SELECT pg_advisory_xact_lock($1, $2)',
        [demoId, usuarioId]
      );

      // Contar las tareas existentes.
      const conteo = await cliente.query(
        `SELECT COUNT(*)::INTEGER AS total
         FROM app.tareas_demo
         WHERE demo_id = $1 AND usuario_id = $2`,
        [demoId, usuarioId]
      );

      // Rechazar la creación si alcanzó el límite.
      if (conteo.rows[0].total >= 50) {
        await cliente.query('ROLLBACK');
        return null;
      }

      // Insertar la nueva tarea.
      const resultado = await cliente.query(
        `INSERT INTO app.tareas_demo
           (demo_id, usuario_id, titulo)
         VALUES ($1, $2, $3)
         RETURNING id, titulo, estado`,
        [demoId, usuarioId, titulo]
      );

      // Confirmar los cambios.
      await cliente.query('COMMIT');

      return resultado.rows[0];

    } catch (error) {
      // Deshacer la transacción si ocurre un error.
      await cliente.query('ROLLBACK');
      throw error;

    } finally {
      // Devolver la conexión al pool.
      cliente.release();
    }
  },


  // Cambia el estado de una tarea del usuario.
  async cambiar(demoId, usuarioId, tareaId, nuevoEstado) {
    const sql = `
      UPDATE app.tareas_demo
      SET estado = $1,
          updated_at = NOW()
      WHERE id = $2
        AND demo_id = $3
        AND usuario_id = $4
      RETURNING id, titulo, estado
    `;

    const { rows } = await pool.query(sql, [
      nuevoEstado,
      tareaId,
      demoId,
      usuarioId
    ]);

    return rows[0] ?? null;
  },

  // Elimina una tarea perteneciente al usuario.
  async eliminar(demoId, usuarioId, tareaId) {
    const sql = `
      DELETE FROM app.tareas_demo
      WHERE id = $1
        AND demo_id = $2
        AND usuario_id = $3
      RETURNING id
    `;

    const { rows } = await pool.query(sql, [
      tareaId,
      demoId,
      usuarioId
    ]);

    return rows.length > 0;
  }
};
