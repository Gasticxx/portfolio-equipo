import sharp from 'sharp';
import crypto from 'node:crypto';
import { pool } from '../config/db.js';
import { AppError } from '../middlewares/errors.js';
import { configurarStorage } from './fotos-storage.js';

export const MAX_IMAGEN_BYTES = 5 * 1024 * 1024;
const noDisponible = () => new AppError(503, 'SERVICIO_NO_DISPONIBLE', 'No se pudo completar la operación de la portada.');
export async function convertirPortada(buffer) {
  if (!buffer?.length) throw new AppError(422, 'IMAGEN_INVALIDA', 'Elegí una imagen JPEG, PNG o WebP.');
  if (buffer.length > MAX_IMAGEN_BYTES) throw new AppError(413, 'ARCHIVO_GRANDE', 'La imagen supera los 5 MiB.');
  try {
    const input = sharp(buffer, { limitInputPixels: 16_000_000, animated: true, failOn: 'warning' });
    const info = await input.metadata();
    if (!['jpeg', 'png', 'webp'].includes(info.format) || (info.pages || 1) !== 1 || info.width < 64 || info.height < 64 || info.width > 4096 || info.height > 4096) {
      throw new Error('Formato o dimensiones no admitidos');
    }
    const result = await input.rotate().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
    if (result.data.length > MAX_IMAGEN_BYTES) throw new AppError(413, 'ARCHIVO_GRANDE', 'La imagen procesada supera los 5 MiB.');
    return result;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(422, 'IMAGEN_INVALIDA', 'Usá JPEG, PNG o WebP estático de 64 a 4096 píxeles por lado y hasta 16 millones de píxeles.');
  }
}

export function crearArchivosService(db = pool, http = fetch) {
  async function storage(metodo, path, data, contentType) {
    try {
      const { headers } = configurarStorage();
      const bucket = encodeURIComponent(process.env.SUPABASE_STORAGE_BUCKET || 'portfolio-media');
      const endpoint = metodo === 'DELETE' ? `/object/${bucket}` : metodo === 'GET' ? `/object/authenticated/${bucket}/${path}` : `/object/${bucket}/${path}`;
      const response = await http(`${process.env.SUPABASE_URL.replace(/\/+$/, '')}/storage/v1${endpoint}`, {
        method: metodo, headers: { ...headers, ...(contentType ? { 'Content-Type': contentType } : {}), ...(metodo === 'POST' ? { 'x-upsert': 'false' } : {}) },
        ...(data ? { body: data } : {}), signal: AbortSignal.timeout(15000),
      });
      if (!response.ok && !(metodo === 'DELETE' && response.status === 404)) throw noDisponible();
      return response;
    } catch { throw noDisponible(); }
  }
  function validarRuta(path) {
    if (!/^portadas\/[0-9a-f-]{36}\.webp$/.test(path)) throw noDisponible();
  }
  async function borrarObjeto(path) { validarRuta(path); await storage('DELETE', '', JSON.stringify({ prefixes: [path] }), 'application/json'); }
  return {
    async crear(buffer, usuarioId) {
      const { data, info } = await convertirPortada(buffer);
      const path = `portadas/${crypto.randomUUID()}.webp`;
      await storage('POST', path, data, 'image/webp');
      try {
        const { rows } = await db.query(`INSERT INTO app.archivos(object_path,mime,bytes,ancho,alto,creado_por)
          VALUES($1,'image/webp',$2,$3,$4,$5) RETURNING id,ancho,alto,bytes`, [path, data.length, info.width, info.height, usuarioId]);
        return { ...rows[0], url: `/media/${rows[0].id}` };
      } catch (error) {
        try { await borrarObjeto(path); } catch {
          console.error(JSON.stringify({ level: 'error', code: 'PORTADA_HUERFANA', object_path: path }));
        }
        throw noDisponible();
      }
    },
    async descargar(id, administrador) {
      const { rows } = await db.query(`SELECT a.object_path FROM app.archivos a WHERE a.id=$1
        AND ($2::boolean OR EXISTS(SELECT 1 FROM app.proyectos p WHERE p.portada_id=a.id AND p.publicado=true))`, [id, administrador]);
      if (!rows[0]) throw new AppError(404, 'NO_ENCONTRADO', 'La portada no existe o no está disponible.');
      validarRuta(rows[0].object_path);
      const response = await storage('GET', rows[0].object_path);
      return Buffer.from(await response.arrayBuffer());
    },
    async eliminar(id) {
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        const { rows } = await client.query('SELECT object_path FROM app.archivos WHERE id=$1 FOR UPDATE', [id]);
        if (!rows[0]) throw new AppError(404, 'NO_ENCONTRADO', 'La portada ya no existe.');
        const usos = await client.query('SELECT id FROM app.proyectos WHERE portada_id=$1', [id]);
        if (usos.rows.length) throw new AppError(409, 'ARCHIVO_EN_USO', 'Quitá o reemplazá esta portada en los proyectos que la utilizan antes de eliminarla.');
        await borrarObjeto(rows[0].object_path);
        await client.query('DELETE FROM app.archivos WHERE id=$1', [id]);
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
