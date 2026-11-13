
import sharp from 'sharp';

// Tamaño máximo permitido: 5 MiB.
const MAX_BYTES = 5 * 1024 * 1024;

// Dimensiones permitidas para la imagen original.
const MIN_DIMENSION = 64;
const MAX_DIMENSION = 4096;

// Tamaño máximo de la imagen procesada.
const MAX_SALIDA = 2400;

// Formatos de entrada permitidos.
const FORMATOS = ['jpeg', 'png', 'webp'];

export async function procesarImagen(buffer) {
  // Verificar que recibimos un archivo.
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('No se recibió una imagen válida.');
  }

  // Comprobar el tamaño original.
  if (buffer.length > MAX_BYTES) {
    throw new Error('La imagen supera el límite de 5 MiB.');
  }

  // Leer la información real del archivo.
  const imagen = sharp(buffer, {
    limitInputPixels: 16_000_000,
    failOn: 'error'
  });

  const metadata = await imagen.metadata();

  // Validar formato y dimensiones.
  if (!FORMATOS.includes(metadata.format)) {
    throw new Error('Formato no permitido. Usá JPEG, PNG o WebP.');
  }

  if (
    !metadata.width ||
    !metadata.height ||
    metadata.width < MIN_DIMENSION ||
    metadata.height < MIN_DIMENSION ||
    metadata.width > MAX_DIMENSION ||
    metadata.height > MAX_DIMENSION
  ) {
    throw new Error('Las dimensiones deben estar entre 64 y 4096 píxeles.');
  }

  // Convertir a WebP y reducir si supera 2400 píxeles.
  const resultado = await sharp(buffer, {
    limitInputPixels: 16_000_000,
    failOn: 'error'
  })
    .rotate()
    .resize({
      width: MAX_SALIDA,
      height: MAX_SALIDA,
      fit: 'inside',
      withoutEnlargement: true
    })
    .webp({ quality: 80 })
    .toBuffer({ resolveWithObject: true });

  // Verificar el tamaño de salida.
  if (resultado.data.length > MAX_BYTES) {
    throw new Error('La imagen procesada supera el límite de 5 MiB.');
  }

  return {
    buffer: resultado.data,
    mime: 'image/webp',
    bytes: resultado.data.length,
    ancho: resultado.info.width,
    alto: resultado.info.height
  };
}
