import sharp from 'sharp';
import { AppError } from '../middlewares/errors.js';

export const MAX_IMAGEN_BYTES = 5 * 1024 * 1024;

export async function procesarImagen(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new AppError(422, 'IMAGEN_INVALIDA', 'Elegí una imagen JPEG, PNG o WebP.');
  if (buffer.length > MAX_IMAGEN_BYTES) throw new AppError(413, 'ARCHIVO_GRANDE', 'La imagen supera los 5 MiB.');
  try {
    const imagen = sharp(buffer, { limitInputPixels: 16_000_000, animated: true, failOn: 'warning' });
    const info = await imagen.metadata();
    if (!['jpeg', 'png', 'webp'].includes(info.format) || (info.pages || 1) !== 1
      || !info.width || !info.height || info.width < 64 || info.height < 64 || info.width > 4096 || info.height > 4096) {
      throw new Error('Formato o dimensiones no admitidos');
    }
    const { data, info: salida } = await imagen.rotate()
      .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
    if (data.length > MAX_IMAGEN_BYTES) throw new AppError(413, 'ARCHIVO_GRANDE', 'La imagen procesada supera los 5 MiB.');
    return { buffer: data, mime: 'image/webp', bytes: data.length, ancho: salida.width, alto: salida.height };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(422, 'IMAGEN_INVALIDA', 'Usá JPEG, PNG o WebP estático de 64 a 4096 píxeles por lado y hasta 16 millones de píxeles.');
  }
}
