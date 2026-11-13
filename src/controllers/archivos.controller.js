
import { randomUUID } from 'node:crypto';
import { AppError } from '../middlewares/errors.js';
import { procesarImagen } from '../services/imagenes.service.js';
import {
  subirImagenStorage,
  descargarImagenStorage,
  eliminarImagenStorage
} from '../services/storage.service.js';
import { archivosRepository } from '../repositories/archivos.repository.js';


export async function subirArchivo(req, res, next) {
  let objectPath = null;
  let imagenSubida = false;

  try {
    // Comprobar que multer recibió una imagen.
    if (!req.file) {
      throw new AppError(
        400,
        'IMAGEN_REQUERIDA',
        'Debés seleccionar una imagen.'
      );
    }

    // Validar y convertir la imagen a WebP.
    let imagen;

    try {
      imagen = await procesarImagen(req.file.buffer);
    } catch (error) {
      throw new AppError(
        422,
        'IMAGEN_INVALIDA',
        error.message
      );
    }

    // Crear una ruta única para la imagen.
    objectPath = `portadas/${randomUUID()}.webp`;

    // Subir la imagen al bucket privado.
    await subirImagenStorage(objectPath, imagen.buffer);
    imagenSubida = true;

    // Registrar los metadatos en PostgreSQL.
    const archivo = await archivosRepository.crear(
      objectPath,
      imagen.mime,
      imagen.bytes,
      imagen.ancho,
      imagen.alto,
      req.user.id
    );

    // Responder al cliente.
    return res.status(201).json({
      ok: true,
      data: {
        id: archivo.id,
        url: `/media/${archivo.id}`,
        ancho: archivo.ancho,
        alto: archivo.alto,
        bytes: archivo.bytes
      }
    });

  } catch (error) {

    // Si la imagen ya se subió pero falló PostgreSQL,
    // intentar eliminar el objeto recién creado.
    if (imagenSubida && objectPath) {
      try {
        await eliminarImagenStorage(objectPath);
      } catch (errorLimpieza) {
        console.error(
          'No se pudo limpiar el objeto de Storage:',
          objectPath,
          errorLimpieza.message
        );
      }
    }

    return next(error);
  }
}


export async function obtenerArchivo(req, res, next) {
  try {
    // Validar el ID de la imagen.
    const archivoId = Number(req.params.id);

    if (!Number.isSafeInteger(archivoId) || archivoId <= 0) {
      throw new AppError(
        404,
        'ARCHIVO_NO_ENCONTRADO',
        'La imagen solicitada no existe.'
      );
    }

    // Buscar la imagen en PostgreSQL.
    const archivo = await archivosRepository.obtenerPorId(archivoId);

    if (!archivo) {
      throw new AppError(
        404,
        'ARCHIVO_NO_ENCONTRADO',
        'La imagen solicitada no existe.'
      );
    }

    // Comprobar si está asociada a un proyecto publicado.
    const publicada = await archivosRepository.estaPublicada(archivoId);

    // Comprobar si el usuario es administrador.
    const esAdministrador = req.user?.rol === 'administrador';

    // Autorizar únicamente imágenes publicadas o administradores.
    if (!publicada && !esAdministrador) {
      throw new AppError(
        403,
        'ARCHIVO_SIN_PERMISO',
        'No tenés permiso para acceder a esta imagen.'
      );
    }

    // Descargar la imagen desde Supabase Storage.
    const buffer = await descargarImagenStorage(archivo.object_path);

    // Enviarla al navegador.
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');

    return res.status(200).send(buffer);

  } catch (error) {
    return next(error);
  }
}

export async function eliminarArchivo(req, res, next) {
  try {
    // Validar el identificador.
    const archivoId = Number(req.params.id);

    if (!Number.isSafeInteger(archivoId) || archivoId <= 0) {
      throw new AppError(
        404,
        'ARCHIVO_NO_ENCONTRADO',
        'La imagen solicitada no existe.'
      );
    }

    // Buscar la imagen en PostgreSQL.
    const archivo = await archivosRepository.obtenerPorId(archivoId);

    if (!archivo) {
      throw new AppError(
        404,
        'ARCHIVO_NO_ENCONTRADO',
        'La imagen solicitada no existe.'
      );
    }

    // Comprobar si la imagen es utilizada por un proyecto.
    const enUso = await archivosRepository.estaEnUso(archivoId);

    if (enUso) {
      throw new AppError(
        409,
        'ARCHIVO_EN_USO',
        'No se puede eliminar una imagen asociada a un proyecto.'
      );
    }

    // Eliminar la imagen de Supabase Storage.
    await eliminarImagenStorage(archivo.object_path);

    // Eliminar el registro de PostgreSQL.
    await archivosRepository.eliminar(archivoId);

    // Confirmar la eliminación.
    return res.status(204).end();

  } catch (error) {
    return next(error);
  }
}
