// Solo backend: la clave nunca se entrega al navegador.
export function configurarStorage(source = process.env) {
  const url = (source.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = source.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) throw new Error('Falta configurar Supabase Storage.');
  const headers = { apikey: key };
  if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
  const bucket = encodeURIComponent(source.SUPABASE_STORAGE_BUCKET || 'portfolio-media');
  return { base: `${url}/storage/v1/object/${bucket}/integrantes`, headers };
}

export async function obtenerFotoStorage(codigo) {
  const { base, headers } = configurarStorage();
  return fetch(`${base}/${codigo.toLowerCase()}.webp`, { headers, signal: AbortSignal.timeout(10000) });
}
