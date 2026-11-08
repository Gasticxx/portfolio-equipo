import { serviciosRepository } from '../repositories/servicios.repository.js';

export const serviciosService = {
  async listarPublicos() {
    return await serviciosRepository.listarActivos();
  },

  async listarAdmin(filtros) {
    return await serviciosRepository.listarAdmin(filtros);
  },

  async obtenerAdminPorId(id) {
    return await serviciosRepository.obtenerPorId(id);
  },

  async crearServicio(datos) {
    return await serviciosRepository.crear(datos);
  },

  async actualizarServicio(id, datos) {
    return await serviciosRepository.actualizar(id, datos);
  },

  async eliminarServicio(id) {
    return await serviciosRepository.eliminar(id);
  }
};