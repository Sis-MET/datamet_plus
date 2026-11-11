import { describe, expect, it } from 'vitest';
import {
  MAX_MINUTOS, aCsv, analizar, comparacion, formatoDiferencia, formatoDuracion, formatoHoras, indiceFrenteAlArea, mediana, medir,
  medirServicios, mezclaDe, percentil, periodoAnterior, porMes, rangoPeriodo, referencias, resumir, variacion,
} from './tiempos';

const servicio = (extra = {}) => ({
  codigo: `C-${Math.random()}`, grupo: 'MPR', orden: 'OT-1', fecha: '2026-03-10', inicio: '09:00', fin: '09:30',
  tecnico: 'Ana', cliente: 'CBN', planta: 'LP', codMetrica: '001', equipo: 'BALANZA', ...extra,
});

describe('duración de un servicio', () => {
  it('se mide entre la hora de inicio y la final', () => {
    expect(medir({ inicio: '09:00', fin: '09:30' })).toEqual({ minutos: 30, problema: null });
    expect(medir({ inicio: '08:45', fin: '11:02' })).toEqual({ minutos: 137, problema: null });
  });

  it('sin horas, con el fin antes del inicio o con más de 12 h no se mide', () => {
    expect(medir({ inicio: null, fin: '09:30' }).problema).toBe('SIN_HORAS');
    expect(medir({ inicio: '9:00', fin: '09:30' }).problema).toBe('SIN_HORAS');
    expect(medir({ inicio: '16:39', fin: '08:11' }).problema).toBe('FIN_ANTES');
    expect(medir({ inicio: '13:58', fin: '13:58' }).problema).toBe('FIN_ANTES');
    expect(medir({ inicio: '06:00', fin: '18:01' }).problema).toBe('MAS_DE_12H');
    expect(medir({ inicio: '06:00', fin: '18:00' })).toEqual({ minutos: MAX_MINUTOS, problema: null });
  });
});

describe('estadística', () => {
  it('mediana y percentiles con interpolación lineal (como Excel)', () => {
    expect(mediana([])).toBeNull();
    expect(mediana([30])).toBe(30);
    expect(mediana([10, 40, 20])).toBe(20);
    expect(mediana([10, 20, 30, 40])).toBe(25);
    expect(percentil([10, 20, 30, 40, 50], 0.9)).toBe(46);
  });
});

