const botonSalir = document.querySelector("[data-salir]");

document.addEventListener("equipo:salir", async () => {
  if (botonSalir.disabled) return;
  botonSalir.disabled = true;

  try {
    // Pedimos el token CSRF de la sesión que vamos a cerrar.
    const respuestaCsrf = await fetch("/api/csrf", { cache: "no-store" });
    const datosCsrf = await respuestaCsrf.json();
    const csrfToken = datosCsrf.data?.csrfToken;

    if (!respuestaCsrf.ok || !csrfToken) {
      throw new Error("No se pudo obtener el token CSRF");
    }

    // El servidor elimina la sesión y limpia la cookie.
    const respuesta = await fetch("/api/auth/logout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken,
      },
      body: JSON.stringify({}),
    });

    // Si la sesión ya venció, también volvemos al login.
    if (!respuesta.ok && respuesta.status !== 401) {
      throw new Error("No se pudo cerrar la sesión");
    }

    window.location.assign("/login");
  } catch {
    window.equipoUI?.notificar("No se pudo cerrar sesión. Volvé a intentar.");
  } finally {
    botonSalir.disabled = false;
  }
});
