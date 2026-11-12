import {
  buscarUsuariosRegistrados,
  obtenerUsuarioRegistrado,
  cambiarEstadoUsuarioRegistrado,
} from "../repositories/usuarios.repository.js";

export async function listarUsuarios({ page, pageSize, q, activo }) {
  const offset = (page - 1) * pageSize;
  const { data, total } = await buscarUsuariosRegistrados({
    q,
    activo,
    pageSize,
    offset,
  });

  return {
    data,
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export const obtenerUsuario = (id) => obtenerUsuarioRegistrado(id);
export const actualizarEstadoUsuario = (id, activo) =>
  cambiarEstadoUsuarioRegistrado(id, activo);
