// Panel de métricas con Chart.js 4 local (I6). Apartado 15.
// - Consume GET /api/admin/metricas (I2) con desde, hasta y tipo.
// - Una petición por aplicación de filtros; cancela la anterior con
//   AbortController y solo pinta la más reciente.
// - Actualiza las instancias existentes con chart.update(); nunca superpone canvases.
// - Sin datos: ceros, tablas y "Sin datos para este rango"; la dona no inventa porciones.
// - Ninguna cifra está escrita en el código: todo sale de la respuesta del servidor.
import { pedir, ErrorHttp, mensajeDeError, el, mostrarAlerta } from './consultas-http.js';

const Chart = window.Chart;
const ZONA = 'America/Argentina/Buenos_Aires';
const DIAS_MAXIMOS = 90;
const TIPOS = [
  { clave: 'general', nombre: 'General' },
  { clave: 'cotizacion', nombre: 'Cotización' },
  { clave: 'asesoria', nombre: 'Asesoría' }
];

// Colores por entidad (orden fijo; validados para daltonismo y contraste).
const COLOR = {
  visitas: '#1D4ED8',
  accesos: '#C2410C',
  cuentas: '#0D9488',
  general: '#1D4ED8',
  cotizacion: '#C2410C',
  asesoria: '#0D9488'
};

const form = document.getElementById('filtros-metricas');
const selRango = document.getElementById('m-rango');
const inDesde = document.getElementById('m-desde');
const inHasta = document.getElementById('m-hasta');
const selTipo = document.getElementById('m-tipo');
const boton = document.getElementById('m-aplicar');
const estado = document.getElementById('metricas-estado');
const textoRango = document.getElementById('metricas-rango');
const avisoPrueba = document.getElementById('metricas-prueba');

let controlador = null;
let numeroPeticion = 0;
const graficos = { trafico: null, registros: null, tipos: null };

// -------------------------------------------------------------- Fechas (AR)
const formatoISO = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' });
const hoyAR = () => formatoISO.format(new Date());

function sumarDias(fechaISO, dias) {
  const [a, m, d] = fechaISO.split('-').map(Number);
  const f = new Date(Date.UTC(a, m - 1, d + dias));
  return f.toISOString().slice(0, 10);
}

function diferenciaDias(desde, hasta) {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000);
}

const esFechaReal = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;

const fechaCorta = (iso) => {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
};
const fechaLarga = (iso) => {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
};

const numero = new Intl.NumberFormat('es-AR');

// ----------------------------------------------------------------- Estado UI
const mostrarEstado = (tipo, texto) => mostrarAlerta(estado, tipo, texto);

function errorCampo(input, texto) {
  const destino = document.getElementById(`${input.name}-error`);
  if (texto) input.setAttribute('aria-invalid', 'true');
  else input.removeAttribute('aria-invalid');
  if (destino) destino.textContent = texto ?? '';
}

function sincronizarRango() {
  const personalizado = selRango.value === 'personalizado';
  for (const nodo of document.querySelectorAll('[data-personalizado]')) nodo.hidden = !personalizado;
  const hoy = hoyAR();
  const minimo = sumarDias(hoy, -(DIAS_MAXIMOS - 1));
  for (const input of [inDesde, inHasta]) {
    input.min = minimo;
    input.max = hoy;
  }
  if (personalizado && !inDesde.value) inDesde.value = sumarDias(hoy, -6);
  if (personalizado && !inHasta.value) inHasta.value = hoy;
}

// --------------------------------------------------------- Parámetros
/** Devuelve URLSearchParams o null si hay errores (marcados en los campos). */
function leerParametros() {
  errorCampo(inDesde, null);
  errorCampo(inHasta, null);
  const params = new URLSearchParams();
  const hoy = hoyAR();

  if (selRango.value === '30') {
    params.set('desde', sumarDias(hoy, -29));
    params.set('hasta', hoy);
  } else if (selRango.value === 'personalizado') {
    const desde = inDesde.value;
    const hasta = inHasta.value;
    const minimo = sumarDias(hoy, -(DIAS_MAXIMOS - 1));
    let valido = true;
    if (!esFechaReal(desde)) {
      errorCampo(inDesde, 'Ingresá una fecha válida.');
      valido = false;
    } else if (desde < minimo) {
      errorCampo(inDesde, `La fecha mínima es ${fechaLarga(minimo)}.`);
      valido = false;
    } else if (desde > hoy) {
      errorCampo(inDesde, 'No se admiten fechas futuras.');
      valido = false;
    }
    if (!esFechaReal(hasta)) {
      errorCampo(inHasta, 'Ingresá una fecha válida.');
      valido = false;
    } else if (hasta > hoy) {
      errorCampo(inHasta, 'No se admiten fechas futuras.');
      valido = false;
    } else if (valido && hasta < desde) {
      errorCampo(inHasta, '“Hasta” debe ser igual o posterior a “Desde”.');
      valido = false;
    } else if (valido && diferenciaDias(desde, hasta) + 1 > DIAS_MAXIMOS) {
      errorCampo(inHasta, `El rango máximo es de ${DIAS_MAXIMOS} días.`);
      valido = false;
    }
    if (!valido) {
      (inDesde.getAttribute('aria-invalid') === 'true' ? inDesde : inHasta).focus();
      return null;
    }
    params.set('desde', desde);
    params.set('hasta', hasta);
  }
  // Rango "7": sin fechas → el servidor usa los últimos 7 días de Argentina.
  if (selTipo.value) params.set('tipo', selTipo.value);
  return params;
}

