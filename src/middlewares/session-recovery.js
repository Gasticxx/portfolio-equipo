import { esErrorDeBaseInaccesible } from '../services/consultas.errores.js';
import { AppError } from './errors.js';

const PAGINAS_PUBLICAS = new Set([
  '/', '/equipo', '/servicios', '/proyectos', '/detalle', '/login', '/registro', '/contacto',
]);

// Se monta exclusivamente después de cargar la sesión y verificar al usuario.
export function recuperarNavegacionPublica(err, req, res, next) {
  if (!esErrorDeBaseInaccesible(err)) return next(err);

  // No reutilizar datos de una sesión que no pudimos verificar ni persistir cambios.
  // Conservamos la cookie en el navegador para recuperar la sesión al volver la base.
  req.session = null;
  req.sessionID = null;
  req.user = null;
  res.locals.usuarioActual = null;
  res.set('Cache-Control', 'no-store');

  const ruta = req.path.replace(/\/$/, '') || '/';
  if (['GET', 'HEAD'].includes(req.method)
      && (PAGINAS_PUBLICAS.has(ruta) || /^\/equipo\/I[1-6]$/.test(ruta))) {
    return next();
  }

  const error = new AppError(503, 'SERVICIO_NO_DISPONIBLE', 'El servicio no está disponible temporalmente.');
  error.retryAfter = 30;
  return next(error);
}
