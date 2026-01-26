import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export async function generatePDF(formData, rimCode) {
  try {
    // Crear un contenedor temporal para el PDF
    const pdfContainer = document.createElement('div');
    pdfContainer.style.position = 'absolute';
    pdfContainer.style.left = '-9999px';
    pdfContainer.style.width = '210mm'; // A4 width
    pdfContainer.style.padding = '20px';
    pdfContainer.style.backgroundColor = '#ffffff';
    pdfContainer.style.color = '#000000';
    pdfContainer.style.fontFamily = 'Arial, sans-serif';
    
    // Construir el HTML del documento
    pdfContainer.innerHTML = `
      <div style="max-width: 800px; margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 3px solid #1E3E70; padding-bottom: 20px;">
          <h1 style="color: #1E3E70; margin: 0;">RIM - Recepción de Instrumentos de Pesaje</h1>
          <h2 style="color: #16a34a; margin: 10px 0; font-family: monospace;">${rimCode}</h2>
          <p style="margin: 5px 0; color: #666;">Métrica LTDA</p>
        </div>

        <div style="margin-bottom: 25px;">
          <h3 style="background: #1E3E70; color: white; padding: 10px; margin: 0 0 15px 0;">1. Datos Generales del Cliente</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
            <div><strong>Empresa:</strong> ${formData.companyName || ''}</div>
            <div><strong>Razón Social:</strong> ${formData.companyRazonSocial || ''}</div>
            <div><strong>NIT:</strong> ${formData.taxId || ''}</div>
            <div><strong>Ciudad:</strong> ${formData.city || ''}</div>
            <div><strong>Dirección:</strong> ${formData.address || ''}</div>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div><strong>Nombre Contacto:</strong> ${formData.contactName || ''}</div>
            <div><strong>Cargo:</strong> ${formData.contactPosition || ''}</div>
            <div><strong>Teléfono:</strong> ${formData.phone || ''}</div>
            <div><strong>Email:</strong> ${formData.email || ''}</div>
          </div>
        </div>

        <div style="margin-bottom: 25px;">
          <h3 style="background: #1E3E70; color: white; padding: 10px; margin: 0 0 15px 0;">2. Datos Generales del Instrumento</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div><strong>Instrumento:</strong> ${formData.instrument || ''}</div>
            <div><strong>Marca:</strong> ${formData.brand || ''}</div>
            <div><strong>Modelo:</strong> ${formData.model || ''}</div>
            <div><strong>Serie:</strong> ${formData.serial || ''}</div>
            <div><strong>Capacidad:</strong> ${formData.capacity || ''}</div>
            <div><strong>División:</strong> ${formData.division || ''}</div>
            <div><strong>Clase:</strong> ${formData.instrumentClass || ''}</div>
            <div><strong>Resolución:</strong> ${formData.resolution || ''}</div>
          </div>
        </div>

        <div style="margin-bottom: 25px;">
          <h3 style="background: #1E3E70; color: white; padding: 10px; margin: 0 0 15px 0;">3. Estado del Instrumento</h3>
          <p><strong>Estado General:</strong> ${formData.generalCondition || 'No especificado'}</p>
          <p><strong>Nivel de Suciedad:</strong> ${formData.cleanlinessLevel || 'No especificado'}</p>
          ${formData.damageDescription ? `<p><strong>Descripción de Daños:</strong> ${formData.damageDescription}</p>` : ''}
          ${formData.cleanlinessNotes ? `<p><strong>Observaciones de Limpieza:</strong> ${formData.cleanlinessNotes}</p>` : ''}
        </div>

        <div style="margin-bottom: 25px;">
          <h3 style="background: #1E3E70; color: white; padding: 10px; margin: 0 0 15px 0;">4. Síntomas del Instrumento</h3>
          <p><strong>Pruebas de Funcionamiento:</strong> ${formData.functionalityTestPerformed === 'yes' ? 'Sí' : 'No'}</p>
          ${formData.functionalityTestDescription ? `<p><strong>Descripción:</strong> ${formData.functionalityTestDescription}</p>` : ''}
        </div>

        <div style="margin-bottom: 25px;">
          <h3 style="background: #1E3E70; color: white; padding: 10px; margin: 0 0 15px 0;">6. Recepción, Ejecución y Entrega</h3>
          
          <h4 style="color: #1E3E70; margin-top: 15px;">6.1 Recepción</h4>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div><strong>Cliente:</strong> ${formData.receptionClientName || ''}</div>
            <div><strong>Por Métrica:</strong> ${formData.receptionMetricaRepresentative || ''}</div>
            <div><strong>Fecha:</strong> ${formData.receptionDate || ''}</div>
            <div><strong>Lugar:</strong> ${formData.receptionLocation || ''}</div>
          </div>

          <h4 style="color: #1E3E70; margin-top: 15px;">6.2 Ejecución</h4>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div><strong>Recepción S.T:</strong> ${formData.executionSTReception || ''}</div>
            <div><strong>Fecha Ingreso S.T:</strong> ${formData.executionSTEntryDate || ''}</div>
            <div><strong>Técnico Asignado:</strong> ${formData.executionAssignedTechnician || ''}</div>
            <div><strong>Fecha Inicio:</strong> ${formData.executionStartDate || ''}</div>
            <div><strong>Fecha Informe:</strong> ${formData.executionReportDate || ''}</div>
            <div><strong>Fecha Conclusión:</strong> ${formData.executionCompletionDate || ''}</div>
            <div><strong>N° Cotización:</strong> ${formData.executionQuoteNumber || ''}</div>
            <div><strong>N° Informe:</strong> ${formData.executionReportNumber || ''}</div>
            <div><strong>N° Factura:</strong> ${formData.executionInvoiceNumber || ''}</div>
          </div>

          <h4 style="color: #1E3E70; margin-top: 15px;">6.3 Entrega</h4>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div><strong>Cliente:</strong> ${formData.deliveryClientName || ''}</div>
            <div><strong>Por Métrica:</strong> ${formData.deliveryMetricaRepresentative || ''}</div>
            <div><strong>Fecha:</strong> ${formData.deliveryDate || ''}</div>
            <div><strong>Lugar:</strong> ${formData.deliveryLocation || ''}</div>
          </div>
        </div>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #ccc; text-align: center; color: #666;">
          <p style="margin: 5px 0;">© ${new Date().getFullYear()} Métrica LTDA - Todos los derechos reservados</p>
          <p style="margin: 5px 0; font-size: 12px;">Documento generado el ${new Date().toLocaleString('es-CO')}</p>
        </div>
      </div>
    `;

    document.body.appendChild(pdfContainer);

    // Generar el canvas del contenido
    const canvas = await html2canvas(pdfContainer, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

    // Remover el contenedor temporal
    document.body.removeChild(pdfContainer);

    // Crear el PDF
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pdfWidth - 20; // 10mm margin on each side
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    let heightLeft = imgHeight;
    let position = 10;

    // Agregar la primera página
    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight;

    // Agregar páginas adicionales si es necesario
    while (heightLeft > 0) {
      position = heightLeft - imgHeight + 10;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
    }

    // Guardar el PDF
    const fileName = `RIM_${rimCode}_${new Date().getTime()}.pdf`;
    pdf.save(fileName);

    return { success: true, fileName };
  } catch (error) {
    console.error('Error generating PDF:', error);
    return { success: false, error: error.message };
  }
}
