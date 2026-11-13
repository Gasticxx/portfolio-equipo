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
  const temaSistema = matchMedia('(prefers-color-scheme: dark)');
  const botonTema = pagina.querySelector('.tema-boton');
  const sol = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>';
  const luna = '<path d="M20.5 14A9 9 0 0 1 10 3.5 9 9 0 1 0 20.5 14Z"/>';
  const iconoTema = contenido => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${contenido}</svg>`;
  const ambiente = pagina.querySelector('.ambiente');
  for (let i = 0; i < 4; i++) {
    const figura = document.createElement('span');
    figura.className = `astro astro-${i + 1}`;
    figura.innerHTML = `<span class="astro-sol">${iconoTema(sol)}</span><span class="astro-luna">${iconoTema(luna)}</span>`;
    ambiente?.append(figura);
  }
  let temaGuardado;
  try { temaGuardado = localStorage.getItem('i3-tema'); } catch {}
  function aplicarTema(oscuro) {
    pagina.classList.toggle('tema-oscuro', oscuro);
    botonTema?.setAttribute('aria-pressed', String(oscuro));
    if (botonTema) {
      botonTema.innerHTML = iconoTema(oscuro ? luna : sol);
      botonTema.setAttribute('aria-label', oscuro ? 'Activar modo claro' : 'Activar modo oscuro');
      botonTema.title = oscuro ? 'Activar modo claro' : 'Activar modo oscuro';
    }
    pagina.dispatchEvent(new Event('i3:tema'));
  }
  aplicarTema(temaGuardado ? temaGuardado === 'oscuro' : temaSistema.matches);
  if (botonTema) botonTema.hidden = false;
  botonTema?.addEventListener('click', () => {
    const oscuro = !pagina.classList.contains('tema-oscuro');
    temaGuardado = oscuro ? 'oscuro' : 'claro';
    aplicarTema(oscuro);
    try { localStorage.setItem('i3-tema', temaGuardado); } catch {}
  });
  temaSistema.addEventListener('change', () => { if (!temaGuardado) aplicarTema(temaSistema.matches); });
  // Ilustraciones locales: decorativas, sin interceptar enlaces ni agregar tabulaciones.
  const dibujos = {
    '/mi-cuenta':'<circle cx="32" cy="22" r="10"/><path d="M12 54v-7q0-14 20-14t20 14v7"/><path class="detalle" d="m41 19 4 4 8-8"/>',
    '/operador/consultas':'<path d="M8 12h48v32H29L17 54V44H8Z"/><path class="detalle" d="M18 23h28M18 32h19"/>',
    '/admin':'<rect x="9" y="9" width="18" height="18" rx="4"/><rect x="37" y="9" width="18" height="18" rx="4"/><rect x="9" y="37" width="18" height="18" rx="4"/><path class="detalle" d="M37 46h18m-9-9v18"/>',
    '/demos':'<rect x="9" y="10" width="46" height="44" rx="7"/><path d="M9 23h46M22 5v11m20-11v11"/><path class="detalle" d="m27 32 13 7-13 7Z"/>',
    '/':'<path d="M12 31 32 13l20 18M18 27v25h28V27M28 52V37h9v15"/><path class="detalle" d="m44 14 2-5 2 5 5 2-5 2-2 5-2-5-5-2Z"/>',
    '/equipo':'<circle cx="32" cy="23" r="7"/><circle cx="14" cy="28" r="6"/><circle cx="50" cy="28" r="6"/><path d="M21 51V41q0-10 11-10t11 10v10M5 50V41q0-8 9-8l9 6m36 11V41q0-8-9-8l-9 6"/><path class="detalle" d="M14 43q18 16 36 0"/>',
    '/servicios':'<rect x="9" y="15" width="46" height="36" rx="5"/><path d="M9 25h46m-37-5h1m5 0h1m5 0h1M24 33l-6 6 6 6m16-12 6 6-6 6m-5-13-6 15"/>',
    '/proyectos':'<path d="M8 23v29h48V19H32l-6-7H8v11Z"/><path class="detalle" d="m25 41 5 5 12-13"/>',
    '/contacto':'<rect x="15" y="10" width="38" height="46" rx="5"/><path d="M22 10v46M11 19h8m-8 10h8m-8 10h8m-8 10h8"/><circle cx="37" cy="26" r="5"/><path class="detalle" d="M29 41q0-10 8-10t8 10m-14 7h12"/>',
    '/login':'<rect x="29" y="10" width="24" height="46" rx="4"/><path class="detalle" d="M7 33h32m-9-9 9 9-9 9m15-10h1"/>',
    '/registro':'<circle cx="27" cy="22" r="9"/><path d="M10 53v-7q0-13 17-13 9 0 13 5"/><path class="detalle" d="M48 37v18m-9-9h18"/>'
  };
  let enlaceIlustrado = null;
  function mostrarIlustracion(enlace) {
    if (enlace === enlaceIlustrado) return;
    enlaceIlustrado?.classList.remove('ilustrado');
    enlaceIlustrado = enlace;
    enlace.classList.add('ilustrado');
  }
  function ocultarIlustracion() {
    enlaceIlustrado?.classList.remove('ilustrado');
    enlaceIlustrado = null;
  }
  pagina.querySelectorAll('.navegacion a').forEach(enlace => {
    // El preview y la aplicacion comparten ilustraciones aunque usen rutas distintas.
    const ruta = (enlace.getAttribute('href') || '').replace(/^\/i3(?=\/|$)/, '') || '/';
    const dibujo = dibujos[ruta];
    if (!dibujo) return;
    const ilustracion = document.createElement('span');
    ilustracion.className = 'nav-ilustracion';
    ilustracion.setAttribute('aria-hidden','true');
    ilustracion.innerHTML = `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${dibujo}</svg>`;
    enlace.append(ilustracion);
    enlace.classList.add('con-ilustracion');
    enlace.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') mostrarIlustracion(enlace); });
    enlace.addEventListener('pointerleave', () => {
      if (document.activeElement !== enlace) ocultarIlustracion();
    });
    enlace.addEventListener('focus', () => { if (enlace.matches(':focus-visible')) mostrarIlustracion(enlace); });
    enlace.addEventListener('blur', ocultarIlustracion);
    enlace.addEventListener('click', ocultarIlustracion);
  });
  window.addEventListener('scroll', ocultarIlustracion, {passive:true});
  window.addEventListener('resize', ocultarIlustracion);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') ocultarIlustracion(); });
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
    pagina.dispatchEvent(new Event('i3:movimiento'));
  }
  controlMovimiento.addEventListener('click', () => { pausado = !pausado; actualizarMovimiento(); configurarCursor(); });
  reducir.addEventListener('change', actualizarMovimiento);
  pagina.append(controlMovimiento);
  actualizarMovimiento();
  const excluido = 'input:not([type="submit"]):not([type="button"]),textarea,[contenteditable]:not([contenteditable="false"]),:disabled,[aria-disabled="true"],.disabled';
  let limpiarCursor = () => {};
  function configurarCursor() {
    limpiarCursor();
    if (!preciso.matches || reducir.matches || document.hidden || pausado) return;
    const cursor = document.createElement('div');
    cursor.className = 'cursor-cristal';
    cursor.setAttribute('aria-hidden', 'true');
    // SVG local, sin imágenes, scripts ni recursos externos que puedan fallar.
    cursor.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 38"><defs><linearGradient id="i3-cursor-vidrio" x2="1" y2="1"><stop stop-color="#ffffff" stop-opacity=".95"/><stop offset=".45" stop-color="#d5e7ff" stop-opacity=".65"/><stop offset="1" stop-color="#8c91e8" stop-opacity=".9"/></linearGradient></defs><path d="M2 2 L25 21 L15 23 L11 33 Z" fill="url(#i3-cursor-vidrio)" stroke="#334d87" stroke-width="1.4" stroke-linejoin="round"/><path d="M5 7 L19 19 L12 20" fill="none" stroke="white" stroke-width="1.5"/></svg>';
    pagina.append(cursor);
    const dibujo = cursor.querySelector('svg');
    const eventos = new AbortController();
    const opciones = { signal: eventos.signal, passive: true };
    let frame = 0;
    let x = 0;
    let y = 0;
    let permitido = false;
    let angulo = 0, objetivo = 0, ultimoTiempo = 0, ultimoMovimiento = 0;
    function dibujar(tiempo) {
      frame = 0;
      const paso = ultimoTiempo ? Math.min((tiempo - ultimoTiempo) / 16.67, 3) : 1;
      ultimoTiempo = tiempo;
      if (tiempo - ultimoMovimiento > 65) objetivo = 0;
      angulo += (objetivo - angulo) * (1 - Math.exp(-.24 * paso));
      dibujo.style.rotate = `${angulo}deg`;
      // La punta del SVG está en (2,2): coincide exactamente con el mouse.
      cursor.style.transform = `translate3d(${x - 2}px,${y - 2}px,0)`;
      cursor.classList.toggle('visible', permitido);
      pagina.classList.toggle('cursor-listo', permitido);
      if (permitido && (Math.abs(angulo) > .05 || Math.abs(objetivo) > .05)) frame = requestAnimationFrame(dibujar);
      else ultimoTiempo = 0;
    }
    function mover(event) {
      if (event.pointerType !== 'mouse') { ocultar(); return; }
      const dx = event.clientX - x, dy = event.clientY - y;
      const ahora = performance.now();
      const intervalo = Math.max(8,ahora - ultimoMovimiento);
      objetivo = permitido ? Math.max(-24,Math.min(24,(dx * .9 - dy * .65) * 16.67 / intervalo)) : 0;
      x = event.clientX; y = event.clientY;
      ultimoMovimiento = ahora;
      permitido = event.target instanceof Element && !event.target.closest(excluido);
      cursor.classList.toggle('sobre-control', permitido && Boolean(event.target.closest(interactivo)));
      if (!frame) frame = requestAnimationFrame(dibujar);
    }
    function ocultar() {
      permitido = false;
      pagina.classList.remove('cursor-listo');
      cursor.classList.remove('visible', 'pulsando');
      angulo = objetivo = ultimoTiempo = 0;
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