describe('indicadores', () => {
  it('el resumen separa lo que no se pudo medir y cuenta visitas', () => {
    const medidos = medirServicios([
      servicio({ inicio: '09:00', fin: '09:30' }),
      servicio({ inicio: '09:30', fin: '10:30' }),
      servicio({ inicio: '10:30', fin: null }),
      servicio({ orden: 'OT-2', inicio: '14:00', fin: '14:20' }),
    ]);
    const resumen = resumir(medidos);
    expect(resumen).toMatchObject({ servicios: 4, medidos: 3, porRevisar: 1, minutos: 110, mediana: 30, visitas: 2, equiposPorVisita: 2, tecnicos: 1 });
    expect(resumen.cobertura).toBe(0.75);
  });

  it('el índice compara con la mediana del área en los mismos tipos de servicio', () => {
    const referencia = new Map([['MPR', 30], ['RVD', 5]]);
    // Ana hace solo relevamientos rápidos: no debe parecer más eficiente que quien hace preventivos.
    const ana = medirServicios(Array.from({ length: 5 }, () => servicio({ grupo: 'RVD', inicio: '09:00', fin: '09:06' })));
    expect(indiceFrenteAlArea(ana, referencia)).toBeCloseTo(1.2);
    const beto = medirServicios(Array.from({ length: 5 }, () => servicio({ tecnico: 'Beto', inicio: '09:00', fin: '09:27' })));
    expect(indiceFrenteAlArea(beto, referencia)).toBeCloseTo(0.9);
    // Con pocos servicios medidos no se compara.
    expect(indiceFrenteAlArea(ana.slice(0, 4), referencia)).toBeNull();
  });

  it('la referencia sale del área entera aunque se filtre por técnico o tipo', () => {
    const servicios = [
      ...Array.from({ length: 6 }, () => servicio({ tecnico: 'Ana', inicio: '09:00', fin: '09:20' })),
      ...Array.from({ length: 6 }, () => servicio({ tecnico: 'Beto', inicio: '09:00', fin: '09:40' })),
      servicio({ tecnico: null, grupo: 'RVD', inicio: '09:00', fin: '09:05' }),
    ];
    const grupos = [{ id: 'MPR', nombre: 'Preventivo' }, { id: 'RVD', nombre: 'Relevamiento' }];
    const todo = analizar(servicios, { grupos, desde: '2026-01-01', hasta: '2026-04-30' });
    expect(todo.referencia.get('MPR')).toBe(30);
    expect(todo.porTecnico.map(t => [t.tecnico, t.minutos])).toEqual([['Beto', 240], ['Ana', 120], ['Sin identificar', 5]]);
    expect(todo.porTecnico[0].indice).toBeCloseTo(4 / 3);
    expect(todo.tecnicos).toEqual(['Ana', 'Beto', 'Sin identificar']);
    expect(todo.porGrupo.map(g => [g.nombre, g.servicios])).toEqual([['Preventivo', 12], ['Relevamiento', 1]]);
    expect(todo.porMes.map(m => [m.etiqueta, m.servicios])).toEqual([['ene', 0], ['feb', 0], ['mar', 13], ['abr', 0]]);

    const ana = analizar(servicios, { grupos, tecnico: 'Ana', desde: '2026-01-01', hasta: '2026-04-30' });
    expect(ana.servicios).toHaveLength(6);
    expect(ana.porTecnico).toHaveLength(1);
    expect(ana.porTecnico[0].indice).toBeCloseTo(2 / 3);
    const soloRvd = analizar(servicios, { grupos, grupo: 'RVD' });
    expect(soloRvd.porTecnico.map(t => t.tecnico)).toEqual(['Sin identificar']);
  });

  it('los meses cruzan de año y llevan el año en la etiqueta', () => {
    const meses = porMes([], '2025-11-15', '2026-02-10');
    expect(meses.map(m => m.etiqueta)).toEqual(['nov 25', 'dic 25', 'ene 26', 'feb 26']);
    expect(meses[0].nombre).toBe('noviembre de 2025');
    expect(porMes([], '2026-02-01', '2026-01-01')).toEqual([]);
  });
});

describe('períodos', () => {
  it('cada atajo da su desde y hasta', () => {
    const hoy = '2026-11-11';
    expect(rangoPeriodo('anio', hoy)).toEqual({ desde: '2026-01-01', hasta: hoy });
    expect(rangoPeriodo('mes', hoy)).toEqual({ desde: '2026-11-01', hasta: hoy });
    expect(rangoPeriodo('mes-anterior', hoy)).toEqual({ desde: '2026-10-01', hasta: '2026-10-31' });
    expect(rangoPeriodo('trimestre', hoy)).toEqual({ desde: '2026-09-01', hasta: hoy });
    expect(rangoPeriodo('doce', hoy)).toEqual({ desde: '2025-12-01', hasta: hoy });
    expect(rangoPeriodo('anio-anterior', hoy)).toEqual({ desde: '2025-01-01', hasta: '2025-12-31' });
    // Enero: el mes anterior y el trimestre caen en el año pasado.
    expect(rangoPeriodo('mes-anterior', '2026-01-20')).toEqual({ desde: '2025-12-01', hasta: '2025-12-31' });
    expect(rangoPeriodo('trimestre', '2026-02-20')).toEqual({ desde: '2025-12-01', hasta: '2026-02-20' });
    expect(rangoPeriodo('mes-anterior', '2026-03-05')).toEqual({ desde: '2026-02-01', hasta: '2026-02-28' });
  });
});

