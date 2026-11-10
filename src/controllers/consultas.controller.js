// Controlador HTTP del módulo de consultas (I6).
// Convierte HTTP en entradas validadas, llama al servicio y responde con el
// contrato {"ok":true,"data":...}. No contiene SQL ni credenciales.
import {
  crearConsultaSchema,
  respuestaSchema,
  cambioEstadoSchema,
  reintentoSchema,
  listadoConsultasSchema,
  contactoQuerySchema,
  validarCuerpo,
  validarQuery,
  validarIdRuta,
  validarIdempotencyKey
} from '../validators/consultas.validator.js';
import {
  TEXTO_CONSENTIMIENTO,
  LIMITES_CONSULTA,
  LIMITES_RESPUESTA,
  ETIQUETAS,
  TIPOS_CONSULTA,
  ESTADOS_CONSULTA,
  ESTADOS_ENVIO
} from '../config/consultas.constants.js';
import { ErrorApi, esErrorDeBaseInaccesible } from '../services/consultas.errores.js';

/**
 * @param {object} deps
 * @param {ReturnType<import('../services/consultas.service.js').crearConsultasService>} deps.servicio
 * @param {(req) => ({id:number, nombre?:string, rol:string} | null)} deps.usuarioDe
 */
export function crearConsultasController({ servicio, usuarioDe }) {
  const usuarioObligatorio = (req) => {
    const usuario = usuarioDe(req);
    if (!usuario?.id) throw new ErrorApi(401, 'NO_AUTENTICADO', 'Iniciá sesión para continuar.');
    return usuario;
  };

  // ------------------------------------------------------------------ API
  return {
    async crearConsulta(req, res) {
      const idempotencyKey = validarIdempotencyKey(req.get('Idempotency-Key'));
      const datos = validarCuerpo(crearConsultaSchema, req.body);
      const { status, data } = await servicio.crearConsulta({ datos, idempotencyKey, sessionId: req.sessionID });
      res.status(status).json({ ok: true, data });
    },

    async listar(req, res) {
      const filtros = validarQuery(listadoConsultasSchema, req.query);
      const { data, meta } = await servicio.listar(filtros);
      res.json({ ok: true, data, meta });
    },

    async detalle(req, res) {
      const id = validarIdRuta(req.params.id);
      res.json({ ok: true, data: await servicio.obtenerDetalle(id) });
    },

    async cambiarEstado(req, res) {
      const id = validarIdRuta(req.params.id);
      const { estado } = validarCuerpo(cambioEstadoSchema, req.body);
      res.json({ ok: true, data: await servicio.cambiarEstado(id, estado) });
    },

    async responder(req, res) {
      const consultaId = validarIdRuta(req.params.id);
      const usuario = usuarioObligatorio(req);
      const idempotencyKey = validarIdempotencyKey(req.get('Idempotency-Key'));
      const { mensaje } = validarCuerpo(respuestaSchema, req.body);
      const { status, data } = await servicio.responder({ consultaId, mensaje, idempotencyKey, autorId: usuario.id });
      res.status(status).json({ ok: true, data });
    },

    async reintentar(req, res) {
      const envioId = validarIdRuta(req.params.id);
      const { confirmarRiesgo } = validarCuerpo(reintentoSchema, req.body);
      res.json({ ok: true, data: await servicio.reintentarEnvio(envioId, { confirmarRiesgo }) });
    },

    // ---------------------------------------------------------------- Páginas
    async paginaContacto(req, res) {
      const query = contactoQuerySchema.parse(req.query);
      let servicios = [];
      let contactoDisponible = true;
      try {
        servicios = await servicio.listarServiciosActivos();
      } catch (err) {
        if (!esErrorDeBaseInaccesible(err)) throw err;
        contactoDisponible = false;
      }
      res.set('Cache-Control', 'no-store');
      // Solo se preselecciona un servicio activo y solo para cotización.
      const tipo = query.tipo ?? 'general';
      const servicioId =
        tipo === 'cotizacion' && servicios.some((s) => s.id === query.servicioId) ? query.servicioId : null;
      res.render('consultas/contacto', {
        titulo: 'Contacto',
        rutaActual: '/contacto',
        servicios,
        contactoDisponible,
        seleccion: { tipo, servicioId },
        textoConsentimiento: TEXTO_CONSENTIMIENTO,
        limites: LIMITES_CONSULTA
      });
    },

    async paginaListado(req, res) {
      let filtros;
      let errorFiltros = null;
      // El formulario GET envía selects vacíos ("Todos"): en la página se ignoran.
      const query = Object.fromEntries(Object.entries(req.query).filter(([, v]) => v !== ''));
      try {
        filtros = validarQuery(listadoConsultasSchema, query);
      } catch (err) {
        if (!(err instanceof ErrorApi)) throw err;
        errorFiltros = 'Algunos filtros no son válidos y se ignoraron.';
        filtros = validarQuery(listadoConsultasSchema, {});
        res.status(400);
      }
      const { data, meta } = await servicio.listar(filtros);
      res.set('Cache-Control', 'no-store');
      const urlPagina = (page) => {
        const p = new URLSearchParams();
        for (const clave of ['q', 'tipo', 'estado', 'notificacionEstado']) if (filtros[clave]) p.set(clave, filtros[clave]);
        if (filtros.pageSize !== 10) p.set('pageSize', String(filtros.pageSize));
        if (page > 1) p.set('page', String(page));
        const qs = p.toString();
        return `/operador/consultas${qs ? `?${qs}` : ''}`;
      };
      res.render('consultas/operador-lista', {
        titulo: 'Consultas',
        rutaActual: '/operador/consultas',
        consultas: data,
        meta,
        filtros,
        errorFiltros,
        urlPagina,
        etiquetas: ETIQUETAS,
        opciones: { tipos: TIPOS_CONSULTA, estados: ESTADOS_CONSULTA, estadosEnvio: ESTADOS_ENVIO }
      });
    },

    async paginaDetalle(req, res, next) {
      let id;
      try {
        id = validarIdRuta(req.params.id);
      } catch {
        return next(); // 404 del manejador común
      }
      let consulta;
      try {
        consulta = await servicio.obtenerDetalle(id);
      } catch (err) {
        if (err instanceof ErrorApi && err.status === 404) return next();
        throw err;
      }
      res.set('Cache-Control', 'no-store');
      res.render('consultas/operador-detalle', {
        titulo: `Consulta #${consulta.id}`,
        rutaActual: '/operador/consultas',
        consulta,
        limites: LIMITES_RESPUESTA,
        etiquetas: ETIQUETAS
      });
    },

    paginaMetricas(req, res) {
      res.set('Cache-Control', 'no-store');
      res.render('admin/metricas', { titulo: 'Métricas', rutaActual: '/admin/metricas' });
    }
  };
}
