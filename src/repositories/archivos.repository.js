import { pool } from '../config/db.js';

export const archivosRepository = {

  // Registra en PostgreSQL una imagen subida a Storage.
  async crear(objectPath, mime, bytes, ancho, alto, usuarioId) {

    const sql = `
      INSERT INTO app.archivos
        (object_path, mime, bytes, ancho, alto, creado_por)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, object_path, mime, bytes, ancho, alto, creado_por
    `;

    const { rows } = await pool.query(sql, [
      objectPath,
      mime,
      bytes,
      ancho,
      alto,
      usuarioId
    ]);

    return rows[0];
  },

  // Busca una imagen por su identificador.
  async obtenerPorId(archivoId) {

    const sql = `
      SELECT
        id,
        object_path,
        mime,
        bytes,
        ancho,
        alto,
        creado_por
      FROM app.archivos
      WHERE id = $1
    `;

    const { rows } = await pool.query(sql, [archivoId]);

    return rows[0] ?? null;
  },

  // Comprueba si una imagen es utilizada por algún proyecto.
  async estaEnUso(archivoId) {

    const sql = `
      SELECT EXISTS (
        SELECT 1
        FROM app.proyectos
        WHERE portada_id = $1
      ) AS en_uso
    `;

    const { rows } = await pool.query(sql, [archivoId]);

    return rows[0].en_uso;
  },

// Comprueba si la imagen pertenece a un proyecto publicado.
async estaPublicada(archivoId) {

  const sql = `
    SELECT EXISTS (
      SELECT 1
      FROM app.proyectos
      WHERE portada_id = $1
        AND publicado = true
    ) AS publicada
  `;

  const { rows } = await pool.query(sql, [archivoId]);

  return rows[0].publicada;
},

  // Elimina de PostgreSQL el registro de una imagen.
  async eliminar(archivoId) {

    const sql = `
      DELETE FROM app.archivos
      WHERE id = $1
      RETURNING id
    `;

    const { rows } = await pool.query(sql, [archivoId]);

    return rows.length > 0;
  }

};
