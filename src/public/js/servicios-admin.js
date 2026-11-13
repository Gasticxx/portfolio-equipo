(() => {
  const panelEl = document.getElementById('panel-admin-servicios');
  let csrfToken = panelEl?.dataset?.csrfToken || null;
  let ultimoBotonFoco = null;

  const alertaBox = document.getElementById('alerta-admin-servicios');
  const tablaBody = document.getElementById('tabla-servicios-body');
  const formFiltros = document.getElementById('form-filtros-servicios');
  const btnNuevo = document.getElementById('btn-nuevo-servicio');
  const modalEl = document.getElementById('modal-servicio');
  const btnCerrarModal = document.getElementById('btn-cerrar-modal');
  const btnCancelarModal = document.getElementById('btn-cancelar-modal');
  const formServicio = document.getElementById('form-servicio');
  const btnGuardar = document.getElementById('btn-guardar-servicio');
  const modalTitulo = document.getElementById('modal-servicio-titulo');

  const inputId = document.getElementById('servicio-id');
  const inputNombre = document.getElementById('servicio-nombre');
  const inputCategoria = document.getElementById('servicio-categoria');
  const inputDescripcion = document.getElementById('servicio-descripcion');
  const inputOrden = document.getElementById('servicio-orden');
  const inputActivo = document.getElementById('servicio-activo');

  const camposMapa = {
    nombre: { input: inputNombre, error: document.getElementById('error-nombre') },
    categoria: { input: inputCategoria, error: document.getElementById('error-categoria') },
    descripcion: { input: inputDescripcion, error: document.getElementById('error-descripcion') },
    orden: { input: inputOrden, error: document.getElementById('error-orden') }
  };

  function abrirModal() {
    if (!modalEl) return;
    if (typeof modalEl.showModal === 'function') {
      if (!modalEl.open) modalEl.showModal();
    } else if (window.bootstrap && window.bootstrap.Modal) {
      window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
    inputNombre?.focus();
  }

  function cerrarModal() {
    if (!modalEl) return;
    if (typeof modalEl.close === 'function') {
      if (modalEl.open) modalEl.close();
    } else if (window.bootstrap && window.bootstrap.Modal) {
      window.bootstrap.Modal.getOrCreateInstance(modalEl).hide();
    }
    if (ultimoBotonFoco && typeof ultimoBotonFoco.focus === 'function') {
      ultimoBotonFoco.focus();
    }
  }

  function mostrarAlerta(mensaje, tipo = 'success') {
    if (!alertaBox) return;
    alertaBox.className = `alert alert-${tipo}`;
    alertaBox.textContent = mensaje;
    alertaBox.classList.remove('d-none');
  }

  function limpiarErroresFormulario() {
    Object.values(camposMapa).forEach(({ input, error }) => {
      if (input) input.classList.remove('is-invalid');
      if (error) error.textContent = '';
    });
  }

  function mostrarErroresCampos(fields = {}) {
    limpiarErroresFormulario();
    let primerInvalido = null;

    for (const [campo, mensaje] of Object.entries(fields)) {
      if (camposMapa[campo]) {
        camposMapa[campo].input.classList.add('is-invalid');
        camposMapa[campo].error.textContent = mensaje;
        if (!primerInvalido) {
          primerInvalido = camposMapa[campo].input;
        }
      }
    }

    if (primerInvalido) {
      primerInvalido.focus();
    }
  }

  async function asegurarCsrf(forzar = false) {
    if (csrfToken && !forzar) return csrfToken;
    try {
      const res = await fetch('/api/csrf', {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' }
      });
      if (res.ok) {
        const payload = await res.json();
        csrfToken = payload?.data?.csrfToken || payload?.csrfToken || csrfToken;
      }
    } catch {
      // Mantiene el token inyectado desde el SSR en data-csrf-token
    }
    return csrfToken;
  }

  function renderizarFilas(servicios = []) {
    if (!tablaBody) return;
    tablaBody.innerHTML = '';

    if (servicios.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 5;
      td.className = 'text-center text-secondary py-4';
      td.textContent = 'No se encontraron servicios.';
      tr.appendChild(td);
      tablaBody.appendChild(tr);
      return;
    }

    servicios.forEach((s) => {
      const tr = document.createElement('tr');
      tr.dataset.servicioId = String(s.id);

      const tdOrden = document.createElement('td');
      tdOrden.textContent = String(s.orden);

      const tdNombre = document.createElement('td');
      const divTitulo = document.createElement('div');
      divTitulo.className = 'fw-semibold';
      divTitulo.textContent = s.nombre;
      const divDesc = document.createElement('div');
      divDesc.className = 'small text-secondary text-truncate descripcion-truncada';
      divDesc.textContent = s.descripcion;
      tdNombre.append(divTitulo, divDesc);

      const tdCat = document.createElement('td');
      const badgeCat = document.createElement('span');
      badgeCat.className = 'badge text-bg-secondary text-uppercase';
      badgeCat.textContent = s.categoria;
      tdCat.appendChild(badgeCat);

      const tdEstado = document.createElement('td');
      const badgeEstado = document.createElement('span');
      badgeEstado.className = s.activo ? 'badge text-bg-success' : 'badge text-bg-secondary';
      badgeEstado.textContent = s.activo ? 'Activo' : 'Inactivo';
      tdEstado.appendChild(badgeEstado);

      const tdAcciones = document.createElement('td');
      tdAcciones.className = 'text-end';

      const btnEditar = document.createElement('button');
      btnEditar.type = 'button';
      btnEditar.className = 'btn btn-sm btn-outline-primary me-1 btn-editar-servicio';
      btnEditar.dataset.id = String(s.id);
      btnEditar.textContent = 'Editar';

      const btnEliminar = document.createElement('button');
      btnEliminar.type = 'button';
      btnEliminar.className = 'btn btn-sm btn-outline-danger btn-eliminar-servicio';
      btnEliminar.dataset.id = String(s.id);
      btnEliminar.dataset.nombre = s.nombre;
      btnEliminar.textContent = 'Eliminar';

      tdAcciones.append(btnEditar, btnEliminar);
      tr.append(tdOrden, tdNombre, tdCat, tdEstado, tdAcciones);
      tablaBody.appendChild(tr);
    });
  }

  async function cargarServicios() {
    const params = new URLSearchParams({ page: '1', pageSize: '50' });
    const q = document.getElementById('filtro-q')?.value?.trim() || '';
    const activo = document.getElementById('filtro-activo')?.value || '';

    if (q.length >= 2) params.set('q', q);
    if (activo === 'true' || activo === 'false') params.set('activo', activo);

    const res = await fetch(`/api/admin/servicios?${params.toString()}`, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    });
    const payload = await res.json();
    if (!res.ok || !payload.ok) {
      mostrarAlerta(payload?.error?.message || 'Error al filtrar servicios.', 'danger');
      return;
    }
    renderizarFilas(payload.data);
  }

  btnCerrarModal?.addEventListener('click', cerrarModal);
  btnCancelarModal?.addEventListener('click', cerrarModal);

  if (btnNuevo) {
    btnNuevo.addEventListener('click', () => {
      ultimoBotonFoco = btnNuevo;
      limpiarErroresFormulario();
      formServicio.reset();
      inputId.value = '';
      inputOrden.value = '1';
      inputActivo.checked = true;
      modalTitulo.textContent = 'Nuevo servicio';
      abrirModal();
    });
  }

  if (formFiltros) {
    formFiltros.addEventListener('submit', async (e) => {
      e.preventDefault();
      await cargarServicios();
    });
  }

  if (tablaBody) {
    tablaBody.addEventListener('click', async (e) => {
      const btnEditar = e.target.closest('.btn-editar-servicio');
      if (btnEditar) {
        ultimoBotonFoco = btnEditar;
        const id = btnEditar.dataset.id;
        limpiarErroresFormulario();

        const res = await fetch(`/api/admin/servicios/${encodeURIComponent(id)}`, {
          method: 'GET',
          credentials: 'same-origin',
          headers: { Accept: 'application/json' }
        });
        const payload = await res.json();
        if (!res.ok || !payload.ok) {
          mostrarAlerta(payload?.error?.message || 'No se pudo cargar el servicio.', 'danger');
          return;
        }

        const s = payload.data;
        inputId.value = String(s.id);
        inputNombre.value = s.nombre;
        inputCategoria.value = s.categoria;
        inputDescripcion.value = s.descripcion;
        inputOrden.value = String(s.orden);
        inputActivo.checked = Boolean(s.activo);
        modalTitulo.textContent = 'Editar servicio';
        abrirModal();
        return;
      }

      const btnEliminar = e.target.closest('.btn-eliminar-servicio');
      if (btnEliminar) {
        const id = btnEliminar.dataset.id;
        const nombre = btnEliminar.dataset.nombre || '';
        const confirmado = window.confirm(
          `¿Confirmás eliminar el servicio "${nombre}"? Las consultas existentes conservarán su nombre histórico en el panel.`
        );
        if (!confirmado) return;

        const token = await asegurarCsrf();
        const res = await fetch(`/api/admin/servicios/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          credentials: 'same-origin',
          headers: {
            Accept: 'application/json',
            'X-CSRF-Token': token || ''
          }
        });

        if (res.status === 204) {
          mostrarAlerta(`Servicio "${nombre}" eliminado correctamente.`, 'success');
          await cargarServicios();
          return;
        }

        const payload = await res.json();
        mostrarAlerta(payload?.error?.message || 'No se pudo eliminar el servicio.', 'danger');
      }
    });
  }

  if (formServicio) {
    formServicio.addEventListener('submit', async (e) => {
      e.preventDefault();
      limpiarErroresFormulario();

      const id = inputId.value.trim();
      const esEdicion = id.length > 0;
      const url = esEdicion
        ? `/api/admin/servicios/${encodeURIComponent(id)}`
        : '/api/admin/servicios';
      const metodo = esEdicion ? 'PUT' : 'POST';

      const cuerpo = {
        nombre: inputNombre.value,
        categoria: inputCategoria.value,
        descripcion: inputDescripcion.value,
        orden: Number(inputOrden.value),
        activo: Boolean(inputActivo.checked)
      };

      btnGuardar.disabled = true;
      try {
        const token = await asegurarCsrf();
        const res = await fetch(url, {
          method: metodo,
          credentials: 'same-origin',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-CSRF-Token': token || ''
          },
          body: JSON.stringify(cuerpo)
        });

        const payload = await res.json();

        if (!res.ok || !payload.ok) {
          if (res.status === 422 && payload?.error?.fields) {
            mostrarErroresCampos(payload.error.fields);
            return;
          }
          mostrarAlerta(payload?.error?.message || 'Error al guardar el servicio.', 'danger');
          return;
        }

        cerrarModal();
        mostrarAlerta(
          esEdicion ? 'Servicio actualizado correctamente.' : 'Servicio creado correctamente.',
          'success'
        );
        await cargarServicios();
      } catch {
        mostrarAlerta('Error de red al guardar el servicio.', 'danger');
      } finally {
        btnGuardar.disabled = false;
      }
    });
  }
})();
