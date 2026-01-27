import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import logoMetrica from '../assets/logoMetrica2.png';

export async function generatePDF(formData, rimCode) {
  console.log('Starting PDF generation...');
  console.log('RIM Code:', rimCode);
  console.log('Form Data:', formData);
  
  try {
    // Crear un contenedor temporal para el PDF
    console.log('Creating PDF container...');
    const pdfContainer = document.createElement('div');
    pdfContainer.style.position = 'absolute';
    pdfContainer.style.left = '-9999px';
    pdfContainer.style.width = '750px'; // Fixed width for consistent rendering
    pdfContainer.style.padding = '30px';
    pdfContainer.style.backgroundColor = '#ffffff';
    pdfContainer.style.color = '#000000';
    pdfContainer.style.fontFamily = 'Arial, sans-serif';
    pdfContainer.style.boxSizing = 'border-box';
    
    // Construir el HTML del documento
    pdfContainer.innerHTML = `
      <div style="width: 100%;">
        <!-- Header con logo y datos de contacto -->
        <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #000;">
          <div style="flex: 0 0 120px;">
            <img src="${logoMetrica}" style="width: 120px; height: auto; display: block;" alt="Métrica LTDA" />
          </div>
          <div style="flex: 1; font-size: 7px; line-height: 1.2;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; text-align: right;">
              <div>
                <div style="font-weight: bold; margin-bottom: 2px;">CENTRAL LA PAZ</div>
                <div>Calle. Fernando Guachalla, Sopocachi</div>
                <div>Pje. Gral. Donato Cardozo N° 715-B</div>
                <div>591 2 2422060 - 591 2 2910878</div>
                <div style="font-weight: bold;">www.metrica.com.bo</div>
              </div>
              <div>
                <div style="font-weight: bold; margin-bottom: 2px;">SUCURSAL SANTA CRUZ</div>
                <div>Calle: Prolongación Mutualista</div>
                <div>Entre 6to y 7mo Anillo # 6170</div>
                <div>+591 67010001</div>
                <div style="font-weight: bold;">info@metrica.com.bo</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Título del documento -->
        <div style="text-align: center; margin-bottom: 10px; padding: 6px; background: #f8f9fa; border: 1px solid #1E3E70;">
          <h1 style="color: #1E3E70; margin: 0; font-size: 12px; text-transform: uppercase;">RECEPCIÓN DE INSTRUMENTOS DE PESAJE</h1>
          <h2 style="color: #16a34a; margin: 4px 0 0 0; font-family: monospace; font-size: 10px;">${rimCode}</h2>
        </div>

        <div style="margin-bottom: 12px;">
          <h3 style="background: #1E3E70; color: white; padding: 5px; margin: 0 0 8px 0; font-size: 10px;">1. Datos Generales del Cliente</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 8px; font-size: 8px;">
            <div><strong>Empresa:</strong> ${formData.companyName || ''}</div>
            <div><strong>Razón Social:</strong> ${formData.companyRazonSocial || ''}</div>
            <div><strong>NIT:</strong> ${formData.taxId || ''}</div>
            <div><strong>Ciudad:</strong> ${formData.city || ''}</div>
            <div><strong>Dirección:</strong> ${formData.address || ''}</div>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 8px;">
            <div><strong>Nombre Contacto:</strong> ${formData.contactName || ''}</div>
            <div><strong>Cargo:</strong> ${formData.contactPosition || ''}</div>
            <div><strong>Teléfono:</strong> ${formData.phone || ''}</div>
            <div><strong>Email:</strong> ${formData.email || ''}</div>
          </div>
        </div>

        <div style="margin-bottom: 12px;">
          <h3 style="background: #1E3E70; color: white; padding: 5px; margin: 0 0 8px 0; font-size: 10px;">2. Datos Generales del Instrumento</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 8px;">
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

        <div style="margin-bottom: 12px;">
          <h3 style="background: #1E3E70; color: white; padding: 5px; margin: 0 0 8px 0; font-size: 10px;">3. Estado del Instrumento</h3>
          
          <!-- 3.1 Inventario de Componentes -->
          ${formData.inventory && Object.keys(formData.inventory).some(key => formData.inventory[key]) ? `
          <h4 style="color: #1E3E70; margin-top: 6px; margin-bottom: 4px; font-size: 9px;">3.1 Inventario de Componentes</h4>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 6px; font-size: 7px;">
            <thead>
              <tr style="background: #f0f0f0;">
                <th style="border: 1px solid #ddd; padding: 3px; text-align: left;">Componente</th>
                <th style="border: 1px solid #ddd; padding: 3px; text-align: center; width: 60px;">Estado</th>
                <th style="border: 1px solid #ddd; padding: 3px; text-align: center; width: 40px;">Cant.</th>
              </tr>
            </thead>
            <tbody>
              ${[
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
              ].filter(item => formData.inventory[item.key]).map(item => {
                const status = formData.inventory[item.key];
                const statusLabels = { 'present': 'Presente', 'missing': 'Faltante', 'na': 'N/A' };
                const statusLabel = statusLabels[status] || status || '-';
                const qty = item.qtyKey && formData.inventory[item.qtyKey] ? formData.inventory[item.qtyKey] : '-';
                return `
                  <tr>
                    <td style="border: 1px solid #ddd; padding: 3px;">${item.label}</td>
                    <td style="border: 1px solid #ddd; padding: 3px; text-align: center;">${statusLabel}</td>
                    <td style="border: 1px solid #ddd; padding: 3px; text-align: center;">${qty}</td>
                  </tr>
                `;
              }).join('')}
              ${formData.inventory.other ? `
              <tr>
                <td style="border: 1px solid #ddd; padding: 3px;">Otros componentes</td>
                <td colspan="2" style="border: 1px solid #ddd; padding: 3px;">${formData.inventory.other}</td>
              </tr>
              ` : ''}
            </tbody>
          </table>
          ${formData.inventoryNotes ? `<p style="font-size: 7px; margin: 4px 0;"><strong>Observaciones:</strong> ${formData.inventoryNotes}</p>` : ''}
          ` : ''}
          
          
          <!-- 3.2 Daños Físicos -->
          <h4 style="color: #1E3E70; margin-top: 8px; margin-bottom: 4px; font-size: 9px;">3.2 Daños Físicos</h4>
          ${formData.damageLevel ? `
          <p style="font-size: 7px; margin: 2px 0;"><strong>Estado General:</strong> ${
            { 'excellent': 'Excelente', 'good': 'Bueno', 'fair': 'Regular', 'poor': 'Malo', 'critical': 'Crítico' }[formData.damageLevel] || formData.damageLevel
          }</p>
          ` : '<p style="font-size: 7px; margin: 2px 0;"><strong>Estado General:</strong> No especificado</p>'}
          
          ${formData.damageTypes && Object.keys(formData.damageTypes).length > 0 ? (() => {
            const damageLabels = {
              'scratches': 'Rayones superficiales',
              'dents': 'Abolladuras',
              'corrosion': 'Corrosión/Oxidación',
              'cracks': 'Grietas',
              'broken': 'Piezas rotas',
              'wear': 'Desgaste excesivo',
              'other': 'Otros'
            };
            const locationLabels = {
              'platform': 'Plataforma',
              'display': 'Indicador/Display',
              'structure': 'Estructura',
              'column': 'Columna',
              'loadCells': 'Celdas de carga',
              'wiring': 'Cableado',
              'other': 'Otro'
            };
            
            const damageItems = Object.entries(formData.damageTypes).map(([damageType, locations]) => {
              const damageLabel = damageLabels[damageType] || damageType;
              const locationList = Array.isArray(locations) && locations.length > 0 
                ? locations.map(loc => locationLabels[loc] || loc).join(', ')
                : 'No especificado';
              return `<li><strong>${damageLabel}:</strong> ${locationList}</li>`;
            }).join('');
            
            return `
          <div style="margin-top: 4px; font-size: 7px;">
            <p style="font-weight: bold; margin-bottom: 3px;">Tipos de daños:</p>
            <ul style="margin: 0; padding-left: 12px;">
              ${damageItems}
            </ul>
          </div>
          `;
          })() : ''}
          
          ${formData.damageDescription ? `<p style="margin-top: 4px; font-size: 7px;"><strong>Descripción:</strong> ${formData.damageDescription}</p>` : ''}
          
          <!-- 3.3 Limpieza del Instrumento -->
          <h4 style="color: #1E3E70; margin-top: 8px; margin-bottom: 4px; font-size: 9px;">3.3 Limpieza del Instrumento</h4>
          ${formData.cleanlinessLevel ? `
          <p style="font-size: 7px; margin: 2px 0;"><strong>Nivel de Suciedad:</strong> ${
            { 'clean': 'Limpio', 'light': 'Suciedad Ligera', 'moderate': 'Suciedad Moderada', 'heavy': 'Muy Sucio' }[formData.cleanlinessLevel] || formData.cleanlinessLevel
          }</p>
          ` : '<p style="font-size: 7px; margin: 2px 0;"><strong>Nivel de Suciedad:</strong> No especificado</p>'}
          
          ${formData.dirtTypes && Object.keys(formData.dirtTypes).length > 0 ? (() => {
            const dirtLabels = {
              'dust': 'Polvo',
              'grease': 'Grasa/Aceite',
              'rust': 'Óxido',
              'residue': 'Residuos de producto',
              'stains': 'Manchas',
              'other': 'Otros'
            };
            const locationLabels = {
              'platform': 'Plataforma',
              'display': 'Indicador/Display',
              'structure': 'Estructura',
              'column': 'Columna',
              'loadCells': 'Celdas de carga',
              'wiring': 'Cableado',
              'other': 'Otro'
            };
            
            const dirtItems = Object.entries(formData.dirtTypes).map(([dirtType, locations]) => {
              const dirtLabel = dirtLabels[dirtType] || dirtType;
              const locationList = Array.isArray(locations) && locations.length > 0 
                ? locations.map(loc => locationLabels[loc] || loc).join(', ')
                : 'No especificado';
              return `<li><strong>${dirtLabel}:</strong> ${locationList}</li>`;
            }).join('');
            
            return `
          <div style="margin-top: 4px; font-size: 7px;">
            <p style="font-weight: bold; margin-bottom: 3px;">Tipos de suciedad:</p>
            <ul style="margin: 0; padding-left: 12px;">
              ${dirtItems}
            </ul>
          </div>
          `;
          })() : ''}
          
          ${formData.cleanlinessNotes ? `<p style="margin-top: 4px; font-size: 7px;"><strong>Observaciones:</strong> ${formData.cleanlinessNotes}</p>` : ''}
        </div>

        <div style="margin-bottom: 10px;">
          <h3 style="background: #1E3E70; color: white; padding: 5px; margin: 0 0 6px 0; font-size: 10px;">4. Síntomas del Instrumento</h3>
          <p style="font-size: 7px; margin: 2px 0;"><strong>Pruebas de Funcionamiento:</strong> ${formData.functionalityTestPerformed === 'yes' ? 'Sí' : 'No'}</p>
          ${formData.functionalityTestDescription ? `<p style="font-size: 7px; margin: 2px 0;"><strong>Descripción:</strong> ${formData.functionalityTestDescription}</p>` : ''}
        </div>

        ${formData.photos && formData.photos.length > 0 ? `
        <div style="margin-bottom: 10px;">
          <h3 style="background: #1E3E70; color: white; padding: 5px; margin: 0 0 6px 0; font-size: 10px;">5. Evidencias Fotográficas</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
            ${formData.photos.map((photo, index) => {
              const photoUrl = photo instanceof File ? URL.createObjectURL(photo) : photo;
              return `
                <div style="text-align: center;">
                  <img src="${photoUrl}" style="max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px;" />
                  <p style="margin: 2px 0; font-size: 6px; color: #666;">Foto ${index + 1}</p>
                </div>
              `;
            }).join('')}
          </div>
        </div>
        ` : ''}

        <div style="margin-bottom: 10px;">
          <h3 style="background: #1E3E70; color: white; padding: 5px; margin: 0 0 6px 0; font-size: 10px;">6. Recepción, Ejecución y Entrega</h3>
          
          <h4 style="color: #1E3E70; margin-top: 6px; font-size: 9px;">6.1 Recepción</h4>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 6px; font-size: 7px;">
            <div><strong>Cliente:</strong> ${formData.receptionClientName || ''}</div>
            <div><strong>Por Métrica:</strong> ${formData.receptionMetricaRepresentative || ''}</div>
            <div><strong>Fecha:</strong> ${formData.receptionDate || ''}</div>
            <div><strong>Lugar:</strong> ${formData.receptionLocation || ''}</div>
          </div>
          
          ${formData.receptionClientSignature || formData.receptionReceiverSignature ? `
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 8px;">
            ${formData.receptionClientSignature ? `
            <div style="text-align: center;">
              <p style="margin: 0 0 3px 0; font-weight: bold; font-size: 7px;">Firma del Cliente</p>
              <img src="${formData.receptionClientSignature}" style="width: 150px; height: 60px; object-fit: contain; border: 1px solid #ccc; border-radius: 2px; display: block; margin: 0 auto;" />
            </div>
            ` : '<div></div>'}
            ${formData.receptionReceiverSignature ? `
            <div style="text-align: center;">
              <p style="margin: 0 0 3px 0; font-weight: bold; font-size: 7px;">Firma del Receptor</p>
              <img src="${formData.receptionReceiverSignature}" style="width: 150px; height: 60px; object-fit: contain; border: 1px solid #ccc; border-radius: 2px; display: block; margin: 0 auto;" />
            </div>
            ` : '<div></div>'}
          </div>
          ` : ''}

          <h4 style="color: #1E3E70; margin-top: 6px; font-size: 9px;">6.2 Ejecución</h4>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 7px;">
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

          <h4 style="color: #1E3E70; margin-top: 6px; font-size: 9px;">6.3 Entrega</h4>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 6px; font-size: 7px;">
            <div><strong>Cliente:</strong> ${formData.deliveryClientName || ''}</div>
            <div><strong>Por Métrica:</strong> ${formData.deliveryMetricaRepresentative || ''}</div>
            <div><strong>Fecha:</strong> ${formData.deliveryDate || ''}</div>
            <div><strong>Lugar:</strong> ${formData.deliveryLocation || ''}</div>
          </div>
          
          ${formData.deliveryClientSignature || formData.deliveryResponsibleSignature ? `
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 8px;">
            ${formData.deliveryClientSignature ? `
            <div style="text-align: center;">
              <p style="margin: 0 0 3px 0; font-weight: bold; font-size: 7px;">Firma del Cliente</p>
              <img src="${formData.deliveryClientSignature}" style="width: 150px; height: 60px; object-fit: contain; border: 1px solid #ccc; border-radius: 2px; display: block; margin: 0 auto;" />
            </div>
            ` : '<div></div>'}
            ${formData.deliveryResponsibleSignature ? `
            <div style="text-align: center;">
              <p style="margin: 0 0 3px 0; font-weight: bold; font-size: 7px;">Firma del Responsable</p>
              <img src="${formData.deliveryResponsibleSignature}" style="width: 150px; height: 60px; object-fit: contain; border: 1px solid #ccc; border-radius: 2px; display: block; margin: 0 auto;" />
            </div>
            ` : '<div></div>'}
          </div>
          ` : ''}
        </div>

        <div style="margin-top: 10px; padding-top: 6px; border-top: 1px solid #ccc; text-align: center; color: #666; font-size: 6px;">
          <p style="margin: 2px 0;">© ${new Date().getFullYear()} Métrica LTDA - Todos los derechos reservados</p>
          <p style="margin: 2px 0;">Documento generado el ${new Date().toLocaleString('es-CO')}</p>
        </div>
      </div>
    `;

    console.log('HTML content built successfully');
    document.body.appendChild(pdfContainer);

    // Generar el canvas del contenido
    console.log('Rendering HTML to canvas...');
    const canvas = await html2canvas(pdfContainer, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

    console.log('Canvas rendered successfully');
    // Remover el contenedor temporal
    document.body.removeChild(pdfContainer);

    // Crear el PDF
    console.log('Creating PDF document...');
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'legal'); // Cambiado a tamaño legal (oficio)
    
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pdfWidth - 16; // 8mm margin on each side (reducido)
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    let heightLeft = imgHeight;
    let position = 8; // Margen superior reducido

    // Agregar la primera página
    pdf.addImage(imgData, 'PNG', 8, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight;

    // Agregar páginas adicionales si es necesario
    while (heightLeft > 0) {
      position = heightLeft - imgHeight + 8;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 8, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
    }

    // Guardar el PDF
    console.log('Saving PDF...');
    const fileName = `RIM_${rimCode}_${new Date().getTime()}.pdf`;
    pdf.save(fileName);

    console.log('PDF generated and saved successfully:', fileName);
    return { success: true, fileName };
  } catch (error) {
    console.error('Error generating PDF:', error);
    console.error('Error stack:', error.stack);
    console.error('Form data that caused error:', formData);
    return { success: false, error: error.message, stack: error.stack };
  }
}
