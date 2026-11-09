import { Router } from 'express';
import { integrantes } from '../ui-i3/equipo.js';

export const interfazRouter = Router();

const datos = { baseUi: '', integrantes };
interfazRouter.get('/', (req, res) => {
  res.render('i3/inicio', { ...datos, titulo: 'Inicio', rutaActual: req.path });
});

const paginas = {
  equipo: ['El equipo', '01 / LAS PERSONAS', 'Seis especialidades, un espacio compartido.'],
  servicios: ['Lo que podemos construir', '02 / CAPACIDADES', 'Conocé nuestras capacidades y servicios.'],
  proyectos: ['Proyectos con propósito', '03 / PROYECTOS', 'Una selección que crecerá con nuestro aprendizaje.'],
  detalle: ['Portfolio del equipo', 'PROYECTO / EN DESARROLLO', 'Nuestro portfolio colectivo está en desarrollo.'],
};

for (const [vista, [titulo, seccion, descripcion]] of Object.entries(paginas)) {
  interfazRouter.get(`/${vista}`, (req, res) => {
    res.render('i3/pagina', { ...datos, vista, titulo, seccion, descripcion, rutaActual: req.path });
  });
}

interfazRouter.get('/equipo/:codigo', (req, res, next) => {
  const integrante = integrantes.find(item => item.codigo === req.params.codigo);
  if (!integrante) return next();
  res.render('i3/pagina', {
    ...datos, integrante, vista: 'perfil', titulo: integrante.nombre,
    seccion: integrante.codigo, descripcion: integrante.especialidad, rutaActual: '/equipo',
  });
});
