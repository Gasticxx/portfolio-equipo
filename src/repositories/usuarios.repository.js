import { pool } from "../config/db.js";

export async function buscarUsuariosRegistrados({
  q,
  activo,
  pageSize,
  offset,
}) {
  // Usamos ! para que %, _ y el propio ! se busquen literalmente.
  const patron = q === undefined ? null : `%${q.replace(/[!%_]/g, "!$&")}%`;

  const { rows } = await pool.query(
    `WITH filtrados AS (
       SELECT id, nombre, email, activo, created_at, updated_at
       FROM app.usuarios
       WHERE rol = 'registrado'
         AND ($1::boolean IS NULL OR activo = $1)
         AND (
           $2::text IS NULL
           OR nombre ILIKE $2 ESCAPE '!'
           OR email ILIKE $2 ESCAPE '!'
         )
     ), pagina AS (
       SELECT id, nombre, email, activo, created_at, updated_at
       FROM filtrados
       ORDER BY created_at DESC, id DESC
       LIMIT $3 OFFSET $4
     )
     SELECT p.id, p.nombre, p.email, p.activo,
            p.created_at AS "createdAt", p.updated_at AS "updatedAt", t.total
     FROM (SELECT COUNT(*) AS total FROM filtrados) AS t
     LEFT JOIN pagina AS p ON true
     ORDER BY p.created_at DESC, p.id DESC`,
    [activo ?? null, patron, pageSize, offset],
  );

  // El LEFT JOIN conserva el total incluso si la página pedida está vacía.
  const total = Number(rows[0].total);
  const data =
    rows[0].id === null
      ? []
      : rows.map(({ id, nombre, email, activo, createdAt, updatedAt }) => ({
          id,
          nombre,
          email,
          activo,
          createdAt,
        updatedAt,
        }));

  return { data, total };
}

export async function obtenerUsuarioRegistrado(id) {
  const { rows } = await pool.query(
    `SELECT id, nombre, email, activo, created_at AS "createdAt", updated_at AS "updatedAt"
     FROM app.usuarios WHERE id = $1 AND rol = 'registrado'`,
    [id],
  );
  return rows[0] ?? null;
}

export async function cambiarEstadoUsuarioRegistrado(id, activo) {
  const { rows } = await pool.query(
    `UPDATE app.usuarios
     SET activo = $2,
         version_sesion = CASE
           WHEN activo = true AND $2 = false THEN version_sesion + 1
           ELSE version_sesion
         END,
         updated_at = now()
     WHERE id = $1 AND rol = 'registrado'
     RETURNING id, nombre, email, activo, created_at AS "createdAt", updated_at AS "updatedAt"`,
    [id, activo],
  );
  return rows[0] ?? null;
}
