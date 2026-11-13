(() => {
  const lab = document.querySelector('[data-ondas]');
  if (!lab) return;
  const $ = selector => lab.querySelector(selector);
  const canvas = $('[data-ondas-canvas]'), ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) { canvas.hidden = true; $('[data-ondas-sin-canvas]').hidden = false; lab.querySelectorAll('button,input').forEach(el => { el.disabled = true; }); return; }
  const pagina = document.body, reducir = matchMedia('(prefers-reduced-motion: reduce)');
  const buffer = document.createElement('canvas'), pintura = buffer.getContext('2d', { alpha: false });
  const parametros = { frecuencia: .9, amplitud: .75, velocidad: 30 };
  let fuentes = escenarioOndas(), seleccionado = 0, tiempo = 2.4, pausado = false, suspendido = false, foco = true;
  let frame = 0, ultimo = 0, ancho = 1, alto = 1, dpr = 1, imagen, distancias = [], geometriaSucia = true, arrastre = null, ultimoReloj = -1;
  let presupuesto = 22000, cuadrosLentos = 0;
  const avisar = texto => { $('[data-ondas-estado]').textContent = texto; };
  const activo = () => !pausado && !suspendido && foco && !document.hidden && !reducir.matches && !pagina.classList.contains('movimiento-pausado');

  function parametrosVisuales() {
    for (const [clave, valor] of Object.entries(parametros)) {
      $(`[data-ondas-param=${clave}]`).value = valor;
      $(`[data-ondas-valor=${clave}]`).textContent = clave === 'frecuencia' ? `${valor.toFixed(1).replace('.', ',')} Hz` : clave === 'amplitud' ? `${Math.round(valor * 100)} %` : `${valor} u/s`;
    }
  }
  function mostrarFuentes() {
    const lista = $('[data-ondas-fuentes]'); lista.replaceChildren();
    fuentes.forEach((fuente, i) => {
      const boton = document.createElement('button'); boton.type = 'button'; boton.dataset.fuente = i;
      boton.textContent = `Emisor ${i + 1}`; boton.setAttribute('aria-pressed', String(i === seleccionado)); lista.append(boton);
    });
    $('[data-ondas-cantidad]').textContent = `${fuentes.length} ${fuentes.length === 1 ? 'emisor' : 'emisores'}`;
    $('[data-ondas-agregar]').disabled = fuentes.length >= ONDAS_MAX_EMISORES;
    $('[data-ondas-quitar]').disabled = fuentes.length <= 1;
    $('#ondas-x').value = Math.round(fuentes[seleccionado].x * 100);
    $('#ondas-y').value = Math.round(fuentes[seleccionado].y * 100);
    $('[data-ondas-fase]').checked = fuentes[seleccionado].fase !== 0;
  }
  function pedirCuadro() { if (!frame && !suspendido && !document.hidden) frame = requestAnimationFrame(cuadro); }
  function revisarReproduccion() {
    if (frame) cancelAnimationFrame(frame); frame = 0; ultimo = 0;
    const bloqueado = reducir.matches || pagina.classList.contains('movimiento-pausado');
    const boton = $('[data-ondas-play]'); boton.disabled = bloqueado;
    boton.textContent = bloqueado ? 'Movimiento reducido / pausado' : pausado ? 'Reanudar' : 'Pausar';
    boton.setAttribute('aria-pressed', String(!activo()));
    avisar(bloqueado ? 'Animación detenida por la preferencia de movimiento. Podés explorar con «Un paso».' : activo() ? 'En reproducción · mové las fuentes para explorar.' : 'En pausa · podés ajustar los controles o avanzar un paso.');
    pedirCuadro();
  }
  function cambiarEscenario(nombre) {
    fuentes = escenarioOndas(nombre); seleccionado = 0; tiempo = 2.4; geometriaSucia = true;
    lab.querySelectorAll('[data-ondas-preset]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.ondasPreset === nombre)));
    mostrarFuentes(); pedirCuadro(); avisar('Escenario listo. Compará las zonas de color y equilibrio.');
  }
  function marcarPersonalizado() { lab.querySelectorAll('[data-ondas-preset]').forEach(b => b.setAttribute('aria-pressed', 'false')); }
  function agregar(x = .5, y = .35) {
    if (fuentes.length >= ONDAS_MAX_EMISORES) { avisar('El máximo es seis emisores. Mové uno existente o quitá el seleccionado.'); return false; }
    fuentes.push({ x: limitarOnda(x, .05, .95), y: limitarOnda(y, .05, .95), fase: 0, nacimiento: tiempo });
    seleccionado = fuentes.length - 1; geometriaSucia = true; marcarPersonalizado(); mostrarFuentes(); pedirCuadro();
    avisar(`Emisor ${seleccionado + 1} agregado.`); return true;
  }
  function mover(x, y) {
    fuentes[seleccionado].x = limitarOnda(x, .05, .95); fuentes[seleccionado].y = limitarOnda(y, .05, .95);
    geometriaSucia = true; marcarPersonalizado(); $('#ondas-x').value = Math.round(fuentes[seleccionado].x * 100); $('#ondas-y').value = Math.round(fuentes[seleccionado].y * 100); pedirCuadro();
  }
  function redimensionar() {
    const caja = canvas.getBoundingClientRect(); ancho = Math.max(1, caja.width); alto = Math.max(1, caja.height);
    dpr = Math.min(devicePixelRatio || 1, 1.5, 1200 / ancho, 900 / alto);
    canvas.width = Math.round(ancho * dpr); canvas.height = Math.round(alto * dpr);
    const escala = Math.min(.5, Math.sqrt(presupuesto / (ancho * alto)));
    buffer.width = Math.max(1, Math.floor(ancho * escala)); buffer.height = Math.max(1, Math.floor(alto * escala));
    imagen = pintura.createImageData(buffer.width, buffer.height); geometriaSucia = true; pedirCuadro();
  }
  function cachearDistancias() {
    distancias = fuentes.map(fuente => {
      const cache = new Float32Array(buffer.width * buffer.height);
      for (let y = 0; y < buffer.height; y++) for (let x = 0; x < buffer.width; x++) {
        cache[y * buffer.width + x] = Math.hypot((x / buffer.width - fuente.x) * ancho / alto * 100, (y / buffer.height - fuente.y) * 100);
      }
      return cache;
    }); geometriaSucia = false;
  }
  function dibujar() {
    if (!imagen) return;
    if (geometriaSucia) cachearDistancias();
    const pixeles = imagen.data;
    for (let i = 0; i < distancias[0].length; i++) {
      let suma = 0;
      for (let f = 0; f < fuentes.length; f++) suma += aporteOnda(distancias[f][i], tiempo, fuentes[f], parametros.frecuencia, parametros.velocidad);
      const valor = suma * parametros.amplitud, intensidad = Math.min(1, Math.abs(valor) * .7), p = i * 4;
      pixeles[p] = 7 + intensidad * (valor >= 0 ? 60 : 158);
      pixeles[p + 1] = 16 + intensidad * (valor >= 0 ? 199 : 104);
      pixeles[p + 2] = 36 + intensidad * (valor >= 0 ? 190 : 190); pixeles[p + 3] = 255;
    }
    pintura.putImageData(imagen, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = true;
    ctx.drawImage(buffer, 0, 0, ancho, alto);
    ctx.strokeStyle = '#a2c1ed10'; ctx.lineWidth = 1;
    for (let x = 0; x < ancho; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, alto); ctx.stroke(); }
    for (let y = 0; y < alto; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ancho, y); ctx.stroke(); }
    fuentes.forEach((fuente, i) => {
      const x = fuente.x * ancho, y = fuente.y * alto;
      const longitud = parametros.velocidad / parametros.frecuencia;
      const frente = (tiempo - fuente.nacimiento) * parametros.velocidad;
      ctx.strokeStyle = fuente.fase ? '#d4b5ff30' : '#9ce9f730'; ctx.lineWidth = 1;
      for (let n = Math.max(0, Math.floor((frente - 200) / longitud)); parametros.amplitud > 0 && n <= Math.floor(frente / longitud); n++) {
        const radio = (frente - n * longitud) * alto / 100;
        if (radio > 0) { ctx.beginPath(); ctx.arc(x, y, radio, 0, Math.PI * 2); ctx.stroke(); }
      }
      ctx.beginPath(); ctx.arc(x, y, i === seleccionado ? 17 : 14, 0, Math.PI * 2);
      ctx.fillStyle = '#101c38e8'; ctx.fill(); ctx.strokeStyle = i === seleccionado ? '#fff' : '#b4d6ed99'; ctx.lineWidth = i === seleccionado ? 2 : 1; ctx.stroke();
      ctx.fillStyle = fuente.fase ? '#d5b7ff' : '#9cedf4'; ctx.font = '600 12px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), x, y);
    });
    const reloj = Math.floor(tiempo * 10);
    if (reloj !== ultimoReloj) { $('[data-ondas-reloj]').textContent = `${(reloj / 10).toFixed(1)} s`; ultimoReloj = reloj; }
  }
  function cuadro(ahora) {
    frame = 0;
    if (activo() && ultimo) tiempo += Math.min((ahora - ultimo) / 1000, .05);
    ultimo = activo() ? ahora : 0;
    const inicio = performance.now(); dibujar();
    if (performance.now() - inicio > 22) cuadrosLentos++; else cuadrosLentos = Math.max(0, cuadrosLentos - 1);
    if (cuadrosLentos > 20 && presupuesto > 6500) { presupuesto = Math.max(6500, Math.round(presupuesto * .75)); cuadrosLentos = 0; redimensionar(); }
    if (activo()) pedirCuadro();
  }

  $('[data-ondas-play]').addEventListener('click', () => { pausado = !pausado; revisarReproduccion(); });
  $('[data-ondas-paso]').addEventListener('click', () => { pausado = true; tiempo += .2; revisarReproduccion(); });
  $('[data-ondas-reiniciar]').addEventListener('click', () => { Object.assign(parametros, { frecuencia: .9, amplitud: .75, velocidad: 30 }); parametrosVisuales(); cambiarEscenario('interferencia'); tiempo = 0; revisarReproduccion(); });
  lab.querySelectorAll('[data-ondas-preset]').forEach(b => b.addEventListener('click', () => cambiarEscenario(b.dataset.ondasPreset)));
  lab.querySelectorAll('[data-ondas-param]').forEach(input => input.addEventListener('input', () => {
    parametros[input.dataset.ondasParam] = limitarOnda(input.value, Number(input.min), Number(input.max)); parametrosVisuales(); pedirCuadro();
  }));
  $('[data-ondas-fuentes]').addEventListener('click', e => {
    const boton = e.target.closest('[data-fuente]'); if (!boton) return;
    seleccionado = Number(boton.dataset.fuente); mostrarFuentes(); pedirCuadro(); avisar(`Emisor ${seleccionado + 1} seleccionado. Usá sus controles de posición y fase.`);
    $('[data-ondas-fuentes]').children[seleccionado].focus({ preventScroll: true });
  });
  $('[data-ondas-agregar]').addEventListener('click', () => agregar(.5, .25 + fuentes.length * .07));
  $('[data-ondas-quitar]').addEventListener('click', () => {
    if (fuentes.length <= 1) return; fuentes.splice(seleccionado, 1); seleccionado = Math.min(seleccionado, fuentes.length - 1);
    geometriaSucia = true; marcarPersonalizado(); mostrarFuentes(); pedirCuadro(); avisar('Emisor quitado.');
  });
  $('#ondas-x').addEventListener('input', e => mover(Number(e.target.value) / 100, fuentes[seleccionado].y));
  $('#ondas-y').addEventListener('input', e => mover(fuentes[seleccionado].x, Number(e.target.value) / 100));
  $('[data-ondas-fase]').addEventListener('change', e => { fuentes[seleccionado].fase = e.target.checked ? Math.PI : 0; marcarPersonalizado(); pedirCuadro(); });
  canvas.addEventListener('pointerdown', e => {
    if (arrastre !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const caja = canvas.getBoundingClientRect(), x = (e.clientX - caja.left) / caja.width, y = (e.clientY - caja.top) / caja.height;
    const indice = fuentes.findIndex(f => Math.hypot((f.x - x) * ancho, (f.y - y) * alto) <= 24);
    if (indice !== -1) seleccionado = indice; else if (!agregar(x, y)) return;
    arrastre = e.pointerId; canvas.setPointerCapture(e.pointerId); canvas.focus({ preventScroll: true }); mostrarFuentes(); pedirCuadro();
  });
  canvas.addEventListener('pointermove', e => {
    if (arrastre !== e.pointerId) return; const caja = canvas.getBoundingClientRect(); mover((e.clientX - caja.left) / caja.width, (e.clientY - caja.top) / caja.height);
  });
  for (const evento of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(evento, e => { if (arrastre === e.pointerId) arrastre = null; });
  canvas.addEventListener('keydown', e => {
    const direcciones = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (!direcciones[e.key]) return; e.preventDefault(); const [dx, dy] = direcciones[e.key], paso = e.shiftKey ? .05 : .01;
    mover(fuentes[seleccionado].x + dx * paso, fuentes[seleccionado].y + dy * paso);
  });
  reducir.addEventListener('change', revisarReproduccion); pagina.addEventListener('i3:movimiento', revisarReproduccion);
  document.addEventListener('visibilitychange', revisarReproduccion);
  window.addEventListener('blur', () => { foco = false; revisarReproduccion(); });
  window.addEventListener('focus', () => { foco = true; revisarReproduccion(); });
  window.addEventListener('pagehide', () => { suspendido = true; revisarReproduccion(); });
  window.addEventListener('pageshow', () => { suspendido = false; revisarReproduccion(); });
  new ResizeObserver(redimensionar).observe(canvas);
  parametrosVisuales(); mostrarFuentes(); redimensionar(); revisarReproduccion();
})();
