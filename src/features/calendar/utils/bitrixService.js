// src/features/calendar/utils/bitrixService.js

// Usamos la URL proporcionada
const BITRIX_URL = 'https://b24-nxcf6f.bitrix24.es/rest/69/fthkeab45vtr8gao/';

/**
 * Función genérica para llamar a la API de Bitrix24
 */
async function callBitrixAPI(method, params = {}) {
  try {
    const url = `${BITRIX_URL}${method}.json`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.result;
  } catch (error) {
    console.error(`Error en Bitrix24 API (${method}):`, error);
    throw error;
  }
}

/**
 * Crea un nuevo Deal (Negociación) en Bitrix24
 * @param {Object} dealData Datos de la actividad para crear el deal
 */
export async function createBitrixDeal(dealData) {
  // crm.deal.add es el método para crear negociaciones
  return await callBitrixAPI('crm.deal.add', {
    fields: {
      TITLE: `Actividad: ${dealData.morning}`,
      COMMENTS: `
        Detalles de la actividad creada desde el Cronograma RimMET:
        Técnico Asignado: ${dealData.tecnico}
        Fecha: ${dealData.fecha}
        Horario: ${dealData.horaInicio} - ${dealData.horaFin}
      `,
      // Puedes añadir más campos de Bitrix aquí según necesites:
      // CATEGORY_ID: 0,
      // STAGE_ID: "NEW", 
    }
  });
}
