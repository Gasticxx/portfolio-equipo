import { serviciosService } from '../services/servicios.service.js';
import { obtenerTokenCsrf } from '../middlewares/csrf.js';
import {
  servicioBodySchema,
  servicioPutBodySchema,
  servicioQuerySchema,
  idParamSchema
} from '../validators/servicios.validator.js';

function formatearErroresZod(zodError) {
  const fields = {};
  for (const issue of zodError.issues) {
    const key = issue.path.join('.') || 'general';
    if (!fields[key]) {
      fields[key] = issue.message;
    }
  }
  return fields;
}

export const serviciosController = {
  // GET /servicios (Vista pública)
  async vistaServicios(req, res, next) {
    try {
      const servicios = await serviciosService.listarPublicos();
      return res.render('servicios/index', {
        titulo: 'Servicios',
        tituloPagina: 'Servicios - Reflection Tech',
        rutaActual: '/servicios',
        servicios
      });
    } catch {
      return res.render('servicios/index', {
        titulo: 'Servicios',
        tituloPagina: 'Servicios - Reflection Tech',
        rutaActual: '/servicios',
        servicios: []
      });
    }
  },

  // GET /admin/servicios (Vista administrativa)
  async vistaAdminServicios(req, res, next) {
    try {
      const resultado = await serviciosService.listarAdmin({ page: 1, pageSize: 50 });
      const csrfToken = obtenerTokenCsrf(req.session);
      return res.render('servicios/admin', {
        titulo: 'Administración de Servicios',
        tituloPagina: 'Administración de Servicios - Reflection Tech',
        rutaActual: '/admin/servicios',
        csrfToken,
        servicios: resultado.data,
        meta: resultado.meta
      });
    } catch (err) {
      return next(err);
    }
  },

  // GET /api/servicios (API pública)
  async apiListarPublicos(req, res, next) {
    try {
      if (Object.keys(req.query).length > 0) {
        return res.status(400).json({
          ok: false,
          error: {
            code: 'PARAMETRO_INVALIDO',
            message: 'Esta ruta no admite parámetros de consulta.',
            requestId: req.requestId
          }
        });
      }
      const data = await serviciosService.listarPublicos();
      return res.status(200).json({ ok: true, data });
    } catch (err) {
      return next(err);
    }
  },

  // GET /api/admin/servicios
  async apiListarAdmin(req, res, next) {
    try {
      const parsed = servicioQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({
          ok: false,
          error: {
            code: 'PARAMETRO_INVALIDO',
            message: 'Parámetros de consulta inválidos.',
            fields: formatearErroresZod(parsed.error),
            requestId: req.requestId
          }
        });
      }
      const { data, meta } = await serviciosService.listarAdmin(parsed.data);
      return res.status(200).json({ ok: true, data, meta });
    } catch (err) {
      return next(err);
    }
  },

  // GET /api/admin/servicios/:id
  async apiObtenerPorId(req, res, next) {
    try {
      const paramParsed = idParamSchema.safeParse(req.params);
      if (!paramParsed.success) {
        return res.status(400).json({
          ok: false,
          error: {
            code: 'PARAMETRO_INVALIDO',
            message: 'El identificador de servicio es inválido.',
            requestId: req.requestId
          }
        });
      }

      const servicio = await serviciosService.obtenerAdminPorId(paramParsed.data.id);
      if (!servicio) {
        return res.status(404).json({
          ok: false,
          error: {
            code: 'NO_ENCONTRADO',
            message: 'El servicio solicitado no existe.',
            requestId: req.requestId
          }
        });
      }
      return res.status(200).json({ ok: true, data: servicio });
    } catch (err) {
      return next(err);
    }
  },

  // POST /api/admin/servicios
  async apiCrear(req, res, next) {
    try {
      const bodyParsed = servicioBodySchema.safeParse(req.body);
      if (!bodyParsed.success) {
        return res.status(422).json({
          ok: false,
          error: {
            code: 'VALIDACION',
            message: 'Revisá los campos indicados.',
            fields: formatearErroresZod(bodyParsed.error),
            requestId: req.requestId
          }
        });
      }

      const creado = await serviciosService.crearServicio(bodyParsed.data);
      return res.status(201).json({ ok: true, data: creado });
    } catch (err) {
      return next(err);
    }
  },

  // PUT /api/admin/servicios/:id
  async apiActualizar(req, res, next) {
    try {
      const paramParsed = idParamSchema.safeParse(req.params);
      if (!paramParsed.success) {
        return res.status(400).json({
          ok: false,
          error: {
            code: 'PARAMETRO_INVALIDO',
            message: 'El identificador de servicio es inválido.',
            requestId: req.requestId
          }
        });
      }

      const bodyParsed = servicioPutBodySchema.safeParse(req.body);
      if (!bodyParsed.success) {
        return res.status(422).json({
          ok: false,
          error: {
            code: 'VALIDACION',
            message: 'Revisá los campos indicados.',
            fields: formatearErroresZod(bodyParsed.error),
            requestId: req.requestId
          }
        });
      }

      const actualizado = await serviciosService.actualizarServicio(
        paramParsed.data.id,
        bodyParsed.data
      );

      if (!actualizado) {
        return res.status(404).json({
          ok: false,
          error: {
            code: 'NO_ENCONTRADO',
            message: 'El servicio solicitado no existe.',
            requestId: req.requestId
          }
        });
      }

      return res.status(200).json({ ok: true, data: actualizado });
    } catch (err) {
      return next(err);
    }
  },

  // DELETE /api/admin/servicios/:id
  async apiEliminar(req, res, next) {
    try {
      const paramParsed = idParamSchema.safeParse(req.params);
      if (!paramParsed.success) {
        return res.status(400).json({
          ok: false,
          error: {
            code: 'PARAMETRO_INVALIDO',
            message: 'El identificador de servicio es inválido.',
            requestId: req.requestId
          }
        });
      }

      const eliminado = await serviciosService.eliminarServicio(paramParsed.data.id);
      if (!eliminado) {
        return res.status(404).json({
          ok: false,
          error: {
            code: 'NO_ENCONTRADO',
            message: 'El servicio solicitado no existe.',
            requestId: req.requestId
          }
        });
      }

      return res.status(204).end();
    } catch (err) {
      return next(err);
    }
  }
};
