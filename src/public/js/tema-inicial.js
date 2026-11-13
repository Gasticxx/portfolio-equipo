// Antes del primer contenido; archivo externo compatible con la CSP.
(() => {
  let tema;
  try { tema = localStorage.getItem('i3-tema'); } catch {}
  const oscuro = tema === 'oscuro' || (tema !== 'claro' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.body.classList.toggle('tema-oscuro', oscuro);
  document.documentElement.style.colorScheme = oscuro ? 'dark' : 'light';
})();
