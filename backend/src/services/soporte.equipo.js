// Los rangos sin configurar suelen llegar como NULL, vacío o cero.
const positivo = (valor) => {
  if (valor === null || valor === undefined || String(valor).trim() === '') return null;
  const numero = Number(String(valor).trim().replace(',', '.'));
  return Number.isFinite(numero) && numero > 0 ? numero : null;
};

const datosPesaje = (valores) => {
  const rangos = [1, 2, 3].map(numero => ({
    numero,
    capacidad: positivo(valores[`cap_max${numero}`]),
    division: positivo(valores[`d${numero}`]),
    verificacion: positivo(valores[`e${numero}`]),
  })).filter(r => r.capacidad !== null || r.division !== null || r.verificacion !== null);
  const completos = rangos.every((r, index) => r.numero === index + 1 && r.capacidad !== null);
  const capacidades = rangos.map(r => r.capacidad).filter(v => v !== null);
  return {
    unidades: String(valores.unidades || '').trim() || null,
    rangos,
    tipoRango: rangos.length === 0 ? null : !completos ? 'Rangos incompletos'
      : { 1: 'Rango único', 2: 'Doble rango', 3: 'Triple rango' }[rangos.length],
    capacidadMaxima: capacidades.length ? Math.max(...capacidades) : null,
  };
};

module.exports = { datosPesaje };