/** Lee filtros de la URL de la página para conservarlos al recargar. */
function filtrosDesdeUrl() {
  const p = new URLSearchParams(window.location.search);
  const desde = p.get('desde');
  const hasta = p.get('hasta');
  const tipo = p.get('tipo');
  if (TIPOS.some((t) => t.clave === tipo)) selTipo.value = tipo;
  if (desde && hasta && esFechaReal(desde) && esFechaReal(hasta)) {
    const hoy = hoyAR();
    if (desde === sumarDias(hoy, -29) && hasta === hoy) selRango.value = '30';
    else {
      selRango.value = 'personalizado';
      inDesde.value = desde;
      inHasta.value = hasta;
    }
  }
}

// ------------------------------------------------------------- Chart.js
function estiloTexto() {
  const css = getComputedStyle(document.documentElement);
  return {
    texto: css.getPropertyValue('--color-texto').trim() || '#0F172A',
    secundario: css.getPropertyValue('--color-secundario').trim() || '#475569',
    borde: css.getPropertyValue('--color-borde').trim() || '#CBD5E1',
    superficie: css.getPropertyValue('--color-superficie').trim() || '#FFFFFF'
  };
}

const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function opcionesBase({ leyenda, eje = true }) {
  const t = estiloTexto();
  const base = {
    responsive: true,
    maintainAspectRatio: false,
    animation: sinMovimiento ? false : { duration: 250 },
    plugins: {
      legend: { display: leyenda, position: 'bottom', labels: { color: t.texto, usePointStyle: true, boxWidth: 8 } },
      tooltip: { enabled: true }
    }
  };
  if (eje) {
    base.interaction = { mode: 'index', intersect: false };
    base.scales = {
      x: { grid: { display: false }, ticks: { color: t.secundario, maxRotation: 0, autoSkip: true } },
      y: { beginAtZero: true, suggestedMax: 1, grid: { color: t.borde }, border: { display: false }, ticks: { color: t.secundario, precision: 0 } }
    };
  }
  return base;
}

function crearOActualizar(clave, crear, actualizar) {
  if (!Chart) return;
  if (graficos[clave]) {
    actualizar(graficos[clave]);
    graficos[clave].update();
  } else {
    graficos[clave] = crear();
  }
}

function pintarTrafico(serie) {
  const etiquetas = serie.map((p) => fechaCorta(p.fecha));
  const visitas = serie.map((p) => p.visitas);
  const accesos = serie.map((p) => p.accesos);
  crearOActualizar(
    'trafico',
    () =>
      new Chart(document.getElementById('g-trafico'), {
        type: 'line',
        data: {
          labels: etiquetas,
          datasets: [
            { label: 'Visitas', data: visitas, borderColor: COLOR.visitas, backgroundColor: COLOR.visitas, borderWidth: 2, pointRadius: 3, pointHoverRadius: 5, tension: 0 },
            { label: 'Accesos autenticados', data: accesos, borderColor: COLOR.accesos, backgroundColor: COLOR.accesos, borderWidth: 2, pointRadius: 3, pointHoverRadius: 5, pointStyle: 'rectRot', borderDash: [6, 3], tension: 0 }
          ]
        },
        options: opcionesBase({ leyenda: true })
      }),
    (g) => {
      g.data.labels = etiquetas;
      g.data.datasets[0].data = visitas;
      g.data.datasets[1].data = accesos;
    }
  );
  const filas = serie.map((p) =>
    el('tr', {}, [el('td', { texto: fechaLarga(p.fecha) }), el('td', { clase: 'text-end', texto: numero.format(p.visitas) }), el('td', { clase: 'text-end', texto: numero.format(p.accesos) })])
  );
  document.getElementById('tabla-trafico').replaceChildren(...filas);
  document.querySelector('[data-vacio="trafico"]').hidden = serie.some((p) => p.visitas > 0 || p.accesos > 0);
}

