/* eslint-disable react-refresh/only-export-components */
import { Circle, Document, Image, Page, Path, StyleSheet, Svg, Text, View, pdf } from '@react-pdf/renderer';
import logoMetrica from '../../../assets/logoMetrica2.png';
import {
  PROBLEMAS, SIN_TECNICO, formatoDecimal, formatoDiferencia, formatoDuracion, formatoHoras, formatoPorcentaje,
} from '../domain/tiempos';
import { ALTO, ANCHO, SIN_DEPARTAMENTO, agruparPuntos, geometriaDepartamentos } from '../domain/ubicacion';

/**
 * Informe PDF de los tiempos de servicio con el encabezado de los RIM:
 * logotipo y sitio a la izquierda, oficinas de La Paz y Santa Cruz a la
 * derecha, en todas las páginas. Usa lo que el panel ya calculó (mismos
 * filtros y mismo período) y no vuelve a pedir nada al servidor.
 */

// Paleta de los RIM.
const AZUL = '#1E3E70';
const VERDE = '#16a34a';
const GRIS_SECCION = '#E0E0E0';
const BORDE = '#dddddd';
const TEXTO = '#333333';
const SUAVE = '#666666';

// Colores de cada grupo (los del tema claro del panel, en hex para el PDF).
const SERIES = {
  1: '#2a78d6', 2: '#eb6834', 3: '#1baf7a', 4: '#eda100', 5: '#e87ba4', 6: '#008300', 7: '#6250d6', 8: '#e34948', otros: '#a09e96',
};
export const hexDeSerie = (css) => {
  const match = /--serie-(\d+|otros)/.exec(String(css || ''));
  return SERIES[match?.[1]] || SERIES.otros;
};

/** Helvetica del PDF no tiene algunos signos: se cambian por sus equivalentes. */
const caracteres = (...codigos) => String.fromCharCode(...codigos);
// Signo menos, espacios finos y el carácter de reemplazo (texto dañado).
const REEMPLAZOS = [
  [new RegExp(caracteres(0x2212), 'g'), '-'],
  [new RegExp(`[${caracteres(0x202f, 0x2009, 0x2007)}]`, 'g'), ' '],
  [new RegExp(caracteres(0xfffd), 'g'), '?'],
];
const t = valor => REEMPLAZOS.reduce((texto, [patron, por]) => texto.replace(patron, por), String(valor ?? ''));

