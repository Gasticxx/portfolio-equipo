(() => {
  const notificar = mensaje => { const salida = document.querySelector('#notificacion'); if (salida) salida.textContent = mensaje; };
  window.equipoUI = { notificar };
  const menu = document.querySelector('.menu-boton');
  const nav = document.querySelector('#navegacion');
  function cerrarMenu() { menu?.setAttribute('aria-expanded', 'false'); nav?.classList.remove('abierta'); }
  const escritorio = matchMedia('(min-width: 992px)');
  escritorio.addEventListener('change', () => {
    const focoEnNav = nav?.contains(document.activeElement);
    cerrarMenu();
    if (!escritorio.matches && focoEnNav) menu?.focus();
    else if (escritorio.matches && document.activeElement === menu) nav?.querySelector('a')?.focus();
  });
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

// Efectos de presentación exclusivos de I3. El cursor nativo es el respaldo.
(() => {
  const pagina = document.querySelector('.interfaz-i3');
  if (!pagina) return;
  const preciso = matchMedia('(hover: hover) and (pointer: fine)');
  const reducir = matchMedia('(prefers-reduced-motion: reduce)');
  const interactivo = 'a[href],button,[role="button"],[role="tab"],select,input[type="submit"],input[type="button"]';
  const controlMovimiento = document.createElement('button');
  controlMovimiento.type = 'button';
  controlMovimiento.className = 'control-movimiento';
  let pausado = false;
  function actualizarMovimiento() {
    pagina.classList.toggle('movimiento-pausado', pausado);
    controlMovimiento.disabled = reducir.matches;
    controlMovimiento.setAttribute('aria-pressed', String(pausado || reducir.matches));
    controlMovimiento.textContent = reducir.matches ? 'Movimiento reducido activado' : pausado ? 'Reanudar movimiento' : 'Pausar movimiento';
  }
  controlMovimiento.addEventListener('click', () => { pausado = !pausado; actualizarMovimiento(); });
  reducir.addEventListener('change', actualizarMovimiento);
  pagina.append(controlMovimiento);
  actualizarMovimiento();
  const excluido = 'input:not([type="submit"]):not([type="button"]),textarea,[contenteditable]:not([contenteditable="false"]),:disabled,[aria-disabled="true"],.disabled';
  let limpiarCursor = () => {};
  function configurarCursor() {
    limpiarCursor();
    if (!preciso.matches || reducir.matches || document.hidden) return;
    const cursor = document.createElement('div');
    cursor.className = 'cursor-cristal';
    cursor.setAttribute('aria-hidden', 'true');
    // SVG local, sin imágenes, scripts ni recursos externos que puedan fallar.
    cursor.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 38"><defs><linearGradient id="i3-cursor-vidrio" x2="1" y2="1"><stop stop-color="#ffffff" stop-opacity=".95"/><stop offset=".45" stop-color="#d5e7ff" stop-opacity=".65"/><stop offset="1" stop-color="#8c91e8" stop-opacity=".9"/></linearGradient></defs><path d="M2 2 L25 21 L15 23 L11 33 Z" fill="url(#i3-cursor-vidrio)" stroke="#334d87" stroke-width="1.4" stroke-linejoin="round"/><path d="M5 7 L19 19 L12 20" fill="none" stroke="white" stroke-width="1.5"/></svg>';
    pagina.append(cursor);
    const eventos = new AbortController();
    const opciones = { signal: eventos.signal, passive: true };
    let frame = 0;
    let x = 0;
    let y = 0;
    let permitido = false;
    function dibujar() {
      frame = 0;
      // La punta del SVG está en (2,2): coincide exactamente con el mouse.
      cursor.style.transform = `translate3d(${x - 2}px,${y - 2}px,0)`;
      cursor.classList.toggle('visible', permitido);
      pagina.classList.toggle('cursor-listo', permitido);
    }
    function mover(event) {
      if (event.pointerType !== 'mouse') { ocultar(); return; }
      x = event.clientX; y = event.clientY;
      permitido = event.target instanceof Element && !event.target.closest(excluido);
      cursor.classList.toggle('sobre-control', permitido && Boolean(event.target.closest(interactivo)));
      if (!frame) frame = requestAnimationFrame(dibujar);
    }
    function ocultar() {
      permitido = false;
      pagina.classList.remove('cursor-listo');
      cursor.classList.remove('visible', 'pulsando');
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    }
    document.addEventListener('pointermove', mover, opciones);
    document.addEventListener('pointerover', mover, opciones);
    document.addEventListener('pointerdown', () => cursor.classList.add('pulsando'), opciones);
    document.addEventListener('pointerup', () => cursor.classList.remove('pulsando'), opciones);
    document.documentElement.addEventListener('pointerleave', ocultar, opciones);
    window.addEventListener('blur', ocultar, opciones);
    document.addEventListener('focusin', ocultar, opciones);
    limpiarCursor = () => { ocultar(); eventos.abort(); cursor.remove(); };
  }
  function visibilidad() {
    pagina.classList.toggle('efectos-pausados', document.hidden);
    configurarCursor();
  }
  preciso.addEventListener('change', configurarCursor);
  reducir.addEventListener('change', configurarCursor);
  document.addEventListener('visibilitychange', visibilidad);
  window.addEventListener('pagehide', () => {
    limpiarCursor();
    pagina.classList.add('efectos-pausados');
  });
  window.addEventListener('pageshow', visibilidad);
  visibilidad();
})();
