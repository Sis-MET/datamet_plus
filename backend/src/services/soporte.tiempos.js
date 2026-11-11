/**
 * Tiempos de servicio de Soporte técnico (KPI del personal). Cada servicio
 * vigente de los 8 tipos (la última fila de su `codigo_registro`, sin los
 * anulados) con la hora de inicio y la hora final que registró el técnico en
 * ServiceMET; esas horas no se corrigen en DataMET+. La OTST es la vigente del
 * informe (la corregida, si se cambió). Los ven el jefe del área y Sistemas.
 */
const { getPool, sql } = require('../config/db');
const { CLAVES_TIPO, TIPOS } = require('./soporte.tipos');
const { claveTecnicoSql } = require('./soporte.lista');
const { exigirTiempos } = require('./soporte.permisos');
const { fechaTexto, horaTexto, leerPeriodo, texto } = require('./tiempos');

/** Nombre corto de cada tipo, para las leyendas (los de la lista de informes). */
const CORTOS = {
  MPR: 'Preventivo regular', MPA: 'Preventivo avanzado', MCR: 'Correctivo', DIG: 'Diagnóstico',
  INT: 'Instalación', IBM: 'Verificación IBMETRO', VFI: 'Verificación interna', RVD: 'Relevamiento',
};

const fuenteTiempos = (tipo) => `
  SELECT '${tipo}' AS tipo, x.codigo_registro, x.otst, x.fecha_servicio, x.hora_inicio, x.hora_fin,
    x.cliente, x.planta, x.cod_metrica, x.tipo_equipo, n2.tecnico_clave
  FROM (
    SELECT t.codigo_registro, t.otst, t.fecha_servicio, t.hora_inicio, t.hora_fin,
      t.personal, t.cliente, t.planta, t.cod_metrica, t.tipo_equipo,
      ROW_NUMBER() OVER (PARTITION BY t.codigo_registro ORDER BY t.n DESC) AS rn
    FROM dbo.[${TIPOS[tipo].tabla}] t
    WHERE t.codigo_registro IS NOT NULL AND ISNULL(t.estado_servicio_csv, N'') <> N'ANULADO'
  ) x${claveTecnicoSql('x.personal')}
  WHERE x.rn = 1 AND x.fecha_servicio BETWEEN @desde AND @hasta`;

/** Servicios de los 8 tipos en el período, con la OTST vigente del informe. */
const consultaTiempos = () => `
  SELECT f.tipo, f.codigo_registro,
    COALESCE(NULLIF(LTRIM(RTRIM(JSON_VALUE(i.datos, '$.otst'))), N''), f.otst) AS otst,
    f.fecha_servicio, f.hora_inicio, f.hora_fin, f.tecnico_clave, f.cliente, f.planta, f.cod_metrica, f.tipo_equipo
  FROM (${CLAVES_TIPO.map(fuenteTiempos).join('\n  UNION ALL')}) f
  LEFT JOIN dbo.ST_INFORMES i ON i.tipo = f.tipo AND i.codigo_registro = f.codigo_registro
  ORDER BY f.fecha_servicio, f.hora_inicio, f.codigo_registro;`;

/**
 * Fecha del primer servicio registrado en DataMET, de cualquier tipo: antes no
 * hay datos, así que un período anterior a ella no sirve para comparar.
 */
const consultaPrimerServicio = () => `
  SELECT MIN(p.fecha) AS primero FROM (${CLAVES_TIPO.map(tipo => `
    SELECT MIN(t.fecha_servicio) AS fecha FROM dbo.[${TIPOS[tipo].tabla}] t
    WHERE t.codigo_registro IS NOT NULL AND ISNULL(t.estado_servicio_csv, N'') <> N'ANULADO'`).join('\n    UNION ALL')}
  ) p;`;

/** Una fila de la consulta como servicio de los tiempos. */
const mapServicio = (row) => ({
  codigo: row.codigo_registro,
  grupo: row.tipo,
  orden: texto(row.otst),
  fecha: fechaTexto(row.fecha_servicio),
  inicio: horaTexto(row.hora_inicio),
  fin: horaTexto(row.hora_fin),
  tecnico: texto(row.tecnico_clave),
  cliente: texto(row.cliente),
  planta: texto(row.planta),
  codMetrica: texto(row.cod_metrica),
  equipo: texto(row.tipo_equipo),
});

/** Servicios del período con sus horas, y cómo se llaman los grupos (tipos de servicio). */
const getTiempos = async (query, user) => {
  await exigirTiempos(user);
  const { desde, hasta } = leerPeriodo(query);
  const [result, primero] = await Promise.all([
    getPool().request()
      .input('desde', sql.Date, new Date(`${desde}T00:00:00Z`))
      .input('hasta', sql.Date, new Date(`${hasta}T00:00:00Z`))
      .query(consultaTiempos()),
    getPool().request().query(consultaPrimerServicio()),
  ]);
  return {
    desde,
    hasta,
    primerServicio: fechaTexto(primero.recordset[0]?.primero),
    grupos: CLAVES_TIPO.map(tipo => ({ id: tipo, nombre: TIPOS[tipo].etiqueta, corto: CORTOS[tipo] })),
    servicios: result.recordset.map(mapServicio),
  };
};

module.exports = { consultaPrimerServicio, consultaTiempos, getTiempos, mapServicio };
