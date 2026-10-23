/* eslint-disable react-refresh/only-export-components */
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';
import { medidaPesaje, SITUACIONES, sugeridoLabel } from '../../domain/proximos';

const s = StyleSheet.create({
  page: { paddingTop: 117, paddingBottom: 42, paddingHorizontal: 28, fontFamily: 'Helvetica', fontSize: 8, color: '#202832', lineHeight: 1.4 },
  header: { position: 'absolute', left: 28, right: 28, top: 23 },
  brand: { fontSize: 9, color: '#1f4e79', fontFamily: 'Helvetica-Bold' },
  title: { fontSize: 17, fontFamily: 'Helvetica-Bold', marginTop: 3 },
  subtitle: { fontSize: 8, color: '#4b5563', marginTop: 4 },
  columns: { position: 'absolute', left: 28, right: 28, top: 92, flexDirection: 'row', backgroundColor: '#1f4e79', color: '#fff', paddingVertical: 6, fontFamily: 'Helvetica-Bold' },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#d7dde3', paddingVertical: 8 },
  date: { width: '9%', paddingHorizontal: 6 },
  client: { width: '21%', paddingHorizontal: 6 },
  equipment: { width: '24%', paddingHorizontal: 6 },
  ranges: { width: '24%', paddingHorizontal: 6 },
  service: { width: '22%', paddingHorizontal: 6 },
  bold: { fontFamily: 'Helvetica-Bold' },
  muted: { color: '#4b5563', fontSize: 7, marginTop: 3 },
  footer: { position: 'absolute', top: 568, left: 28, right: 28, fontSize: 7, color: '#4b5563' },
});

export function PlanServiciosDocumento({ eventos, periodo, generado, filtros }) {
  return (
    <Document title={`Próximos servicios sugeridos - ${periodo}`} author="Métrica Ltda.">
      <Page size="A4" orientation="landscape" style={s.page} wrap>
        <View style={s.header} fixed>
          <Text style={s.brand}>MÉTRICA LTDA. · SOPORTE TÉCNICO</Text>
          <Text style={s.title}>Próximos servicios sugeridos</Text>
          <Text style={s.subtitle}>{periodo} · {eventos.length} {eventos.length === 1 ? 'servicio' : 'servicios'} · Generado el {generado}</Text>
          <Text style={s.subtitle}>Fechas sugeridas registradas; sujetas a coordinación.</Text>
        </View>
        <View style={s.columns} fixed>
          <Text style={s.date}>Fecha</Text><Text style={s.client}>Cliente / planta</Text>
          <Text style={s.equipment}>Equipo</Text><Text style={s.ranges}>Capacidad y divisiones</Text><Text style={s.service}>Servicio / referencia</Text>
        </View>
        {filtros && <Text style={{ marginBottom: 8, color: '#4b5563' }}>Filtros: {filtros}</Text>}
        {eventos.map(e => (
          <View key={e.id} style={s.row} wrap={false}>
            <View style={s.date}>
              <Text style={s.bold}>{e.fecha.split('-').reverse().join('/')}</Text>
              <Text style={s.muted}>{SITUACIONES[e.situacion]?.label || e.situacion}</Text>
            </View>
            <View style={s.client}>
              <Text style={s.bold}>{e.cliente || 'Sin cliente'}</Text>
              <Text>{e.planta || 'Sin planta'}</Text><Text style={s.muted}>{e.ciudad || ''}</Text>
            </View>
            <View style={s.equipment}>
              <Text style={s.bold}>{e.codMetrica}</Text>
              <Text>{[e.instrumento, e.marca, e.modelo].filter(Boolean).join(' · ')}</Text>
              <Text style={s.muted}>Serie: {e.serie || 'Sin dato'}{e.ubicacion ? ` · ${e.ubicacion}` : ''}</Text>
            </View>
            <View style={s.ranges}>
              <Text style={s.bold}>{e.tipoRango || 'Sin datos de rangos'}</Text>
              {(e.rangos || []).map(r => <Text key={r.numero}>
                R{r.numero}: Máx. {medidaPesaje(r.capacidad, e.unidades)} · d {medidaPesaje(r.division, e.unidades)}
                {r.verificacion != null ? ` · e ${medidaPesaje(r.verificacion, e.unidades)}` : ''}
              </Text>)}
            </View>
            <View style={s.service}>
              <Text style={s.bold}>{sugeridoLabel(e)}</Text>
              <Text style={s.muted}>OTST de referencia: {e.origen?.otst || 'Sin dato'}</Text>
              <Text style={s.muted}>Informe: {e.origen?.numero || e.origen?.codigo || 'Sin dato'}</Text>
            </View>
          </View>
        ))}
        <View style={s.footer} fixed>
          <Text render={({ pageNumber, totalPages }) => `DataMET+ · d: división de escala; e: intervalo de verificación · Página ${pageNumber} de ${totalPages}`}>
            DataMET+ · Plan de servicios sugeridos
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export const generarPlanPdf = datos => pdf(<PlanServiciosDocumento {...datos} />).toBlob();
