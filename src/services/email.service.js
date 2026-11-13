// Servicio de correo transaccional con Brevo (I6).
// Apartados 14 y 14.1: POST HTTPS a /v3/smtp/email con fetch nativo de Node,
// api-key en cabecera, timeout de 10 s, estados pendiente → enviando →
// aceptado | error | desconocido, sin reintentos automáticos.
//
// Regla clave: la llamada al proveedor ocurre SIEMPRE después del commit y sin
// bloqueos SQL abiertos. El reclamo (pendiente/error → enviando) es una
// transacción corta con FOR UPDATE; el resultado se guarda en otra.
import { CORREO } from '../config/consultas.constants.js';
import * as repo from '../repositories/consultas.repository.js';
import { conTransaccion } from './transaccion.js';
import { errores } from './consultas.errores.js';

// Fallos de red en los que el mensaje con seguridad no salió del servidor.
const RED_SIN_ENVIO = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH', 'CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'ERR_TLS_CERT_ALTNAME_INVALID']);

const recortar = (texto, max) => {
  const chars = Array.from(texto);
  return chars.length <= max ? texto : chars.slice(0, max - 1).join('') + '…';
};

const codigoSeguro = (texto) =>
  recortar(String(texto).replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'DESCONOCIDO', CORREO.errorCodigoMax);

const NOMBRES_TIPO = { general: 'General', cotizacion: 'Cotización', asesoria: 'Asesoría' };

// ---------------------------------------------------------------------------
// Composición de mensajes (texto plano; nunca se interpreta HTML del usuario)
// ---------------------------------------------------------------------------
export function asuntoNotificacion(consultaId, asunto) {
  return recortar(`${CORREO.prefijoAsunto} Consulta #${consultaId} - ${asunto}`, CORREO.asuntoMax);
}

export function asuntoRespuesta(consultaId) {
  return recortar(`${CORREO.prefijoAsunto} Respuesta a consulta #${consultaId}`, CORREO.asuntoMax);
}

export function cuerpoNotificacion(consulta, appOrigin) {
  const lineas = [
    'Nueva consulta recibida en el sitio de Reflection Tech.',
    '',
    `Consulta #${consulta.id}`,
    `Tipo: ${NOMBRES_TIPO[consulta.tipo] ?? consulta.tipo}`
  ];
  if (consulta.servicio_nombre_snapshot) lineas.push(`Servicio: ${consulta.servicio_nombre_snapshot}`);
  lineas.push(
    `Nombre: ${consulta.nombre}`,
    `Email: ${consulta.email}`,
    `Asunto: ${consulta.asunto}`,
    '',
    'Mensaje:',
    consulta.mensaje,
    ''
  );
  if (appOrigin) lineas.push(`Gestionala desde el panel: ${appOrigin}/operador/consultas/${consulta.id}`);
  lineas.push('Respondé desde el panel para conservar el historial; no respondas este correo directamente.');
  return recortar(lineas.join('\n'), CORREO.cuerpoMax);
}

export function cuerpoRespuesta(consulta, mensaje) {
  const texto = [
    `Hola, ${consulta.nombre}:`,
    '',
    mensaje,
    '',
    '—',
    'Reflection Tech',
    `Respuesta a tu consulta #${consulta.id}: ${consulta.asunto}`
  ].join('\n');
  return recortar(texto, CORREO.cuerpoMax);
}

