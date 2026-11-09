import { equipoService } from '../services/equipo.service.js';

export const equipoController = {
  // GET / (Vista Inicio)
  async vistaInicio(req, res, next) {
    try {
      const { miembros, servicios } = await equipoService.obtenerDatosInicio();
      return res.render('pages/inicio', {
        tituloPagina: 'Equipo Seis - Portfolio Fullstack',
        miembros,
        servicios
      });
    } catch (err) {
      return next(err);
    }
  },

  // GET /equipo (Vista listado de los 6 miembros)
  async vistaEquipo(req, res, next) {
    try {
      const miembros = await equipoService.listarEquipo();
      return res.render('equipo/index', {
        tituloPagina: 'Nuestro Equipo - Equipo Seis',
        miembros
      });
    } catch (err) {
      return next(err);
    }
  },

  // GET /equipo/:slug (Vista perfil individual)
  async vistaPerfil(req, res, next) {
    try {
      const miembro = await equipoService.obtenerMiembroPorSlug(req.params.slug);
      if (!miembro) {
        return res.status(404).render('pages/404', {
          tituloPagina: 'Integrante no encontrado'
        });
      }
      return res.render('equipo/detalle', {
        tituloPagina: `${miembro.nombre} - Equipo Seis`,
        miembro
      });
    } catch (err) {
      return next(err);
    }
  },

  // GET /api/equipo
  async apiListarEquipo(req, res, next) {
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
      const data = await equipoService.listarEquipo();
      return res.status(200).json({ ok: true, data });
    } catch (err) {
      return next(err);
    }
  },

  // GET /api/equipo/:slug
  async apiObtenerMiembro(req, res, next) {
    try {
      const miembro = await equipoService.obtenerMiembroPorSlug(req.params.slug);
      if (!miembro) {
        return res.status(404).json({
          ok: false,
          error: {
            code: 'NO_ENCONTRADO',
            message: 'El integrante solicitado no existe.',
            requestId: req.requestId
          }
        });
      }
      return res.status(200).json({ ok: true, data: miembro });
    } catch (err) {
      return next(err);
    }
  }
};