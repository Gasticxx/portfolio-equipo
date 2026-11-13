import crypto from 'node:crypto';
import { pool } from '../config/db.js';
import { AppError } from '../middlewares/errors.js';
import { crearArchivosRepository } from '../repositories/archivos.repository.js';
import { procesarImagen } from './imagenes.service.js';
import { subirImagenStorage, descargarImagenStorage, eliminarImagenStorage } from './storage.service.js';

export { MAX_IMAGEN_BYTES } from './imagenes.service.js';
const noDisponible = () => new AppError(503, 'SERVICIO_NO_DISPONIBLE', 'No se pudo completar la operación de la portada.');

// Conserva el contrato del editor utilizando el procesador compartido de I5.
export async function convertirPortada(buffer) {
  const imagen = await procesarImagen(buffer);
  return { data: imagen.buffer, info: { format: 'webp', width: imagen.ancho, height: imagen.alto } };
}

export function crearArchivosService(db = pool, http = fetch) {
  const repo = crearArchivosRepository(db);
  return {
    async crear(buffer, usuarioId) {
      const imagen = await procesarImagen(buffer);
      const path = `portadas/${crypto.randomUUID()}.webp`;
      await subirImagenStorage(path, imagen.buffer, http);
      try {
        const archivo = await repo.crear(path, imagen.mime, imagen.bytes, imagen.ancho, imagen.alto, usuarioId);
        return { id: archivo.id, ancho: archivo.ancho, alto: archivo.alto, bytes: archivo.bytes, url: `/media/${archivo.id}` };
      } catch {
        try { await eliminarImagenStorage(path, http); } catch {
          console.error(JSON.stringify({ level: 'error', code: 'PORTADA_HUERFANA', object_path: path }));
        }
        throw noDisponible();
      }
    },
    async descargar(id, administrador) {
      const archivo = await repo.obtenerPorId(id);
      if (!archivo || (!administrador && !archivo.publicada)) throw new AppError(404, 'NO_ENCONTRADO', 'La portada no existe o no está disponible.');
      return descargarImagenStorage(archivo.object_path, http);
    },
    async eliminar(id) {
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        const archivo = await repo.obtenerPorId(id, client, true);
        if (!archivo) throw new AppError(404, 'NO_ENCONTRADO', 'La portada ya no existe.');
        if (await repo.estaEnUso(id, client)) throw new AppError(409, 'ARCHIVO_EN_USO', 'Quitá o reemplazá esta portada en los proyectos que la utilizan antes de eliminarla.');
        await eliminarImagenStorage(archivo.object_path, http);
        await repo.eliminar(id, client);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        if (error.code === '23503') throw new AppError(409, 'ARCHIVO_EN_USO', 'La portada está en uso.');
        throw error;
      } finally { client.release(); }
    },
  };
}
export const archivosService = crearArchivosService();