// ---------------------------------------------------------------------------
// Reglas de reintento (función pura; usa el reloj de la base: fila.ahora)
// ---------------------------------------------------------------------------
export function evaluarReintento(envio) {
  const estado = envio.estado; // estado efectivo (enviando vencido = desconocido)
  if (estado === 'aceptado') {
    return { permitido: false, code: 'ENVIO_ACEPTADO', motivo: 'El proveedor ya aceptó este envío; no se reenvía.' };
  }
  if (estado === 'enviando') {
    return { permitido: false, code: 'ENVIO_EN_CURSO', motivo: 'Hay un envío en curso. Esperá su resultado.' };
  }
  if (envio.intentos >= CORREO.intentosMaximos) {
    return {
      permitido: false,
      code: 'INTENTOS_AGOTADOS',
      motivo: `Se alcanzaron los ${CORREO.intentosMaximos} intentos. Revisá la configuración de Brevo y registrá el incidente.`
    };
  }
  if (envio.intentos > 0) {
    // Inicio del último intento: bloqueo_hasta − duración del bloqueo. Así un
    // cambio de estado sin intento (enviando vencido → desconocido) no reinicia la espera.
    const inicioUltimo = envio.bloqueo_hasta
      ? new Date(envio.bloqueo_hasta).getTime() - CORREO.bloqueoSegundos * 1000
      : new Date(envio.updated_at).getTime();
    const transcurridos = (new Date(envio.ahora).getTime() - inicioUltimo) / 1000;
    const espera = Math.ceil(CORREO.esperaReintentoSegundos - transcurridos);
    if (espera > 0) {
      return {
        permitido: false,
        code: 'ESPERA_REQUERIDA',
        motivo: `Esperá ${espera} s antes de reintentar.`,
        esperaSegundos: espera,
        requiereConfirmacion: estado === 'desconocido'
      };
    }
  }
  return {
    permitido: true,
    requiereConfirmacion: estado === 'desconocido',
    motivo: estado === 'desconocido'
      ? 'Posible envío previo: revisá el panel de Brevo antes de reintentar.'
      : null
  };
}

// ---------------------------------------------------------------------------
// Fábrica del servicio
// ---------------------------------------------------------------------------
/**
 * @param {object} deps
 * @param {import('pg').Pool} deps.pool
 * @param {{BREVO_API_KEY:string, MAIL_FROM_EMAIL:string, MAIL_FROM_NAME:string, CONTACT_TO_EMAIL:string, APP_ORIGIN?:string}} deps.env
 * @param {typeof fetch} [deps.fetch]  Inyectable para pruebas (doble de Brevo)
 * @param {{info:Function, warn:Function, error:Function}} [deps.logger]
 */
