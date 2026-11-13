// Panel del operador (I6): listado con filtros y detalle con acciones.
// Las páginas se renderizan en el servidor; este script agrega las acciones
// que escriben mediante la API JSON (estado, respuesta y reintento).
import { pedir, obtenerCsrf, ErrorHttp, ErrorRed, mensajeDeError, largoUnicode, normalizarTexto, mostrarAlerta } from './consultas-http.js';

const CLAVE_AVISO = 'i6-operador-aviso';

// ------------------------------------------------------------------ Listado
const filtros = document.getElementById('filtros-consultas');
if (filtros) {
  // No enviar parámetros vacíos: URL limpia y sin parámetros inválidos.
  filtros.addEventListener('submit', (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    for (const [k, v] of new FormData(filtros)) if (String(v).trim() !== '') params.set(k, String(v).trim());
    const qs = params.toString();
    window.location.assign(`/operador/consultas${qs ? `?${qs}` : ''}`);
  });
}

// ------------------------------------------------------------------ Detalle
const contenedor = document.querySelector('[data-consulta-id]');
if (contenedor) iniciarDetalle(Number(contenedor.dataset.consultaId));

function iniciarDetalle(consultaId) {
  const aviso = document.getElementById('operador-estado');

  const mostrar = (tipo, texto) => mostrarAlerta(aviso, tipo, texto, { enfocar: true });

  // Aviso pendiente de la acción anterior (se recarga para ver datos frescos).
  try {
    const guardado = sessionStorage.getItem(CLAVE_AVISO);
    if (guardado) {
      sessionStorage.removeItem(CLAVE_AVISO);
      const { tipo, texto } = JSON.parse(guardado);
      mostrar(tipo, texto);
    }
  } catch {
    /* sessionStorage no disponible: se omite el aviso diferido */
  }

  const recargarCon = (tipo, texto) => {
    try {
      sessionStorage.setItem(CLAVE_AVISO, JSON.stringify({ tipo, texto }));
    } catch {
      /* sin almacenamiento: el usuario verá el estado actualizado igualmente */
    }
    window.location.reload();
  };

  const manejarError = async (err) => {
    if (err instanceof ErrorHttp && err.code === 'CSRF_INVALIDO') await obtenerCsrf({ renovar: true }).catch(() => {});
    if (err instanceof ErrorHttp && err.code === 'NO_AUTENTICADO') {
      window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    mostrar(err instanceof ErrorHttp && err.status === 409 ? 'aviso' : 'error', mensajeDeError(err));
  };

  const conBoton = async (boton, textoOcupado, accion) => {
    const original = boton.textContent;
    boton.disabled = true;
    boton.textContent = textoOcupado;
    try {
      await accion();
    } finally {
      boton.disabled = false;
      boton.textContent = original;
    }
  };

  // ---------------------------------------------------------- Cambio de estado
  for (const boton of document.querySelectorAll('[data-accion="estado"]')) {
    boton.addEventListener('click', () =>
      conBoton(boton, 'Guardando…', async () => {
        try {
          await pedir(`/api/operador/consultas/${consultaId}`, { method: 'PATCH', body: { estado: boton.dataset.estado } });
          recargarCon('exito', 'Estado actualizado.');
        } catch (err) {
          await manejarError(err);
        }
      })
    );
  }

  // ------------------------------------------------------------- Respuesta
  const form = document.getElementById('form-respuesta');
  if (form) {
    const campo = document.getElementById('respuesta');
    const error = document.getElementById('respuesta-error');
    const contador = document.getElementById('contador-respuesta');
    const boton = document.getElementById('btn-responder');
    const min = Number(form.dataset.min);
    const max = Number(form.dataset.max);
    let clave = null; // una clave por intento; se renueva al editar

    const actualizar = () => {
      contador.textContent = `${largoUnicode(normalizarTexto(campo.value))} / ${max}`;
    };
    const marcar = (texto) => {
      if (texto) campo.setAttribute('aria-invalid', 'true');
      else campo.removeAttribute('aria-invalid');
      error.textContent = texto ?? '';
      if (texto) campo.focus();
    };

    campo.addEventListener('input', () => {
      clave = null;
      actualizar();
    });
    actualizar();

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (boton.disabled) return;
      const mensaje = normalizarTexto(campo.value);
      const n = largoUnicode(mensaje);
      if (n < min || n > max) return marcar(`La respuesta debe tener entre ${min} y ${max} caracteres.`);
      marcar(null);
      clave ??= crypto.randomUUID();

      conBoton(boton, 'Enviando…', async () => {
        try {
          const { data } = await pedir(`/api/operador/consultas/${consultaId}/respuestas`, {
            method: 'POST',
            body: { mensaje },
            idempotencyKey: clave
          });
          const textos = {
            aceptado: ['exito', 'Respuesta registrada y aceptada por el proveedor. Comprobá la recepción en la casilla.'],
            error: ['error', 'Respuesta registrada, pero el proveedor rechazó el envío. Revisá la configuración y reintentá desde “Envíos de email”.'],
            desconocido: ['aviso', 'Respuesta registrada; no se pudo confirmar el envío (posible envío previo). Revisá el panel de Brevo antes de reintentar.'],
            pendiente: ['aviso', 'Respuesta registrada; el envío quedó pendiente. Podés reintentarlo desde “Envíos de email”.'],
            enviando: ['aviso', 'Respuesta registrada; el envío está en curso.']
          };
          const [tipo, texto] = textos[data.envioEstado] ?? textos.pendiente;
          recargarCon(tipo, texto);
        } catch (err) {
          if (err instanceof ErrorRed) {
            mostrar('aviso', 'No pudimos confirmar el envío por un problema de conexión. Volvé a presionar “Enviar respuesta” sin editar el texto: no se duplicará.');
          } else if (err instanceof ErrorHttp && err.status === 422 && err.fields?.mensaje) {
            marcar(err.fields.mensaje);
          } else {
            await manejarError(err);
          }
        }
      });
    });
  }

  // ------------------------------------------------------------- Reintentos
  for (const boton of document.querySelectorAll('[data-accion="reintentar"]')) {
    const envioId = boton.dataset.envioId;
    let espera = Number(boton.dataset.espera) || 0;
    if (espera > 0) {
      boton.disabled = true;
      const temporizador = setInterval(() => {
        espera -= 1;
        boton.textContent = espera > 0 ? `Reintentar (${espera} s)` : 'Reintentar';
        if (espera <= 0) {
          clearInterval(temporizador);
          boton.disabled = false;
        }
      }, 1000);
      boton.textContent = `Reintentar (${espera} s)`;
    }

    boton.addEventListener('click', () => {
      const requiere = boton.dataset.requiereConfirmacion === 'true';
      const confirmacion = document.getElementById(`confirmar-${envioId}`);
      if (requiere && !confirmacion?.checked) {
        mostrar('aviso', 'Posible envío previo: revisá el panel de Brevo y marcá la confirmación antes de reintentar.');
        confirmacion?.focus();
        return;
      }
      conBoton(boton, 'Reintentando…', async () => {
        try {
          const { data } = await pedir(`/api/operador/envios/${envioId}/reintentar`, {
            method: 'POST',
            body: requiere ? { confirmarRiesgo: true } : {}
          });
          const tipo = data.estado === 'aceptado' ? 'exito' : data.estado === 'error' ? 'error' : 'aviso';
          recargarCon(tipo, `Reintento realizado. Estado del envío: ${data.estado}.`);
        } catch (err) {
          await manejarError(err);
        }
      });
    });
  }
}
