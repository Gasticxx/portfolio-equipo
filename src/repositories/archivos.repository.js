import { pool } from '../config/db.js';

export function crearArchivosRepository(db = pool) {
  return {
    async crear(objectPath, mime, bytes, ancho, alto, usuarioId) {
      const { rows } = await db.query(`INSERT INTO app.archivos
        (object_path,mime,bytes,ancho,alto,creado_por) VALUES($1,$2,$3,$4,$5,$6)
        RETURNING id,object_path,mime,bytes,ancho,alto,creado_por`,
      [objectPath, mime, bytes, ancho, alto, usuarioId]);
      return rows[0];
    },
    async obtenerPorId(archivoId, client = db, bloquear = false) {
      const { rows } = await client.query(`SELECT a.id,a.object_path,a.mime,a.bytes,a.ancho,a.alto,a.creado_por,
        EXISTS(SELECT 1 FROM app.proyectos p WHERE p.portada_id=a.id AND p.publicado=true) AS publicada
        FROM app.archivos a WHERE a.id=$1 ${bloquear ? 'FOR UPDATE OF a' : ''}`, [archivoId]);
      return rows[0] ?? null;
    },
    async estaEnUso(archivoId, client = db) {
      const { rows } = await client.query('SELECT EXISTS(SELECT 1 FROM app.proyectos WHERE portada_id=$1) AS en_uso', [archivoId]);
      return rows[0].en_uso;
    },
    async estaPublicada(archivoId) {
      const { rows } = await db.query('SELECT EXISTS(SELECT 1 FROM app.proyectos WHERE portada_id=$1 AND publicado=true) AS publicada', [archivoId]);
      return rows[0].publicada;
    },
    async eliminar(archivoId, client = db) {
      const { rows } = await client.query('DELETE FROM app.archivos WHERE id=$1 RETURNING id', [archivoId]);
      return rows.length > 0;
    },
  };
}
export const archivosRepository = crearArchivosRepository();
