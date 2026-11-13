const raiz = document.querySelector('[data-calendario]');
if (raiz) {
  const buscar = nombre => raiz.querySelector(`[data-cal-${nombre}]`);
  const form = buscar('form');
  const hoy = new Date();
  const dias = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];
  let modelo, visibles, elegido = null, timer = null;
  const formato = new Intl.DateTimeFormat('es-AR', { month:'long', year:'numeric', timeZone:'UTC' });
  const fechaLarga = new Intl.DateTimeFormat('es-AR', { dateStyle:'full', timeZone:'UTC' });
  function detener() { clearInterval(timer); timer = null; buscar('pausa').disabled = true; buscar('play').disabled = false; }
  function dibujar() {
    const titulo = formato.format(new Date(Date.UTC(modelo.anio, modelo.mes - 1, 1)));
    buscar('titulo').textContent = titulo; buscar('caption').textContent = titulo;
    buscar('bisiesto').textContent = `${modelo.anio} ${modelo.bisiesto ? 'es bisiesto: febrero tiene 29 días' : 'no es bisiesto: febrero tiene 28 días'}.`;
    buscar('inicio').textContent = `Contamos ${modelo.diasAnios.toLocaleString('es-AR')} días de años anteriores y ${modelo.diasMeses} de este año. El resto al dividir por 7 es ${modelo.inicio}: el mes empieza un ${dias[modelo.inicio]}.`;
    buscar('progreso').textContent = `Ubicamos cada día en la siguiente casilla: ${visibles} de ${modelo.cantidad} días.`;
    buscar('anterior').disabled = modelo.anio === 1900 && modelo.mes === 1;
    buscar('siguiente').disabled = modelo.anio === 2400 && modelo.mes === 12;
    const cuerpo = buscar('dias'); cuerpo.replaceChildren();
    for (let fila = 0; fila < 6; fila++) {
      const tr = document.createElement('tr');
      for (let col = 0; col < 7; col++) {
        const td = document.createElement('td'); const dia = fila * 7 + col - modelo.inicio + 1;
        if (dia > 0 && dia <= modelo.cantidad) {
          const boton = document.createElement('button'); boton.type = 'button'; boton.className = 'calendario-dia'; boton.textContent = dia;
          boton.disabled = dia > visibles;
          boton.setAttribute('aria-label', fechaLarga.format(new Date(Date.UTC(modelo.anio, modelo.mes - 1, dia))));
          boton.setAttribute('aria-pressed', String(dia === elegido));
          if (modelo.anio === hoy.getFullYear() && modelo.mes === hoy.getMonth() + 1 && dia === hoy.getDate()) boton.setAttribute('aria-current','date');
          boton.addEventListener('click', () => {
            elegido = dia;
            raiz.querySelectorAll('.calendario-dia[aria-pressed=true]').forEach(b => b.setAttribute('aria-pressed','false'));
            boton.setAttribute('aria-pressed','true'); buscar('seleccion').textContent = boton.getAttribute('aria-label');
          }); td.append(boton);
        }
        tr.append(td);
      }
      cuerpo.append(tr);
    }
  }
  function cargar(anio, mes) {
    try {
      const siguiente = calcularMes(anio, mes); detener(); modelo = siguiente; visibles = modelo.cantidad; elegido = null;
      form.elements.anio.value = anio; form.elements.mes.value = mes; buscar('error').textContent = '';
      buscar('seleccion').textContent = 'Seleccioná un día para ver la fecha completa.'; dibujar();
    } catch(error) { buscar('error').textContent = error.message; }
  }
  function paso() {
    if (visibles === modelo.cantidad) visibles = 0;
    visibles++; dibujar();
    if (visibles === modelo.cantidad) detener();
  }
  form.addEventListener('submit', event => { event.preventDefault(); if (form.reportValidity()) cargar(Number(form.elements.anio.value), Number(form.elements.mes.value)); });
  for (const [nombre, delta] of [['anterior',-1],['siguiente',1]]) buscar(nombre).addEventListener('click', () => {
    const fecha = new Date(Date.UTC(modelo.anio, modelo.mes - 1 + delta, 1)); cargar(fecha.getUTCFullYear(), fecha.getUTCMonth() + 1);
  });
  buscar('hoy').addEventListener('click', () => cargar(hoy.getFullYear(), hoy.getMonth() + 1));
  buscar('play').addEventListener('click', () => {
    detener(); if (visibles === modelo.cantidad) visibles = 0;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { visibles = modelo.cantidad; dibujar(); return; }
    buscar('play').disabled = true; buscar('pausa').disabled = false; timer = setInterval(paso, 180); dibujar();
  });
  buscar('pausa').addEventListener('click', detener);
  buscar('paso').addEventListener('click', () => { detener(); paso(); });
  buscar('completar').addEventListener('click', () => { detener(); visibles = modelo.cantidad; dibujar(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) detener(); });
  window.addEventListener('pagehide', detener);
  cargar(hoy.getFullYear(), hoy.getMonth() + 1);
}
