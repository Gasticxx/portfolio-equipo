(() => {
  const formulario = document.getElementById("registro-form");
  if (!formulario) return;

  const boton = document.getElementById("registro-enviar");
  const estado = document.getElementById("registro-estado");
  const campos = {};

  for (const nombre of ["nombre", "email", "password", "passwordConfirm"]) {
    campos[nombre] = formulario.elements.namedItem(nombre);

    // Los límites Unicode completos se comprueban en el servidor.
    campos[nombre].removeAttribute("maxlength");
  }

  campos.nombre.autocomplete = "name";
  campos.email.autocomplete = "email";
  boton.disabled = false;

  function mostrarErrores(errores) {
    let primero = null;

    for (const nombre of Object.keys(campos)) {
      const mensaje = errores[nombre];
      if (typeof mensaje !== "string" || !mensaje) continue;

      campos[nombre].setAttribute("aria-invalid", "true");
      document.getElementById(nombre + "-error").textContent = mensaje;
      primero ??= campos[nombre];
    }

    primero?.focus();
  }

  function limpiarContrasenas() {
    campos.password.value = "";
    campos.passwordConfirm.value = "";
  }

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    if (boton.disabled) return;

    const errores = {};

    for (const nombre of Object.keys(campos)) {
      campos[nombre].removeAttribute("aria-invalid");
      document.getElementById(nombre + "-error").textContent = "";

      if (!campos[nombre].checkValidity()) {
        errores[nombre] = campos[nombre].validity.typeMismatch
          ? "Ingresá un correo electrónico válido."
          : "Completá este campo.";
      }
    }

    if (campos.password.value !== campos.passwordConfirm.value) {
      errores.passwordConfirm = "Las contraseñas deben coincidir.";
    }

    if (Object.keys(errores).length > 0) {
      estado.textContent = "Revisá los campos indicados.";
      limpiarContrasenas();
      mostrarErrores(errores);
      return;
    }

    boton.disabled = true;
    estado.textContent = "Creando tu cuenta…";

    try {
      // Primero obtenemos el token asociado a la cookie de esta sesión.
      const respuestaCsrf = await fetch("/api/csrf", {
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      const datosCsrf = await respuestaCsrf.json();

      if (
        !respuestaCsrf.ok ||
        datosCsrf.ok !== true ||
        typeof datosCsrf.data?.csrfToken !== "string" ||
        !/^[0-9a-f]{64}$/.test(datosCsrf.data.csrfToken)
      ) {
        throw new Error("No se pudo obtener el token.");
      }

      // Enviamos únicamente los cuatro campos acordados.
      const datos = {};

      for (const nombre of Object.keys(campos)) {
        datos[nombre] = campos[nombre].value;
      }

      const respuesta = await fetch("/api/auth/registro", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRF-Token": datosCsrf.data.csrfToken,
        },
        body: JSON.stringify(datos),
      });

      const resultado = await respuesta.json();

      if (respuesta.status === 201 && resultado.ok === true) {
        formulario.reset();
        estado.textContent = "Cuenta creada. Iniciá sesión para continuar.";
        window.location.assign("/login?registro=ok");
        return;
      }

      const erroresServidor = resultado.error?.fields ?? {};

      if (
        respuesta.status === 409 &&
        resultado.error?.code === "EMAIL_DUPLICADO"
      ) {
        erroresServidor.email = "Ya existe una cuenta con ese email.";
      }

      estado.textContent =
        resultado.error?.message || "No se pudo crear la cuenta.";

      const espera = Number(respuesta.headers.get("Retry-After"));

      if (
        [429, 503].includes(respuesta.status) &&
        Number.isInteger(espera) &&
        espera > 0
      ) {
        estado.textContent += " Volvé a intentar en " + espera + " segundos.";
      }

      mostrarErrores(erroresServidor);
    } catch {
      estado.textContent =
        "No pudimos confirmar el registro. Revisá la conexión e intentá nuevamente.";
    } finally {
      // Conservamos nombre y email ante un fallo y vaciamos las contraseñas.
      limpiarContrasenas();
      boton.disabled = false;
    }
  });
})();
