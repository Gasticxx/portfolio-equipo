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
  async crear(demoId, usuarioId, titulo) {
    const sql = `
      INSERT INTO app.tareas_demo
        (demo_id, usuario_id, titulo)
      VALUES ($1, $2, $3)
      RETURNING id, titulo, estado
    `;

    const { rows } = await pool.query(sql, [
      demoId,
      usuarioId,
      titulo
    ]);

    return rows[0];
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
