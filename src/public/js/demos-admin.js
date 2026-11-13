(() => {
  const form = document.querySelector('#demo-form');
  const estado = document.querySelector('#demo-estado');
  const lista = document.querySelector('#demo-listado');
  let editando = null;
  let ocupado = false;
  function mensaje(texto, tipo = 'aviso') { estado.className = `alerta alerta-${tipo}`; estado.textContent = texto; }
  function nueva() {
    editando = null; form.reset(); form.elements.proyecto_id.disabled = false; form.elements.tipo.disabled = false;
    document.querySelector('#demo-form-titulo').textContent = 'Nueva demo';
  }
  async function cargar() {
    const response = await fetch('/api/admin/demos', { headers: { Accept: 'application/json' } });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message || 'No se pudieron cargar las demos.');
    const proyecto = form.elements.proyecto_id.value;
    form.elements.proyecto_id.replaceChildren();
    for (const p of body.data.proyectos) {
      const option = document.createElement('option'); option.value = p.id; option.textContent = p.titulo + (p.publicado ? '' : ' (borrador)'); form.elements.proyecto_id.append(option);
    }
    if (proyecto) form.elements.proyecto_id.value = proyecto;
    form.querySelector('[type=submit]').disabled = !body.data.proyectos.length;
    lista.replaceChildren();
    for (const d of body.data.demos) {
      const article = document.createElement('article'); article.className = 'demo-admin-item';
      const titulo = document.createElement('h3'); titulo.textContent = d.titulo;
      const info = document.createElement('p'); info.textContent = `${d.proyecto_titulo} · ${d.tipo} · ${d.publicada ? (d.proyecto_publicado ? 'Publicada' : 'Proyecto sin publicar') : 'Borrador'}`;
      const descripcion = document.createElement('p'); descripcion.textContent = d.descripcion;
      const editar = document.createElement('button'); editar.type = 'button'; editar.className = 'btn btn-glass'; editar.textContent = 'Editar';
      editar.addEventListener('click', () => {
        if (ocupado) return;
        editando = d.id;
        for (const campo of ['proyecto_id', 'tipo', 'titulo', 'descripcion', 'orden']) form.elements[campo].value = d[campo];
        form.elements.publicada.checked = d.publicada; form.elements.proyecto_id.disabled = true; form.elements.tipo.disabled = true;
        document.querySelector('#demo-form-titulo').textContent = 'Editar demo'; form.elements.titulo.focus();
      });
      article.append(titulo, info, descripcion, editar); lista.append(article);
    }
    if (!body.data.proyectos.length) mensaje('No hay proyectos cargados. Primero el equipo debe cargar un proyecto.');
    else mensaje(body.data.demos.length ? `${body.data.demos.length} demos cargadas.` : 'Todavía no hay demos. Podés crear la primera.');
  }
  document.querySelector('#demo-nueva').addEventListener('click', () => { if (!ocupado) nueva(); });
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (ocupado || !form.reportValidity()) return;
    ocupado = true;
    const boton = form.querySelector('[type=submit]'); boton.disabled = true;
    try {
      const csrfResponse = await fetch('/api/csrf'); const csrf = await csrfResponse.json();
      if (!csrfResponse.ok) throw new Error('No se pudo verificar la sesión.');
      const datos = { proyecto_id: Number(form.elements.proyecto_id.value), titulo: form.elements.titulo.value, descripcion: form.elements.descripcion.value, tipo: form.elements.tipo.value, publicada: form.elements.publicada.checked, orden: Number(form.elements.orden.value) };
      const response = await fetch('/api/admin/demos' + (editando ? `/${editando}` : ''), { method: editando ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': csrf.data.csrfToken }, body: JSON.stringify(datos) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || 'No se pudo guardar.');
      nueva(); await cargar(); mensaje('Demo guardada correctamente.', 'exito');
    } catch (error) { mensaje(error.message, 'error'); }
    finally { ocupado = false; boton.disabled = !form.elements.proyecto_id.options.length; }
  });
  cargar().catch(error => mensaje(error.message, 'error'));
})();
