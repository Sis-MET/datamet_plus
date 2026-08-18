/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import { pdf, Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';
import logoMetrica from '../assets/logoMetrica2.png';

// Register standard fonts if needed, but defaults are usually fine.
// Using Helvetica native for minimum size and best performance

const styles = StyleSheet.create({
  page: {
    padding: 25,
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: '#333333',
    lineHeight: 1.3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 8,
    marginBottom: 10,
  },
  logo: {
    width: 140,
    height: 55,
    objectFit: 'contain',
    marginBottom: -4,
  },
  headerLeft: {
    flexDirection: 'column',
    alignItems: 'center',
    width: 150,
  },
  headerWeb: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
  },
  headerInfo: {
    flexDirection: 'row',
    fontSize: 6,
    gap: 10,
    lineHeight: 1.1,
  },
  headerColLeft: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    textAlign: 'right',
  },
  headerColRight: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    textAlign: 'left',
  },
  headerTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    marginBottom: 2,
  },
  headerText: {
    marginBottom: 1,
  },
  headerBold: {
    fontFamily: 'Helvetica-Bold',
    marginTop: 1,
  },
  titleContainer: {
    textAlign: 'center',
    marginBottom: 8,
    padding: 6,
  },
  docTitle: {
    color: '#1E3E70',
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  docCode: {
    color: '#16a34a',
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
  },
  sectionTitle: {
    backgroundColor: '#E0E0E0',
    color: '#000000',
    padding: 4,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    marginTop: 8,
    marginBottom: 6,
  },
  subSectionTitle: {
    color: '#444444',
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    marginTop: 6,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#444444',
    paddingBottom: 2,
  },
  halfColumn: {
    width: '48%',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 4,
  },
  fieldCol2: {
    width: '50%',
    paddingRight: 5,
    marginBottom: 3,
  },
  fieldCol3: {
    width: '33.33%',
    paddingRight: 5,
    marginBottom: 3,
  },
  fieldCol4: {
    width: '25%',
    paddingRight: 5,
    marginBottom: 3,
  },
  fieldColFull: {
    width: '100%',
    marginBottom: 3,
  },
  label: {
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
  },
  value: {
    fontFamily: 'Helvetica',
    color: '#000000',
  },
  table: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 6,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    padding: 3,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  tableColComponent: {
    width: '60%',
    padding: 3,
    borderRightWidth: 1,
    borderRightColor: '#ddd',
  },
  tableColStatus: {
    width: '20%',
    padding: 3,
    borderRightWidth: 1,
    borderRightColor: '#ddd',
    textAlign: 'center',
  },
  tableColQty: {
    width: '20%',
    padding: 3,
    textAlign: 'center',
  },
  bulletItem: {
    flexDirection: 'row',
    marginBottom: 2,
    paddingLeft: 10,
  },
  bulletPoint: {
    width: 10,
    fontFamily: 'Helvetica-Bold',
  },
  bulletText: {
    flex: 1,
  },
  signatureContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
    marginBottom: 10,
  },
  signatureBox: {
    alignItems: 'center',
    width: '40%',
  },
  signatureImage: {
    width: 150,
    height: 60,
    objectFit: 'contain',
    borderWidth: 1,
    borderColor: '#ccc',
    marginBottom: 4,
  },
  signatureLineText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 5,
  },
  photoBox: {
    width: '33.33%',
    padding: 5,
    alignItems: 'center',
  },
  photoImage: {
    width: '100%',
    height: 100,
    objectFit: 'contain',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 2,
  },
  photoLabel: {
    fontSize: 6,
    color: '#666',
    marginTop: 2,
  },
  footer: {
    position: 'absolute',
    bottom: 15,
    left: 25,
    right: 25,
    textAlign: 'center',
    color: '#666',
    fontSize: 6,
    borderTopWidth: 1,
    borderTopColor: '#ccc',
    paddingTop: 4,
  }
});

