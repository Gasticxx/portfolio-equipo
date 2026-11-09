const formulario = document.getElementById("login-form");
const boton = document.getElementById("login-enviar");
const estado = document.getElementById("login-estado");

formulario.addEventListener("submit", async (evento) => {
  // Manejamos el envío con JavaScript y evitamos clics repetidos.
  evento.preventDefault();
  if (!formulario.reportValidity()) return;

  boton.disabled = true;
  estado.textContent = "Ingresando…";

  try {
    // Pedimos el token asociado a la cookie de este navegador.
    const respuestaCsrf = await fetch("/api/csrf", { cache: "no-store" });
    const datosCsrf = await respuestaCsrf.json();
    const csrfToken = datosCsrf.data?.csrfToken;

    if (!respuestaCsrf.ok || !csrfToken) {
      estado.textContent = "No se pudo preparar el ingreso. Volvé a intentar.";
      return;
    }

    const respuesta = await fetch(formulario.action, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken,
      },
      body: JSON.stringify({
        email: formulario.elements.namedItem("email").value,
        password: formulario.elements.namedItem("password").value,
      }),
    });

    const resultado = await respuesta.json();

    if (!respuesta.ok) {
      estado.textContent =
        resultado.error?.message ?? "No se pudo iniciar sesión.";
      return;
    }

    // El navegador ya recibió la cookie de la sesión autenticada.
    window.location.assign("/mi-cuenta");
  } catch {
    estado.textContent = "No se pudo completar el ingreso. Volvé a intentar.";
  } finally {
    boton.disabled = false;
  }
});

// Habilitamos el botón después de conectar el evento de envío.
boton.disabled = false;