const s = StyleSheet.create({
  // Sin lineHeight en la página: react-pdf lo vuelve a multiplicar en el pie con «Página X de Y»
  // en cada página y, pasadas unas 12, el número se desborda y el PDF falla.
  page: { paddingTop: 25, paddingBottom: 40, paddingHorizontal: 28, fontFamily: 'Helvetica', fontSize: 8, color: TEXTO },
  // Encabezado de los RIM
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 6, marginBottom: 8, borderBottomWidth: 0.75, borderBottomColor: '#cfcfcf' },
  headerLeft: { flexDirection: 'column', alignItems: 'center', width: 150 },
  logo: { width: 140, height: 55, objectFit: 'contain', marginBottom: -4 },
  headerWeb: { fontFamily: 'Helvetica-Bold', fontSize: 8 },
  headerInfo: { flexDirection: 'row', fontSize: 6, gap: 10, lineHeight: 1.1 },
  headerColLeft: { flexDirection: 'column', alignItems: 'flex-end', textAlign: 'right' },
  headerColRight: { flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' },
  headerTitle: { fontFamily: 'Helvetica-Bold', fontSize: 7, marginBottom: 2 },
  headerText: { marginBottom: 1 },
  headerBold: { fontFamily: 'Helvetica-Bold', marginTop: 1 },
  // Título
  titleContainer: { textAlign: 'center', marginBottom: 8, padding: 4 },
  docTitle: { color: AZUL, fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 4 },
  docCode: { color: VERDE, fontSize: 11, fontFamily: 'Helvetica-Bold' },
  docPeriodo: { color: SUAVE, fontSize: 8, marginTop: 3 },
  sectionTitle: { backgroundColor: GRIS_SECCION, color: '#000', padding: 4, fontSize: 9, fontFamily: 'Helvetica-Bold', marginTop: 10, marginBottom: 6 },
  subTitle: { color: '#444', fontSize: 9, fontFamily: 'Helvetica-Bold', marginTop: 6, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: '#444', paddingBottom: 2 },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 2 },
  field: { width: '50%', paddingRight: 6, marginBottom: 3 },
  label: { fontFamily: 'Helvetica-Bold', color: '#000' },
  value: { fontFamily: 'Helvetica', color: '#000' },
  nota: { fontSize: 7, color: SUAVE, marginTop: 3 },
  // Indicadores
  kpis: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  kpi: { flex: 1, borderWidth: 1, borderColor: BORDE, borderRadius: 3, padding: 6 },
  kpiLabel: { fontSize: 7, color: SUAVE, marginBottom: 2 },
  kpiValue: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: AZUL },
  kpiDelta: { fontSize: 6.5, marginTop: 2 },
  kpiDetalle: { fontSize: 6.5, color: SUAVE, marginTop: 1 },
  // Tablas
  thead: { flexDirection: 'row', backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: BORDE },
  th: { padding: 3, fontFamily: 'Helvetica-Bold', fontSize: 7, color: '#000' },
  tr: { flexDirection: 'row', borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 0.5, borderColor: BORDE },
  trPar: { backgroundColor: '#fafafa' },
  td: { padding: 3, fontSize: 7 },
  total: { fontFamily: 'Helvetica-Bold' },
  // Gráfico por mes
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 110, borderBottomWidth: 1, borderBottomColor: '#bbbbbb', paddingHorizontal: 4, marginTop: 4 },
  chartCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%', paddingHorizontal: 2 },
  chartBar: { width: '70%', backgroundColor: '#2868b6', borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  chartValue: { fontSize: 6, color: TEXTO, marginBottom: 2 },
  chartLabels: { flexDirection: 'row', paddingHorizontal: 4, marginTop: 2, marginBottom: 6 },
  chartLabel: { flex: 1, textAlign: 'center', fontSize: 6.5, color: SUAVE },
  // Mapa
  mapaFila: { flexDirection: 'row', gap: 10 },
  mapaCaja: { width: 230, position: 'relative' },
  mapaEtiqueta: { position: 'absolute', fontSize: 6, fontFamily: 'Helvetica-Bold', textAlign: 'center', width: 60 },
  leyenda: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  leyendaCuadro: { width: 10, height: 6 },
  // Bloque por técnico
  tecnico: { borderWidth: 1, borderColor: BORDE, borderRadius: 3, padding: 6, marginBottom: 6 },
  tecnicoNombre: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: AZUL },
  tecnicoResumen: { fontSize: 7, color: SUAVE, marginTop: 1, marginBottom: 4 },
  mezcla: { flexDirection: 'row', height: 6, marginBottom: 3, borderRadius: 2, overflow: 'hidden' },
  footer: { position: 'absolute', bottom: 15, left: 28, right: 28, textAlign: 'center', color: SUAVE, fontSize: 6, borderTopWidth: 1, borderTopColor: '#cccccc', paddingTop: 4 },
});

