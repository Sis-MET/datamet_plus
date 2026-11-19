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
};
