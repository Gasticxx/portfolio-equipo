import { AppError } from '../middlewares/errors.js';
import { configurarStorage } from './fotos-storage.js';

const noDisponible = () => new AppError(503, 'SERVICIO_NO_DISPONIBLE', 'No se pudo completar la operación de la portada.');
async function solicitarStorage(method, objectPath, buffer, http) {
  try {
    if (!/^portadas\/[0-9a-f-]{36}\.webp$/.test(objectPath)) throw noDisponible();
    const { headers } = configurarStorage();
    const bucket = encodeURIComponent(process.env.SUPABASE_STORAGE_BUCKET || 'portfolio-media');
    const base = `${process.env.SUPABASE_URL.replace(/\/+$/, '')}/storage/v1`;
    const path = method === 'DELETE' ? `/object/${bucket}` : method === 'GET' ? `/object/authenticated/${bucket}/${objectPath}` : `/object/${bucket}/${objectPath}`;
    const response = await http(`${base}${path}`, {
      method,
      headers: { ...headers, ...(method !== 'GET' ? { 'Content-Type': method === 'DELETE' ? 'application/json' : 'image/webp' } : {}), ...(method === 'POST' ? { 'x-upsert': 'false' } : {}) },
      ...(method === 'DELETE' ? { body: JSON.stringify({ prefixes: [objectPath] }) } : buffer ? { body: buffer } : {}),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok && !(method === 'DELETE' && response.status === 404)) throw noDisponible();
    return response;
  } catch { throw noDisponible(); }
}

export async function subirImagenStorage(objectPath, buffer, http = fetch) {
  await solicitarStorage('POST', objectPath, buffer, http);
  return objectPath;
}
export async function descargarImagenStorage(objectPath, http = fetch) {
  try {
    const response = await solicitarStorage('GET', objectPath, undefined, http);
    return Buffer.from(await response.arrayBuffer());
  } catch { throw noDisponible(); }
}
export async function eliminarImagenStorage(objectPath, http = fetch) {
  await solicitarStorage('DELETE', objectPath, undefined, http);
  return true;
}