function Encabezado() {
  return (
    <View style={s.header} fixed>
      <View style={s.headerLeft}>
        <Image src={logoMetrica} style={s.logo} />
        <Text style={s.headerWeb}>www.metrica.com.bo</Text>
      </View>
      <View style={s.headerInfo}>
        <View style={s.headerColLeft}>
          <Text style={s.headerTitle}>LA PAZ</Text>
          <Text style={s.headerText}>Pje. Gral. Donato Cardozo N° 715-B</Text>
          <Text style={s.headerText}>Fernando Guachalla, Sopocachi</Text>
          <Text style={s.headerText}>591 2 2422060 - 591 2 2910878</Text>
          <Text style={s.headerBold}>• comercial@metrica.com.bo</Text>
        </View>
        <View style={s.headerColRight}>
          <Text style={s.headerTitle}>SANTA CRUZ</Text>
          <Text style={s.headerText}>Prolongación Mutualista N° 6170</Text>
          <Text style={s.headerText}>Entre 6to y 7mo Anillo</Text>
          <Text style={s.headerText}>+591 67010001</Text>
          <Text style={s.headerBold}>• info@metrica.com.bo</Text>
        </View>
      </View>
    </View>
  );
}

const Campo = ({ label, value, ancho }) => (
  <View style={[s.field, ancho ? { width: ancho } : null]}>
    <Text style={s.label}>{t(label)}: <Text style={s.value}>{t(value || '-')}</Text></Text>
  </View>
);

/**
 * Tabla simple: columnas [{ titulo, ancho, alinear }] y filas de textos.
 * Las filas van sueltas, cada una con su borde: un contenedor con borde que
 * se parte en muchas páginas hace fallar al motor del PDF (react-pdf).
 */
function Tabla({ columnas, filas, totales }) {
  const fila = (clave, valores, estilo, extra) => (
    <View key={clave} style={[s.tr, estilo]} wrap={false}>
      {columnas.map((columna, j) => (
        <View key={columna.titulo} style={{ width: columna.ancho }}>
          <Text style={[s.td, { textAlign: columna.alinear || 'left' }, extra]}>{t(valores[j])}</Text>
        </View>
      ))}
    </View>
  );
  return (
    <>
      <View style={s.thead} wrap={false} minPresenceAhead={24}>
        {columnas.map(columna => (
          <Text key={columna.titulo} style={[s.th, { width: columna.ancho, textAlign: columna.alinear || 'left' }]}>{t(columna.titulo)}</Text>
        ))}
      </View>
      {filas.map((valores, i) => fila(i, valores, i % 2 ? s.trPar : null))}
      {totales && fila('total', totales, { backgroundColor: '#f0f0f0' }, s.total)}
    </>
  );
}

function Indicador({ label, valor, cambio, subeEsBueno = true, detalle, etiqueta }) {
  const tieneCambio = cambio !== null && cambio !== undefined;
  const bueno = tieneCambio && (cambio === 0 || (cambio > 0) === subeEsBueno);
  return (
    <View style={s.kpi}>
      <Text style={s.kpiLabel}>{t(label)}</Text>
      <Text style={s.kpiValue}>{t(valor)}</Text>
      {tieneCambio && (
        <Text style={[s.kpiDelta, { color: cambio === 0 ? SUAVE : bueno ? VERDE : '#be1e1e' }]}>
          {t(`${cambio > 0 ? '+' : cambio < 0 ? '-' : ''}${Math.abs(Math.round(cambio * 100))} % ${etiqueta || ''}`)}
        </Text>
      )}
      {detalle && <Text style={s.kpiDetalle}>{t(detalle)}</Text>}
    </View>
  );
}

function GraficoMeses({ meses }) {
  const maximo = Math.max(1, ...meses.map(m => m.minutos));
  return (
    <View wrap={false}>
      <View style={s.chart}>
        {meses.map(mes => (
          <View key={mes.clave} style={s.chartCol}>
            {mes.minutos > 0 && <Text style={s.chartValue}>{t(formatoHoras(mes.minutos).replace(' h', ''))}</Text>}
            <View style={[s.chartBar, { height: `${Math.max(mes.minutos ? 2 : 0, (mes.minutos / maximo) * 85)}%` }]} />
          </View>
        ))}
      </View>
      <View style={s.chartLabels}>
        {meses.map(mes => <Text key={mes.clave} style={s.chartLabel}>{t(mes.etiqueta)}</Text>)}
      </View>
    </View>
  );
}

