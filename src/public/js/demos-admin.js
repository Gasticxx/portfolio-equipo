(() => {
  const $ = selector => document.querySelector(selector);
  const form = $('#demo-form');
  if (!form) return;
  const campo = nombre => form.elements.namedItem(nombre);
  const tipos = { tablero: { nombre: 'Tablero de tareas', icono: '▦', ayuda: 'Tareas personales que se conservan en la cuenta de cada usuario.' }, algoritmos: { nombre: 'Algoritmos', icono: '⌘', ayuda: 'Búsqueda lineal y ordenamiento burbuja, paso a paso.' }, calendario: { nombre: 'Calendario', icono: '◷', ayuda: 'Meses, días y años bisiestos en una experiencia interactiva.' }, ondas: { nombre: 'Laboratorio de ondas', icono: '∿', ayuda: 'Emisores móviles, interferencia y controles de frecuencia, amplitud y propagación. El experimento se reinicia al salir.' } };
  const etiquetas = { titulo: 'Título', descripcion: 'Descripción', proyectoId: 'Proyecto', tipo: 'Tipo', orden: 'Orden', publicada: 'Publicación', q: 'Búsqueda' };
  let catalogos = null, actual = null, ocupado = false, modificado = false, page = 1, pages = 0, enfocar = false;
  function nodo(tag, contenido, clase) { const el = document.createElement(tag); el.textContent = contenido; if (clase) el.className = clase; return el; }
  function mensaje(texto, tipo = 'aviso') { const el = $('#demo-estado'); el.textContent = texto; el.dataset.tipo = tipo; }
  async function api(url, method = 'GET', datos) {
    const headers = { Accept: 'application/json' };
    if (method !== 'GET') {
      const response = await fetch('/api/csrf', { credentials: 'same-origin', headers });
      const body = await response.json();
      if (!response.ok) throw new Error('No se pudo verificar la sesión. Volvé a ingresar.');
      headers['X-CSRF-Token'] = body.data.csrfToken; headers['Content-Type'] = 'application/json';
    }
    const response = await fetch(url, { method, credentials: 'same-origin', cache: 'no-store', headers, ...(datos !== undefined ? { body: JSON.stringify(datos) } : {}) });
    if (response.status === 204) return null;
    const body = await response.json();
    if (!response.ok) {
      const error = new Error(response.status === 401 ? 'Tu sesión venció. Volvé a ingresar para continuar.' : body.error?.message || 'No se pudo completar la operación.');
      error.fields = body.error?.fields; throw error;
    }
    return body;
  }
  function mostrarError(error) {
    mensaje(error.message, 'error');
    const el = $('#demo-errores'); el.replaceChildren(nodo('strong', error.message));
    if (error.fields) {
      const lista = document.createElement('ul');
      for (const [key, value] of Object.entries(error.fields)) lista.append(nodo('li', `${etiquetas[key] || key}: ${value}`));
      el.append(lista);
    }
    el.hidden = form.hidden;
  }
  async function tarea(fn) {
    if (ocupado) return;
    ocupado = true; $('#demo-campos').disabled = true; $('#demo-errores').hidden = true;
    try { await fn(); } catch (error) {
      mostrarError(error);
      if (!$('#demo-listado').children.length) vacio('No pudimos cargar las demos', 'Tus datos se conservan. Usá Actualizar listado para volver a intentar.');
    } finally {
      ocupado = false; $('#demo-campos').disabled = false; $('#demo-listado').setAttribute('aria-busy', 'false');
      if (enfocar && !form.hidden) { enfocar = false; campo('titulo').focus({ preventScroll: true }); }
    }
  }
  function confirmar(titulo, texto) {
    const dialog = $('#demo-confirmacion'); $('#demo-confirmar-titulo').textContent = titulo; $('#demo-confirmar-texto').textContent = texto;
    dialog.returnValue = ''; dialog.showModal();
    return new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue === 'aceptar'), { once: true }));
  }
  const descartar = () => !modificado || confirmar('Descartar cambios', 'Los cambios de la demo que todavía no guardaste se perderán.');
  function seleccionarTarjeta() { document.querySelectorAll('[data-demo-id]').forEach(el => el.classList.toggle('is-selected', Number(el.dataset.demoId) === actual?.id)); }
  function contadores() {
    $('#demo-titulo-cuenta').textContent = `${Array.from(campo('titulo').value).length} / 100`;
    $('#demo-descripcion-cuenta').textContent = `${Array.from(campo('descripcion').value).length} / 1000`;
    $('#demo-tipo-ayuda').textContent = tipos[campo('tipo').value]?.ayuda || '';
    const proyecto = catalogos?.proyectos.find(p => p.id === Number(campo('proyectoId').value));
    $('#demo-publicacion-ayuda').textContent = !proyecto ? 'Elegí el proyecto de esta demo.' : proyecto.publicado ? 'Al guardar publicada, estará disponible para las cuentas autenticadas.' : 'El proyecto está en borrador: la demo no será visible en el catálogo. Publicá primero el proyecto para habilitarla.';
  }
  function cargarSelect(select, proyectos, primera, elegido) {
    select.replaceChildren();
    if (primera) { const option = nodo('option', primera); option.value = ''; select.append(option); }
    for (const p of proyectos) { const option = nodo('option', p.titulo + (p.publicado ? '' : ' · Borrador')); option.value = p.id; select.append(option); }
    if (elegido !== undefined) select.value = String(elegido);
  }
  async function cargarCatalogos() {
    const data = (await api('/api/admin/demos/catalogos')).data;
    catalogos = data;
    const elegido = campo('proyectoId').value, filtro = $('#demo-filtro-proyecto').value;
    cargarSelect(campo('proyectoId'), data.proyectos, 'Elegí un proyecto', elegido);
    cargarSelect($('#demo-filtro-proyecto'), data.proyectos, 'Todos los proyectos', filtro);
    for (const option of campo('tipo').options) option.disabled = !data.tipos.includes(option.value);
    for (const [id, value] of [['#demo-total', data.resumen.total], ['#demo-publicadas', data.resumen.publicadas], ['#demo-borradores', data.resumen.borradores]]) $(id).textContent = value;
    $('#demo-guardar').disabled = !data.proyectos.length || !data.tipos.length;
    contadores();
  }
  function abrir(data = null) {
    actual = data; form.reset(); $('#demo-editor-vacio').hidden = true; form.hidden = false; $('#demo-errores').hidden = true;
    $('#demo-form-titulo').textContent = data ? 'Editar demo' : 'Nueva demo';
    $('#demo-form-etiqueta').textContent = data ? `EXPERIENCIA / ${String(data.id).padStart(2, '0')}` : 'NUEVA EXPERIENCIA';
    for (const key of ['titulo', 'descripcion', 'tipo', 'orden']) if (data) campo(key).value = data[key];
    campo('proyectoId').value = data?.proyectoId ?? catalogos.proyectos.find(p => p.publicado)?.id ?? catalogos.proyectos[0]?.id ?? '';
    if (!data) campo('tipo').value = catalogos.tipos.includes('algoritmos') ? 'algoritmos' : catalogos.tipos[0] || '';
    campo('publicada').checked = data?.publicada ?? false;
    const bloqueada = (data?.tareasGuardadas || 0) > 0;
    campo('proyectoId').disabled = bloqueada; campo('tipo').disabled = bloqueada;
    $('#demo-datos-aviso').hidden = !bloqueada;
    $('#demo-datos-aviso').textContent = `${data?.tareasGuardadas === 1 ? '1 tarea guardada' : `${data?.tareasGuardadas || 0} tareas guardadas`}. El proyecto y el tipo se conservan para protegerlas. El resto de la ficha se puede editar.`;
    $('#demo-form-info').textContent = data ? `Última actualización: ${new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(data.updatedAt))}` : 'Completá la ficha. Podés guardarla como borrador y publicarla cuando esté lista.';
    modificado = false; enfocar = true; contadores(); seleccionarTarjeta();
    $('#demo-editor').scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    if (!catalogos.proyectos.length) mensaje('Primero debe existir un proyecto para asociar la demo.', 'error');
  }
  function cerrar() { actual = null; modificado = false; form.hidden = true; $('#demo-editor-vacio').hidden = false; seleccionarTarjeta(); $('#demo-nueva').focus(); }
  function vacio(titulo, descripcion) {
    const el = nodo('div', '', 'demo-vacio'); el.append(nodo('span', '✳'), nodo('h3', titulo), nodo('p', descripcion)); $('#demo-listado').replaceChildren(el);
  }
  function tarjeta(demo) {
    const info = tipos[demo.tipo] || { nombre: demo.tipo, icono: '✳' };
    const el = document.createElement('article'); el.className = 'demo-tarjeta'; el.dataset.tipo = demo.tipo; el.dataset.demoId = demo.id;
    const arriba = nodo('div', '', 'demo-tarjeta-arriba'); const icono = nodo('span', info.icono, 'demo-icono'); icono.setAttribute('aria-hidden', 'true');
    const publicada = demo.publicada && demo.proyectoPublicado;
    const badge = nodo('span', publicada ? '● Publicada' : demo.publicada ? 'Proyecto en borrador' : '○ Borrador', 'demo-badge'); badge.dataset.estado = publicada ? 'publicada' : demo.publicada ? 'oculta' : 'borrador'; arriba.append(icono, badge);
    el.append(arriba, nodo('p', info.nombre.toUpperCase(), 'eyebrow'), nodo('h3', demo.titulo), nodo('p', demo.descripcion, 'demo-tarjeta-descripcion'), nodo('p', demo.proyectoTitulo, 'demo-tarjeta-proyecto'));
    const meta = nodo('div', '', 'demo-tarjeta-meta'); meta.append(nodo('span', `Orden ${String(demo.orden).padStart(2, '0')}`), nodo('span', demo.tareasGuardadas === 1 ? '1 tarea guardada' : demo.tareasGuardadas ? `${demo.tareasGuardadas} tareas guardadas` : 'Sin tareas guardadas')); el.append(meta);
    const acciones = nodo('div', '', 'acciones'); const editar = nodo('button', 'Editar demo ↗', 'btn btn-glass'); editar.type = 'button';
    editar.setAttribute('aria-label', `Editar ${demo.titulo}`);
    editar.addEventListener('click', () => tarea(async () => { if (!await descartar()) return; await cargarCatalogos(); abrir((await api(`/api/admin/demos/${demo.id}`)).data); }));
    acciones.append(editar);
    const eliminar = nodo('button', 'Eliminar', 'btn btn-glass'); eliminar.type = 'button';
    eliminar.addEventListener('click', () => tarea(async () => {
      if (!await confirmar('Eliminar demo', `Se eliminará «${demo.titulo}» y todas sus tareas guardadas. Esta acción es definitiva. Para conservar los datos, cancelá y despublicá la demo.`)) return;
      await api(`/api/admin/demos/${demo.id}`, 'DELETE');
      if (actual?.id === demo.id) cerrar();
      await cargarCatalogos(); await cargar(); mensaje('Demo eliminada junto con sus tareas.', 'exito');
    }));
    acciones.append(eliminar);
    if (publicada) { const enlace = nodo('a', 'Abrir demo →', 'enlace-flecha'); enlace.href = `/demos/${demo.id}`; acciones.append(enlace); }
    el.append(acciones); return el;
  }
  async function cargar() {
    $('#demo-listado').setAttribute('aria-busy', 'true');
    const query = new URLSearchParams(new FormData($('#demo-filtros')));
    for (const [key, value] of [...query]) if (!value.trim()) query.delete(key);
    query.set('page', page); query.set('pageSize', '10');
    const result = await api(`/api/admin/demos?${query}`); pages = result.meta.totalPages;
    if (page > Math.max(1, pages)) { page = Math.max(1, pages); return cargar(); }
    if (!result.data.length) vacio('Un espacio para la próxima idea', 'No hay demos para estos filtros. Cambiá la búsqueda o creá una nueva experiencia.');
    else $('#demo-listado').replaceChildren(...result.data.map(tarjeta));
    $('#demo-conteo').textContent = `${result.meta.total} ${result.meta.total === 1 ? 'experiencia encontrada' : 'experiencias encontradas'}`;
    $('#demo-pagina').textContent = pages ? `${page} / ${pages}` : '0 resultados';
    $('#demo-anterior').disabled = page <= 1; $('#demo-siguiente').disabled = page >= pages;
    seleccionarTarjeta(); $('#demo-listado').setAttribute('aria-busy', 'false');
  }
  for (const id of ['#demo-nueva', '#demo-empezar']) $(id).addEventListener('click', () => tarea(async () => { if (!await descartar()) return; await cargarCatalogos(); abrir(); }));
  for (const id of ['#demo-cerrar', '#demo-cancelar']) $(id).addEventListener('click', () => tarea(async () => { if (await descartar()) cerrar(); }));
  form.addEventListener('input', () => { modificado = true; contadores(); });
  form.addEventListener('change', () => { modificado = true; contadores(); });
  form.addEventListener('submit', event => {
    event.preventDefault(); if (ocupado || !form.reportValidity()) return;
    tarea(async () => {
      const data = { proyectoId: Number(campo('proyectoId').value), titulo: campo('titulo').value, descripcion: campo('descripcion').value, tipo: campo('tipo').value, publicada: campo('publicada').checked, orden: Number(campo('orden').value) };
      if (actual && (data.proyectoId !== actual.proyectoId || data.tipo !== actual.tipo) && !await confirmar('Cambiar la experiencia', 'Se cambiará el proyecto o el tipo de esta demo. Revisá su nueva ubicación e implementación antes de confirmar.')) return;
      const guardar = $('#demo-guardar'); guardar.textContent = 'Guardando…';
      try {
        const result = await api(`/api/admin/demos${actual ? `/${actual.id}` : ''}`, actual ? 'PUT' : 'POST', data);
        abrir(result.data);
        try { await cargarCatalogos(); await cargar(); mensaje('Demo guardada en la base de datos. Los cambios ya están disponibles según su publicación.', 'exito'); }
        catch { mensaje('La demo se guardó correctamente, pero no pudimos actualizar el listado. Volvé a cargarlo.', 'aviso'); }
      } finally { guardar.textContent = 'Guardar demo ↗'; }
    });
  });
  $('#demo-filtros').addEventListener('submit', event => { event.preventDefault(); tarea(async () => { page = 1; await cargar(); mensaje('Listado actualizado.'); }); });
  $('#demo-recargar').addEventListener('click', () => tarea(async () => { await cargarCatalogos(); await cargar(); mensaje('Datos actualizados desde la base.'); }));
  $('#demo-anterior').addEventListener('click', () => tarea(async () => { if (page > 1) { page--; await cargar(); } }));
  $('#demo-siguiente').addEventListener('click', () => tarea(async () => { if (page < pages) { page++; await cargar(); } }));
  window.addEventListener('beforeunload', event => { if (modificado) { event.preventDefault(); event.returnValue = ''; } });
  tarea(async () => { await cargarCatalogos(); await cargar(); mensaje('Elegí una demo para editarla o creá tu próxima experiencia.'); });
})();
