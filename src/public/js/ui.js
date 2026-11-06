(() => {
  const notificar = mensaje => { const salida = document.querySelector('#notificacion'); if (salida) salida.textContent = mensaje; };
  window.equipoUI = { notificar };
  const menu = document.querySelector('.menu-boton');
  const nav = document.querySelector('#navegacion');
  function cerrarMenu() { menu?.setAttribute('aria-expanded', 'false'); nav?.classList.remove('abierta'); }
  menu?.addEventListener('click', () => {
    const abierto = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(abierto)); nav.classList.toggle('abierta', abierto);
  });
  document.addEventListener('keydown', event => { if(event.key === 'Escape' && menu?.getAttribute('aria-expanded') === 'true') { cerrarMenu(); menu.focus(); } });
  nav?.addEventListener('click', event => { if(event.target.closest('a')) cerrarMenu(); });
  const reducir = matchMedia('(prefers-reduced-motion: reduce)');
  if ('IntersectionObserver' in window && !reducir.matches) {
    const observador = new IntersectionObserver(entradas => entradas.forEach(entrada => { if(entrada.isIntersecting) { entrada.target.classList.remove('esperando'); observador.unobserve(entrada.target); } }), {threshold:.08});
    document.querySelectorAll('.revelar').forEach(tarjeta => { tarjeta.classList.add('esperando'); observador.observe(tarjeta); });
    reducir.addEventListener('change', () => { if(reducir.matches) { document.querySelectorAll('.esperando').forEach(el=>el.classList.remove('esperando')); observador.disconnect(); } });
  }
  document.querySelectorAll('img').forEach(img => img.addEventListener('error', () => { img.hidden=true; img.nextElementSibling?.classList.remove('oculto'); }));
  document.querySelectorAll('[data-formulario-ejemplo]').forEach(form => {
    form.addEventListener('submit', event => {
      event.preventDefault(); let primero;
      form.querySelectorAll('input,textarea').forEach(campo => {
        const invalido = !campo.checkValidity() || !campo.value.trim();
        campo.setAttribute('aria-invalid', String(invalido));
        const error = document.getElementById(`${campo.id}-error`);
        if(error) error.textContent = invalido ? (campo.validity.typeMismatch ? 'Ingresá un correo electrónico válido.' : 'Completá este campo con un valor válido.') : '';
        if(invalido && !primero) primero=campo;
      });
      if(primero) { primero.focus(); return; }
      form.querySelector('[data-formulario-estado]').textContent='Campos revisados. Esta muestra no envía información ni inicia una sesión.';
      form.querySelectorAll('input[type=password]').forEach(input=>input.value='');
    });
  });
  const confirmar = document.querySelector('[data-confirmar-ejemplo]');
  const dialogo = document.querySelector('#confirmacion-ejemplo');
  confirmar?.addEventListener('click',()=>dialogo.showModal());
  dialogo?.addEventListener('close',()=>{ confirmar.focus(); if(dialogo.returnValue==='eliminar') notificar('Confirmación revisada. No se eliminaron datos reales.'); });
  document.querySelector('[data-salir]')?.addEventListener('click',()=>document.dispatchEvent(new CustomEvent('equipo:salir')));
})();
