// Reglas de negocio de consultas, respuestas y operador (I6).
// Apartado 14: idempotencia, transacción consulta+envío, Brevo después del
// commit, transiciones de estado y respuestas con historial.
import { createHash, createHmac } from 'node:crypto';
import { TRANSICIONES_MANUALES } from '../config/consultas.constants.js';
import * as repo from '../repositories/consultas.repository.js';
import { conTransaccion } from './transaccion.js';
import { ErrorApi, errores } from './consultas.errores.js';
import {
  asuntoNotificacion,
  asuntoRespuesta,
  cuerpoNotificacion,
  cuerpoRespuesta,
  evaluarReintento
} from './email.service.js';

// ---------------------------------------------------------------------------
// Huellas de idempotencia
// ---------------------------------------------------------------------------
/** SHA-256 del JSON con claves en orden alfabético, incluyendo null explícitos. */
export function huellaPayload(objeto) {
  const ordenado = {};
  for (const clave of Object.keys(objeto).sort()) ordenado[clave] = objeto[clave] === undefined ? null : objeto[clave];
  return createHash('sha256').update(JSON.stringify(ordenado), 'utf8').digest('hex');
}

/** HMAC del id de sesión anónima: no se guarda el sid en claro. */
export function huellaActor(secreto, sessionId) {
  return createHmac('sha256', secreto).update(`consulta:${sessionId}`, 'utf8').digest('hex');
}

const esViolacionUnica = (err) => err?.code === '23505';

const conflictoIdempotencia = () =>
  errores.conflicto(
    'IDEMPOTENCIA_CONFLICTO',
    'Esta clave de envío ya se usó con otros datos o desde otra sesión. Revisá si tu consulta anterior quedó registrada o enviá una nueva.'
  );

// ---------------------------------------------------------------------------
// Presentación (camelCase, fechas ISO UTC, null explícitos)
// ---------------------------------------------------------------------------
const iso = (fecha) => (fecha ? new Date(fecha).toISOString() : null);

function envioPublico(e) {
  const regla = evaluarReintento(e);
  return {
    id: e.id,
    clase: e.clase,
    respuestaId: e.respuesta_id,
    destinatario: e.destinatario,
    asunto: e.asunto,
    estado: e.estado,
    intentos: e.intentos,
    proveedorId: e.proveedor_id,
    errorCodigo: e.error_codigo,
    createdAt: iso(e.created_at),
    updatedAt: iso(e.updated_at),
    reintento: {
      permitido: regla.permitido,
      requiereConfirmacion: Boolean(regla.requiereConfirmacion),
      motivo: regla.motivo ?? null,
      esperaSegundos: regla.esperaSegundos ?? 0
    }
  };
}

// ---------------------------------------------------------------------------
// Fábrica
// ---------------------------------------------------------------------------
/**
 * @param {object} deps
 * @param {import('pg').Pool} deps.pool
 * @param {ReturnType<import('./email.service.js').crearEmailService>} deps.emailService
 * @param {string} deps.secretoActor  Secreto del servidor para el HMAC del actor
 * @param {string} deps.contactoDestino  CONTACT_TO_EMAIL
 * @param {string} [deps.appOrigin]
 */
