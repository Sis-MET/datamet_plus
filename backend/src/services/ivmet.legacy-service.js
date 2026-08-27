const { ConnectionPool, Int, VarChar } = require('mssql');
const env = require('../config/env');
let connection;
const getLegacyPool = () => {
  if (!connection)
    connection = new ConnectionPool({
      ...env.db,
      database: process.env.IVMET_DATAMET_DATABASE || 'DataMET',
    })
      .connect()
      .catch((error) => {
        connection = null;
        throw error;
      });
  return connection;
};
const fail = (message) =>
  Object.assign(new Error(message), { statusCode: 422 });
const createLegacyService = ({ getPool = getLegacyPool } = {}) => ({
  async search(search) {
    if (search.length < 2) return [];
    const db = await getPool();
    const result = await db
      .request()
      .input('q', VarChar(104), '%' + search.replace(/[[\]%_]/g, '') + '%')
      .query(
        `SELECT TOP (30) cliente_id AS id,LTRIM(RTRIM(codigo_cliente)) AS code,cliente AS name,razonsocial AS legalName FROM dbo.DATA_CLIENTES WHERE (codigo_cliente LIKE @q OR cliente LIKE @q OR razonsocial LIKE @q) AND UPPER(LTRIM(RTRIM(estado)))='ACTIVO' ORDER BY codigo_cliente,cliente_id`
      );
    return result.recordset;
  },
  async catalog(clientId) {
    const db = await getPool();
    const clients = await db
      .request()
      .input('id', Int, clientId)
      .query(
        'SELECT cliente_id AS id,LTRIM(RTRIM(codigo_cliente)) AS code,cliente AS name FROM dbo.DATA_CLIENTES WHERE cliente_id=@id'
      );
    if (clients.recordset.length !== 1)
      throw fail('El cliente no tiene una identidad única en DataMET.');
    const client = clients.recordset[0];
    if (!/^\d{4}$/.test(client.code))
      throw fail('El código de cliente no es canónico en DataMET.');
    const plants = await db
      .request()
      .input('id', Int, clientId)
      .query(
        'SELECT LTRIM(RTRIM(codigo_planta)) AS code,planta AS name FROM dbo.DATA_PLANTAS WHERE cliente_id=@id ORDER BY codigo_planta'
      );
    const equipment = await db
      .request()
      .input('prefix', VarChar(20), client.code + '-%')
      .query(
        `SELECT e.id,LTRIM(RTRIM(e.cod_metrica)) AS code,e.instrumento AS name,e.marca AS brand,e.estado AS status FROM dbo.DATA_EQUIPOS e WHERE e.cod_metrica LIKE @prefix AND EXISTS(SELECT 1 FROM dbo.DATA_EQUIPOS_BALANZAS b WHERE LTRIM(RTRIM(b.cod_metrica))=LTRIM(RTRIM(e.cod_metrica))) ORDER BY e.cod_metrica`
      );
    return { client, plants: plants.recordset, equipment: equipment.recordset };
  },
  async validateScope(payload) {
    const catalog = await this.catalog(payload.legacyClientId);
    if (catalog.client.code !== payload.clientCode)
      throw fail('El código del cliente no coincide con DataMET.');
    const validPlants = new Set(catalog.plants.map((p) => p.code));
    const validEquipment = new Set(catalog.equipment.map((e) => e.code));
    if (
      payload.plantCodes.some(
        (code) => catalog.plants.filter((p) => p.code === code).length > 1
      ) ||
      payload.equipmentCodes.some(
        (code) => catalog.equipment.filter((e) => e.code === code).length > 1
      )
    )
      throw fail(
        'Existen códigos duplicados en DataMET. Corrígelos antes de incorporar el cliente.'
      );
    if (
      new Set(payload.plantCodes).size !== payload.plantCodes.length ||
      new Set(payload.equipmentCodes).size !== payload.equipmentCodes.length ||
      payload.plantCodes.some(
        (p) => !validPlants.has(p) || !p.startsWith(payload.clientCode + '-')
      ) ||
      payload.equipmentCodes.some(
        (e) =>
          !validEquipment.has(e) || !payload.plantCodes.includes(e.slice(0, 7))
      )
    )
      throw fail('El alcance contiene plantas o equipos ajenos al cliente.');
    return catalog.client;
  },
});
module.exports = { createLegacyService };
