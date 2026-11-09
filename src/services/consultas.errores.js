// Error de negocio del módulo de consultas. El manejador de errores del módulo
// (o el global de I2, si reconoce status/code/fields) lo traduce al contrato:
// {"ok":false,"error":{"code","message","fields?","requestId"}}

export class ErrorApi extends Error {
  /**
   * @param {number} status   Estado HTTP
   * @param {string} code     Código estable del apartado 11 o específico del módulo
   * @param {string} message  Texto visible en español
   * @param {object} [extra]  { fields, retryAfter }
   */
  constructor(status, code, message, extra = {}) {
    super(message);
    this.name = 'ErrorApi';
    this.status = status;
    this.code = code;
    if (extra.fields) this.fields = extra.fields;
    if (extra.retryAfter !== undefined) this.retryAfter = extra.retryAfter;
    this.expose = true;
  }
}

export const errores = {
  parametro: (message = 'Parámetro inválido.', fields) =>
    new ErrorApi(400, 'PARAMETRO_INVALIDO', message, { fields }),
  validacion: (fields, message = 'Revisá los campos indicados.') =>
    new ErrorApi(422, 'VALIDACION', message, { fields }),
  noEncontrado: (message = 'No encontramos el recurso solicitado.') =>
    new ErrorApi(404, 'NO_ENCONTRADO', message),
  conflicto: (code, message, extra) => new ErrorApi(409, code, message, extra),
  noDisponible: () =>
    new ErrorApi(503, 'SERVICIO_NO_DISPONIBLE', 'El servicio no está disponible. No se confirmó ningún guardado; intentá de nuevo en unos minutos.')
};

// Errores de PostgreSQL / red que indican base inaccesible (→ 503).
const CODIGOS_RED = new Set(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE']);

export function esErrorDeBaseInaccesible(err) {
  if (!err) return false;
  const code = String(err.code ?? '');
  if (CODIGOS_RED.has(code)) return true;
  // Clase 08 (conexión), 57P (operador/apagado), 53 (recursos insuficientes)
  if (/^(08|57P|53)/.test(code)) return true;
  const msg = String(err.message ?? '');
  return /Connection terminated|timeout exceeded when trying to connect|Client has encountered a connection error/i.test(msg);
}
