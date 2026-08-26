const { getSupabaseAdminClient } = require('../config/supabase');

const assertResult = (result, context) => {
  if (result.error) {
    const error = new Error(`Supabase no pudo ${context}: ${result.error.message}`);
    error.statusCode = result.error.code === '42501' ? 403 : 502;
    error.code = result.error.code;
    throw error;
  }
  return result;
};

const countRows = async (client, table, configure = (query) => query) => {
  const query = configure(client.from(table).select('*', { count: 'exact', head: true }));
  const result = assertResult(await query, `contar ${table}`);
  return result.count || 0;
};

const assembleClientSummaries = ({ customers, plants, equipment, profiles, contracts, subscriptions, licenses, plans }) => {
  const plansById = new Map(plans.map((plan) => [plan.id, plan]));
  const subscriptionsByContract = new Map(subscriptions.map((subscription) => [subscription.contrato_id, subscription]));

  return customers.map((customer) => {
    const customerContracts = contracts.filter((contract) => contract.cliente_id === customer.id);
    const contract = customerContracts.find((item) => item.estado === 'ACTIVE') || customerContracts[0] || null;
    const subscription = contract ? subscriptionsByContract.get(contract.id) || null : null;
    const customerProfiles = profiles.filter((profile) => profile.cliente_id === customer.id);
    const profileIds = new Set(customerProfiles.map((profile) => profile.id));

    return {
      ...customer,
      plants: plants.filter((plant) => plant.cliente_id === customer.id && plant.activo).length,
      equipment: equipment.filter((item) => item.cliente_id === customer.id && item.activo).length,
      equipmentReview: equipment.filter((item) => item.cliente_id === customer.id && item.activo && item.estado_catalogo !== 'READY').length,
      users: customerProfiles.filter((profile) => profile.activo).length,
      activeLicenses: licenses.filter((license) => license.estado === 'ACTIVE' && profileIds.has(license.usuario_id)).length,
      contract,
      subscription: subscription ? {
        ...subscription,
        plan: plansById.get(subscription.plan_id) || null
      } : null
    };
  });
};

const assembleEquipmentReview = ({ equipment, plants, customers, ranges }) => {
  const plantsById = new Map(plants.map((item) => [item.id, item]));
  const customersById = new Map(customers.map((item) => [item.id, item]));

  return equipment.map((item) => ({
    ...item,
    customer: customersById.get(item.cliente_id) || null,
    plant: plantsById.get(item.planta_id) || null,
    ranges: ranges.filter((range) => range.equipo_id === item.id)
  }));
};

