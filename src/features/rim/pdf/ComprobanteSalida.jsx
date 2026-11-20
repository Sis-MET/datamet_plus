/* eslint-disable react-refresh/only-export-components */
import { Document, Image, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer';
import logoMetrica from '../../../assets/logoMetrica2.png';
import { descripcionInstrumento, fechaHora } from '../domain/rim';
import { ESTADOS_SALIDA, fechaCorta, quien } from '../domain/seguimiento';

/**
 * Comprobante de salida de un instrumento: la entrega vigente del RIM (6.3)
 * con el estado del equipo al salir y las dos firmas, en el mismo estilo que
 * el PDF de la recepción.
 */
const AZUL = '#1E3E70';

const styles = StyleSheet.create({
  page: { padding: 32, paddingBottom: 48, fontFamily: 'Helvetica', fontSize: 9, color: '#222', lineHeight: 1.35 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  headerLeft: { alignItems: 'center', width: 150 },
  logo: { width: 140, height: 55, objectFit: 'contain', marginBottom: -4 },
  headerWeb: { fontFamily: 'Helvetica-Bold', fontSize: 8 },
  headerInfo: { flexDirection: 'row', fontSize: 6, gap: 10, lineHeight: 1.1 },
  headerColLeft: { alignItems: 'flex-end', textAlign: 'right' },
  headerTitle: { fontFamily: 'Helvetica-Bold', fontSize: 7, marginBottom: 2 },
  headerBold: { fontFamily: 'Helvetica-Bold', marginTop: 1 },
  titleContainer: { alignItems: 'center', marginBottom: 10 },
  docTitle: { color: AZUL, fontSize: 12.5, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 3 },
  docCode: { color: '#16a34a', fontSize: 11, fontFamily: 'Helvetica-Bold' },
  anulado: {
    marginTop: 6, paddingVertical: 3, paddingHorizontal: 8, borderWidth: 1, borderColor: '#b91c1c',
    color: '#b91c1c', fontFamily: 'Helvetica-Bold', fontSize: 8.5,
  },
  sectionTitle: {
    backgroundColor: '#E0E0E0', color: '#000', paddingVertical: 4, paddingHorizontal: 6, fontSize: 9.5,
    fontFamily: 'Helvetica-Bold', marginTop: 10, marginBottom: 6,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  field: { width: '50%', paddingRight: 8, marginBottom: 4 },
  fieldFull: { width: '100%', marginBottom: 4 },
  label: { fontFamily: 'Helvetica-Bold', color: '#000' },
  estado: {
    marginTop: 2, marginBottom: 6, paddingVertical: 6, paddingHorizontal: 8, borderWidth: 1, borderColor: AZUL,
    flexDirection: 'row', alignItems: 'center',
  },
  estadoValor: { fontFamily: 'Helvetica-Bold', fontSize: 11, color: AZUL },
  conformidad: { marginTop: 4, marginBottom: 4, fontSize: 8.5 },
  firmas: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 },
  firma: { width: '42%', alignItems: 'center' },
  firmaImagen: { width: 190, height: 80, objectFit: 'contain', borderWidth: 1, borderColor: '#ccc', marginBottom: 4 },
  firmaVacia: { width: 190, height: 80, borderWidth: 1, borderColor: '#ccc', borderStyle: 'dashed', marginBottom: 4 },
  firmaLinea: { width: '100%', borderTopWidth: 1, borderTopColor: '#444', paddingTop: 3, alignItems: 'center' },
  firmaTitulo: { fontFamily: 'Helvetica-Bold', fontSize: 8 },
  firmaNombre: { fontSize: 8.5 },
  footer: {
    position: 'absolute', bottom: 18, left: 32, right: 32, textAlign: 'center', color: '#666', fontSize: 6.5,
    borderTopWidth: 1, borderTopColor: '#ccc', paddingTop: 4,
  },
});

const Campo = ({ label, value, full = false }) => (
  <View style={full ? styles.fieldFull : styles.field}>
    <Text><Text style={styles.label}>{label}: </Text>{value || '-'}</Text>
  </View>
);

const Firma = ({ titulo, nombre, src }) => (
  <View style={styles.firma}>
    {src ? <Image style={styles.firmaImagen} src={src} /> : <View style={styles.firmaVacia} />}
    <View style={styles.firmaLinea}>
      <Text style={styles.firmaTitulo}>{titulo}</Text>
      {nombre && <Text style={styles.firmaNombre}>{nombre}</Text>}
    </View>
  </View>
);

const conUnidad = (valor, unidad) => [valor, unidad].filter(Boolean).join(' ');

function ComprobanteSalidaDocument({ rim, generado }) {
  const entrega = rim.seguimiento.entrega.vigente;
  const datos = entrega.datos;
  const estado = ESTADOS_SALIDA[datos.estadoSalida]?.label || datos.estadoSalida;
  const registro = [quien(entrega), fechaHora(entrega.registradoEn)].filter(Boolean).join(' el ');

  return (
    <Document title={`Comprobante de salida ${rim.codigo}`} author="Métrica Ltda." creator="DataMET+">
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Image src={logoMetrica} style={styles.logo} />
            <Text style={styles.headerWeb}>www.metrica.com.bo</Text>
          </View>
          <View style={styles.headerInfo}>
            <View style={styles.headerColLeft}>
              <Text style={styles.headerTitle}>LA PAZ</Text>
              <Text>Pje. Gral. Donato Cardozo N° 715-B</Text>
              <Text>Fernando Guachalla, Sopocachi</Text>
              <Text>591 2 2422060 - 591 2 2910878</Text>
              <Text style={styles.headerBold}>• comercial@metrica.com.bo</Text>
            </View>
            <View>
              <Text style={styles.headerTitle}>SANTA CRUZ</Text>
              <Text>Prolongación Mutualista N° 6170</Text>
              <Text>Entre 6to y 7mo Anillo</Text>
              <Text>+591 67010001</Text>
              <Text style={styles.headerBold}>• info@metrica.com.bo</Text>
            </View>
          </View>
        </View>

        <View style={styles.titleContainer}>
          <Text style={styles.docTitle}>Comprobante de salida de instrumento</Text>
          <Text style={styles.docCode}>{rim.codigo}</Text>
          {rim.estado === 'anulado' && <Text style={styles.anulado}>RIM ANULADO</Text>}
        </View>

        <Text style={styles.sectionTitle}>1. Cliente e instrumento</Text>
        <View style={styles.grid}>
          <Campo label="Cliente" value={[rim.cliente.nombre, rim.cliente.codigo && `(${rim.cliente.codigo})`].filter(Boolean).join(' ')} />
          <Campo label="Razón social" value={rim.cliente.razonSocial} />
          <Campo label="NIT" value={rim.cliente.nit} />
          <Campo label="Planta" value={[rim.planta.codigo, rim.planta.nombre].filter(Boolean).join(' · ')} />
          <Campo label="Instrumento" value={descripcionInstrumento(rim.instrumento)} />
          <Campo label="Serie" value={rim.instrumento.serie} />
          <Campo label="Código Métrica" value={rim.instrumento.codMetrica} />
          <Campo label="Capacidad" value={conUnidad(rim.instrumento.capacidad, rim.instrumento.unidad)} />
          <Campo label="Resolución" value={conUnidad(rim.instrumento.division, rim.instrumento.unidad)} />
          <Campo label="Recibido (RIM)" value={fechaHora(rim.trazabilidad?.emitidoEn || rim.emitidoEn)} />
        </View>

        <Text style={styles.sectionTitle}>2. Entrega</Text>
        <View style={styles.estado}>
          <Text style={styles.label}>Estado del equipo al salir: </Text>
          <Text style={styles.estadoValor}>{estado || 'No indicado'}</Text>
        </View>
        <View style={styles.grid}>
          <Campo label="Fecha de entrega" value={fechaCorta(datos.fechaEntrega)} />
          <Campo label="Lugar de entrega" value={datos.lugarEntrega} />
          <Campo label="Recibió (cliente)" value={datos.recibeNombre} />
          <Campo label="Entregó (Métrica)" value={datos.entregaPor} />
          <Campo label="Observaciones" value={datos.observaciones || 'Sin observaciones'} full />
        </View>

        <Text style={styles.sectionTitle}>3. Conformidad</Text>
        <Text style={styles.conformidad}>
          Quien firma por el cliente declara recibir el instrumento descrito, en el estado indicado.
        </Text>
        <View style={styles.firmas} wrap={false}>
          <Firma titulo="Recibí conforme (cliente)" nombre={datos.recibeNombre} src={entrega.firmas?.cliente} />
          <Firma titulo="Entregó por Métrica" nombre={datos.entregaPor} src={entrega.firmas?.representante} />
        </View>

        <Text style={styles.footer} fixed>
          {[
            `Métrica Ltda. · ${rim.codigo}`,
            registro && `Entrega registrada por ${registro}`,
            `Comprobante generado el ${generado}`,
          ].filter(Boolean).join(' · ')}
        </Text>
      </Page>
    </Document>
  );
}

/** PDF del comprobante de salida de la entrega vigente. */
export function comprobanteSalidaBlob(rim, { ahora = new Date() } = {}) {
  if (!rim?.seguimiento?.entrega?.vigente) throw new Error('El RIM no tiene una entrega vigente.');
  return pdf(<ComprobanteSalidaDocument rim={rim} generado={fechaHora(ahora.toISOString())} />).toBlob();
}

/** Genera y descarga el comprobante: «Salida_RIM-26-0042.pdf». */
export async function descargarComprobanteSalida(rim) {
  const blob = await comprobanteSalidaBlob(rim);
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `Salida_${rim.codigo}.pdf`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
