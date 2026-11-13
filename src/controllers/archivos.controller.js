import { AppError } from '../middlewares/errors.js';
import { archivosService } from '../services/archivos.service.js';

function archivoId(value) {
  if (!/^[1-9]\d*$/.test(value) || Number(value) > 2147483647) {
    throw new AppError(400, 'PARAMETRO_INVALIDO', 'Identificador de archivo inválido.');
  }
  return Number(value);
}

export async function subirArchivo(req, res) {
  if (!req.file) throw new AppError(400, 'IMAGEN_REQUERIDA', 'Debés seleccionar una imagen.');
  const data = await archivosService.crear(req.file.buffer, req.user.id);
  res.status(201).json({ ok: true, data });
}

export async function obtenerArchivo(req, res) {
  const imagen = await archivosService.descargar(archivoId(req.params.id), req.user?.rol === 'administrador');
  res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }).type('image/webp').send(imagen);
}

export async function eliminarArchivo(req, res) {
  await archivosService.eliminar(archivoId(req.params.id));
  res.status(204).end();
}
