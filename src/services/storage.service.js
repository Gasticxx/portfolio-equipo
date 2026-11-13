
import { env } from '../config/env.js';

// Dirección base del bucket privado.
function obtenerUrlStorage() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Falta configurar Supabase Storage.');
  }

  return `${env.SUPABASE_URL}/storage/v1`;
}

// Envía una imagen WebP al almacenamiento.
export async function subirImagenStorage(objectPath, buffer) {
  const url = `${obtenerUrlStorage()}/object/${env.SUPABASE_STORAGE_BUCKET}/${objectPath}`;

  const respuesta = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'image/webp',
      'x-upsert': 'false'
    },
    body: buffer,
    signal: AbortSignal.timeout(15_000)
  });

  if (!respuesta.ok) {
    throw new Error(`No se pudo subir la imagen a Storage (HTTP ${respuesta.status}).`);
  }

  return objectPath;
}

 // Descarga una imagen desde el bucket privado.
export async function descargarImagenStorage(objectPath) {
  const url = `${obtenerUrlStorage()}/object/authenticated/${env.SUPABASE_STORAGE_BUCKET}/${objectPath}`;

  const respuesta = await fetch(url, {
    method: 'GET',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
    },
    signal: AbortSignal.timeout(15_000)
  });

  if (!respuesta.ok) {
    throw new Error(
      `No se pudo descargar la imagen de Storage (HTTP ${respuesta.status}).`
    );
  }

  // Convertir el contenido descargado en un Buffer.
  const contenido = await respuesta.arrayBuffer();

  return Buffer.from(contenido);
}

// Elimina una imagen del bucket privado.
export async function eliminarImagenStorage(objectPath) {
  const url = `${obtenerUrlStorage()}/object/${env.SUPABASE_STORAGE_BUCKET}`;

  const respuesta = await fetch(url, {
    method: 'DELETE',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prefixes: [objectPath]
    }),
    signal: AbortSignal.timeout(15_000)
  });

  if (!respuesta.ok) {
    throw new Error(
      `No se pudo eliminar la imagen de Storage (HTTP ${respuesta.status}).`
    );
  }

  return true;
}
