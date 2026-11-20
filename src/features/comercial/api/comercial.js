import { api } from '../../../shared/api/client';

const unwrap = (promise) => promise.then(response => response.data);

/** Apartado Comercial: facturas, pagos aplicados y cuentas por cobrar. */
export const comercialApi = {
  acceso: () => unwrap(api.get('/comercial/acceso')),
  categorias: () => unwrap(api.get('/comercial/categorias')),
  personal: () => unwrap(api.get('/comercial/personal')),
  clientes: (q) => unwrap(api.get('/comercial/clientes', { q })),
  cliente: (codigo) => unwrap(api.get(`/comercial/clientes/${encodeURIComponent(codigo)}`)),
  guardarCliente: (codigo, body) => unwrap(api.put(`/comercial/clientes/${encodeURIComponent(codigo)}`, body)),

  facturas: (params) => unwrap(api.get('/comercial/facturas', params)),
  siguienteNumero: (gestion) => unwrap(api.get('/comercial/facturas/siguiente', { gestion })),
  factura: (id) => unwrap(api.get(`/comercial/facturas/${id}`)),
  registrarFactura: (body) => unwrap(api.post('/comercial/facturas', body)),
  anularFactura: (id, motivo) => unwrap(api.post(`/comercial/facturas/${id}/anulacion`, { motivo })),

  pagos: (params) => unwrap(api.get('/comercial/pagos', params)),
  pago: (id) => unwrap(api.get(`/comercial/pagos/${id}`)),
  registrarPago: (body) => unwrap(api.post('/comercial/pagos', body)),
  anularPago: (id, motivo) => unwrap(api.post(`/comercial/pagos/${id}/anulacion`, { motivo })),

  cobranza: (params) => unwrap(api.get('/comercial/cobranza', params)),

  // Reportes (fase 4) y su libro de Excel para Contabilidad, con los mismos filtros.
  reportes: (params) => unwrap(api.get('/comercial/reportes', params)),
  reportesExcel: (params) => api.blob('/comercial/reportes/excel', { params, timeout: 60000 }),

  // Comisiones (fase 4): cada responsable ve las suyas; con permiso, las de todos.
  comisiones: (gestion) => unwrap(api.get('/comercial/comisiones', { gestion })),
  comisionesMes: (gestion, mes) => unwrap(api.get(`/comercial/comisiones/${gestion}/${mes}`)),
  comisionesExcel: (gestion, mes) => api.blob(`/comercial/comisiones/${gestion}/${mes}/excel`, { timeout: 60000 }),
  comisionesReglas: () => unwrap(api.get('/comercial/comisiones/reglas')),
  crearReglaComision: (body) => unwrap(api.post('/comercial/comisiones/reglas', body)),
  cerrarComisiones: (gestion, mes) => unwrap(api.post(`/comercial/comisiones/${gestion}/${mes}/cierre`, {})),
  anularCierreComisiones: (id, motivo) => unwrap(api.post(`/comercial/comisiones/cierres/${id}/anulacion`, { motivo })),

  // Bitrix24 (solo lectura del CRM): copia, enlaces y equivalencias de responsables.
  bitrixEstado: () => unwrap(api.get('/comercial/bitrix/estado')),
  bitrixNegociaciones: (params) => unwrap(api.get('/comercial/bitrix/negociaciones', params)),
  bitrixNegociacion: (id) => unwrap(api.get(`/comercial/bitrix/negociaciones/${id}`)),
  bitrixSincronizar: (completa = false) => unwrap(api.post('/comercial/bitrix/sincronizar', { completa })),
  bitrixUsuarios: () => unwrap(api.get('/comercial/bitrix/usuarios')),
  bitrixConfirmarUsuario: (bitrixId, usuarioId) => unwrap(api.put(`/comercial/bitrix/usuarios/${bitrixId}`, { usuarioId })),
  // Escribir en Bitrix24, con lo que la persona vio y confirmó.
  bitrixActualizar: (dealId, cambios) => unwrap(api.post(`/comercial/bitrix/negociaciones/${dealId}/actualizacion`, { cambios })),
  bitrixPendientes: () => unwrap(api.get('/comercial/bitrix/actualizaciones')),
  bitrixActualizarPendientes: (esperadas) => unwrap(api.post('/comercial/bitrix/actualizaciones', { esperadas })),
};
