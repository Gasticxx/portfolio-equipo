import { pool } from '../config/db.js';

export const equipoRepository = {
  /**
   * Lista los 6 integrantes ordenados por orden ASC con sus tecnologías (Apartado 11.1)
   */
  async listarMiembros() {
    const sql = `
      SELECT
        m.id,
        m.slug,
        m.nombre,
        m.especialidad,
        m.presentacion,
        m.orden,
        COALESCE(
          json_agg(
            json_build_object('id', t.id, 'nombre', t.nombre)
            ORDER BY t.nombre ASC
          ) FILTER (WHERE t.id IS NOT NULL),
          '[]'::json
        ) AS tecnologias
      FROM app.miembros m
      LEFT JOIN app.miembro_tecnologia mt ON mt.miembro_id = m.id
      LEFT JOIN app.tecnologias t ON t.id = mt.tecnologia_id
      GROUP BY m.id
      ORDER BY m.orden ASC;
    `;
    const { rows } = await pool.query(sql);
    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      nombre: row.nombre,
      especialidad: row.especialidad,
      presentacion: row.presentacion,
      tecnologias: row.tecnologias,
      avatarUrl: `/assets/img/equipo/I${row.orden}.svg`
    }));
  },

  /**
   * Obtiene la ficha individual por slug con sus tecnologías y aportes comprobados
   * de proyectos publicados (Apartado 10.1 y 11.1)
   */
  async obtenerPorSlug(slug) {
    const sqlMiembro = `
      SELECT
        m.id,
        m.slug,
        m.nombre,
        m.especialidad,
        m.presentacion,
        m.formacion,
        m.github_url AS "githubUrl",
        m.linkedin_url AS "linkedinUrl",
        m.orden,
        COALESCE(
          json_agg(
            json_build_object('id', t.id, 'nombre', t.nombre)
            ORDER BY t.nombre ASC
          ) FILTER (WHERE t.id IS NOT NULL),
          '[]'::json
        ) AS tecnologias
      FROM app.miembros m
      LEFT JOIN app.miembro_tecnologia mt ON mt.miembro_id = m.id
      LEFT JOIN app.tecnologias t ON t.id = mt.tecnologia_id
      WHERE m.slug = $1
      GROUP BY m.id;
    `;
    const { rows } = await pool.query(sqlMiembro, [slug]);
    if (rows.length === 0) return null;

    const miembro = rows[0];

    const sqlAportes = `
      SELECT
        a.titulo,
        p.slug AS "proyectoSlug",
        COALESCE(
          json_agg(
            json_build_object('id', t.id, 'nombre', t.nombre)
            ORDER BY t.nombre ASC
          ) FILTER (WHERE t.id IS NOT NULL),
          '[]'::json
        ) AS tecnologias
      FROM app.aportes a
      INNER JOIN app.proyectos p ON p.id = a.proyecto_id
      LEFT JOIN app.aporte_tecnologia at ON at.aporte_id = a.id
      LEFT JOIN app.tecnologias t ON t.id = at.tecnologia_id
      WHERE a.miembro_id = $1
        AND a.estado = 'comprobado'
        AND p.publicado = true
      GROUP BY a.id, p.slug
      ORDER BY a.id ASC;
    `;
    const { rows: aportes } = await pool.query(sqlAportes, [miembro.id]);

    return {
      id: miembro.id,
      slug: miembro.slug,
      nombre: miembro.nombre,
      especialidad: miembro.especialidad,
      presentacion: miembro.presentacion,
      formacion: miembro.formacion,
      githubUrl: miembro.githubUrl,
      linkedinUrl: miembro.linkedinUrl,
      avatarUrl: `/assets/img/equipo/I${miembro.orden}.svg`,
      tecnologias: miembro.tecnologias,
      aportes
    };
  }
};