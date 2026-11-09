// Formulario público de contacto (I6). Apartado 14.
// - Validación en el navegador con las mismas reglas que el servidor.
// - Idempotency-Key: un UUID por intento; se conserva al repetir por error de
//   red con los mismos datos y se renueva cuando el usuario edita un campo.
import { pedir, obtenerCsrf, ErrorHttp, ErrorRed, mensajeDeError, largoUnicode, normalizarTexto, mostrarAlerta } from './consultas-http.js';

const form = document.getElementById('form-contacto');
const estado = document.getElementById('contacto-estado');
const boton = document.getElementById('btn-enviar');
const tipo = document.getElementById('tipo');
const servicio = document.getElementById('servicioId');
const grupoServicio = document.getElementById('grupo-servicio');
const mensaje = document.getElementById('mensaje');
const contador = document.getElementById('contador-mensaje');

const LIM = Object.fromEntries(
  Object.entries(form.dataset).map(([k, v]) => [k, Number(v)])
); // minNombre, maxNombre, maxEmail, minAsunto, ...

const CAMPOS = ['nombre', 'email', 'tipo', 'servicioId', 'asunto', 'mensaje', 'consentimiento'];
const TIPOS = ['general', 'cotizacion', 'asesoria'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let claveIdempotencia = null;
let enviando = false;

// ---------------------------------------------------------------- Estado UI
const mostrarEstado = (tipo, texto, enfocar = false) => mostrarAlerta(estado, tipo, texto, { enfocar });

function limpiarErrores() {
  for (const campo of CAMPOS) {
    const input = form.elements[campo];
    input?.removeAttribute('aria-invalid');
    const error = document.getElementById(`${campo}-error`);
    if (error) error.textContent = '';
  }
}

function marcarErrores(fields) {
  let primero = null;
  for (const [campo, texto] of Object.entries(fields)) {
    const input = form.elements[campo];
    const error = document.getElementById(`${campo}-error`);
    if (!input || !error) continue;
    input.setAttribute('aria-invalid', 'true');
    error.textContent = texto;
    if (campo === 'servicioId') grupoServicio.hidden = false;
    primero ??= input;
  }
  // Campos que el servidor rechazó y no existen en el formulario
  const ajenos = Object.keys(fields).filter((c) => !form.elements[c]);
  if (ajenos.length) mostrarEstado('error', 'El formulario envió datos no admitidos. Recargá la página.');
  primero?.focus();
  return Boolean(primero);
}

function sincronizarServicio() {
  const esCotizacion = tipo.value === 'cotizacion';
  grupoServicio.hidden = !esCotizacion;
  if (!esCotizacion) servicio.value = ''; // se limpia servicioId si deja de ser cotización
}

function actualizarContador() {
  contador.textContent = `${largoUnicode(normalizarTexto(mensaje.value))} / ${LIM.maxMensaje}`;
}

// --------------------------------------------------------------- Validación
function leerDatos() {
  return {
    nombre: normalizarTexto(form.elements.nombre.value),
    email: normalizarTexto(form.elements.email.value).toLowerCase(),
    tipo: tipo.value,
    asunto: normalizarTexto(form.elements.asunto.value),
    mensaje: normalizarTexto(mensaje.value),
    consentimiento: form.elements.consentimiento.checked,
    servicioId: tipo.value === 'cotizacion' && servicio.value ? Number(servicio.value) : null
  };
}

function rango(valor, min, max, unaLinea = false) {
  const n = largoUnicode(valor);
  if (n === 0) return 'Este campo es obligatorio.';
  if (unaLinea && valor.includes('\n')) return 'Debe escribirse en una sola línea.';
  if (n < min) return `Debe tener al menos ${min} caracteres.`;
  if (n > max) return `Debe tener como máximo ${max} caracteres.`;
  return null;
}

function validar(d) {
  const f = {};
  const nombre = rango(d.nombre, LIM.minNombre, LIM.maxNombre, true);
  if (nombre) f.nombre = nombre;
  if (!EMAIL_RE.test(d.email) || largoUnicode(d.email) > LIM.maxEmail) f.email = 'Ingresá un email válido.';
  if (!TIPOS.includes(d.tipo)) f.tipo = 'Elegí general, cotización o asesoría.';
  const asunto = rango(d.asunto, LIM.minAsunto, LIM.maxAsunto, true);
  if (asunto) f.asunto = asunto;
  const msj = rango(d.mensaje, LIM.minMensaje, LIM.maxMensaje);
  if (msj) f.mensaje = msj;
  if (d.consentimiento !== true) f.consentimiento = 'Necesitamos tu consentimiento para responder la consulta.';
  if (d.servicioId !== null && !(Number.isInteger(d.servicioId) && d.servicioId > 0)) f.servicioId = 'Elegí un servicio de la lista.';
  return f;
}

// ------------------------------------------------------------------- Envío
async function enviar(evento) {
  evento.preventDefault();
  if (enviando) return;
  limpiarErrores();

  const datos = leerDatos();
  const errores = validar(datos);
  if (Object.keys(errores).length) {
    marcarErrores(errores);
    mostrarEstado('error', 'Revisá los campos indicados.');
    return;
  }

  claveIdempotencia ??= crypto.randomUUID();
  enviando = true;
  boton.disabled = true;
  boton.textContent = 'Enviando…';
  mostrarEstado('aviso', 'Enviando tu consulta…');

  try {
    const { data } = await pedir('/api/consultas', { method: 'POST', body: datos, idempotencyKey: claveIdempotencia });
    const texto =
      data.notificacionEstado === 'aceptado'
        ? 'Consulta registrada; notificación aceptada por el proveedor.'
        : 'Consulta registrada; el aviso por email quedó pendiente de revisión.';
    // La consulta quedó guardada en ambos casos; si el aviso por email no fue
    // aceptado se muestra como advertencia, nunca como éxito de envío.
    mostrarEstado(data.notificacionEstado === 'aceptado' ? 'exito' : 'aviso', `${texto} Número de consulta: ${data.id}.`, true);
    form.reset();
    sincronizarServicio();
    actualizarContador();
    claveIdempotencia = null; // el próximo envío es una consulta nueva
  } catch (err) {
    if (err instanceof ErrorRed) {
      // Mismos datos + misma clave: reintentar no duplica la consulta.
      mostrarEstado(
        'aviso',
        'No pudimos confirmar el envío por un problema de conexión. Podés volver a presionar Enviar sin cambiar los datos: no se duplicará la consulta.'
      );
    } else if (err instanceof ErrorHttp && err.status === 422 && err.fields) {
      marcarErrores(err.fields);
      mostrarEstado('error', 'Revisá los campos indicados.');
    } else if (err instanceof ErrorHttp && err.code === 'CSRF_INVALIDO') {
      await obtenerCsrf({ renovar: true }).catch(() => {});
      mostrarEstado('aviso', mensajeDeError(err));
    } else {
      mostrarEstado(err instanceof ErrorHttp && err.status === 409 ? 'aviso' : 'error', mensajeDeError(err));
    }
  } finally {
    enviando = false;
    boton.disabled = false;
    boton.textContent = 'Enviar consulta';
  }
}

// ----------------------------------------------------------------- Eventos
form.addEventListener('submit', enviar);
// Editar cualquier campo inicia un nuevo intento (nueva clave).
form.addEventListener('input', () => {
  claveIdempotencia = null;
});
form.addEventListener('change', () => {
  claveIdempotencia = null;
});
tipo.addEventListener('change', sincronizarServicio);
mensaje.addEventListener('input', actualizarContador);

sincronizarServicio();
actualizarContador();
// Prepara la sesión anónima y el token CSRF antes del primer envío.
obtenerCsrf().catch(() => mostrarEstado('aviso', 'No se pudo preparar el formulario. Recargá la página antes de enviar.'));