const mezclar = (a, b, k) => Math.round(a + (b - a) * k);
/** Del gris azulado claro al azul METTLER según la intensidad (0–1). */
const rellenoPdf = (nivel) => {
  if (nivel <= 0) return '#f1f1ee';
  const k = 0.12 + 0.88 * nivel;
  const [r, g, b] = [mezclar(233, 0, k), mezclar(240, 54, k), mezclar(248, 114, k)];
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
};

function MapaPdf({ filas, servicios, colores }) {
  const geometria = geometriaDepartamentos();
  const porId = new Map(filas.map(f => [f.id, f]));
  const maximo = Math.max(0, ...filas.filter(f => f.id !== SIN_DEPARTAMENTO).map(f => f.servicios));
  const ancho = 230;
  const escala = ancho / ANCHO;
  const alto = ALTO * escala;
  const puntos = agruparPuntos(servicios, 14);
  return (
    <View style={s.mapaCaja}>
      <Svg width={ancho} height={alto} viewBox={`0 0 ${ANCHO} ${ALTO}`}>
        {geometria.map((d) => {
          const fila = porId.get(d.id);
          const nivel = maximo > 0 && fila?.servicios ? Math.sqrt(fila.servicios / maximo) : 0;
          return <Path key={d.id} d={d.ruta} fill={rellenoPdf(nivel)} stroke="#ffffff" strokeWidth={4} />;
        })}
        {puntos.map(p => (
          <Circle
            key={p.clave}
            cx={p.x}
            cy={p.y}
            r={Math.min(30, 9 + 5 * Math.sqrt(p.servicios.length))}
            fill={hexDeSerie(colores.get(p.grupo))}
            stroke="#ffffff"
            strokeWidth={3}
          />
        ))}
      </Svg>
      {geometria.map((d) => {
        const fila = porId.get(d.id);
        const nivel = maximo > 0 && fila?.servicios ? Math.sqrt(fila.servicios / maximo) : 0;
        const [x, y] = d.etiqueta;
        return (
          <View key={`e-${d.id}`} style={[s.mapaEtiqueta, { left: x * escala - 30, top: y * escala - 7 }]}>
            <Text style={{ color: nivel > 0.55 ? '#ffffff' : '#1b1b1b' }}>{t(d.nombre)}</Text>
            {fila?.servicios > 0 && <Text style={{ color: nivel > 0.55 ? '#ffffff' : '#1b1b1b', fontFamily: 'Helvetica', fontSize: 5.5 }}>{fila.servicios}</Text>}
          </View>
        );
      })}
    </View>
  );
}

const fechaCorta = iso => (iso ? iso.split('-').reverse().join('/') : '-');
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

