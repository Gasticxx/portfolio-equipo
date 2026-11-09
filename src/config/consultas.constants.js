// Constantes del módulo de consultas, correo y gráficos (I6).
// Valores tomados de la especificación (apartados 11, 14 y 14.1).
// Propuesta: I2 puede mover este bloque a src/config/constants.js y reexportarlo
// desde aquí para no romper los imports del módulo.

export const TIPOS_CONSULTA = Object.freeze(['general', 'cotizacion', 'asesoria']);

export const ESTADOS_CONSULTA = Object.freeze(['nueva', 'en_proceso', 'respondida', 'cerrada']);

export const ESTADOS_ENVIO = Object.freeze(['pendiente', 'enviando', 'aceptado', 'error', 'desconocido']);

// Transiciones manuales permitidas por PATCH /api/operador/consultas/:id.
// "respondida" nunca se marca a mano: solo cuando Brevo acepta una respuesta.
export const TRANSICIONES_MANUALES = Object.freeze({
  nueva: Object.freeze(['en_proceso']),
  en_proceso: Object.freeze([]),
  respondida: Object.freeze(['en_proceso', 'cerrada']),
  cerrada: Object.freeze(['en_proceso'])
});

export const LIMITES_CONSULTA = Object.freeze({
  nombre: { min: 2, max: 80 },
  email: { max: 254 },
  asunto: { min: 5, max: 120 },
  mensaje: { min: 20, max: 3000 }
});

export const LIMITES_RESPUESTA = Object.freeze({ mensaje: { min: 10, max: 3000 } });

export const PAGINACION = Object.freeze({
  pageMax: 100000,
  pageSizeMax: 50,
  pageSizeDefault: 10,
  qMin: 2,
  qMax: 80
});

export const ID_MAXIMO = 2147483647;

export const CORREO = Object.freeze({
  brevoUrl: 'https://api.brevo.com/v3/smtp/email',
  timeoutMs: 10000,
  bloqueoSegundos: 30,
  intentosMaximos: 3,
  esperaReintentoSegundos: 60,
  asuntoMax: 160,
  cuerpoMax: 6000,
  errorCodigoMax: 60,
  proveedorIdMax: 300,
  prefijoAsunto: '[Equipo Seis]'
});

export const TEXTO_CONSENTIMIENTO = 'Acepto que el equipo use estos datos para responder esta consulta.';

// Textos visibles (español con ortografía normal) para vistas y JS de cliente.
export const ETIQUETAS = Object.freeze({
  tipo: { general: 'General', cotizacion: 'Cotización', asesoria: 'Asesoría' },
  estadoConsulta: { nueva: 'Nueva', en_proceso: 'En proceso', respondida: 'Respondida', cerrada: 'Cerrada' },
  estadoEnvio: {
    pendiente: 'Pendiente',
    enviando: 'Enviando',
    aceptado: 'Aceptado por el proveedor',
    error: 'Error del proveedor',
    desconocido: 'Desconocido (posible envío previo)'
  },
  clase: { notificacion: 'Notificación al equipo', respuesta: 'Respuesta al contacto' },
  accionEstado: { en_proceso: 'Marcar en proceso', cerrada: 'Cerrar consulta' }
});
