(() => {
  const pagina = document.querySelector('.interfaz-i3');
  const rueda = pagina?.querySelector('[data-equipo-rueda]');
  if (!rueda) return;
  const tarjetas = [...rueda.querySelectorAll('.equipo-orbita-item')];
  if (tarjetas.length < 2) return;
  const reducir = matchMedia('(prefers-reduced-motion: reduce)');
  const estado = rueda.querySelector('.equipo-posicion');
  let actual = 0, repeticion = 0, fase = 0, frame = 0, inicio = null, desde = 0;
  let radio = Math.min(360,rueda.clientWidth*.34);
  function detener() { clearTimeout(repeticion); repeticion = 0; }
  function dibujar() {
    tarjetas.forEach((tarjeta,i) => {
      const angulo = (i-fase)*Math.PI*2/tarjetas.length;
      const profundidad = (Math.cos(angulo)+1)/2;
      const lateral = Math.sin(angulo);
      tarjeta.style.transform = `translateX(-50%) translate3d(${lateral*radio}px,${20-(1-profundidad)*110}px,0) scale(${.5+profundidad*.5}) rotateY(${-lateral*14}deg)`;
      tarjeta.style.opacity = String(.12+profundidad*.88);
      tarjeta.style.zIndex = String(1+Math.round(profundidad*100));
    });
  }
  function mostrar() {
    const indice = ((actual % tarjetas.length)+tarjetas.length) % tarjetas.length;
    tarjetas.forEach((tarjeta,i) => {
      const posicion = ((i-indice+tarjetas.length+Math.floor(tarjetas.length/2)) % tarjetas.length)-Math.floor(tarjetas.length/2);
      tarjeta.dataset.posicion = String(posicion);
      const atras = Math.abs(posicion) > 1;
      tarjeta.inert = atras;
      tarjeta.setAttribute('aria-hidden',String(atras));
    });
    estado.textContent = `${indice+1} de ${tarjetas.length} · ${tarjetas[indice].dataset.nombre}`;
  }
  function animar(ahora) {
    frame = 0;
    if (inicio === null) inicio = ahora;
    const progreso = Math.min(1,(ahora-inicio)/650);
    const curva = (1-Math.cos(progreso*Math.PI))/2;
    fase = desde+(actual-desde)*curva;
    dibujar();
    if (progreso < 1) frame = requestAnimationFrame(animar);
    else { fase = actual; mostrar(); }
  }
  function mover(direccion) {
    // Completar cada arco antes de iniciar otro evita cortar trayectorias.
    if (frame) return;
    // Si el enlace enfocado va a quedar atrás, llevar el foco al control usado.
    if (tarjetas.some(t=>t.contains(document.activeElement))) {
      rueda.querySelector(direccion>0?'.equipo-siguiente':'.equipo-anterior').focus({preventScroll:true});
    }
    desde = fase; actual += direccion;
    if (reducir.matches || pagina.classList.contains('movimiento-pausado')) {
      fase = actual; dibujar(); mostrar();
    } else {
      inicio = null; frame = requestAnimationFrame(animar);
    }
  }
  function continuar(direccion) {
    detener();
    if (reducir.matches || document.hidden || pagina.classList.contains('movimiento-pausado')) return;
    repeticion = setTimeout(() => { mover(direccion); continuar(direccion); },1000);
  }
  for (const [selector,direccion] of [['.equipo-anterior',-1],['.equipo-siguiente',1]]) {
    const boton = rueda.querySelector(selector);
    boton.addEventListener('click',()=>{ detener(); mover(direccion); });
    boton.addEventListener('pointerenter',event=>{ if(event.pointerType==='mouse') continuar(direccion); });
    boton.addEventListener('pointerleave',detener);
    boton.addEventListener('blur',detener);
  }
  rueda.addEventListener('keydown',event=>{
    if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
    event.preventDefault(); detener(); mover(event.key==='ArrowRight'?1:-1);
  });
  rueda.querySelector('.equipo-controles').hidden = false;
  rueda.classList.add('equipo-carrusel');
  // Medir sin transformaciones permite conservar la tarjeta completa al variar
  // los nombres, las especialidades, las fuentes o el ancho de pantalla.
  const escena = rueda.querySelector('.equipo-escena');
  function ajustarAlto() {
    escena.style.height = `${Math.max(340, ...tarjetas.map(t => t.offsetHeight)) + 90}px`;
  }
  ajustarAlto();
  if ('ResizeObserver' in window) {
    const medidas = new ResizeObserver(ajustarAlto);
    tarjetas.forEach(t => medidas.observe(t));
  }
  dibujar(); mostrar();
  function terminar() {
    detener();
    if (frame) cancelAnimationFrame(frame);
    frame = 0; fase = actual;
    dibujar(); mostrar();
  }
  window.addEventListener('resize',()=>{ radio = Math.min(360,rueda.clientWidth*.34); ajustarAlto(); dibujar(); },{passive:true});
  pagina.addEventListener('i3:movimiento',terminar);
  reducir.addEventListener('change',terminar);
  document.addEventListener('visibilitychange',terminar);
  window.addEventListener('blur',detener);
  window.addEventListener('pagehide',terminar);
})();
