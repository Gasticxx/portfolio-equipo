(() => {
  const controles = [];
  for (const input of document.querySelectorAll('input[type="password"]')) {
    if (input.closest('.password-control')) continue;
    const grupo = document.createElement('div'), boton = document.createElement('button');
    const etiqueta = /confirm/i.test(input.id) ? 'confirmación de contraseña' : input.labels?.[0]?.textContent.trim().toLowerCase() || 'contraseña';
    grupo.className = 'password-control';
    boton.type = 'button'; boton.className = 'password-toggle';
    boton.setAttribute('aria-controls', input.id);
    boton.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/><path class="password-ojo-tachado" d="m3 3 18 18"/></svg>';
    input.before(grupo); grupo.append(input, boton);
    function mostrar(visible) {
      const inicio = input.selectionStart, fin = input.selectionEnd;
      input.type = visible ? 'text' : 'password';
      grupo.classList.toggle('password-visible', visible);
      boton.setAttribute('aria-pressed', String(visible));
      boton.setAttribute('aria-label', `${visible ? 'Ocultar' : 'Mostrar'} ${etiqueta}`);
      boton.title = boton.getAttribute('aria-label');
      if (inicio !== null && fin !== null) input.setSelectionRange(inicio, fin);
    }
    boton.addEventListener('click', () => mostrar(input.type === 'password'));
    const ocultar = () => mostrar(false);
    input.form?.addEventListener('submit', ocultar, { capture: true });
    input.form?.addEventListener('reset', ocultar);
    controles.push(ocultar); ocultar();
  }
  const ocultarTodas = () => controles.forEach(ocultar => ocultar());
  window.addEventListener('pagehide', ocultarTodas);
  document.addEventListener('visibilitychange', () => { if (document.hidden) ocultarTodas(); });
})();
