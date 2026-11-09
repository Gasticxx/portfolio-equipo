// Cliente HTTP compartido por contacto.js, operador.js y metricas.js (I6).
// fetch same-origin, Accept JSON, token CSRF desde /api/csrf (apartado 12).
// Si I3/I4 publican un cliente común, este módulo puede reexportarlo.

let tokenCsrf = null;

export async function obtenerCsrf({ renovar = false } = {}) {
  if (tokenCsrf && !renovar) return tokenCsrf;
  const r = await fetch('/api/csrf', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
  if (!r.ok) throw new ErrorHttp(r.status, { code: 'CSRF_NO_DISPONIBLE', message: 'No se pudo preparar el formulario. Recargá la página.' });
  const cuerpo = await r.json();
  tokenCsrf = cuerpo.data.csrfToken;
  return tokenCsrf;
}

export class ErrorHttp extends Error {
  constructor(status, error = {}, retryAfter = null) {
    super(error.message ?? `Error ${status}`);
    this.status = status;
    this.code = error.code ?? 'ERROR';
    this.fields = error.fields ?? null;
    this.requestId = error.requestId ?? null;
    this.retryAfter = retryAfter;
  }
}

/** Fallo de red: no sabemos si el servidor procesó la petición. */
export class ErrorRed extends Error {
  constructor(causa) {
    super('No se pudo confirmar la comunicación con el servidor.');
    this.causa = causa;
  }
}

/**
 * @param {string} url
 * @param {{method?:string, body?:object, idempotencyKey?:string, signal?:AbortSignal}} [opciones]
 * @returns {Promise<{status:number, data:any, meta?:object}>}
 */
export async function pedir(url, { method = 'GET', body, idempotencyKey, signal } = {}) {
  const headers = { Accept: 'application/json' };
  if (method !== 'GET') {
    headers['Content-Type'] = 'application/json';
    headers['X-CSRF-Token'] = await obtenerCsrf();
  }
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  let r;
  try {
    r = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new ErrorRed(err);
  }

  if (r.status === 204) return { status: 204, data: null };

  let cuerpo = null;
  try {
    cuerpo = await r.json();
  } catch {
    cuerpo = null;
  }
  if (!r.ok || !cuerpo?.ok) {
    if (r.status === 403 && cuerpo?.error?.code === 'CSRF_INVALIDO') tokenCsrf = null; // se pedirá uno nuevo
    throw new ErrorHttp(r.status, cuerpo?.error ?? {}, r.headers.get('Retry-After'));
  }
  return { status: r.status, data: cuerpo.data, meta: cuerpo.meta };
}

/** Mensaje legible para errores generales (no de campo). */
export function mensajeDeError(err) {
  if (err instanceof ErrorRed) return err.message;
  if (!(err instanceof ErrorHttp)) return 'Ocurrió un error inesperado.';
  switch (err.code) {
    case 'CSRF_INVALIDO':
      return 'Tu sesión de seguridad se renovó. Revisá los datos y volvé a enviar.';
    case 'NO_AUTENTICADO':
      return 'Tu sesión terminó. Iniciá sesión nuevamente.';
    case 'SIN_PERMISO':
      return 'No tenés permiso para esta acción.';
    case 'LIMITE_EXCEDIDO':
      return `Hiciste demasiados intentos. Probá de nuevo en ${err.retryAfter ?? 'unos'} segundos.`;
    case 'SERVICIO_NO_DISPONIBLE':
      return 'El servicio no está disponible y no se guardó nada. Intentá de nuevo en unos minutos.';
    case 'ERROR_INTERNO':
      return `Ocurrió un error inesperado (código ${err.requestId ?? 'sin código'}).`;
    default:
      return err.message;
  }
}

/** Crea un nodo con texto plano (nunca innerHTML con datos del usuario). */
export function el(etiqueta, { clase, texto, atributos } = {}, hijos = []) {
  const nodo = document.createElement(etiqueta);
  if (clase) nodo.className = clase;
  if (texto !== undefined && texto !== null) nodo.textContent = String(texto);
  if (atributos) for (const [k, v] of Object.entries(atributos)) if (v !== undefined && v !== null) nodo.setAttribute(k, v);
  for (const h of hijos) if (h) nodo.append(h);
  return nodo;
}

const formatoFecha = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Argentina/Buenos_Aires'
});
export const fechaLegible = (iso) => (iso ? formatoFecha.format(new Date(iso)) : '—');

export function largoUnicode(texto) {
  return Array.from(texto).length;
}

export function normalizarTexto(texto) {
  return texto.normalize('NFC').replace(/\r\n?/g, '\n').trim();
}

// Alertas con los componentes de I3: alerta-exito, alerta-error, alerta-aviso.
const TIPOS_ALERTA = { exito: 'exito', error: 'error', aviso: 'aviso', info: 'aviso' };
export function mostrarAlerta(nodo, tipo, texto, { enfocar = false } = {}) {
  if (!texto) {
    nodo.hidden = true;
    nodo.textContent = '';
    return;
  }
  nodo.hidden = false;
  nodo.className = `alerta alerta-${TIPOS_ALERTA[tipo] ?? 'aviso'}`;
  nodo.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
  nodo.textContent = texto;
  if (enfocar) nodo.focus?.();
}
