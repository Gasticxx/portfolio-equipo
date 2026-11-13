// Reproduce el contrato de pasos de I5. El recurso real se sirve con autorización.
(() => {
  const raiz = document.querySelector('[data-visualizador]');
  if (!raiz) return;
  const $ = selector => raiz.querySelector(selector);
  const algoritmo = $('#algoritmo'), datos = $('#datos'), objetivo = $('#objetivo'), velocidad = $('#velocidad');
  const barras = $('[data-barras]'), pagina = document.body;
  const reducir = matchMedia('(prefers-reduced-motion: reduce)');
  const movimientos = new Set(), celebraciones = new Set();
  let estado = 'listo', timer = null, pasos = null, indice = 0, comparaciones = 0, intercambios = 0;
  let inicial = datos.value.split(',').map(Number), fichas = [], identidad = 0, ciclo = 0;

  // El preview independiente conserva sus dos fixtures; no expone el motor privado.
  const fixtures = {
    generar({ algoritmo, datos, objetivo }) {
      if (algoritmo === 'lineal' && datos.join(',') === '4,2,4' && objetivo === 4) return [{ valores: [4,2,4], activos: [0], comparacion: 'Posición 1: 4 = 4.', resultado: 'Encontrado en posición 1.', encontrado: 0 }];
      if (algoritmo === 'burbuja' && datos.join(',') === '3,1,2') return [
        { valores: [1,3,2], activos: [0,1], comparacion: '3 > 1: intercambio.' },
        { valores: [1,2,3], activos: [1,2], comparacion: '3 > 2: intercambio.' },
        { valores: [1,2,3], activos: [0,1], comparacion: '1 ≤ 2: sin intercambio.', resultado: 'Orden ascendente: 1, 2, 3.' },
      ];
      throw new Error('La muestra incluye búsqueda [4,2,4] de 4 y burbuja [3,1,2]. Para otros datos conectá el motor de I5.');
    },
  };
  const adapter = window.algoritmosAdapter || fixtures;
  const puedeAnimar = () => !reducir.matches && !document.hidden && !pagina.matches('.movimiento-pausado,.efectos-pausados');
  const detener = () => { clearTimeout(timer); timer = null; };
  function cancelar(coleccion) { for (const animacion of coleccion) animacion.cancel(); coleccion.clear(); }
  function limpiarAnimaciones() { ciclo++; cancelar(movimientos); cancelar(celebraciones); delete raiz.dataset.celebracion; }
  function registrar(animacion, coleccion) {
    coleccion.add(animacion);
    animacion.finished.then(() => coleccion.delete(animacion), () => coleccion.delete(animacion));
    return animacion;
  }
  function crearFicha(valor, maximo) {
    const elemento = document.createElement('div'), columna = document.createElement('div');
    const pieza = document.createElement('div'), numero = document.createElement('span'), posicion = document.createElement('span');
    elemento.className = 'alg-elemento'; elemento.setAttribute('role', 'listitem');
    elemento.dataset.ficha = String(++identidad); elemento.dataset.valor = String(valor);
    columna.className = 'alg-columna'; columna.setAttribute('aria-hidden', 'true');
    pieza.className = `alg-pieza nivel-${Math.max(1, Math.ceil(Math.abs(valor) / maximo * 10))}`;
    numero.className = 'alg-numero'; numero.textContent = valor;
    posicion.className = 'alg-indice'; posicion.setAttribute('aria-hidden', 'true');
    pieza.append(numero); columna.append(pieza); elemento.append(columna, posicion);
    return { valor, elemento, columna, pieza, posicion };
  }
  function crearBarras(valores) {
    limpiarAnimaciones();
    const maximo = Math.max(1, ...valores.map(Math.abs));
    fichas = valores.map(valor => crearFicha(valor, maximo));
    barras.replaceChildren(...fichas.map(f => f.elemento));
    pintar(valores);
  }
  function pintar(valores, activos = [], encontrado, animar = false) {
    // Colas por valor mantienen la identidad y el orden de los duplicados.
    const disponibles = new Map();
    for (const ficha of fichas) {
      if (!disponibles.has(ficha.valor)) disponibles.set(ficha.valor, []);
      disponibles.get(ficha.valor).push(ficha);
    }
    const posiciones = new Map(animar && puedeAnimar() ? fichas.map(f => [f, f.columna.getBoundingClientRect().left]) : []);
    cancelar(movimientos);
    fichas = valores.map(valor => disponibles.get(valor).shift());
    barras.append(...fichas.map(f => f.elemento));
    fichas.forEach((ficha, i) => {
      ficha.posicion.textContent = String(i + 1).padStart(2, '0');
      ficha.elemento.classList.toggle('actual', activos.includes(i));
      ficha.elemento.classList.toggle('encontrado', encontrado === i);
      ficha.elemento.setAttribute('aria-label', `Posición ${i + 1}: ${ficha.valor}${encontrado === i ? ', encontrado' : activos.includes(i) ? ', comparación actual' : ''}`);
    });
    // FLIP: el DOM ya tiene el orden correcto; solo se anima el recorrido visual.
    const duracion = Math.min(700, Math.max(110, Number(velocidad.value) * .8));
    fichas.forEach(ficha => {
      if (!posiciones.has(ficha) || !ficha.columna.animate) return;
      const delta = posiciones.get(ficha) - ficha.columna.getBoundingClientRect().left;
      if (Math.abs(delta) < 1) return;
      registrar(ficha.columna.animate([
        { transform: `translateX(${delta}px)` },
        { transform: `translate(${delta * .5}px, ${delta > 0 ? -14 : 8}px)` },
        { transform: 'translate(0, 0)' },
      ], { duration: duracion, easing: 'cubic-bezier(.25,.8,.25,1)' }), movimientos);
    });
  }
  function actualizar() {
    raiz.dataset.estado = estado;
    $('[data-algoritmo-estado]').textContent = { listo: 'Listo', ejecutando: 'Ejecutando', pausado: 'Pausado', finalizado: 'Finalizado' }[estado];
    $('[data-iniciar]').disabled = estado === 'ejecutando' || estado === 'finalizado' || !puedeAnimar();
    $('[data-alg-play-texto]').textContent = estado === 'pausado' ? 'Continuar' : 'Iniciar';
    $('[data-pausar]').disabled = estado !== 'ejecutando';
    $('[data-paso]').disabled = estado === 'ejecutando' || estado === 'finalizado';
    [algoritmo, datos, objetivo, $('[data-mezclar]')].filter(Boolean).forEach(el => { el.disabled = pasos !== null; });
    $('[data-alg-cantidad]').textContent = String(fichas.length).padStart(2, '0');
    $('[data-alg-comparaciones]').textContent = String(comparaciones).padStart(2, '0');
    $('[data-alg-intercambios]').textContent = String(intercambios).padStart(2, '0');
    $('[data-alg-pasos]').textContent = pasos ? `${indice} / ${pasos.length} pasos` : '0 pasos';
    $('[data-alg-progreso]').max = pasos?.length || 1;
    $('[data-alg-progreso]').value = indice;
    $('[data-alg-consejo]').textContent = puedeAnimar() ? 'Pausá para mirar una comparación o avanzá un paso a la vez.' : 'Movimiento pausado o reducido: usá Un paso para recorrer la secuencia sin animaciones.';
  }
  function borrarErrores() {
    for (const campo of [datos, objetivo]) { campo.setAttribute('aria-invalid', 'false'); $(`#${campo.id}-error`).textContent = ''; }
  }
  function leerDatos() {
    const texto = datos.value.trim(), partes = texto.split(',').map(v => v.trim());
    return texto && partes.length <= 20 && partes.every(v => /^-?\d+$/.test(v) && Number(v) >= -99 && Number(v) <= 99) ? partes.map(Number) : null;
  }
  function preparar() {
    if (pasos) return true;
    const valores = leerDatos(), objetivoTexto = objetivo.value.trim();
    const objetivoValido = /^-?\d+$/.test(objetivoTexto) && Number(objetivoTexto) >= -99 && Number(objetivoTexto) <= 99;
    const errorDatos = valores ? '' : 'Ingresá de 1 a 20 enteros entre -99 y 99.';
    const errorObjetivo = algoritmo.value === 'lineal' && !objetivoValido ? 'Ingresá un objetivo entero entre -99 y 99.' : '';
    $('#datos-error').textContent = errorDatos; $('#objetivo-error').textContent = errorObjetivo;
    datos.setAttribute('aria-invalid', String(Boolean(errorDatos))); objetivo.setAttribute('aria-invalid', String(Boolean(errorObjetivo)));
    if (errorDatos || errorObjetivo) { (errorDatos ? datos : objetivo).focus(); return false; }
    try {
      const secuencia = adapter.generar({ algoritmo: algoritmo.value, datos: [...valores], objetivo: Number(objetivoTexto) });
      if (!Array.isArray(secuencia) || !secuencia.length) throw new Error('El motor no devolvió pasos.');
      inicial = valores; pasos = secuencia;
      if (fichas.length !== inicial.length || fichas.some((f, i) => f.valor !== inicial[i])) crearBarras(inicial);
      else pintar(inicial);
      return true;
    } catch (error) { $('[data-resultado]').textContent = error.message; return false; }
  }
  function celebrarOrden() {
    if (!puedeAnimar()) return;
    raiz.dataset.celebracion = 'ola';
    fichas.forEach((ficha, i) => {
      if (!ficha.pieza.animate) return;
      registrar(ficha.pieza.animate([
        { transform: 'translateY(0) scaleY(1)', filter: 'brightness(1)' },
        { transform: 'translateY(-18px) scaleY(1.05)', filter: 'brightness(1.18)', offset: .4 },
        { transform: 'translateY(0) scaleY(1)', filter: 'brightness(1)' },
      ], { duration: 620, delay: i * 65, easing: 'ease-in-out' }), celebraciones);
    });
  }
  function finalizar(paso) {
    estado = 'finalizado'; detener();
    const ordenado = algoritmo.value === 'burbuja', encontrado = Number.isInteger(paso.encontrado);
    fichas.forEach((f, i) => {
      f.elemento.classList.remove('actual'); f.elemento.classList.toggle('completado', ordenado);
      f.elemento.setAttribute('aria-label', `Posición ${i + 1}: ${f.valor}${ordenado ? ', ordenado' : paso.encontrado === i ? ', encontrado' : ''}`);
    });
    $('[data-alg-resultado-caja]').classList.toggle('exito', ordenado || encontrado);
    $('[data-alg-resultado-caja]').classList.toggle('ausente', !ordenado && !encontrado);
    $('[data-alg-resultado-icono]').textContent = ordenado || encontrado ? '✓' : '⌕';
    $('[data-alg-resultado-titulo]').textContent = ordenado ? 'Cada número encontró su lugar.' : encontrado ? 'Ahí está lo que buscabas.' : 'La lista está revisada.';
    $('[data-resultado]').textContent = paso.resultado || 'Secuencia finalizada.';
    if (ordenado && puedeAnimar()) {
      const turno = ciclo;
      Promise.all([...movimientos].map(a => a.finished.catch(() => {}))).then(() => {
        if (turno === ciclo && estado === 'finalizado') celebrarOrden();
      });
    }
  }
  function avanzar() {
    if (!preparar()) return false;
    const paso = pasos[indice++];
    if (paso.activos?.length) comparaciones++;
    if (algoritmo.value === 'burbuja' && paso.valores.some((valor, i) => valor !== fichas[i].valor)) intercambios++;
    pintar(paso.valores, paso.activos, paso.encontrado, true);
    $('[data-comparacion]').textContent = paso.comparacion || '';
    if (indice === pasos.length) finalizar(paso);
    else if (estado !== 'ejecutando') estado = 'pausado';
    actualizar(); return true;
  }
  function programar() {
    detener();
    timer = setTimeout(() => { timer = null; if (estado === 'ejecutando' && avanzar() && estado === 'ejecutando') programar(); }, Number(velocidad.value));
  }
  function pausar() {
    detener(); limpiarAnimaciones();
    if (estado === 'ejecutando') estado = 'pausado';
    actualizar();
  }
  function reiniciar() {
    detener(); limpiarAnimaciones(); borrarErrores();
    datos.value = inicial.join(','); pasos = null; indice = 0; comparaciones = 0; intercambios = 0; estado = 'listo';
    $('[data-resultado]').textContent = 'Al terminar vas a encontrar el resultado acá.';
    $('[data-comparacion]').textContent = 'Elegí tus números y dale movimiento a la secuencia.';
    $('[data-alg-resultado-titulo]').textContent = 'El siguiente paso es tuyo.';
    $('[data-alg-resultado-icono]').textContent = '⌁';
    $('[data-alg-resultado-caja]').classList.remove('exito', 'ausente');
    crearBarras(inicial); actualizar();
  }
  function presentarAlgoritmo() {
    const lineal = algoritmo.value === 'lineal';
    $('[data-objetivo-campo]').hidden = !lineal;
    $('[data-alg-nombre]').textContent = lineal ? 'Búsqueda lineal' : 'Ordenamiento burbuja';
    $('[data-alg-explicacion]').textContent = lineal ? 'Recorre la lista de izquierda a derecha hasta encontrar la primera coincidencia.' : 'Compara dos valores vecinos e intercambia sus posiciones si están fuera de orden.';
  }
  $('[data-iniciar]').addEventListener('click', () => {
    if (estado === 'ejecutando' || estado === 'finalizado' || !puedeAnimar() || !preparar()) return;
    estado = 'ejecutando'; actualizar(); programar();
  });
  $('[data-pausar]').addEventListener('click', pausar);
  $('[data-paso]').addEventListener('click', () => { if (['listo', 'pausado'].includes(estado)) avanzar(); });
  $('[data-reiniciar]').addEventListener('click', reiniciar);
  datos.addEventListener('input', () => {
    if (pasos) return;
    const valores = leerDatos();
    if (valores) { inicial = valores; crearBarras(inicial); borrarErrores(); actualizar(); }
  });
  algoritmo.addEventListener('change', () => {
    if (pasos) return;
    inicial = algoritmo.value === 'lineal' ? [4,2,4] : window.algoritmosAdapter ? [38,12,65,27,48,19,54,33] : [3,1,2];
    reiniciar(); presentarAlgoritmo();
  });
  $('[data-mezclar]')?.addEventListener('click', () => {
    if (pasos) return;
    inicial = Array.from({ length: 8 }, () => Math.floor(Math.random() * 90) + 10);
    reiniciar();
  });
  velocidad.addEventListener('change', () => { if (estado === 'ejecutando') programar(); });
  reducir.addEventListener('change', () => { if (!puedeAnimar()) pausar(); else actualizar(); });
  pagina.addEventListener('i3:movimiento', () => { if (!puedeAnimar()) pausar(); else actualizar(); });
  window.addEventListener('pagehide', pausar);
  window.addEventListener('pageshow', actualizar);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pausar(); else actualizar(); });
  window.addEventListener('resize', limpiarAnimaciones);
  presentarAlgoritmo(); crearBarras(inicial); actualizar();
})();