describe('formato', () => {
  it('duraciones, horas y diferencias', () => {
    expect(formatoDuracion(45)).toBe('45 min');
    expect(formatoDuracion(59.6)).toBe('1 h 00 min');
    expect(formatoDuracion(95)).toBe('1 h 35 min');
    expect(formatoDuracion(null)).toBe('—');
    expect(formatoHoras(12318)).toMatch(/^205[,.]3 h$/);
    expect(formatoDiferencia(1.12)).toBe('+12 %');
    expect(formatoDiferencia(0.92)).toBe('−8 %');
    expect(formatoDiferencia(1.001)).toBe('±0 %');
    expect(formatoDiferencia(null)).toBe('—');
  });

  it('el CSV es para Excel: punto y coma, BOM y sin fórmulas', () => {
    const csv = aCsv(medirServicios([
      servicio({ cliente: 'Planta "Norte"; Sur', inicio: '09:00', fin: '09:30' }),
      servicio({ cliente: '=HYPERLINK("x")', tecnico: null, inicio: '16:39', fin: '08:11' }),
    ]), { orden: 'OTST', grupo: 'Tipo de servicio', nombreGrupo: () => 'Preventivo' });
    const lineas = csv.split('\r\n');
    expect(csv.startsWith('\uFEFFFecha;OTST;Tipo de servicio;Técnico')).toBe(true);
    expect(lineas[1]).toBe('2026-03-10;OT-1;Preventivo;Ana;"Planta ""Norte""; Sur";LP;001;BALANZA;09:00;09:30;30;');
    expect(lineas[2]).toContain(`;"'=HYPERLINK(""x"")";`);
    expect(lineas[2]).toContain('Sin identificar');
    expect(lineas[2].endsWith(';La hora final no es posterior a la de inicio')).toBe(true);
  });
});

