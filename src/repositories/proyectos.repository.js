import { pool } from '../config/db.js';
import { AppError } from '../middlewares/errors.js';

const columnas = `p.id,p.slug,p.titulo,p.resumen,p.descripcion,p.estado,p.publicado,
  p.portada_id AS "portadaId",p.repositorio_url AS "repositorioUrl",
  p.created_at AS "createdAt",p.updated_at AS "updatedAt"`;
export const proyectosRepository = {
  async listarPublicos(db = pool) {
    const { rows } = await db.query(`SELECT p.id,p.slug,p.titulo,p.resumen,p.estado,p.portada_id AS "portadaId",
      COALESCE((SELECT json_agg(t.nombre ORDER BY t.nombre) FROM app.proyecto_tecnologia pt JOIN app.tecnologias t ON t.id=pt.tecnologia_id WHERE pt.proyecto_id=p.id),'[]'::json) AS tecnologias
      FROM app.proyectos p WHERE p.publicado=true
      ORDER BY (p.slug='portfolio-equipo') DESC,p.created_at DESC,p.id DESC`);
    return rows;
  },
  async listar({ page = 1, pageSize = 10, q, publicado } = {}, db = pool) {
    const valores = [], condiciones = [];
    if (q) { valores.push(`%${q.replace(/[\\%_]/g, '\\$&')}%`); condiciones.push(`p.titulo ILIKE $${valores.length}`); }
    if (publicado !== undefined) { valores.push(publicado); condiciones.push(`p.publicado=$${valores.length}`); }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    // La cuenta y la página provienen del mismo snapshot, incluso si la página queda vacía.
    const { rows } = await db.query(`WITH filtrados AS (SELECT ${columnas} FROM app.proyectos p ${where}),
      pagina AS (SELECT * FROM filtrados ORDER BY "createdAt" DESC,id DESC LIMIT $${valores.length + 1} OFFSET $${valores.length + 2})
      SELECT (SELECT count(*)::int FROM filtrados) AS total,
      COALESCE((SELECT json_agg(pagina ORDER BY "createdAt" DESC,id DESC) FROM pagina),'[]'::json) AS data`,
    [...valores, pageSize, (page - 1) * pageSize]);
    const total = rows[0].total;
    return { data: rows[0].data, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  },
  async obtener(id, db = pool) {
    // Un solo SELECT conserva un snapshot coherente del proyecto y sus relaciones.
    const { rows } = await db.query(`SELECT ${columnas},
      COALESCE((SELECT json_agg(pt.tecnologia_id ORDER BY pt.tecnologia_id) FROM app.proyecto_tecnologia pt WHERE pt.proyecto_id=p.id),'[]'::json) AS "tecnologiaIds",
      COALESCE((SELECT json_agg(json_build_object('miembroId',a.miembro_id,'titulo',a.titulo,'descripcion',a.descripcion,'estado',a.estado,'evidenciaUrl',a.evidencia_url,
        'tecnologiaIds',COALESCE((SELECT json_agg(at.tecnologia_id ORDER BY at.tecnologia_id) FROM app.aporte_tecnologia at WHERE at.aporte_id=a.id),'[]'::json)) ORDER BY a.id)
        FROM app.aportes a WHERE a.proyecto_id=p.id),'[]'::json) AS aportes,
      COALESCE((SELECT json_agg(json_build_object('id',d.id,'titulo',d.titulo) ORDER BY d.orden,d.id) FROM app.demos d WHERE d.proyecto_id=p.id),'[]'::json) AS demos
      FROM app.proyectos p WHERE p.id=$1`, [id]);
    return rows[0] || null;
  },
  async guardar(id, data) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (id && !(await client.query('SELECT id FROM app.proyectos WHERE id=$1 FOR UPDATE', [id])).rows.length) throw new AppError(404, 'NO_ENCONTRADO', 'El proyecto ya no existe.');
      const tecnologias = [...new Set([...data.tecnologiaIds, ...data.aportes.flatMap(a => a.tecnologiaIds)])];
      const miembros = [...new Set(data.aportes.map(a => a.miembroId))];
      const techs = await client.query('SELECT id FROM app.tecnologias WHERE id=ANY($1::int[]) FOR KEY SHARE', [tecnologias]);
      const members = await client.query('SELECT id FROM app.miembros WHERE id=ANY($1::int[]) FOR KEY SHARE', [miembros]);
      const fields = {};
      if (techs.rows.length !== tecnologias.length) fields.tecnologiaIds = 'Hay tecnologías que ya no existen en el catálogo.';
      if (members.rows.length !== miembros.length) fields.aportes = 'Seleccioná integrantes existentes.';
      if (data.portadaId && !(await client.query('SELECT id FROM app.archivos WHERE id=$1 FOR KEY SHARE', [data.portadaId])).rows.length) fields.portadaId = 'La portada ya no existe.';
      if (Object.keys(fields).length) throw new AppError(422, 'VALIDACION', 'Revisá las relaciones del proyecto.', fields);
      const valores = [data.slug, data.titulo, data.resumen, data.descripcion, data.estado, data.publicado, data.portadaId, data.repositorioUrl];
      const result = id
        ? await client.query(`UPDATE app.proyectos SET slug=$1,titulo=$2,resumen=$3,descripcion=$4,estado=$5,publicado=$6,portada_id=$7,repositorio_url=$8,updated_at=now() WHERE id=$9 RETURNING id`, [...valores, id])
        : await client.query(`INSERT INTO app.proyectos(slug,titulo,resumen,descripcion,estado,publicado,portada_id,repositorio_url) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`, valores);
      const proyectoId = result.rows[0].id;
      await client.query('DELETE FROM app.proyecto_tecnologia WHERE proyecto_id=$1', [proyectoId]);
      await client.query('DELETE FROM app.aportes WHERE proyecto_id=$1', [proyectoId]);
      await client.query('INSERT INTO app.proyecto_tecnologia(proyecto_id,tecnologia_id) SELECT $1,unnest($2::int[])', [proyectoId, data.tecnologiaIds]);
      for (const aporte of data.aportes) {
        const { rows } = await client.query(`INSERT INTO app.aportes(proyecto_id,miembro_id,titulo,descripcion,estado,evidencia_url) VALUES($1,$2,$3,$4,$5,$6) RETURNING id`, [proyectoId, aporte.miembroId, aporte.titulo, aporte.descripcion, aporte.estado, aporte.evidenciaUrl]);
        await client.query('INSERT INTO app.aporte_tecnologia(aporte_id,tecnologia_id) SELECT $1,unnest($2::int[])', [rows[0].id, aporte.tecnologiaIds]);
      }
      const guardado = await this.obtener(proyectoId, client);
      await client.query('COMMIT');
      return guardado;
    } catch (error) {
      await client.query('ROLLBACK');
      if (error.code === '23505') throw new AppError(409, 'SLUG_DUPLICADO', 'Ya existe un proyecto con ese slug.', { slug: 'Elegí otro slug.' });
      if (error.code === '23503') throw new AppError(422, 'VALIDACION', 'Una relación cambió. Recargá los catálogos e intentá nuevamente.');
      throw error;
    } finally { client.release(); }
  },
  async eliminar(id) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (!(await client.query('SELECT id FROM app.proyectos WHERE id=$1 FOR UPDATE', [id])).rows.length) throw new AppError(404, 'NO_ENCONTRADO', 'El proyecto ya no existe.');
      const demos = await client.query('SELECT titulo FROM app.demos WHERE proyecto_id=$1 ORDER BY orden,id', [id]);
      if (demos.rows.length) throw new AppError(409, 'PROYECTO_CON_DEMOS', 'Primero eliminá las demos asociadas al proyecto.', { demos: demos.rows.map(d => d.titulo).join(', ') });
      await client.query('DELETE FROM app.proyectos WHERE id=$1', [id]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      if (error.code === '23503') throw new AppError(409, 'PROYECTO_CON_DEMOS', 'El proyecto tiene demos asociadas.');
      throw error;
    } finally { client.release(); }
  },
};
