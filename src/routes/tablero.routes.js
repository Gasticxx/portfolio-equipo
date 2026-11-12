import { Router } from 'express';
import { tableroRepository } from '../repositories/tablero.repository.js';
import { requerirAutenticacion } from '../middlewares/auth.js';
import { verificarCsrf } from '../middlewares/csrf.js';
import { AppError } from '../middlewares/errors.js';

export const tableroRouter = Router();

// ID de la demostración "Tablero personal de tareas".
const DEMO_ID = 1;

// Estados permitidos por la tabla app.tareas_demo.
const ESTADOS = ['pendiente', 'progreso', 'completada'];

// Comprueba que un ID sea un entero positivo válido.
function validarId(valor) {
  const id = Number(valor);

  if (!Number.isSafeInteger(id) || id <= 0 || id > 2147483647) {
    throw new AppError(
      400,
      'PARAMETRO_INVALIDO',
      'El identificador de la tarea no es válido.'
    );
  }

  return id;
}

// Comprueba que el título tenga entre 3 y 80 caracteres.
function validarTitulo(titulo) {
  if (
    typeof titulo !== 'string' ||
    titulo.trim().length < 3 ||
    titulo.trim().length > 80
  ) {
    throw new AppError(
      400,
      'TITULO_INVALIDO',
      'El título debe tener entre 3 y 80 caracteres.'
    );
  }

  return titulo.trim();
}

// Comprueba que el estado sea uno de los permitidos.
function validarEstado(estado) {
  if (!ESTADOS.includes(estado)) {
    throw new AppError(
      400,
      'ESTADO_INVALIDO',
      'El estado de la tarea no es válido.'
    );
  }

  return estado;
}

// Todas las rutas del tablero requieren iniciar sesión.
tableroRouter.use('/api/tablero', requerirAutenticacion);

// GET: listar las tareas del usuario autenticado.
tableroRouter.get('/api/tablero/tareas', async (req, res, next) => {
  try {
    const tareas = await tableroRepository.listar(
      DEMO_ID,
      req.user.id
    );

    return res.status(200).json({
      ok: true,
      data: tareas
    });
  } catch (error) {
    return next(error);
  }
});


 // POST: crear una tarea nueva.
tableroRouter.post(
  '/api/tablero/tareas',
  verificarCsrf,
  async (req, res, next) => {
    try {
      const titulo = validarTitulo(req.body?.titulo);

      const tareas = await tableroRepository.listar(
        DEMO_ID,
        req.user.id
      );

      if (tareas.length >= 50) {
        throw new AppError(
          409,
          'LIMITE_TAREAS',
          'Alcanzaste el límite de 50 tareas.'
        );
      }

      const tarea = await tableroRepository.crear(
        DEMO_ID,
        req.user.id,
        titulo
      );

      if (!tarea) {
        throw new AppError(
          409,
          'LIMITE_TAREAS',
          'Alcanzaste el límite de 50 tareas.'
        );
      }

      return res.status(201).json({
        ok: true,
        data: tarea
      });
    } catch (error) {
      return next(error);
    }
  }
);


 // PATCH: cambiar el estado de una tarea.
tableroRouter.patch(
  '/api/tablero/tareas/:id',
  verificarCsrf,
  async (req, res, next) => {
    try {
      const tareaId = validarId(req.params.id);
      const nuevoEstado = validarEstado(req.body?.estado);

      const tarea = await tableroRepository.cambiar(
        DEMO_ID,
        req.user.id,
        tareaId,
        nuevoEstado
      );

      if (!tarea) {
        throw new AppError(
          404,
          'TAREA_NO_ENCONTRADA',
          'La tarea solicitada no existe.'
        );
      }

      return res.status(200).json({
        ok: true,
        data: tarea
      });
    } catch (error) {
      return next(error);
    }
  }
);


 // DELETE: eliminar una tarea.
tableroRouter.delete(
  '/api/tablero/tareas/:id',
  verificarCsrf,
  async (req, res, next) => {
    try {
      const tareaId = validarId(req.params.id);

      const eliminada = await tableroRepository.eliminar(
        DEMO_ID,
        req.user.id,
        tareaId
      );

      if (!eliminada) {
        throw new AppError(
          404,
          'TAREA_NO_ENCONTRADA',
          'La tarea solicitada no existe.'
        );
      }

      return res.status(200).json({
        ok: true,
        data: {
          mensaje: 'Tarea eliminada correctamente.'
        }
      });
    } catch (error) {
      return next(error);
    }
  }
);


 // GET: mostrar la página del tablero personal.
tableroRouter.get(
  '/tablero',
  requerirAutenticacion,
  (req, res) => {
    return res.render('i3/demo', {
      titulo: 'Tablero personal de tareas',
      vista: 'tablero',
      rutaActual: '/tablero',
      recursoJs: '/js/tablero.js',
      regresoProyecto: '/proyectos/portfolio-equipo'
    });
  }
);
