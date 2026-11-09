import { equipoRepository } from '../repositories/equipo.repository.js';
import { serviciosRepository } from '../repositories/servicios.repository.js';

export const equipoService = {
  async obtenerDatosInicio() {
    const [miembros, servicios] = await Promise.all([
      equipoRepository.listarMiembros(),
      serviciosRepository.listarActivos()
    ]);
    return {
      miembros,
      servicios: servicios.slice(0, 3)
    };
  },

  async listarEquipo() {
    return await equipoRepository.listarMiembros();
  },

  async obtenerMiembroPorSlug(slug) {
    if (typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug) || slug.length > 40) {
      return null;
    }
    return await equipoRepository.obtenerPorSlug(slug);
  }
};