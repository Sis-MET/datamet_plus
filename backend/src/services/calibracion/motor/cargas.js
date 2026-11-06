/**
 * Composición de cada carga de ensayo con las piezas de los juegos de pesas
 * que eligió el técnico (decisión 4: DataMET+ arma la carga con una regla fija
 * y documentada; quien elabora el registro la puede corregir antes de emitir).
 *
 * Regla: la combinación con **menos piezas** cuya suma de valores nominales es
 * exactamente la carga. Desempates, en este orden:
 *   1. La primera que encuentra la búsqueda probando primero las piezas de
 *      mayor valor nominal con el mayor número posible (prefiere piezas
 *      grandes).
 *   2. Dentro de un mismo valor nominal, primero la pieza sin marca, luego «*»,
 *      «**» y después las demás por orden alfabético de su identificación.
 * (Desempates propuestos; el laboratorio debe confirmarlos, fase 0.)
 */

const MG_POR = { mg: 1, g: 1e3, kg: 1e6, t: 1e9 };

/** Orden de las piezas de un mismo valor nominal: sin marca, «*», «**», resto. */
const ordenMarca = (identificacion) => {
  const texto = String(identificacion || '').trim();
  if (!texto) return [0, ''];
  if (/^\*+$/.test(texto)) return [texto.length, ''];
  return [100, texto];
};
const compararPiezas = (a, b) => {
  const [na, ta] = ordenMarca(a.identificacion);
  const [nb, tb] = ordenMarca(b.identificacion);
  return na - nb || ta.localeCompare(tb);
};

/**
 * Busca la combinación de piezas para una carga. piezas: [{ nominal, … }] en
 * la misma unidad que la carga. Devuelve las piezas elegidas o null si la
 * carga no se puede formar exactamente.
 */
const componerCarga = (carga, piezas) => {
  if (!(carga > 0)) return [];
  const tolerancia = Math.max(1e-12, Math.abs(carga) * 1e-9);
  // Grupos por valor nominal, de mayor a menor.
  const grupos = [];
  for (const pieza of [...piezas].sort((a, b) => b.nominal - a.nominal)) {
    const grupo = grupos.find(g => Math.abs(g.nominal - pieza.nominal) <= tolerancia);
    if (grupo) grupo.piezas.push(pieza);
    else grupos.push({ nominal: pieza.nominal, piezas: [pieza] });
  }
  grupos.forEach(grupo => grupo.piezas.sort(compararPiezas));

  let mejor = null;
  const cantidades = new Array(grupos.length).fill(0);
  const buscar = (indice, restante, usadas) => {
    if (Math.abs(restante) <= tolerancia) {
      if (!mejor || usadas < mejor.usadas) mejor = { usadas, cantidades: [...cantidades] };
      return;
    }
    if (indice >= grupos.length || restante < 0) return;
    const { nominal, piezas: disponibles } = grupos[indice];
    // Cota: con piezas de este valor o menores hacen falta al menos ⌈restante/nominal⌉.
    if (mejor && usadas + Math.ceil((restante - tolerancia) / nominal) >= mejor.usadas) return;
    const maximo = Math.min(disponibles.length, Math.floor((restante + tolerancia) / nominal));
    for (let cantidad = maximo; cantidad >= 0; cantidad -= 1) {
      cantidades[indice] = cantidad;
      buscar(indice + 1, restante - cantidad * nominal, usadas + cantidad);
    }
    cantidades[indice] = 0;
  };
  buscar(0, carga, 0);
  if (!mejor) return null;
  return grupos.flatMap((grupo, i) => grupo.piezas.slice(0, mejor.cantidades[i]));
};

/**
 * Piezas supuestas para una carga cuando el juego no tiene piezas en
 * DataMET+: descomposición en la serie 5-2-2-1 de la R111 (una de 5, dos de 2
 * y una de 1 por década), sin pasar del mayor valor que admite el juego
 * (`maximo`, en la unidad de la carga); ese valor mayor puede repetirse. Son
 * nominales: se usan con u = emp/√3 (EURAMET 7.1.2-3) y con aviso.
 */
const piezasSupuestas = (carga, { maximo = Infinity } = {}) => {
  if (!(carga > 0)) return [];
  const tolerancia = Math.max(1e-12, Math.abs(carga) * 1e-9);
  const tope = Math.min(carga, maximo);
  const valores = [];
  for (let decada = 10 ** Math.floor(Math.log10(tope)); decada >= carga * 1e-7; decada /= 10) {
    for (const factor of [5, 2, 1]) {
      const valor = Number((factor * decada).toPrecision(12));
      if (valor <= tope + tolerancia) valores.push({ valor, veces: factor === 2 ? 2 : 1 });
    }
  }
  const piezas = [];
  let restante = carga;
  valores.forEach(({ valor, veces }, indice) => {
    const limite = indice === 0 ? Infinity : veces;
    for (let n = 0; n < limite && valor <= restante + tolerancia; n += 1) {
      piezas.push({ nominal: valor, identificacion: '', supuesta: true });
      restante -= valor;
    }
  });
  return Math.abs(restante) <= tolerancia ? piezas : null;
};

module.exports = { MG_POR, componerCarga, piezasSupuestas };
