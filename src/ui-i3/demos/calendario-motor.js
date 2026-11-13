export function esBisiesto(anio) {
  return anio % 4 === 0 && (anio % 100 !== 0 || anio % 400 === 0);
}

export function calcularMes(anio, mes) {
  if (!Number.isInteger(anio) || anio < 1900 || anio > 2400 || !Number.isInteger(mes) || mes < 1 || mes > 12) {
    throw new RangeError('Elegí un mes válido y un año entre 1900 y 2400.');
  }
  const bisiesto = esBisiesto(anio);
  const longitudes = [31, bisiesto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const anteriores = anio - 1;
  const diasAnios = 365 * anteriores + Math.floor(anteriores / 4) - Math.floor(anteriores / 100) + Math.floor(anteriores / 400);
  const diasMeses = longitudes.slice(0, mes - 1).reduce((a, b) => a + b, 0);
  // El 1 de enero del año 1 fue lunes: resto 0=lunes, ... 6=domingo.
  const inicio = (diasAnios + diasMeses) % 7;
  return { anio, mes, bisiesto, inicio, cantidad: longitudes[mes - 1], diasAnios, diasMeses };
}
