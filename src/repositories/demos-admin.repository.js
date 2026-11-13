import { pool } from '../config/db.js';
import { AppError } from '../middlewares/errors.js';
import { tiposDemo } from '../validators/demos-admin.validator.js';

const columnas = `d.id,d.proyecto_id AS "proyectoId",d.titulo,d.descripcion,d.tipo,d.publicada,d.orden,
  d.created_at AS "createdAt",d.updated_at AS "updatedAt",p.titulo AS "proyectoTitulo",p.publicado AS "proyectoPublicado",
  (SELECT count(*)::int FROM app.tareas_demo t WHERE t.demo_id=d.id) AS "tareasGuardadas"`;
export function crearDemosAdminRepository(db = pool) {
  return {
    async catalogos() {
      const [proyectos, restriccion, resumen] = await Promise.all([
        db.query('SELECT id,titulo,publicado FROM app.proyectos ORDER BY titulo,id'),
        db.query("SELECT pg_get_constraintdef(oid) AS regla FROM pg_constraint WHERE conname='demos_tipo_ck' AND connamespace='app'::regnamespace"),
        db.query(`SELECT count(*)::int AS total,count(*) FILTER(WHERE d.publicada AND p.publicado)::int AS publicadas,
          count(*) FILTER(WHERE NOT d.publicada)::int AS borradores FROM app.demos d JOIN app.proyectos p ON p.id=d.proyecto_id`),
      ]);
      return { proyectos: proyectos.rows, tipos: tiposDemo.filter(tipo => restriccion.rows[0]?.regla.includes(`'${tipo}'`)), resumen: resumen.rows[0] };
    },
    async listar({ page, pageSize, q, proyectoId, tipo, publicada }) {
      const args = [], filtros = [];
      if (q) { args.push(`%${q.replace(/[\\%_]/g, '\\$&')}%`); filtros.push(`d.titulo ILIKE $${args.length}`); }
      for (const [columna, value] of [['d.proyecto_id', proyectoId], ['d.tipo', tipo], ['d.publicada', publicada]]) {
        if (value !== undefined) { args.push(value); filtros.push(`${columna}=$${args.length}`); }
      }
      const { rows } = await db.query(`WITH filtradas AS (SELECT ${columnas} FROM app.demos d JOIN app.proyectos p ON p.id=d.proyecto_id ${filtros.length ? `WHERE ${filtros.join(' AND ')}` : ''}),
        pagina AS (SELECT * FROM filtradas ORDER BY "proyectoTitulo",orden,id LIMIT $${args.length + 1} OFFSET $${args.length + 2})
        SELECT (SELECT count(*)::int FROM filtradas) AS total,COALESCE((SELECT json_agg(pagina ORDER BY "proyectoTitulo",orden,id) FROM pagina),'[]'::json) AS data`,
      [...args, pageSize, (page - 1) * pageSize]);
      const total = rows[0].total;
      return { data: rows[0].data, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
    },
    async obtener(id, client = db) {
      return (await client.query(`SELECT ${columnas} FROM app.demos d JOIN app.proyectos p ON p.id=d.proyecto_id WHERE d.id=$1`, [id])).rows[0] || null;
    },
    async guardar(id, data) {
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        let original = null;
        if (id) {
          original = (await client.query('SELECT proyecto_id,tipo,publicada FROM app.demos WHERE id=$1 FOR UPDATE', [id])).rows[0];
          if (!original) throw new AppError(404, 'NO_ENCONTRADO', 'La demo ya no existe. Recargá el listado.');
          if (original.proyecto_id !== data.proyectoId || original.tipo !== data.tipo) {
            const tareas = await client.query('SELECT EXISTS(SELECT 1 FROM app.tareas_demo WHERE demo_id=$1) AS tiene', [id]);
            if (tareas.rows[0].tiene) throw new AppError(409, 'DEMO_CON_DATOS', 'Esta demo tiene tareas guardadas. Conservá su proyecto y tipo; podés editar el título, la descripción, el orden y la publicación.');
          }
        }
        const proyecto = (await client.query('SELECT id,publicado FROM app.proyectos WHERE id=$1 FOR SHARE', [data.proyectoId])).rows[0];
        if (!proyecto) throw new AppError(422, 'PROYECTO_INVALIDO', 'Seleccioná un proyecto existente.', { proyectoId: 'El proyecto ya no existe.' });
        if (data.publicada && !proyecto.publicado && (!original?.publicada || original.proyecto_id !== data.proyectoId)) throw new AppError(422, 'PROYECTO_NO_PUBLICADO', 'Publicá primero el proyecto para poder publicar su demo.', { publicada: 'El proyecto seleccionado es un borrador.' });
        const args = [data.proyectoId, data.titulo, data.descripcion, data.tipo, data.publicada, data.orden];
        const result = id
          ? await client.query('UPDATE app.demos SET proyecto_id=$1,titulo=$2,descripcion=$3,tipo=$4,publicada=$5,orden=$6,updated_at=now() WHERE id=$7 RETURNING id', [...args, id])
          : await client.query('INSERT INTO app.demos(proyecto_id,titulo,descripcion,tipo,publicada,orden) VALUES($1,$2,$3,$4,$5,$6) RETURNING id', args);
        const guardado = await this.obtener(result.rows[0].id, client);
        await client.query('COMMIT');
        return guardado;
      } catch (error) {
        await client.query('ROLLBACK');
        if (error.code === '23505') throw new AppError(409, 'DEMO_DUPLICADA', 'Ese proyecto ya tiene una demo de ese tipo. Editá la existente o elegí otro proyecto o tipo.');
        if (error.code === '23503') throw new AppError(422, 'PROYECTO_INVALIDO', 'El proyecto cambió o ya no existe.');
        if (error.code === '23514') throw new AppError(422, 'TIPO_NO_DISPONIBLE', 'Este tipo de demo todavía no está habilitado en la base de datos.', { tipo: 'Elegí un tipo disponible.' });
        throw error;
      } finally { client.release(); }
    },
  };
}