const createIvmetService = ({ getClient = getSupabaseAdminClient } = {}) => ({
  async getOverview() {
    const client = getClient();
    const [
      clients,
      plants,
      equipment,
      equipmentReview,
      activeUsers,
      activeContracts,
      activeSubscriptions,
      activeLicenses
    ] = await Promise.all([
      countRows(client, 'clientes', (q) => q.eq('activo', true)),
      countRows(client, 'plantas', (q) => q.eq('activo', true)),
      countRows(client, 'equipos', (q) => q.eq('activo', true)),
      countRows(client, 'equipos', (q) => q.eq('activo', true).neq('estado_catalogo', 'READY')),
      countRows(client, 'perfiles', (q) => q.eq('activo', true)),
      countRows(client, 'contratos', (q) => q.eq('estado', 'ACTIVE')),
      countRows(client, 'suscripciones', (q) => q.in('estado', ['ACTIVE', 'GRACE'])),
      countRows(client, 'licencias_usuario', (q) => q.eq('estado', 'ACTIVE'))
    ]);

    return {
      clients,
      plants,
      equipment,
      equipmentReview,
      activeUsers,
      activeContracts,
      activeSubscriptions,
      activeLicenses,
      generatedAt: new Date().toISOString()
    };
  },

  async getClients() {
    const client = getClient();
    const [clientsResult, plantsResult, equipmentResult, profilesResult, contractsResult, subscriptionsResult, licensesResult, plansResult] = await Promise.all([
      client.from('clientes').select('id,codigo,nombre,razon_social,activo,synced_at').order('codigo'),
      client.from('plantas').select('id,cliente_id,legacy_codigo_planta,nombre,activo'),
      client.from('equipos').select('id,cliente_id,estado_catalogo,activo'),
      client.from('perfiles').select('id,cliente_id,rol,activo'),
      client.from('contratos').select('id,cliente_id,numero_contrato,estado,vigente_desde,vigente_hasta'),
      client.from('suscripciones').select('id,contrato_id,plan_id,estado,periodicidad,inicio_periodo,fin_periodo,gracia_hasta'),
      client.from('licencias_usuario').select('usuario_id,suscripcion_id,estado'),
      client.from('planes_comerciales').select('id,codigo,nombre,cuentas_incluidas')
    ]);

    const clientsData = assertResult(await clientsResult, 'listar clientes').data || [];
    const plants = assertResult(await plantsResult, 'listar plantas').data || [];
    const equipment = assertResult(await equipmentResult, 'listar equipos').data || [];
    const profiles = assertResult(await profilesResult, 'listar usuarios').data || [];
    const contracts = assertResult(await contractsResult, 'listar contratos').data || [];
    const subscriptions = assertResult(await subscriptionsResult, 'listar suscripciones').data || [];
    const licenses = assertResult(await licensesResult, 'listar licencias').data || [];
    const plans = assertResult(await plansResult, 'listar planes').data || [];

    return assembleClientSummaries({
      customers: clientsData,
      plants,
      equipment,
      profiles,
      contracts,
      subscriptions,
      licenses,
      plans
    });
  },

  async getPlans() {
    const client = getClient();
    const [plansResult, pricesResult] = await Promise.all([
      client.from('planes_comerciales').select('id,codigo,nombre,descripcion,cuentas_incluidas,dias_gracia,caracteristicas,activo,updated_at').order('nombre'),
      client.from('precios_plan').select('id,plan_id,periodicidad,moneda,importe,vigente_desde,vigente_hasta,activo').order('vigente_desde', { ascending: false })
    ]);

    const plans = assertResult(await plansResult, 'listar planes comerciales').data || [];
    const prices = assertResult(await pricesResult, 'listar precios').data || [];
    return plans.map((plan) => ({
      ...plan,
      prices: prices.filter((price) => price.plan_id === plan.id)
    }));
  },

  async getEquipmentReview() {
    const client = getClient();
    const equipmentResult = await client
      .from('equipos')
      .select('id,cliente_id,planta_id,cod_metrica,cod_interno,instrumento,tipo_instrumento,tipo_balanza,marca,modelo,serie,unidad,ubicacion,estado_catalogo,activo,synced_at')
      .eq('activo', true)
      .neq('estado_catalogo', 'READY')
      .order('cod_metrica');

    const equipment = assertResult(equipmentResult, 'listar equipos pendientes').data || [];
    if (equipment.length === 0) return [];

    const plantIds = [...new Set(equipment.map((item) => item.planta_id))];
    const clientIds = [...new Set(equipment.map((item) => item.cliente_id))];
    const equipmentIds = equipment.map((item) => item.id);
    const [plantsResult, clientsResult, rangesResult] = await Promise.all([
      client.from('plantas').select('id,legacy_codigo_planta,nombre').in('id', plantIds),
      client.from('clientes').select('id,codigo,nombre,razon_social').in('id', clientIds),
      client.from('equipo_rangos').select('equipo_id,numero_rango,unidad,capacidad_max,division_escala,intervalo_verificacion').in('equipo_id', equipmentIds).order('numero_rango')
    ]);

    const plants = assertResult(await plantsResult, 'resolver plantas').data || [];
    const customers = assertResult(await clientsResult, 'resolver clientes').data || [];
    const ranges = assertResult(await rangesResult, 'listar rangos').data || [];

    return assembleEquipmentReview({ equipment, plants, customers, ranges });
  }
});

const ivmetService = createIvmetService();

module.exports = {
  ...ivmetService,
  createIvmetService,
  assertResult,
  assembleClientSummaries,
  assembleEquipmentReview
};
