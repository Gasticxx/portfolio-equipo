(() => {
  const form = document.getElementById('form-cambio-password');
  if (!form) return;
  const mensaje = document.getElementById('password-mensaje');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    mensaje.textContent = 'Actualizando…';
    try {
      const csrfResponse = await fetch('/api/csrf', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      const csrf = await csrfResponse.json();
      if (!csrfResponse.ok) throw new Error(csrf.error?.message ?? 'No se pudo validar la solicitud.');
      const response = await fetch('/api/auth/password', {
        method: 'PATCH', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': csrf.data.csrfToken },
        body: JSON.stringify({ passwordActual: form.elements.passwordActual.value, password: form.elements.password.value, passwordConfirm: form.elements.passwordConfirm.value }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? 'No se pudo actualizar la contraseña.');
      form.reset();
      window.location.assign('/login');
    } catch (error) { mensaje.textContent = error.message; }
  });
})();