describe('jornadas, mezcla y comparación', () => {
  it('las horas por jornada son la media de los días con servicios medidos', () => {
    const resumen = resumir(medirServicios([
      servicio({ fecha: '2026-03-10', inicio: '08:00', fin: '10:00' }),
      servicio({ fecha: '2026-03-10', inicio: '10:00', fin: '12:00' }),
      servicio({ fecha: '2026-03-11', inicio: '08:00', fin: '10:00' }),
      servicio({ fecha: '2026-03-12', inicio: null }),
    ]));
    expect(resumen.jornadas).toBe(2);
    expect(resumen.porJornada).toBe(180);
    // El día sin horas cuenta como día trabajado, pero no entra en la media.
    expect(resumen.dias).toBe(3);
  });

  it('la mezcla respeta el orden de los grupos para que cada uno conserve su color', () => {
    const mezcla = mezclaDe(medirServicios([
      servicio({ grupo: 'RVD', inicio: '08:00', fin: '08:15' }),
      servicio({ grupo: 'MPR', inicio: '08:00', fin: '08:45' }),
      servicio({ grupo: 'MPR', inicio: null }),
    ]), [{ id: 'MPR' }, { id: 'MCR' }, { id: 'RVD' }]);
    expect(mezcla).toEqual([
      { id: 'MPR', servicios: 1, minutos: 45, parte: 0.75 },
      { id: 'RVD', servicios: 1, minutos: 15, parte: 0.25 },
    ]);
  });

  it('cada técnico trae sus meses y su mezcla, y «Sin identificar» va al final', () => {
    const filas = analizar([
      servicio({ tecnico: null, inicio: '08:00', fin: '18:00' }),
      servicio({ tecnico: 'Zoe', inicio: '08:00', fin: '08:30' }),
      servicio({ tecnico: 'Ana', fecha: '2026-02-01', inicio: '08:00', fin: '09:00' }),
    ], { grupos: [{ id: 'MPR' }], desde: '2026-01-01', hasta: '2026-03-31', orden: 'nombre' }).porTecnico;
    expect(filas.map(f => f.tecnico)).toEqual(['Ana', 'Zoe', 'Sin identificar']);
    expect(filas[0].meses.map(m => m.minutos)).toEqual([0, 60, 0]);
    expect(filas[0].mezcla).toEqual([{ id: 'MPR', servicios: 1, minutos: 60, parte: 1 }]);
  });

  it('el período anterior es el mismo tramo del año o del mes, o uno igual de largo', () => {
    expect(periodoAnterior('anio', { desde: '2026-01-01', hasta: '2026-11-11' }))
      .toEqual({ desde: '2025-01-01', hasta: '2025-11-11', etiqueta: 'vs. mismo período de 2025' });
    expect(periodoAnterior('anio', { desde: '2028-01-01', hasta: '2028-02-29' }).hasta).toBe('2027-02-28');
    expect(periodoAnterior('mes', { desde: '2026-03-01', hasta: '2026-03-31' }))
      .toEqual({ desde: '2026-02-01', hasta: '2026-02-28', etiqueta: 'vs. mismos días de febrero' });
    expect(periodoAnterior('mes-anterior', { desde: '2026-01-01', hasta: '2026-01-31' }))
      .toEqual({ desde: '2025-12-01', hasta: '2025-12-31', etiqueta: 'vs. diciembre' });
    expect(periodoAnterior('anio-anterior', { desde: '2025-01-01', hasta: '2025-12-31' }).desde).toBe('2024-01-01');
    expect(periodoAnterior('otro', { desde: '2026-03-01', hasta: '2026-03-10' }))
      .toEqual({ desde: '2026-02-19', hasta: '2026-02-28', etiqueta: 'vs. los 10 días anteriores' });
  });

  it('solo se compara si había datos durante todo el período anterior y suficientes', () => {
    const anterior = { desde: '2025-01-01', hasta: '2025-11-11' };
    const muchos = { medidos: 40 };
    expect(comparacion({ primerServicio: '2024-03-01', anterior, resumenAnterior: muchos })).toEqual({ comparar: true, motivo: null });
    // Los servicios empezaron a cargarse en agosto de 2025: enero a julio estarían vacíos.
    expect(comparacion({ primerServicio: '2025-08-18', anterior, resumenAnterior: muchos }).motivo).toBe('SIN_HISTORIA');
    expect(comparacion({ primerServicio: null, anterior, resumenAnterior: muchos }).motivo).toBe('SIN_HISTORIA');
    // Unos días de diferencia al comienzo no impiden comparar.
    expect(comparacion({ primerServicio: '2025-01-03', anterior, resumenAnterior: muchos }).comparar).toBe(true);
    expect(comparacion({ primerServicio: '2025-03-01', anterior, resumenAnterior: muchos }).motivo).toBe('SIN_HISTORIA');
    expect(comparacion({ primerServicio: '2024-03-01', anterior, resumenAnterior: { medidos: 9 } }).motivo).toBe('POCOS_DATOS');
    expect(comparacion({ primerServicio: '2024-03-01', anterior: null }).comparar).toBe(false);
  });

  it('la variación necesita un valor anterior', () => {
    expect(variacion(112, 100)).toBeCloseTo(0.12);
    expect(variacion(80, 100)).toBeCloseTo(-0.2);
    expect(variacion(10, 0)).toBeNull();
    expect(variacion(null, 5)).toBeNull();
  });
});

describe('referencias', () => {
  it('ignora lo que no se pudo medir', () => {
    const referencia = referencias(medirServicios([
      servicio({ inicio: '09:00', fin: '09:10' }), servicio({ inicio: '09:00', fin: '09:30' }), servicio({ inicio: null }),
    ]));
    expect(referencia.get('MPR')).toBe(20);
  });
});
