(() => {
  const $ = selector => document.querySelector(selector);
  const form = $('#proyecto-form');
  const editor = $('#proyecto-editor');
  const campos = $('#proyecto-campos');
  const errores = $('#proyecto-errores');
  const campo = nombre => form.elements.namedItem(nombre);
  let catalogos, editando = null, page = 1, totalPages = 0, ocupado = false, modificado = false, carga = 0, focoPendiente = false;
  let aporteActivo = null, secuenciaAporte = 0;
  const nombres = { titulo: 'Título', slug: 'Slug', resumen: 'Resumen', descripcion: 'Descripción', estado: 'Estado', tecnologiaIds: 'Tecnologías', aportes: 'Aportes', portadaId: 'Portada', repositorioUrl: 'Repositorio', miembroId: 'Integrante', evidenciaUrl: 'Evidencia' };
  function mensaje(texto, tipo = 'aviso') { const nodo = $('#proyectos-mensaje'); nodo.className = `alerta alerta-${tipo}`; nodo.textContent = texto; }
  function texto(tag, contenido, clase) { const node = document.createElement(tag); node.textContent = contenido; if (clase) node.className = clase; return node; }
  function actualizarEstado() {
    const estado = $('#proyecto-guardado-estado');
    const valor = ocupado ? 'Procesando…' : modificado ? 'Cambios sin guardar' : 'Sin cambios pendientes';
    if (estado.textContent !== valor) estado.textContent = valor;
    estado.dataset.pendiente = String(modificado);
  }
  function actualizarVista() {
    $('#proyecto-vista-titulo').textContent = campo('titulo').value.trim() || 'Tu próximo proyecto';
    $('#proyecto-vista-resumen').textContent = campo('resumen').value.trim() || 'Tu idea, las personas que la construyen y todo lo que hace falta para contarla.';
    $('#proyecto-vista-ruta').textContent = `/proyectos/${campo('slug').value.trim() || 'tu-proyecto'}`;
    const publicado = $('#proyecto-vista-publicado');
    publicado.textContent = campo('publicado').checked ? 'Publicado' : 'Borrador';
    publicado.dataset.publicado = String(campo('publicado').checked);
    const tecnologias = [...$('#proyecto-tecnologias').querySelectorAll('input:checked')];
    $('#proyecto-vista-tecnologias').replaceChildren(...tecnologias.map(input => texto('span', input.parentElement.textContent)));
    const aportes = [...$('#proyecto-aportes').children];
    const participantes = new Set(aportes.map(aporte => aporte.querySelector('[data-campo=miembroId]').value).filter(Boolean));
    $('#proyecto-vista-meta').textContent = `${campo('estado').value === 'terminado' ? 'Terminado' : 'En desarrollo'} · ${participantes.size} ${participantes.size === 1 ? 'integrante' : 'integrantes'} · ${aportes.length} ${aportes.length === 1 ? 'aporte' : 'aportes'}`;
    for (const key of ['resumen', 'descripcion']) $(`#proyecto-${key}-contador`).textContent = `${Array.from(campo(key).value).length} / ${campo(key).maxLength}`;
    actualizarEstado();
  }
  function cambiar() { modificado = true; numerar(); actualizarVista(); }
  function opciones(select, items, valor, titulo = item => item.nombre) {
    select.replaceChildren(...items.map(item => { const option = document.createElement('option'); option.value = item.id; option.textContent = titulo(item); return option; }));
    if (valor !== undefined) select.value = String(valor ?? '');
  }
  async function solicitar(url, { method = 'GET', data } = {}) {
    const headers = { Accept: 'application/json' };
    if (method !== 'GET') {
      const response = await fetch('/api/csrf', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      const body = await response.json();
      if (!response.ok) throw new Error('La sesión no pudo verificarse. Volvé a ingresar.');
      headers['X-CSRF-Token'] = body.data.csrfToken;
    }
    let body;
    if (data instanceof FormData) body = data;
    else if (data !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(data); }
    const response = await fetch(url, { method, headers, body, credentials: 'same-origin' });
    if (response.status === 204) return null;
    const result = await response.json();
    if (!response.ok) {
      const error = new Error(response.status === 401 ? 'Tu sesión venció. Iniciá sesión nuevamente antes de continuar.' : result.error?.message || 'No se pudo completar la operación.');
      error.fields = result.error?.fields; throw error;
    }
    return result;
  }
  function mostrarError(error) {
    errores.replaceChildren(texto('strong', error.message));
    if (error.fields) {
      const indice = Object.keys(error.fields).map(key => /^aportes\.(\d+)/.exec(key)?.[1]).find(value => value !== undefined);
      if (indice !== undefined) seleccionarAporte($('#proyecto-aportes').children[Number(indice)]);
      const ul = document.createElement('ul');
      for (const [key, value] of Object.entries(error.fields)) {
        const etiqueta = key.split('.').map(p => /^\d+$/.test(p) ? Number(p) + 1 : nombres[p] || p).join(' · ');
        ul.append(texto('li', `${etiqueta}: ${value}`));
      }
      errores.append(ul);
    }
    errores.hidden = false; mensaje(error.message, 'error');
    if (!editor.hidden) errores.scrollIntoView({ block: 'nearest' });
  }
  function confirmar(titulo, descripcion) {
    const dialog = $('#proyecto-confirmacion');
    $('#confirmacion-titulo').textContent = titulo; $('#confirmacion-texto').textContent = descripcion;
    dialog.returnValue = ''; dialog.showModal();
    return new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue === 'aceptar'), { once: true }));
  }
  async function tarea(fn) {
    if (ocupado) return;
    ocupado = true; campos.disabled = true; errores.hidden = true; editor.setAttribute('aria-busy', 'true'); actualizarEstado();
    try { await fn(); } catch (error) { mostrarError(error); }
    finally {
      ocupado = false; campos.disabled = false; editor.setAttribute('aria-busy', 'false'); actualizarEstado();
      if (focoPendiente && !editor.hidden) { focoPendiente = false; campo('titulo').focus({ preventScroll: true }); }
    }
  }
  function checks(container, seleccionados = []) {
    container.replaceChildren();
    for (const tecnologia of catalogos.tecnologias) {
      const label = document.createElement('label'); const input = document.createElement('input');
      input.type = 'checkbox'; input.value = tecnologia.id; input.checked = seleccionados.includes(tecnologia.id);
      label.append(input, document.createTextNode(tecnologia.nombre)); container.append(label);
    }
  }
  const seleccion = container => [...container.querySelectorAll('input:checked')].map(input => Number(input.value));
  function seleccionarAporte(item) {
    aporteActivo = item || null;
    for (const aporte of $('#proyecto-aportes').children) {
      aporte.hidden = aporte !== aporteActivo;
      document.getElementById(`${aporte.id}-selector`).setAttribute('aria-pressed', String(aporte === aporteActivo));
    }
    $('#aportes-vacio').hidden = Boolean(aporteActivo);
    if (aporteActivo) {
      const indice = $('#aportes-indice'); const limite = indice.getBoundingClientRect();
      const selector = document.getElementById(`${aporteActivo.id}-selector`).getBoundingClientRect();
      if (selector.top < limite.top) indice.scrollTop += selector.top - limite.top - 3;
      else if (selector.bottom > limite.bottom) indice.scrollTop += selector.bottom - limite.bottom + 3;
    }
  }
  function agregarAporte(data = {}) {
    if ($('#proyecto-aportes').children.length >= 30) { mensaje('El máximo es 30 aportes.', 'error'); return; }
    const fragment = $('#aporte-template').content.cloneNode(true);
    const item = fragment.querySelector('fieldset');
    item.id = `aporte-editor-${++secuenciaAporte}`; item.hidden = true;
    const selector = texto('button', '', 'proyecto-aporte-selector'); selector.type = 'button'; selector.id = `${item.id}-selector`;
    selector.setAttribute('aria-controls', item.id); selector.setAttribute('aria-pressed', 'false');
    selector.append(texto('span', '', 'proyecto-aporte-numero'));
    const resumen = texto('span', '', 'proyecto-aporte-resumen');
    resumen.append(texto('strong', '', 'proyecto-aporte-miembro'), texto('span', '', 'proyecto-aporte-titulo'), texto('small', '', 'proyecto-aporte-estado'));
    selector.append(resumen); selector.addEventListener('click', () => seleccionarAporte(item));
    const miembro = item.querySelector('[data-campo=miembroId]');
    opciones(miembro, catalogos.miembros, data.miembroId ?? catalogos.miembros[0]?.id);
    for (const key of ['titulo', 'descripcion', 'estado', 'evidenciaUrl']) if (data[key] != null) item.querySelector(`[data-campo=${key}]`).value = data[key];
    checks(item.querySelector('[data-tecnologias]'), data.tecnologiaIds);
    const estado = item.querySelector('[data-campo=estado]'); const evidencia = item.querySelector('[data-campo=evidenciaUrl]');
    function requerirEvidencia() { evidencia.required = estado.value === 'comprobado'; }
    estado.addEventListener('change', requerirEvidencia); requerirEvidencia();
    item.querySelector('[data-quitar-aporte]').addEventListener('click', () => {
      const hermanos = [...$('#proyecto-aportes').children]; const indice = hermanos.indexOf(item);
      item.remove(); selector.remove();
      if (aporteActivo === item) seleccionarAporte(hermanos[indice + 1] || hermanos[indice - 1]);
      cambiar();
      if (aporteActivo) aporteActivo.querySelector('[data-campo=miembroId]').focus({ preventScroll: true }); else $('#aporte-agregar').focus();
    });
    $('#proyecto-aportes').append(fragment); $('#aportes-indice').append(selector); numerar();
    if (!aporteActivo) seleccionarAporte(item);
    return item;
  }
  function numerar() {
    const aportes = [...$('#proyecto-aportes').children];
    aportes.forEach((item, i) => {
      item.querySelector('legend').textContent = `Aporte ${i + 1}`;
      const selector = document.getElementById(`${item.id}-selector`);
      const miembro = item.querySelector('[data-campo=miembroId]');
      selector.querySelector('.proyecto-aporte-numero').textContent = String(i + 1).padStart(2, '0');
      selector.querySelector('.proyecto-aporte-miembro').textContent = miembro.selectedOptions[0]?.textContent || 'Sin integrante';
      selector.querySelector('.proyecto-aporte-titulo').textContent = item.querySelector('[data-campo=titulo]').value.trim() || 'Nuevo aporte';
      const estado = item.querySelector('[data-campo=estado]');
      selector.querySelector('.proyecto-aporte-estado').textContent = estado.selectedOptions[0].textContent;
      selector.dataset.estado = estado.value;
    });
    $('#aportes-conteo').textContent = `${aportes.length} de 30 aportes`;
  }
  function preview() {
    const id = campo('portadaId').value;
    $('#portada-vacia').hidden = Boolean(id);
    for (const img of [$('#portada-preview'), $('#proyecto-vista-imagen')]) {
      img.hidden = !id;
      if (id) img.src = `/media/${id}`; else img.removeAttribute('src');
    }
  }
  async function cargarCatalogos() {
    const result = await solicitar('/api/admin/proyectos/catalogos'); catalogos = result.data;
    opciones(campo('portadaId'), [{ id: '', nombre: 'Sin portada' }, ...catalogos.archivos.map(a => ({ ...a, nombre: `Portada #${a.id} · ${a.ancho} × ${a.alto} · ${Math.ceil(a.bytes / 1024)} KiB` }))], campo('portadaId').value);
  }
  function abrir(data = null) {
    editando = data?.id ?? null; form.reset(); errores.hidden = true;
    $('#proyecto-form-titulo').textContent = data ? `Editar: ${data.titulo}` : 'Nuevo proyecto';
    for (const key of ['titulo', 'slug', 'resumen', 'descripcion', 'estado', 'repositorioUrl', 'portadaId']) if (data && data[key] != null) campo(key).value = data[key];
    campo('publicado').checked = data?.publicado ?? false;
    checks($('#proyecto-tecnologias'), data?.tecnologiaIds);
    $('#proyecto-aportes').replaceChildren(); $('#aportes-indice').replaceChildren(); aporteActivo = null;
    for (const aporte of data?.aportes ?? [{}]) agregarAporte(aporte);
    numerar(); seleccionarAporte(aporteActivo);
    $('#proyecto-reemplazo').hidden = !data;
    const demos = $('#proyecto-demos'); demos.replaceChildren(); demos.hidden = !data?.demos?.length;
    if (!demos.hidden) {
      demos.append(texto('h3', 'Demos asociadas'), texto('p', 'Para eliminar este proyecto primero deben eliminarse sus demos. Despublicarlo conserva sus tareas y oculta el acceso.'));
      const ul = document.createElement('ul'); for (const demo of data.demos) ul.append(texto('li', demo.titulo)); demos.append(ul);
      const link = texto('a', 'Gestionar demos →', 'enlace-flecha'); link.href = '/admin/demos'; demos.append(link);
    }
    editor.hidden = false; modificado = false; focoPendiente = true; preview(); actualizarVista();
    for (const item of $('#proyectos-lista').querySelectorAll('article')) item.classList.toggle('is-selected', Number(item.dataset.proyectoId) === editando);
    editor.scrollIntoView({ block: 'start' });
    if (!catalogos.miembros.length || !catalogos.tecnologias.length) mensaje('Faltan integrantes o tecnologías en el catálogo. Pedile al responsable de datos que los complete.', 'error');
  }
  async function descartar() { return !modificado || confirmar('Descartar cambios', 'Los cambios de la ficha que todavía no guardaste se perderán.'); }
  async function cargar() {
    const version = ++carga;
    const query = new URLSearchParams(new FormData($('#proyectos-filtros'))); query.set('page', page);
    if (!query.get('publicado')) query.delete('publicado'); if (!query.get('q')) query.delete('q');
    const result = await solicitar(`/api/admin/proyectos?${query}`);
    if (version !== carga) return;
    totalPages = result.meta.totalPages;
    if (page > Math.max(1, totalPages)) { page = Math.max(1, totalPages); return cargar(); }
    const lista = $('#proyectos-lista'); lista.replaceChildren();
    if (!result.data.length) lista.append(texto('p', 'No hay proyectos para estos filtros. Podés crear uno nuevo o cambiar la búsqueda.'));
    for (const proyecto of result.data) {
      const item = document.createElement('article');
      item.dataset.proyectoId = proyecto.id; item.classList.toggle('is-selected', proyecto.id === editando);
      if (proyecto.portadaId) { const imagen = document.createElement('img'); imagen.src = `/media/${proyecto.portadaId}`; imagen.alt = ''; imagen.loading = 'lazy'; imagen.className = 'proyecto-lista-portada'; item.append(imagen); }
      const badges = texto('div', '', 'proyecto-badges');
      const publicado = texto('span', proyecto.publicado ? 'Publicado' : 'Borrador', 'proyecto-badge'); publicado.dataset.publicado = String(proyecto.publicado);
      badges.append(publicado, texto('span', proyecto.estado === 'terminado' ? 'Terminado' : 'En desarrollo', 'proyecto-badge'));
      item.append(badges, texto('h3', proyecto.titulo), texto('p', `/proyectos/${proyecto.slug}`, 'proyecto-vista-ruta'), texto('p', proyecto.resumen));
      const acciones = texto('div', '', 'acciones');
      const editar = texto('button', 'Editar proyecto', 'btn btn-glass'); editar.type = 'button';
      editar.addEventListener('click', () => tarea(async () => {
        if (!await descartar()) return;
        await cargarCatalogos(); const response = await solicitar(`/api/admin/proyectos/${proyecto.id}`); abrir(response.data);
      }));
      const eliminar = texto('button', 'Eliminar', 'btn btn-danger'); eliminar.type = 'button';
      eliminar.addEventListener('click', () => tarea(async () => {
        const datos = (await solicitar(`/api/admin/proyectos/${proyecto.id}`)).data;
        if (datos.demos.length) throw new Error(`No se puede eliminar «${datos.titulo}»: primero eliminá sus demos (${datos.demos.map(d => d.titulo).join(', ')}). Podés despublicarlo para ocultarlo.`);
        if (!await confirmar('Eliminar proyecto', `Se eliminará «${datos.titulo}» junto con sus tecnologías asociadas y aportes. Los integrantes, el catálogo de tecnologías y el archivo de portada se conservan. Esta acción no se puede deshacer.`)) return;
        await solicitar(`/api/admin/proyectos/${proyecto.id}`, { method: 'DELETE' });
        if (editando === proyecto.id) { editor.hidden = true; editando = null; modificado = false; }
        await cargar(); mensaje('Proyecto eliminado correctamente.', 'exito');
      }));
      acciones.append(editar, eliminar);
      if (proyecto.publicado) { const link = texto('a', 'Ver proyecto ↗', 'enlace-flecha'); link.href = `/proyectos/${proyecto.slug}`; acciones.append(link); }
      item.append(acciones); lista.append(item);
    }
    $('#proyectos-pagina').textContent = result.meta.total ? `Página ${page} de ${totalPages} · ${result.meta.total} proyectos` : '0 proyectos';
    $('#proyectos-anterior').disabled = page <= 1; $('#proyectos-siguiente').disabled = page >= totalPages;
  }
  $('#proyecto-nuevo').addEventListener('click', () => tarea(async () => { if (await descartar()) { await cargarCatalogos(); abrir(); } }));
  for (const id of ['#proyecto-cancelar', '#proyecto-descartar']) $(id).addEventListener('click', () => tarea(async () => { if (await descartar()) { editor.hidden = true; editando = null; modificado = false; $('#proyecto-nuevo').focus(); } }));
  form.addEventListener('input', cambiar); form.addEventListener('change', cambiar);
  $('#aporte-agregar').addEventListener('click', () => {
    if (ocupado) return;
    const item = agregarAporte();
    if (item) { seleccionarAporte(item); cambiar(); item.querySelector('[data-campo=miembroId]').focus({ preventScroll: true }); }
  });
  campo('portadaId').addEventListener('change', preview);
  $('#portada-quitar').addEventListener('click', () => { campo('portadaId').value = ''; preview(); cambiar(); });
  $('#portada-subir').addEventListener('click', () => tarea(async () => {
    const file = $('#proyecto-imagen').files[0]; if (!file) throw new Error('Elegí una imagen antes de subirla.');
    if (file.size > 5 * 1024 * 1024) throw new Error('La imagen supera los 5 MiB.');
    const data = new FormData(); data.set('imagen', file);
    const response = await solicitar('/api/admin/archivos', { method: 'POST', data });
    await cargarCatalogos(); campo('portadaId').value = response.data.id; preview(); cambiar(); $('#proyecto-imagen').value = '';
    mensaje('Portada subida. Guardá el proyecto para aplicarla.', 'exito');
  }));
  $('#portada-eliminar').addEventListener('click', () => tarea(async () => {
    const id = campo('portadaId').value; if (!id) throw new Error('Seleccioná el archivo de portada que querés eliminar.');
    if (!await confirmar('Eliminar archivo de portada', `Se eliminará permanentemente la portada #${id} del almacenamiento. Solo se permite si ningún proyecto la utiliza.`)) return;
    await solicitar(`/api/admin/archivos/${id}`, { method: 'DELETE' });
    await cargarCatalogos(); campo('portadaId').value = ''; preview(); cambiar(); mensaje('Archivo eliminado.', 'exito');
  }));
  form.addEventListener('submit', event => {
    event.preventDefault(); if (ocupado) return;
    const invalido = form.querySelector('input:invalid,select:invalid,textarea:invalid');
    if (invalido) {
      const aporte = invalido.closest('.proyecto-aporte'); if (aporte) seleccionarAporte(aporte);
      invalido.reportValidity(); return;
    }
    tarea(async () => {
      const data = Object.fromEntries(['titulo', 'slug', 'resumen', 'descripcion', 'estado'].map(key => [key, campo(key).value]));
      data.publicado = campo('publicado').checked; data.portadaId = campo('portadaId').value ? Number(campo('portadaId').value) : null;
      data.repositorioUrl = campo('repositorioUrl').value.trim() || null; data.tecnologiaIds = seleccion($('#proyecto-tecnologias'));
      data.aportes = [...$('#proyecto-aportes').children].map(item => {
        const aporte = Object.fromEntries(['titulo', 'descripcion', 'estado'].map(key => [key, item.querySelector(`[data-campo=${key}]`).value]));
        aporte.miembroId = Number(item.querySelector('[data-campo=miembroId]').value);
        aporte.evidenciaUrl = item.querySelector('[data-campo=evidenciaUrl]').value.trim() || null;
        aporte.tecnologiaIds = seleccion(item.querySelector('[data-tecnologias]')); return aporte;
      });
      if (!data.tecnologiaIds.length || data.tecnologiaIds.length > 15) throw new Error('Elegí entre 1 y 15 tecnologías del proyecto.');
      if (!data.aportes.length) throw new Error('Agregá al menos un aporte para identificar a los participantes.');
      const aporteInvalido = data.aportes.findIndex(a => !a.tecnologiaIds.length || a.tecnologiaIds.length > 10);
      if (aporteInvalido !== -1) { seleccionarAporte($('#proyecto-aportes').children[aporteInvalido]); throw new Error(`Elegí entre 1 y 10 tecnologías para el aporte ${aporteInvalido + 1}.`); }
      if (editando && !await confirmar('Guardar cambios del proyecto', `Se actualizará «${data.titulo}» y se reemplazarán todas sus tecnologías y aportes por los de esta ficha. Revisá que incluiste los aportes de todos los participantes.`)) return;
      const response = await solicitar(`/api/admin/proyectos${editando ? `/${editando}` : ''}`, { method: editando ? 'PUT' : 'POST', data });
      abrir(response.data); await cargar(); mensaje('Proyecto guardado correctamente. Los cambios ya están disponibles según su publicación.', 'exito');
    });
  });
  $('#proyectos-filtros').addEventListener('submit', event => { event.preventDefault(); tarea(async () => { page = 1; await cargar(); mensaje('Listado actualizado.'); }); });
  $('#proyectos-anterior').addEventListener('click', () => tarea(async () => { if (page > 1) { page--; await cargar(); } }));
  $('#proyectos-siguiente').addEventListener('click', () => tarea(async () => { if (page < totalPages) { page++; await cargar(); } }));
  window.addEventListener('beforeunload', event => { if (modificado) { event.preventDefault(); event.returnValue = ''; } });
  tarea(async () => { await cargarCatalogos(); await cargar(); mensaje('Elegí un proyecto para editarlo o creá uno nuevo.'); });
})();
