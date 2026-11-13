
 // Adaptador de I5: conecta el tablero visual con la API.

(() => {
  // Realiza solicitudes a la API del tablero.
  async function solicitar(ruta, metodo = 'GET', datos = null) {
    const demoId = document.querySelector('[data-tablero]')?.dataset.demoId;
    if (demoId) ruta += `?demoId=${encodeURIComponent(demoId)}`;
    const opciones = {
      method: metodo,
      headers: {},
      credentials: 'same-origin'
    };

    // Las operaciones de escritura requieren token CSRF.
    if (metodo !== 'GET') {
      const respuestaCsrf = await fetch('/api/csrf', {
        credentials: 'same-origin'
      });

      if (!respuestaCsrf.ok) {
        throw new Error('No se pudo obtener el token de seguridad.');
      }

      const csrf = await respuestaCsrf.json();
      opciones.headers['X-CSRF-Token'] = csrf.data.csrfToken;
    }

    if (datos !== null) {
      opciones.headers['Content-Type'] = 'application/json';
      opciones.body = JSON.stringify(datos);
    }

    const respuesta = await fetch(ruta, opciones);
    const resultado = await respuesta.json();

    if (!respuesta.ok || !resultado.ok) {
      throw new Error(
        resultado.error?.message || 'No se pudo completar la operación.'
      );
    }

    return resultado.data;
  }

  // Funciones que utiliza la interfaz de I3.
  window.tableroAdapter = {
    listar() {
      return solicitar('/api/tablero/tareas');
    },

    crear(titulo) {
      return solicitar('/api/tablero/tareas', 'POST', {
        titulo
      });
    },

    cambiar(id, estado) {
      return solicitar(`/api/tablero/tareas/${id}`, 'PATCH', {
        estado
      });
    },

    eliminar(id) {
      return solicitar(`/api/tablero/tareas/${id}`, 'DELETE');
    }
  };
})();
