import { Router } from 'express';
import { obtenerIntegrantes } from '../ui-i3/equipo.js';
import { pool } from '../config/db.js';
import { esErrorDeBaseInaccesible } from '../services/consultas.errores.js';
import { proyectosRepository } from '../repositories/proyectos.repository.js';

export const interfazRouter = Router();

// Leer las fichas al renderizar evita conservar nombres anteriores en memoria.
const datos = { baseUi: '', get integrantes() { return obtenerIntegrantes(); } };
interfazRouter.get('/', async (req, res) => {
  let proyectos = [], contenidoDisponible = true;
  try { proyectos = (await proyectosRepository.listarPublicos()).slice(0, 1); }
  catch (error) { if (!esErrorDeBaseInaccesible(error)) throw error; contenidoDisponible = false; }
  res.render('i3/inicio', { ...datos, titulo: 'Inicio', rutaActual: req.path, proyectos, contenidoDisponible });
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

interfazRouter.get('/equipo/:codigo', async (req, res, next) => {
  const integrante = datos.integrantes.find(item => item.codigo === req.params.codigo);
  if (!integrante) return next();
  let aportes = [], aportesDisponibles = true;
  try {
    const resultado = await pool.query(`SELECT a.titulo,p.slug AS "proyectoSlug",p.titulo AS "proyectoTitulo",
      COALESCE((SELECT json_agg(t.nombre ORDER BY t.nombre) FROM app.aporte_tecnologia at JOIN app.tecnologias t ON t.id=at.tecnologia_id WHERE at.aporte_id=a.id),'[]'::json) AS tecnologias
      FROM app.aportes a JOIN app.miembros m ON m.id=a.miembro_id JOIN app.proyectos p ON p.id=a.proyecto_id
      WHERE m.orden=$1 AND a.estado='comprobado' AND p.publicado=true ORDER BY p.titulo,a.titulo`, [Number(integrante.codigo.slice(1))]);
    aportes = resultado.rows;
  } catch (error) { if (!esErrorDeBaseInaccesible(error)) throw error; aportesDisponibles = false; }
  res.render('i3/pagina', {
    ...datos, integrante, vista: 'perfil', titulo: integrante.nombre,
    seccion: integrante.codigo, descripcion: integrante.especialidad, rutaActual: '/equipo', aportes, aportesDisponibles,
  });
});
