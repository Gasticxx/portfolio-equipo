(() => {
  const form = document.getElementById('filtros-usuarios');
  if (!form) return;
  const rows = document.getElementById('usuarios-resultados');
  const message = document.getElementById('usuarios-mensaje');
  const pages = document.getElementById('usuarios-paginacion');
  let page = 1;

  async function csrf() {
    const response = await fetch('/api/csrf', { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
    const body = await response.json();
    if (!response.ok) throw new Error('No se pudo validar la solicitud.');
    return body.data?.csrfToken;
  }
  async function cargar() {
    message.textContent = 'Cargando…';
    const params = new URLSearchParams({ page: String(page), pageSize: '10' });
    const q = form.elements.q.value.trim();
    const activo = form.elements.activo.value;
    if (q) params.set('q', q);
    if (activo) params.set('activo', activo);
    try {
      const response = await fetch(`/api/admin/usuarios?${params}`, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? 'No se pudo cargar el listado.');
      rows.replaceChildren();
      for (const usuario of result.data) {
        const tr = document.createElement('tr');
        for (const value of [usuario.nombre, usuario.email, usuario.activo ? 'Activo' : 'Bloqueado', new Date(usuario.createdAt).toLocaleDateString('es-AR')]) {
          const td = document.createElement('td'); td.textContent = value; tr.append(td);
        }
        const action = document.createElement('td');
        const button = document.createElement('button'); button.type = 'button'; button.className = usuario.activo ? 'btn btn-outline-danger btn-sm' : 'btn btn-outline-success btn-sm'; button.textContent = usuario.activo ? 'Bloquear' : 'Rehabilitar';
        button.addEventListener('click', () => cambiar(usuario.id, !usuario.activo)); action.append(button); tr.append(action); rows.append(tr);
      }
      message.textContent = `${result.meta.total} cuenta(s)`;
      pages.replaceChildren();
      for (let n = 1; n <= result.meta.totalPages; n++) {
        const li = document.createElement('li'); li.className = `page-item${n === page ? ' active' : ''}`;
        const a = document.createElement('button'); a.type = 'button'; a.className = 'page-link'; a.textContent = String(n); a.addEventListener('click', () => { page = n; cargar(); }); li.append(a); pages.append(li);
      }
    } catch (error) { message.textContent = error.message; }
  }
  async function cambiar(id, activo) {
    try {
      const token = await csrf();
      const response = await fetch(`/api/admin/usuarios/${id}`, { method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': token }, body: JSON.stringify({ activo }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? 'No se pudo actualizar el estado.');
      await cargar();
    } catch (error) { message.textContent = error.message; }
  }
  form.addEventListener('submit', event => { event.preventDefault(); page = 1; cargar(); });
  cargar();
})();