const Field = ({ label, value, colStyle = styles.fieldCol3 }) => (
  <View style={colStyle}>
    <Text style={styles.label}>{label}: <Text style={styles.value}>{value || '-'}</Text></Text>
  </View>
);

const RIMDocument = ({ formData, rimCode }) => {
  const dateStr = new Date().toLocaleString('es-CO');

  const getStatusLabel = (status) => {
    const labels = { 'present': 'Presente', 'missing': 'Faltante', 'na': 'N/A' };
    return labels[status] || status || '-';
  };

  const mapDamageLabel = (key) => {
    const labels = {
      'scratches': 'Rayones superficiales',
      'dents': 'Abolladuras',
      'corrosion': 'Corrosión/Oxidación',
      'cracks': 'Grietas',
      'broken': 'Piezas rotas',
      'wear': 'Desgaste excesivo',
      'other': 'Otros'
    };
    return labels[key] || key;
  };

  const mapDirtLabel = (key) => {
    const labels = {
      'dust': 'Polvo',
      'grease': 'Grasa/Aceite',
      'rust': 'Óxido',
      'residue': 'Residuos de producto',
      'stains': 'Manchas',
      'other': 'Otros'
    };
    return labels[key] || key;
  };

  const mapLocationLabel = (loc) => {
    const locs = {
      'platform': 'Plataforma',
      'display': 'Indicador/Display',
      'structure': 'Estructura',
      'column': 'Columna',
      'loadCells': 'Celdas de carga',
      'wiring': 'Cableado',
      'other': 'Otro'
    };
    return locs[loc] || loc;
  };

  const getGeneralDamageLevel = (val) => {
    const map = { 'excellent': 'Excelente', 'good': 'Bueno', 'fair': 'Regular', 'poor': 'Malo', 'critical': 'Crítico' };
    return map[val] || val || 'No especificado';
  };

  const getGeneralDirtLevel = (val) => {
    const map = { 'clean': 'Limpio', 'light': 'Suciedad Ligera', 'moderate': 'Suciedad Moderada', 'heavy': 'Muy Sucio' };
    return map[val] || val || 'No especificado';
  };

  const inventoryItemsList = [
    { key: 'indicator', label: 'Indicador' },
    { key: 'voltageAdapter', label: 'Adaptador de Voltaje' },
    { key: 'powerCable', label: 'Cable de Poder' },
    { key: 'bracket', label: 'Bracket' },
    { key: 'column', label: 'Columna' },
    { key: 'weighingPan', label: 'Bandeja de Pesaje' },
    { key: 'windShield', label: 'Cabina Corta Aire' },
    { key: 'structure', label: 'Estructura' },
    { key: 'loadCells', label: 'Celda(s) de Carga', qtyKey: 'loadCellsQty' },
    { key: 'loadCellCable', label: 'Cable de Celda' },
    { key: 'loadCellConnector', label: 'Conector de Celda' },
    { key: 'junctionBox', label: 'Caja Sumadora' },
    { key: 'feet', label: 'Patas', qtyKey: 'feetQty' },
    { key: 'manual', label: 'Manual' },
    { key: 'originalPackaging', label: 'Embalaje Original' }
  ];

  const presentInventoryItems = formData.inventory ? inventoryItemsList.filter(item => formData.inventory[item.key]) : [];
  const hasOtherItems = formData.inventory?.otherItems && formData.inventory.otherItems.length > 0;

  return (
    <Document>
      <Page size="LEGAL" style={styles.page}>
        
        {/* ENCABEZADO */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Image src={logoMetrica} style={styles.logo} />
            <Text style={styles.headerWeb}>www.metrica.com.bo</Text>
          </View>
          
          <View style={styles.headerInfo}>
            <View style={styles.headerColLeft}>
              <Text style={styles.headerTitle}>LA PAZ</Text>
              <Text style={styles.headerText}>Pje. Gral. Donato Cardozo N° 715-B</Text>
              <Text style={styles.headerText}>Fernando Guachalla, Sopocachi</Text>
              <Text style={styles.headerText}>591 2 2422060 - 591 2 2910878</Text>
              <Text style={styles.headerBold}>• comercial@metrica.com.bo</Text>
            </View>
            <View style={styles.headerColRight}>
              <Text style={styles.headerTitle}>SANTA CRUZ</Text>
              <Text style={styles.headerText}>Prolongación Mutualista N° 6170</Text>
              <Text style={styles.headerText}>Entre 6to y 7mo Anillo</Text>
              <Text style={styles.headerText}>+591 67010001</Text>
              <Text style={styles.headerBold}>• info@metrica.com.bo</Text>
            </View>
          </View>
        </View>

        {/* TÍTULO */}
        <View style={styles.titleContainer}>
          <Text style={styles.docTitle}>RECEPCIÓN DE INSTRUMENTOS DE PESAJE</Text>
          <Text style={styles.docCode}>{rimCode}</Text>
        </View>

        {/* SECCIÓN 1: CLIENTE */}
        <Text style={styles.sectionTitle}>1. Datos Generales del Cliente</Text>
        <View style={styles.row}>
          <Field label="Empresa" value={formData.companyName} />
          <Field label="Razón Social" value={formData.companyRazonSocial} />
          <Field label="NIT/RUT" value={formData.taxId} />
        </View>
        <View style={styles.row}>
          <Field label="Nombre Contacto" value={formData.clientName} />
          <Field label="Cargo" value={formData.clientCargo} />
          <Field label="Teléfono" value={formData.phone} />
        </View>
        <View style={styles.row}>
          <Field label="Email" value={formData.email} />
        </View>

        {/* SECCIÓN 2: INSTRUMENTO */}
        <Text style={styles.sectionTitle}>2. Datos Generales del Instrumento</Text>
        <View style={styles.row}>
          <Field label="Instrumento" value={formData.instrument} />
          <Field label="Marca" value={formData.brand} />
          <Field label="Modelo" value={formData.model} />
        </View>
        <View style={styles.row}>
          <Field label="Número de Serie" value={formData.serialNumber} />
          <Field label="Capacidad" value={formData.maxCapacity} />
          <Field label="Unidad" value={formData.unit} />
        </View>
        <View style={styles.row}>
          <Field label="Resolución" value={formData.resolution} />
          <Field label="Área de Trabajo" value={formData.workArea} />
          <Field label="Observaciones" value={formData.notes || 'Ninguna'} />
        </View>

        {/* SECCIÓN 3: ESTADO E INVENTARIO */}
        <Text style={styles.sectionTitle}>3. Estado Físico e Inventario</Text>
        
        <View style={styles.rowBetween}>
          {/* COLUMNA IZQUIERDA: 3.1 Inventario */}
          <View style={styles.halfColumn}>
            <Text style={styles.subSectionTitle}>3.1 Inventario de Componentes</Text>
            {(presentInventoryItems.length > 0 || hasOtherItems) ? (
              <View style={styles.table}>
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.label, styles.tableColComponent]}>Componente</Text>
                  <Text style={[styles.label, styles.tableColStatus]}>Estado</Text>
                  <Text style={[styles.label, styles.tableColQty]}>Cantidad</Text>
                </View>
                {presentInventoryItems.map((item, i) => {
                  const statusLabel = getStatusLabel(formData.inventory[item.key]);
                  const qty = item.qtyKey && formData.inventory[item.qtyKey] ? formData.inventory[item.qtyKey] : '-';
                  return (
                    <View style={styles.tableRow} key={i}>
                      <Text style={styles.tableColComponent}>{item.label}</Text>
                      <Text style={styles.tableColStatus}>{statusLabel}</Text>
                      <Text style={styles.tableColQty}>{qty}</Text>
                    </View>
                  );
                })}
                {hasOtherItems && formData.inventory.otherItems.map((other, i) => {
                  if (!other.name || !other.name.trim()) return null;
                  return (
                    <View style={styles.tableRow} key={`other-${i}`}>
                      <Text style={styles.tableColComponent}>{other.name}</Text>
                      <Text style={styles.tableColStatus}>{getStatusLabel(other.status)}</Text>
                      <Text style={styles.tableColQty}>-</Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={{ fontSize: 7, fontStyle: 'italic', marginBottom: 6 }}>No se registraron componentes en el inventario.</Text>
            )}
            {formData.inventoryNotes && (
               <Text style={{ fontSize: 7, marginBottom: 8 }}><Text style={styles.label}>Observaciones:</Text> {formData.inventoryNotes}</Text>
            )}
          </View>

          {/* COLUMNA DERECHA: 3.2 y 3.3 */}
          <View style={styles.halfColumn}>
            {/* 3.2 Daños Físicos */}
            <Text style={styles.subSectionTitle}>3.2 Daños Físicos</Text>
            <Text style={{ fontSize: 7, marginBottom: 4 }}><Text style={styles.label}>Estado General:</Text> {getGeneralDamageLevel(formData.damageLevel)}</Text>
            {formData.damageTypes && Object.keys(formData.damageTypes).length > 0 && (
              <View style={{ marginBottom: 6 }}>
                <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>Tipos de daños encontrados:</Text>
                {Object.entries(formData.damageTypes).map(([damageType, locations]) => {
                  const label = mapDamageLabel(damageType);
                  const locList = Array.isArray(locations) && locations.length > 0 
                    ? locations.map(mapLocationLabel).join(', ')
                    : 'Ubicación no especificada';
                  
                  return (
                    <View style={styles.bulletItem} key={damageType}>
                      <Text style={styles.bulletPoint}>•</Text>
                      <Text style={styles.bulletText}><Text style={styles.label}>{label}:</Text> {locList}</Text>
                    </View>
                  );
                })}
              </View>
            )}
            {formData.damageDescription && (
               <Text style={{ fontSize: 7, marginBottom: 8 }}><Text style={styles.label}>Descripción Adicional:</Text> {formData.damageDescription}</Text>
            )}

            {/* 3.3 Suciedad */}
            <Text style={styles.subSectionTitle}>3.3 Limpieza del Instrumento</Text>
            <Text style={{ fontSize: 7, marginBottom: 4 }}><Text style={styles.label}>Nivel de Suciedad:</Text> {getGeneralDirtLevel(formData.cleanlinessLevel)}</Text>
            {formData.dirtTypes && Object.keys(formData.dirtTypes).length > 0 && (
              <View style={{ marginBottom: 6 }}>
                 <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>Tipos de suciedad encontrados:</Text>
                 {Object.entries(formData.dirtTypes).map(([dirtType, locations]) => {
                  const label = mapDirtLabel(dirtType);
                  const locList = Array.isArray(locations) && locations.length > 0 
                    ? locations.map(mapLocationLabel).join(', ')
                    : 'Ubicación no especificada';
                  
                  return (
                    <View style={styles.bulletItem} key={dirtType}>
                      <Text style={styles.bulletPoint}>•</Text>
                      <Text style={styles.bulletText}><Text style={styles.label}>{label}:</Text> {locList}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </View>

        {/* SECCIÓN 4: SÍNTOMAS Y RECEPCIÓN */}
        <Text style={styles.sectionTitle}>4. Recepción, Síntomas y Test</Text>

        <Text style={styles.subSectionTitle}>4.1 Síntomas y Evidencias</Text>
        <Text style={{ fontSize: 7, marginBottom: 3 }}><Text style={styles.label}>¿Se realizaron pruebas de funcionamiento?:</Text> {formData.functionalityTestPerformed === 'yes' ? 'Sí' : 'No'}</Text>
        {formData.functionalityTestPerformed === 'yes' && formData.functionalityTestDescription && (
            <Text style={{ fontSize: 7, marginBottom: 8 }}><Text style={styles.label}>Descripción de pruebas:</Text> {formData.functionalityTestDescription}</Text>
        )}
        
        {formData.photos && formData.photos.length > 0 && (
          <View style={{ marginBottom: 10 }}>
            <Text style={[styles.label, { fontSize: 7, marginBottom: 2 }]}>Evidencias fotográficas ({formData.photos.length}):</Text>
            {/* Omitiendo el renderizado directo de blob URIs en PDF, las notas visuales de las fotos. 
                Si photos.content (base64) existe y react-pdf soporta el tamaño lo renderiza 
            */}
            <View style={styles.photoGrid}>
              {formData.photos.map((p, i) => (
                <View style={styles.photoBox} key={i}>
                   {p.content ? (
                      <Image style={styles.photoImage} src={p.content} />
                   ) : (
                      <Text style={{ fontSize: 6, color: 'gray' }}>[Imagen adjunta]</Text>
                   )}
                   <Text style={styles.photoLabel}>{p.name || `Foto ${i+1}`}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <Text style={styles.subSectionTitle}>4.2 Recepción y Ejecución</Text>
        <View style={styles.row}>
          <Field label="Cliente/Solicitante" value={formData.receptionClientName} colStyle={styles.fieldCol2} />
          <Field label="Representante Métrica" value={formData.receptionMetricaRepresentative} colStyle={styles.fieldCol2} />
          <Field label="Lugar de Recepción" value={formData.receptionLocation} colStyle={styles.fieldCol2} />
          <Field label="Técnico Asignado" value={formData.executionAssignedTechnician} colStyle={styles.fieldCol2} />
        </View>
        
        {/* FIRMAS 4.2 */}
        <View style={styles.signatureContainer}>
           <View style={styles.signatureBox}>
              <Text style={styles.signatureLineText}>Firma del Cliente / Solicitante</Text>
              <View style={[styles.signatureImage, { borderStyle: 'dashed' }]}></View>
           </View>
           <View style={styles.signatureBox}>
              <Text style={styles.signatureLineText}>Representante de Métrica</Text>
              <View style={[styles.signatureImage, { borderStyle: 'dashed' }]}></View>
           </View>
        </View>

        {/* FIRMAS DE RECEPCIÓN */}
        {(formData.receptionClientSignature || formData.receptionReceiverSignature) && (
          <View style={styles.signatureContainer}>
             {formData.receptionClientSignature ? (
               <View style={styles.signatureBox}>
                  <Text style={styles.signatureLineText}>Firma del Cliente</Text>
                  <Image style={styles.signatureImage} src={formData.receptionClientSignature} />
               </View>
             ) : <View style={styles.signatureBox} />}
             
             {formData.receptionReceiverSignature ? (
               <View style={styles.signatureBox}>
                  <Text style={styles.signatureLineText}>Firma del Receptor (Métrica)</Text>
                  <Image style={styles.signatureImage} src={formData.receptionReceiverSignature} />
               </View>
             ) : <View style={styles.signatureBox} />}
          </View>
        )}

        {/* Pie de página */}
        <Text style={styles.footer} fixed>
          Métrica LTDA - Documento Generado el {dateStr}
        </Text>
      </Page>
    </Document>
  );
};

export const generatePDF = async (formData, rimCode) => {
  try {
    console.log("Generating Native PDF with React PDF Renderer...");
    
    const blob = await pdf(<RIMDocument formData={formData} rimCode={rimCode} />).toBlob();
    
    // Create an object URL containing the Blob data
    const url = URL.createObjectURL(blob);
    
    // Create a temporary anchor element to trigger download
    const link = document.createElement("a");
    link.href = url;
    const fileName = `RIM_${rimCode}_${new Date().getTime()}.pdf`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log("PDF generation and download triggered successfully.");
    return { success: true, fileName };
  } catch (error) {
    console.error("Failed to generate PDF:", error);
    return { success: false, error: error.message };
  }
};