export function crearConsultasService({ pool, emailService, secretoActor, contactoDestino, appOrigin }) {
  if (!secretoActor) throw new Error('Falta el secreto para la huella de idempotencia.');
  // Sin CONTACT_TO_EMAIL (solo posible fuera de producción) el envío queda en
  // error de configuración; el destinatario guardado no puede quedar vacío.
  contactoDestino ||= 'sin-configurar@invalid';

  // ------------------------------------------------------------- Contacto
  async function crearConsulta({ datos, idempotencyKey, sessionId }) {
    if (!sessionId) {
      throw new ErrorApi(403, 'CSRF_INVALIDO', 'Tu sesión no es válida. Recargá la página y volvé a enviar.');
    }
    const actor = huellaActor(secretoActor, sessionId);
    const huella = huellaPayload(datos);

    const repetida = (existente) => {
      if (existente.idempotencia_actor !== actor || existente.payload_sha256 !== huella) throw conflictoIdempotencia();
      return {
        status: 200,
        data: { id: existente.id, estado: existente.estado, notificacionEstado: existente.notificacion_estado }
      };
    };

    let alta;
    try {
      alta = await conTransaccion(pool, async (client) => {
        const existente = await repo.buscarConsultaPorIdempotencia(client, idempotencyKey);
        if (existente) return { repetida: repetida(existente) };

        let servicioNombre = null;
        if (datos.servicioId !== null) {
          const servicio = await repo.buscarServicioActivoParaConsulta(client, datos.servicioId);
          if (!servicio) throw errores.validacion({ servicioId: 'El servicio elegido no existe o no está activo.' });
          servicioNombre = servicio.nombre;
        }

        const consulta = await repo.insertarConsulta(client, {
          ...datos,
          servicioNombre,
          idempotenciaId: idempotencyKey,
          idempotenciaActor: actor,
          payloadSha256: huella
        });
        const envio = await repo.insertarEnvio(client, {
          consultaId: consulta.id,
          clase: 'notificacion',
          destinatario: contactoDestino,
          asunto: asuntoNotificacion(consulta.id, consulta.asunto),
          cuerpo: cuerpoNotificacion(consulta, appOrigin)
        });
        return { consulta, envio };
      });
    } catch (err) {
      // Carrera de altas: la restricción UNIQUE resuelve; se compara con la ganadora.
      if (esViolacionUnica(err)) {
        const existente = await repo.buscarConsultaPorIdempotencia(pool, idempotencyKey);
        if (existente) return repetida(existente);
      }
      throw err;
    }
    if (alta.repetida) return alta.repetida;

    // Después del commit: notificación al equipo. Un fallo no pierde la consulta.
    const notificacionEstado = await emailService.enviarPendiente(alta.envio.id);
    return {
      status: 201,
      data: { id: alta.consulta.id, estado: alta.consulta.estado, notificacionEstado }
    };
  }

  async function listarServiciosActivos() {
    return repo.listarServiciosActivos(pool);
  }

  // ------------------------------------------------------------- Operador
  async function listar(filtros) {
    const { filas, total } = await repo.listarConsultas(pool, filtros);
    return {
      data: filas.map((f) => ({
        id: f.id,
        nombre: f.nombre,
        tipo: f.tipo,
        asunto: f.asunto,
        estado: f.estado,
        notificacionEstado: f.notificacion_estado,
        createdAt: iso(f.created_at)
      })),
      meta: {
        page: filtros.page,
        pageSize: filtros.pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / filtros.pageSize)
      }
    };
  }

  async function obtenerDetalle(id) {
    const consulta = await repo.obtenerConsulta(pool, id);
    if (!consulta) throw errores.noEncontrado('No encontramos esa consulta.');
    const [respuestas, envios] = await Promise.all([repo.listarRespuestas(pool, id), repo.listarEnvios(pool, id)]);
    const enviosPublicos = envios.map(envioPublico);
    const porId = new Map(enviosPublicos.map((e) => [e.id, e]));

    return {
      id: consulta.id,
      nombre: consulta.nombre,
      email: consulta.email,
      tipo: consulta.tipo,
      asunto: consulta.asunto,
      mensaje: consulta.mensaje,
      estado: consulta.estado,
      consentimientoAt: iso(consulta.consentimiento_at),
      createdAt: iso(consulta.created_at),
      updatedAt: iso(consulta.updated_at),
      servicio: { id: consulta.servicio_id, nombre: consulta.servicio_nombre_snapshot },
      transicionesPermitidas: [...TRANSICIONES_MANUALES[consulta.estado]],
      puedeResponder: consulta.estado !== 'cerrada',
      respuestas: respuestas.map((r) => {
        const envio = r.envio_id ? porId.get(r.envio_id) : null;
        return {
          id: r.id,
          mensaje: r.mensaje,
          autor: { id: r.autor_id, nombre: r.autor_nombre },
          createdAt: iso(r.created_at),
          envio: envio ? { id: envio.id, estado: envio.estado, intentos: envio.intentos, errorCodigo: envio.errorCodigo } : null
        };
      }),
      envios: enviosPublicos
    };
  }

  async function cambiarEstado(id, estadoNuevo) {
    return conTransaccion(pool, async (client) => {
      const consulta = await repo.obtenerConsultaParaActualizar(client, id);
      if (!consulta) throw errores.noEncontrado('No encontramos esa consulta.');
      if (estadoNuevo === 'respondida') {
        throw errores.conflicto(
          'ESTADO_INCOMPATIBLE',
          'Una consulta pasa a respondida solo cuando el proveedor acepta una respuesta.'
        );
      }
      if (!TRANSICIONES_MANUALES[consulta.estado].includes(estadoNuevo)) {
        throw errores.conflicto('ESTADO_INCOMPATIBLE', `No se puede pasar de ${consulta.estado} a ${estadoNuevo}.`);
      }
      const r = await repo.actualizarEstadoConsulta(client, id, estadoNuevo);
      return { id: r.id, estado: r.estado, updatedAt: iso(r.updated_at) };
    });
  }

  async function responder({ consultaId, mensaje, idempotencyKey, autorId }) {
    const huella = huellaPayload({ consultaId, mensaje });

    const repetida = (existente) => {
      if (existente.autor_id !== autorId || existente.payload_sha256 !== huella || existente.consulta_id !== consultaId) {
        throw conflictoIdempotencia();
      }
      return {
        status: 200,
        data: { id: existente.id, createdAt: iso(existente.created_at), envioEstado: existente.envio_estado }
      };
    };

    let alta;
    try {
      alta = await conTransaccion(pool, async (client) => {
        const consulta = await repo.obtenerConsultaParaActualizar(client, consultaId);
        if (!consulta) throw errores.noEncontrado('No encontramos esa consulta.');

        const existente = await repo.buscarRespuestaPorIdempotencia(client, idempotencyKey);
        if (existente) return { repetida: repetida(existente) };

        if (consulta.estado === 'cerrada') {
          throw errores.conflicto('CONSULTA_CERRADA', 'La consulta está cerrada. Reabrila antes de responder.');
        }

        const respuesta = await repo.insertarRespuesta(client, {
          consultaId,
          autorId,
          mensaje,
          idempotenciaId: idempotencyKey,
          payloadSha256: huella
        });
        const envio = await repo.insertarEnvio(client, {
          consultaId,
          respuestaId: respuesta.id,
          clase: 'respuesta',
          destinatario: consulta.email, // nunca desde el navegador
          asunto: asuntoRespuesta(consultaId),
          cuerpo: cuerpoRespuesta(consulta, mensaje)
        });
        return { respuesta, envio };
      });
    } catch (err) {
      if (esViolacionUnica(err)) {
        const existente = await repo.buscarRespuestaPorIdempotencia(pool, idempotencyKey);
        if (existente) return repetida(existente);
      }
      throw err;
    }
    if (alta.repetida) return alta.repetida;

    const envioEstado = await emailService.enviarPendiente(alta.envio.id);
    return {
      status: 201,
      data: { id: alta.respuesta.id, createdAt: iso(alta.respuesta.created_at), envioEstado }
    };
  }

  async function reintentarEnvio(envioId, opciones) {
    const envio = await emailService.reintentar(envioId, opciones);
    return envioPublico(envio);
  }

  return { crearConsulta, listarServiciosActivos, listar, obtenerDetalle, cambiarEstado, responder, reintentarEnvio };
}