function pintarRegistros(serie) {
  const etiquetas = serie.map((p) => fechaCorta(p.fecha));
  const cuentas = serie.map((p) => p.cuentas);
  crearOActualizar(
    'registros',
    () =>
      new Chart(document.getElementById('g-registros'), {
        type: 'bar',
        data: {
          labels: etiquetas,
          datasets: [{ label: 'Cuentas creadas', data: cuentas, backgroundColor: COLOR.cuentas, borderRadius: 4, borderSkipped: 'start', maxBarThickness: 32 }]
        },
        options: opcionesBase({ leyenda: false })
      }),
    (g) => {
      g.data.labels = etiquetas;
      g.data.datasets[0].data = cuentas;
    }
  );
  const filas = serie.map((p) => el('tr', {}, [el('td', { texto: fechaLarga(p.fecha) }), el('td', { clase: 'text-end', texto: numero.format(p.cuentas) })]));
  document.getElementById('tabla-registros').replaceChildren(...filas);
  document.querySelector('[data-vacio="registros"]').hidden = serie.some((p) => p.cuentas > 0);
}

function pintarTipos(porTipo) {
  // Se respeta el orden fijo de tipos; un tipo ausente en la respuesta vale 0.
  const cantidades = TIPOS.map((t) => porTipo.find((x) => x.tipo === t.clave)?.cantidad ?? 0);
  const total = cantidades.reduce((a, b) => a + b, 0);
  const canvas = document.getElementById('g-tipos');
  const vacio = total === 0;

  document.querySelector('[data-vacio="tipos"]').hidden = !vacio;
  canvas.parentElement.hidden = vacio;
  if (vacio) {
    // No se inventa una porción de dona: se elimina el gráfico.
    graficos.tipos?.destroy();
    graficos.tipos = null;
  } else {
    const t = estiloTexto();
    crearOActualizar(
      'tipos',
      () =>
        new Chart(canvas, {
          type: 'doughnut',
          data: {
            labels: TIPOS.map((x) => x.nombre),
            datasets: [{ data: cantidades, backgroundColor: TIPOS.map((x) => COLOR[x.clave]), borderColor: t.superficie, borderWidth: 2 }]
          },
          options: { ...opcionesBase({ leyenda: true, eje: false }), cutout: '60%' }
        }),
      (g) => {
        g.data.datasets[0].data = cantidades;
      }
    );
  }

  const filas = TIPOS.map((tipo, i) =>
    el('tr', {}, [
      el('td', { texto: tipo.nombre }),
      el('td', { clase: 'text-end', texto: numero.format(cantidades[i]) }),
      el('td', { clase: 'text-end', texto: total ? `${Math.round((cantidades[i] / total) * 100)} %` : '0 %' })
    ])
  );
  document.getElementById('tabla-tipos').replaceChildren(...filas);
}

function pintar(data) {
  for (const [clave, valor] of Object.entries(data.totales)) {
    const nodo = document.querySelector(`[data-total="${clave}"]`);
    if (nodo) nodo.textContent = numero.format(valor);
  }
  const tipo = TIPOS.find((t) => t.clave === data.filtros.tipo);
  document.querySelector('[data-etiqueta-tipo]').textContent = tipo ? `(${tipo.nombre})` : '';
  textoRango.textContent = `Del ${fechaLarga(data.filtros.desde)} al ${fechaLarga(data.filtros.hasta)}, ambos incluidos (hora de Argentina)${tipo ? ` · tipo de consulta: ${tipo.nombre}` : ''}.`;
  avisoPrueba.hidden = !data.incluyeDatosDePrueba;

  pintarTrafico(data.traficoDiario);
  pintarRegistros(data.registrosDiarios);
  pintarTipos(data.consultasPorTipo);

  const sinDatos = Object.values(data.totales).every((v) => v === 0);
  mostrarEstado('aviso', sinDatos ? 'Sin datos para este rango.' : null);
}

// ------------------------------------------------------------------ Carga
async function aplicar() {
  const params = leerParametros();
  if (!params) {
    mostrarEstado('error', 'Revisá las fechas indicadas.');
    return;
  }
  controlador?.abort();
  controlador = new AbortController();
  const miNumero = ++numeroPeticion;

  boton.disabled = true;
  mostrarEstado('aviso', 'Cargando métricas…');
  const qs = params.toString();
  history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);

  try {
    const { data } = await pedir(`/api/admin/metricas${qs ? `?${qs}` : ''}`, { signal: controlador.signal });
    if (miNumero !== numeroPeticion) return; // llegó tarde: se descarta
    pintar(data);
  } catch (err) {
    if (err?.name === 'AbortError' || miNumero !== numeroPeticion) return;
    if (err instanceof ErrorHttp && err.status === 400 && err.fields) {
      if (err.fields.desde) errorCampo(inDesde, err.fields.desde);
      if (err.fields.hasta) errorCampo(inHasta, err.fields.hasta);
    }
    mostrarEstado('error', `No se pudieron cargar las métricas. ${mensajeDeError(err)}`);
  } finally {
    if (miNumero === numeroPeticion) boton.disabled = false;
  }
}

// ----------------------------------------------------------------- Inicio
if (!Chart) {
  mostrarEstado('aviso', 'No se pudo cargar la librería de gráficos. Las tablas siguen disponibles.');
}
form.addEventListener('submit', (e) => {
  e.preventDefault();
  aplicar();
});
selRango.addEventListener('change', sincronizarRango);
filtrosDesdeUrl();
sincronizarRango();
aplicar();