export function InformeTiemposDocumento({ datos }) {
  const {
    titulo, areaNombre, textos, periodo, comparacion, filtros, generadoPor, generado, analisis, anterior, secciones,
    nombreCorto, nombreDepartamento, colores, sinDatos,
  } = datos;
  const { resumen } = analisis;
  const cambio = clave => (anterior ? (anterior.resumen[clave] ? (resumen[clave] - anterior.resumen[clave]) / anterior.resumen[clave] : null) : null);
  const meses = analisis.porMes.length || 1;
  // Las secciones elegidas se numeran a continuación de las dos fijas.
  const incluidas = ['meses', 'personal', 'grupos', 'departamentos', 'detallePersonal', 'servicios'].filter(id => secciones[id]);
  const numeroDe = id => 3 + incluidas.indexOf(id);
  const totalMinutos = analisis.porGrupo.reduce((suma, g) => suma + g.minutos, 0);

  return (
    <Document title={titulo} author="Métrica Ltda." subject={`Tiempos de servicio de ${areaNombre}`} creator="DataMET+">
      <Page size="LETTER" style={s.page} wrap>
        <Encabezado />

        <View style={s.titleContainer}>
          <Text style={s.docTitle}>Informe de tiempos de servicio</Text>
          <Text style={s.docCode}>{t(areaNombre.toUpperCase())}</Text>
          <Text style={s.docPeriodo}>{t(periodo)}</Text>
        </View>

        <Text style={s.sectionTitle}>1. Datos del informe</Text>
        <View style={s.row}>
          <Campo label="Área" value={areaNombre} />
          <Campo label="Período" value={periodo} />
          <Campo label="Comparado con" value={comparacion} />
          <Campo label="Filtros" value={filtros} />
          <Campo label="Generado por" value={generadoPor} />
          <Campo label="Fecha de generación" value={generado} />
        </View>
        <Text style={s.nota}>{t(textos.descripcion)} {t(textos.origen)}</Text>

        <Text style={s.sectionTitle}>2. Resumen general</Text>
        <View style={s.kpis}>
          <Indicador label="Horas de servicio" valor={formatoHoras(resumen.minutos)} cambio={cambio('minutos')} etiqueta={anterior?.etiqueta} detalle={`Media mensual ${formatoHoras(resumen.minutos / meses)}`} />
          <Indicador label="Servicios" valor={String(resumen.servicios)} cambio={cambio('servicios')} etiqueta={anterior?.etiqueta} detalle={resumen.porRevisar ? `${formatoPorcentaje(resumen.cobertura)} con horas válidas` : 'Todos con horas válidas'} />
          <Indicador label="Media por jornada" valor={formatoDuracion(resumen.porJornada)} cambio={cambio('porJornada')} etiqueta={anterior?.etiqueta} detalle={plural(resumen.jornadas, 'jornada', 'jornadas')} />
          <Indicador label="Media por servicio" valor={formatoDuracion(resumen.promedio)} cambio={cambio('promedio')} subeEsBueno={false} etiqueta={anterior?.etiqueta} detalle={`Mediana ${formatoDuracion(resumen.mediana)}`} />
        </View>
        <View style={s.kpis}>
          <Indicador label="Visitas" valor={String(resumen.visitas)} detalle={`${formatoDecimal(resumen.equiposPorVisita)} equipos por visita`} />
          <Indicador label="Personal" valor={String(resumen.tecnicos)} detalle="Técnicos con servicios" />
          <Indicador label="Duración P90" valor={formatoDuracion(resumen.p90)} detalle={`Mín. ${formatoDuracion(resumen.minimo)} · máx. ${formatoDuracion(resumen.maximo)}`} />
          <Indicador label="Horas por revisar" valor={String(resumen.porRevisar)} detalle="Servicios que no se pudieron medir" />
        </View>
        {!anterior && sinDatos && <Text style={s.nota}>{t(`Sin comparación: ${sinDatos}`)}</Text>}

        {secciones.meses && (
          <>
            <Text style={s.sectionTitle} minPresenceAhead={140}>{numeroDe('meses')}. Evolución mensual</Text>
            <Text style={s.subTitle}>Horas de servicio por mes</Text>
            <GraficoMeses meses={analisis.porMes} />
            <Tabla
              columnas={[
                { titulo: 'Mes', ancho: '22%' }, { titulo: 'Servicios', ancho: '13%', alinear: 'right' }, { titulo: 'Horas', ancho: '15%', alinear: 'right' },
                { titulo: 'Media por servicio', ancho: '18%', alinear: 'right' }, { titulo: 'Jornadas', ancho: '12%', alinear: 'right' },
                { titulo: 'Técnicos', ancho: '10%', alinear: 'right' }, { titulo: 'Por revisar', ancho: '10%', alinear: 'right' },
              ]}
              filas={analisis.porMes.map(m => [m.nombre, m.servicios, formatoHoras(m.minutos), formatoDuracion(m.promedio), m.jornadas, m.tecnicos, m.porRevisar])}
              totales={['Total', resumen.servicios, formatoHoras(resumen.minutos), formatoDuracion(resumen.promedio), resumen.jornadas, resumen.tecnicos, resumen.porRevisar]}
            />
          </>
        )}

        {secciones.personal && (
          <>
            <Text style={s.sectionTitle} minPresenceAhead={80}>{numeroDe('personal')}. Personal</Text>
            <Tabla
              columnas={[
                { titulo: 'Técnico', ancho: '26%' }, { titulo: 'Servicios', ancho: '10%', alinear: 'right' }, { titulo: 'Horas', ancho: '12%', alinear: 'right' },
                { titulo: 'Jornadas', ancho: '9%', alinear: 'right' }, { titulo: 'Por jornada', ancho: '12%', alinear: 'right' },
                { titulo: 'Por servicio', ancho: '12%', alinear: 'right' }, { titulo: 'vs. área', ancho: '9%', alinear: 'right' }, { titulo: 'Por revisar', ancho: '10%', alinear: 'right' },
              ]}
              filas={analisis.porTecnico.map(f => [
                f.tecnico, f.servicios, formatoHoras(f.minutos), f.jornadas, formatoDuracion(f.porJornada), formatoDuracion(f.promedio), formatoDiferencia(f.indice), f.porRevisar,
              ])}
            />
            <Text style={s.nota}>{t(`«vs. área»: cuánto más (+) o menos (-) tarda que la mediana del área en ${textos.mismos}, con al menos 5 servicios medidos.`)}</Text>
          </>
        )}

        {secciones.grupos && (
          <>
            <Text style={s.sectionTitle} minPresenceAhead={80}>{numeroDe('grupos')}. {t(textos.grupos)}</Text>
            <Tabla
              columnas={[
                { titulo: textos.grupo, ancho: '34%' }, { titulo: 'Servicios', ancho: '12%', alinear: 'right' }, { titulo: 'Horas', ancho: '14%', alinear: 'right' },
                { titulo: '% de horas', ancho: '12%', alinear: 'right' }, { titulo: 'Media', ancho: '15%', alinear: 'right' }, { titulo: 'Por revisar', ancho: '13%', alinear: 'right' },
              ]}
              filas={analisis.porGrupo.map(g => [
                g.nombre, g.servicios, formatoHoras(g.minutos), totalMinutos ? `${Math.round((g.minutos / totalMinutos) * 100)} %` : '-', formatoDuracion(g.promedio), g.porRevisar,
              ])}
            />
          </>
        )}

        {secciones.departamentos && (
          <View wrap={false}>
            <Text style={s.sectionTitle}>{numeroDe('departamentos')}. Por departamento</Text>
            <View style={s.mapaFila}>
              <MapaPdf filas={analisis.porDepartamento} servicios={analisis.serviciosMapa} colores={colores} />
              <View style={{ flex: 1 }}>
                <Tabla
                  columnas={[
                    { titulo: 'Departamento', ancho: '30%' }, { titulo: 'Servicios', ancho: '17%', alinear: 'right' }, { titulo: 'Horas', ancho: '19%', alinear: 'right' },
                    { titulo: 'Técnicos', ancho: '16%', alinear: 'right' }, { titulo: 'Con GPS', ancho: '18%', alinear: 'right' },
                  ]}
                  filas={[...analisis.porDepartamento]
                    .filter(d => d.servicios > 0)
                    .sort((a, b) => b.servicios - a.servicios)
                    .map(d => [nombreDepartamento(d.id), d.servicios, formatoHoras(d.minutos), d.tecnicos, d.conUbicacion])}
                />
                <Text style={s.nota}>
                  {t('El departamento sale de la ubicación GPS que registró ServiceMET; sin ella, del departamento de la planta. Los puntos del mapa son los lugares con GPS, del color del tipo de servicio que más se repite.')}
                </Text>
              </View>
            </View>
          </View>
        )}

        {secciones.detallePersonal && (
          <>
            <Text style={s.sectionTitle} minPresenceAhead={120}>{numeroDe('detallePersonal')}. Detalle por técnico</Text>
            {analisis.porTecnico.map(fila => (
              <View key={fila.tecnico} style={s.tecnico} wrap={false}>
                <Text style={s.tecnicoNombre}>{t(fila.tecnico)}</Text>
                <Text style={s.tecnicoResumen}>
                  {t(`${plural(fila.servicios, 'servicio', 'servicios')} · ${formatoHoras(fila.minutos)} · ${plural(fila.jornadas, 'jornada', 'jornadas')} · ${formatoDuracion(fila.porJornada)} por jornada · ${formatoDuracion(fila.promedio)} por servicio · vs. área ${formatoDiferencia(fila.indice)}`)}
                </Text>
                {fila.mezcla.length > 0 && (
                  <>
                    <View style={s.mezcla}>
                      {fila.mezcla.map(m => <View key={m.id} style={{ width: `${m.parte * 100}%`, backgroundColor: hexDeSerie(colores.get(m.id)) }} />)}
                    </View>
                    <Text style={{ fontSize: 6.5, color: SUAVE, marginBottom: 4 }}>
                      {t(fila.mezcla.map(m => `${nombreCorto(m.id)} ${Math.round(m.parte * 100)} %`).join(' · '))}
                    </Text>
                  </>
                )}
                <Tabla
                  columnas={[
                    { titulo: 'Mes', ancho: '30%' }, { titulo: 'Servicios', ancho: '17%', alinear: 'right' }, { titulo: 'Horas', ancho: '18%', alinear: 'right' },
                    { titulo: 'Jornadas', ancho: '15%', alinear: 'right' }, { titulo: 'Media', ancho: '20%', alinear: 'right' },
                  ]}
                  filas={fila.meses.filter(m => m.servicios > 0).map(m => [m.nombre, m.servicios, formatoHoras(m.minutos), m.jornadas, formatoDuracion(m.promedio)])}
                />
              </View>
            ))}
          </>
        )}

        {secciones.servicios && (
          <>
            <Text style={s.sectionTitle} minPresenceAhead={60}>{numeroDe('servicios')}. Servicios del período ({analisis.servicios.length})</Text>
            <Tabla
              columnas={[
                { titulo: 'Fecha', ancho: '9%' }, { titulo: textos.orden, ancho: '13%' }, { titulo: textos.grupo, ancho: '13%' },
                { titulo: 'Técnico', ancho: '14%' }, { titulo: 'Cliente / equipo', ancho: '22%' }, { titulo: 'Depto.', ancho: '9%' },
                { titulo: 'Horario', ancho: '10%', alinear: 'center' }, { titulo: 'Duración', ancho: '10%', alinear: 'right' },
              ]}
              filas={[...analisis.servicios]
                .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || String(a.inicio || '').localeCompare(String(b.inicio || '')))
                .map(sv => [
                  fechaCorta(sv.fecha), sv.orden || '-', nombreCorto(sv.grupo), sv.tecnico || SIN_TECNICO,
                  [sv.cliente || 'Sin cliente', sv.equipo].filter(Boolean).join(' · '),
                  sv.departamento && sv.departamento !== SIN_DEPARTAMENTO ? nombreDepartamento(sv.departamento) : '-',
                  `${sv.inicio || '--:--'} - ${sv.fin || '--:--'}`,
                  sv.problema ? PROBLEMAS[sv.problema] : formatoDuracion(sv.minutos),
                ])}
            />
          </>
        )}

        <Text
          style={s.footer}
          fixed
          render={({ pageNumber, totalPages }) => t(`Métrica LTDA - Documento generado el ${generado} · DataMET+ · Tiempos de servicio de ${areaNombre} · Página ${pageNumber} de ${totalPages}`)}
        />
      </Page>
    </Document>
  );
}

/** Genera el PDF y devuelve su Blob. */
export const generarInformeTiempos = datos => pdf(<InformeTiemposDocumento datos={datos} />).toBlob();