export function crearEmailService({ pool, env, fetch: fetchImpl = globalThis.fetch, logger = console, timeoutMs = CORREO.timeoutMs }) {
  // src/config/env.js (I2) exige estas variables solo en producción. En
  // desarrollo pueden faltar: el servidor arranca y cada envío queda en "error"
  // con CONFIGURACION_FALTANTE, sin llamar al proveedor ni perder la consulta.
  const faltantes = ['BREVO_API_KEY', 'MAIL_FROM_EMAIL', 'MAIL_FROM_NAME', 'CONTACT_TO_EMAIL'].filter((c) => !env?.[c]);
  if (faltantes.length) {
    logger.warn?.(`[correo] Falta configurar ${faltantes.join(', ')}: los envíos quedarán en error hasta completarlas.`);
  }

  /** Llama a Brevo y clasifica el resultado. Nunca lanza. */
  async function llamarBrevo(mensaje) {
    if (faltantes.length) return { estado: 'error', errorCodigo: 'CONFIGURACION_FALTANTE' };
    let respuesta;
    try {
      respuesta = await fetchImpl(CORREO.brevoUrl, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'api-key': env.BREVO_API_KEY
        },
        body: JSON.stringify(mensaje),
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch (err) {
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
        return { estado: 'desconocido', errorCodigo: 'TIMEOUT' };
      }
      const causa = err?.cause?.code ?? err?.code;
      if (causa && RED_SIN_ENVIO.has(causa)) return { estado: 'error', errorCodigo: codigoSeguro(`RED_${causa}`) };
      // Desconexión durante la petición: el proveedor pudo haberlo aceptado.
      return { estado: 'desconocido', errorCodigo: codigoSeguro(`RED_${causa ?? 'DESCONEXION'}`) };
    }

    let cuerpo = null;
    try {
      cuerpo = await respuesta.json();
    } catch {
      cuerpo = null;
    }

    if (respuesta.ok) {
      const messageId = typeof cuerpo?.messageId === 'string' ? cuerpo.messageId : null;
      if (messageId) return { estado: 'aceptado', proveedorId: recortar(messageId, CORREO.proveedorIdMax) };
      // 2xx sin messageId: no se puede afirmar aceptación ni rechazo.
      return { estado: 'desconocido', errorCodigo: `HTTP_${respuesta.status}_SIN_MESSAGE_ID` };
    }
    // Rechazo explícito 4xx/5xx: se guarda solo un código resumido.
    const sufijo = typeof cuerpo?.code === 'string' ? `_${cuerpo.code}` : '';
    return { estado: 'error', errorCodigo: codigoSeguro(`HTTP_${respuesta.status}${sufijo}`) };
  }

  function construirMensaje(fila) {
    const base = {
      sender: { email: env.MAIL_FROM_EMAIL, name: env.MAIL_FROM_NAME },
      subject: fila.asunto,
      textContent: fila.cuerpo
    };
    if (fila.clase === 'notificacion') {
      return {
        ...base,
        to: [{ email: env.CONTACT_TO_EMAIL }],
        replyTo: { email: fila.consulta_email, name: fila.consulta_nombre }
      };
    }
    return {
      ...base,
      to: [{ email: fila.destinatario, name: fila.consulta_nombre }],
      replyTo: { email: env.MAIL_FROM_EMAIL, name: env.MAIL_FROM_NAME }
    };
  }

  /** Llama al proveedor (sin transacción abierta) y guarda el resultado. */
  async function ejecutar(fila) {
    const resultado = await llamarBrevo(construirMensaje(fila));
    try {
      const guardado = await conTransaccion(pool, async (client) => {
        const fin = await repo.guardarResultadoEnvio(client, fila.id, resultado);
        if (fin && fin.estado === 'aceptado' && fin.clase === 'respuesta') {
          await repo.marcarRespondidaSiCorresponde(client, fin.consulta_id);
        }
        return fin;
      });
      logger.info?.(`[correo] envío ${fila.id} (${fila.clase}) → ${resultado.estado}${resultado.errorCodigo ? ` ${resultado.errorCodigo}` : ''}`);
      return guardado ? resultado.estado : 'desconocido';
    } catch (err) {
      // El proveedor respondió pero no pudimos guardar: la fila queda en
      // "enviando" y al vencer el bloqueo se verá como "desconocido".
      logger.error?.(`[correo] envío ${fila.id}: no se pudo guardar el resultado (${err?.code ?? err?.name})`);
      return 'desconocido';
    }
  }

  /**
   * Primer envío, llamado después del commit de la consulta o la respuesta.
   * Devuelve el estado final del envío. No lanza por fallos del proveedor.
   */
  async function enviarPendiente(envioId) {
    let fila;
    try {
      fila = await conTransaccion(pool, async (client) => {
        const f = await repo.obtenerEnvioParaActualizar(client, envioId);
        if (!f || f.estado_guardado !== 'pendiente') return null;
        const { intentos } = await repo.marcarEnviando(client, envioId, CORREO.bloqueoSegundos);
        return { ...f, intentos };
      });
    } catch (err) {
      logger.error?.(`[correo] envío ${envioId}: no se pudo reclamar (${err?.code ?? err?.name})`);
      return 'pendiente';
    }
    if (!fila) {
      const actual = await repo.obtenerEnvio(pool, envioId).catch(() => null);
      return actual?.estado ?? 'pendiente';
    }
    return ejecutar(fila);
  }

  /**
   * Reintento manual del operador/administrador. Lanza ErrorApi 404/409 si no
   * corresponde; devuelve el envío actualizado si se intentó.
   */
  async function reintentar(envioId, { confirmarRiesgo = false } = {}) {
    // Se confirma fuera de la transacción de reclamo para que quede registrado
    // aunque el reintento se rechace después.
    await repo.convertirEnviandoVencido(pool, envioId);
    const fila = await conTransaccion(pool, async (client) => {
      const f = await repo.obtenerEnvioParaActualizar(client, envioId);
      if (!f) throw errores.noEncontrado('No encontramos ese envío.');
      const regla = evaluarReintento(f);
      if (!regla.permitido) {
        throw errores.conflicto(regla.code, regla.motivo, regla.esperaSegundos ? { retryAfter: regla.esperaSegundos } : undefined);
      }
      if (regla.requiereConfirmacion && confirmarRiesgo !== true) {
        throw errores.conflicto(
          'CONFIRMACION_REQUERIDA',
          'Posible envío previo. Revisá el panel de Brevo y confirmá el riesgo de duplicado antes de reintentar.'
        );
      }
      const { intentos } = await repo.marcarEnviando(client, envioId, CORREO.bloqueoSegundos);
      return { ...f, intentos };
    });
    await ejecutar(fila);
    return repo.obtenerEnvio(pool, envioId);
  }

  return { enviarPendiente, reintentar, llamarBrevo, construirMensaje };
}
