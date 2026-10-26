// Fixture de desarrollo: no se importa desde la app ni se incluye en el build.
// Todas las solicitudes del módulo se resuelven en memoria, nunca en Supabase.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import { IvmetManagementPage } from '../../src/features/ivmet/IvmetManagementPage';
import '../../src/index.css';
import { safeStorage } from '../../src/shared/utils/storage';

// Autenticación ficticia, sin leer ni modificar almacenamiento del navegador.
safeStorage.getItem = (key) =>
  key === 'datamet_token' ? 'fixture-session' : null;
let accessAttempts = 0;
let caseReads = 0;
const fixtureTicket = 'fixture-ivmet-ticket';

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const date = new Date().toISOString().slice(0, 10);
const fixtureStatus =
  new URLSearchParams(window.location.search).get('onboarding') || 'QUEUED';
const scopes = [
  {
    id: id(70),
    legacy_codigo_cliente: '0001',
    legacy_cliente_id: 1,
    client_name: 'Andina Alimentos',
    row_version: '1',
    solicitado_por: 'RIMMET:demo',
    plants: ['0001-01', '0001-02'],
    equipmentCount: 3,
    equipmentCodes: ['0001-01-001', '0001-01-002', '0001-02-001'],
    estado: 'ACTIVE',
    syncStatus: 'SUCCEEDED',
    solicitado_at: date,
    supabase_cliente_id: id(1),
    issues: [],
    issueCount: 0,
  },
  {
    id: id(74),
    legacy_codigo_cliente: '0004',
    legacy_cliente_id: 4,
    client_name: 'Cliente en incorporación',
    row_version: '1',
    solicitado_por: 'RIMMET:demo',
    plants: ['0004-11', '0004-21'],
    equipmentCount: 50,
    equipmentCodes: [],
    estado: 'REQUESTED',
    syncStatus: fixtureStatus,
    solicitado_at: date,
    nextAttemptAt: date,
    issueCount: fixtureStatus === 'PARTIAL' ? 1 : 0,
    issues:
      fixtureStatus === 'PARTIAL'
        ? [
            {
              entity_type: 'EQUIPMENT',
              source_key: '0004-11-007',
              reason_code: 'EQUIPMENT_AMBIGUOUS',
            },
          ]
        : [],
  },
];
const clients = [
  {
    id: id(1),
    codigo: '0001',
    nombre: 'Andina Alimentos',
    razon_social: 'Andina Alimentos · datos de demostración',
    activo: true,
    plants: 2,
    equipment: 6,
    licenses: 2,
    review: 1,
  },
  {
    id: id(2),
    codigo: '0002',
    nombre: 'Laboratorio del Sur',
    razon_social: 'Laboratorio del Sur · datos de demostración',
    activo: true,
    plants: 1,
    equipment: 1,
    licenses: 0,
    review: 0,
  },
];
clients.push({
  id: null,
  scope_id: id(74),
  codigo: '0004',
  nombre: 'Cliente en incorporación',
  activo: null,
  plants: 0,
  equipment: 0,
  licenses: 0,
  onboarding: scopes[1],
});
const plants = [
  {
    id: id(11),
    cliente_id: id(1),
    legacy_codigo_planta: '0001-01',
    nombre: 'Planta de producción',
    activo: true,
  },
  {
    id: id(12),
    cliente_id: id(1),
    legacy_codigo_planta: '0001-02',
    nombre: 'Centro logístico',
    activo: true,
  },
  {
    id: id(13),
    cliente_id: id(2),
    legacy_codigo_planta: '0002-01',
    nombre: 'Laboratorio',
    activo: true,
  },
];
const equipment = [
  {
    id: id(21),
    cliente_id: id(1),
    planta_id: id(11),
    cod_metrica: '0001-01-001',
    instrumento: 'Balanza de precisión',
    marca: 'METTLER TOLEDO',
    modelo: 'MS6002TS',
    estado_catalogo: 'READY',
    habilitado: true,
  },
  {
    id: id(22),
    cliente_id: id(1),
    planta_id: id(11),
    cod_metrica: '0001-01-002',
    instrumento: 'Balanza de plataforma',
    marca: 'OHAUS',
    modelo: 'Defender 5000',
    estado_catalogo: 'REQUIRES_REVIEW',
    habilitado: false,
  },
  {
    id: id(23),
    cliente_id: id(1),
    planta_id: id(12),
    cod_metrica: '0001-02-001',
    instrumento: 'Báscula camionera',
    marca: 'METTLER TOLEDO',
    modelo: 'IND570',
    estado_catalogo: 'READY',
    habilitado: false,
  },
  {
    id: id(25),
    cliente_id: id(1),
    planta_id: id(11),
    cod_metrica: '0001-01-003',
    instrumento: 'Balanza de mostrador',
    marca: 'OHAUS',
    modelo: 'Ranger 3000',
    estado_catalogo: 'READY',
    habilitado: false,
  },
  {
    id: id(26),
    cliente_id: id(1),
    planta_id: id(12),
    cod_metrica: '0001-02-002',
    instrumento: 'Balanza de piso',
    marca: 'METTLER TOLEDO',
    modelo: 'PBA430',
    estado_catalogo: 'READY',
    habilitado: false,
  },
  {
    id: id(27),
    cliente_id: id(1),
    planta_id: id(12),
    cod_metrica: '0001-02-003',
    instrumento: 'Balanza colgante',
    marca: 'CAS',
    modelo: 'THD',
    estado_catalogo: 'READY',
    habilitado: false,
    estado_configuracion: 'SUSPENDED',
  },
  {
    id: id(24),
    cliente_id: id(2),
    planta_id: id(13),
    cod_metrica: '0002-01-001',
    instrumento: 'Balanza analítica',
    marca: 'SARTORIUS',
    modelo: 'Entris II',
    estado_catalogo: 'READY',
    habilitado: false,
  },
].map((e) => ({
  estado_configuracion: e.habilitado ? 'READY' : 'PENDING',
  ...e,
  activo: true,
  config_version: '1',
  serie: 'DEMO-001',
  clase: 'II',
  ubicacion: 'Control de calidad',
  synced_at: date,
  ranges: [
    {
      numero_rango: 1,
      unidad: 'g',
      capacidad_max: '6200.000000000',
      division_escala: '0.010000000',
      intervalo_verificacion:
        e.estado_catalogo === 'READY' ? '0.100000000' : null,
    },
  ],
}));
const plans = [
  {
    id: id(31),
    codigo: 'ESENCIAL',
    nombre: 'Esencial',
    descripcion:
      'Para equipos de calidad que empiezan a digitalizar sus verificaciones.',
    cuentas_incluidas: 5,
    dias_gracia: 3,
    activo: true,
    row_version: '1',
    prices: [
      {
        id: id(32),
        periodicidad: 'MONTHLY',
        moneda: 'BOB',
        importe: '350.00',
        vigente_desde: '2026-01-01',
        vigente_hasta: null,
        activo: true,
      },
      {
        id: id(33),
        periodicidad: 'ANNUAL',
        moneda: 'BOB',
        importe: '3500.00',
        vigente_desde: '2026-01-01',
        vigente_hasta: null,
        activo: true,
      },
    ],
  },
];
const subscriptions = [
  {
    id: id(41),
    contrato_id: id(40),
    plan_id: id(31),
    precio_plan_id: id(32),
    periodicidad: 'MONTHLY',
    estado: 'ACTIVE',
    inicio_periodo: date,
    fin_periodo: '2099-12-01',
    row_version: '1',
    seats: 5,
    assigned: 2,
    planName: 'Esencial',
    cups: [],
    baseSeats: 5,
  },
];
const invoices = [
  {
    id: id(42),
    suscripcion_id: id(41),
    numero_factura: 'DEMO-001',
    periodo_desde: date,
    periodo_hasta: '2099-11-30',
    total: '350.00',
    saldo: '150.00',
    moneda: 'BOB',
    estado: 'PARTIALLY_PAID',
    row_version: '2',
    payments: [
      {
        id: id(43),
        importe: '200.00',
        moneda: 'BOB',
        fecha_pago: date,
        referencia: 'DEMO (sin valor comercial)',
      },
    ],
  },
];
const users = [
  {
    id: id(51),
    cliente_id: id(1),
    usuario: 'demo.calidad',
    nombre: 'Responsable de calidad (demo)',
    appAccess: true,
    rol: 'cliente_jefe_calidad',
    activo: true,
    row_version: '1',
    plantIds: [id(11), id(12)],
    license: { id: id(53), suscripcion_id: id(41), estado: 'ACTIVE' },
  },
  {
    id: id(52),
    cliente_id: id(1),
    usuario: 'demo.operador',
    nombre: 'Operador de planta (demo)',
    rol: 'cliente_operador',
    activo: true,
    row_version: '1',
    plantIds: [id(11)],
    license: { id: id(54), suscripcion_id: id(41), estado: 'ACTIVE' },
    debe_cambiar_password: true,
  },
];
const role = new URLSearchParams(window.location.search).get('role') || 'admin';
const capabilities = role==='admin'?['commercial','support','integration','staff']:role==='metrologist'?['support']:role==='commercial'?['commercial','integration']:[role];
const limited = !capabilities.includes('commercial');
const support = capabilities.includes('support');
// Mismo criterio que Supabase: validadas que nadie habilitó ni suspendió.
const pendingEnable = (e) => e.activo && e.estado_catalogo === 'READY' && !e.habilitado && e.estado_configuracion === 'PENDING';
const attention = (clientId) => ({
  newCases: [opsCase, opsRegisteredCase].filter((c) => c.cliente_id === clientId && c.estado === 'NEW').length,
  pendingUpdates: [opsEquipmentUpdate, opsRegistrationUpdate].filter((u) => u.cliente_id === clientId && u.estado === 'NEW').length,
});
const paged = (items, params) => {
  const page = Number(params.get('page') || 1);
  const pageSize = 20;
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    total: items.length,
    page,
    pageSize,
  };
};
const opsStaff = [{actor:'RIMMET:demo',nombre:'Administrador de pruebas',rol:'admin',activo:true,row_version:'1'}];
const opsEquipmentUpdate = {
  id:id(820),
  cliente_id:id(1),
  autorizado_at:new Date().toISOString(),
  estado:'NEW',
  row_version:'1',
  mensaje:'Actualizar la ubicación antes de la próxima calibración.',
  comentario:null,
  snapshot:{
    code:'0001-01-001',clientCode:'0001',plantCode:'0001-01',area:'Control de calidad',
    catalog:{ubicacion:'Producción',cod_interno:'B-1',marca:'METTLER TOLEDO',modelo:'MS6002TS',serie:'DEMO-001'},
    customer:{ubicacion:'Control de calidad',cod_interno:'CC-01',marca:'METTLER TOLEDO',modelo:'MS6002TS',serie:'DEMO-001'},
  },
};
// Balanza que el cliente registró en IvMET: sin código de Métrica ni catálogo de DataMET.
const opsRegistrationUpdate = {
  id:id(821),
  cliente_id:id(1),
  autorizado_at:new Date().toISOString(),
  estado:'NEW',
  row_version:'1',
  mensaje:'Compramos esta báscula; queremos incluirla en la próxima visita.',
  comentario:null,
  snapshot:{
    kind:'registration',code:'BAL-NUEVA',clientCode:'0001',plantCode:'0001-01',plantName:'Planta principal',area:'Despacho',catalog:{},
    customer:{ubicacion:'Patio de carga',cod_interno:'BAL-NUEVA',marca:'Toledo',modelo:'IND570',serie:'T-2026-77'},
    technical:{type:'Báscula camionera',class:'III',unit:'kg',ranges:[
      {number:1,capacity:'30000',division:'10',interval:'10',decimals:0},
      {number:2,capacity:'60000',division:'20',interval:'',decimals:0},
    ]},
  },
};
const opsRegisteredCase = {id:id(860),codigo:'CASO-00000002',cliente_id:id(1),cliente:'Andina Alimentos',planta:'0001-01',cod_metrica:null,origen:'CLIENTE',cod_interno:'BAL-NUEVA',estado:'NEW',responsable:null,autorizado_at:date,row_version:'1'};
const opsCase = {id:id(850),codigo:'CASO-00000001',cliente_id:id(1),cliente:'Andina Alimentos',planta:'0001-01',cod_metrica:'0001-01-001',estado:'NEW',responsable:null,autorizado_at:date,consentimiento_version:'case-sharing-v1',row_version:'1',mensaje:'Solicitamos revisar la no conformidad de esta balanza.',
  eventos:[],snapshot:{usuarios:{captura:'Operador de prueba',finalizacion:'Jefe de calidad'},verificacion:{id:id(851),equipo_snapshot:{codigo:'0001-01-001',marca:'Equipo de prueba'},plan_snapshot:{nombre:'Plan compartido'},alcance:'partial',realizado_at:date,recibido_at:date,trazabilidad:'traceable',veredicto_global:'fail',temperatura_c:'22.100',humedad_relativa_pct:'48.500'},patrones:[],
  pruebas:[{id:id(852),tipo:'linearity',estado_ejecucion:'executed',metodo_evaluacion:'absolute_error',unidad:'kg',veredicto:'fail',lecturas:[{id:id(853),etiqueta:'Carga 10 kg',carga_nominal:'10.000000000',indicacion:'10.020000000',retorno_cero:'0.000000000',error:'0.020000000',tolerancia:'0.010000000',veredicto:'fail'}]}]}};
const paginate = (items,url) => paged(items,url.searchParams);
window.fetch = async (input, options = {}) => {
  const url = new URL(input, window.location.origin);
  const path = url.pathname.split('/ivmet/')[1];
  if (!path)
    throw new Error('La prueba bloquea cualquier solicitud fuera de IvMET.');
  if (path === 'access')
    return Response.json({
      success: true,
      data: {
        configured: !new URLSearchParams(window.location.search).has(
          'unconfigured',
        ),
        unlocked: false,
        expiresAt: null,
      },
    });
  if (path === 'access/unlock') {
    accessAttempts += 1;
    if (
      new URLSearchParams(window.location.search).has('rateLimit') ||
      accessAttempts > 5
    )
      return Response.json(
        {
          code: 'IVMET_ACCESS_RATE_LIMITED',
          message:
            'Demasiados intentos. Espera antes de volver a introducir el código.',
          retryAfter: 10,
        },
        { status: 429 },
      );
    if (JSON.parse(options.body).code !== 'ivmet-preview')
      return Response.json(
        {
          code: 'IVMET_ACCESS_INVALID_CODE',
          message: 'El código de acceso no es correcto.',
        },
        { status: 403 },
      );
    return Response.json({
      success: true,
      data: {
        ticket: fixtureTicket,
        expiresAt: new Date(
          Date.now() +
            (new URLSearchParams(window.location.search).has('expire')
              ? 10000
              : 3600000),
        ).toISOString(),
      },
    });
  }
  if (options.headers?.['X-Ivmet-Access'] !== fixtureTicket)
    return Response.json(
      {
        code: 'IVMET_ACCESS_CODE_REQUIRED',
        message: 'Gestión IvMET se encuentra en desarrollo.',
      },
      { status: 403 },
    );
  if (new URLSearchParams(window.location.search).has('error'))
    return Response.json(
      {
        message:
          'Aplica las migraciones administrativas pendientes y vuelve a intentar.',
      },
      { status: 503 },
    );
  let data;
  if (path.startsWith('ops/')) {
    if(path==='ops/session') data={role,actor:'RIMMET:demo',capabilities};
    else if(path==='ops/cases') data=paginate([opsCase,opsRegisteredCase].filter((c)=>(!url.searchParams.get('clientId') || c.cliente_id===url.searchParams.get('clientId'))
      && (!url.searchParams.get('status') || c.estado===url.searchParams.get('status'))),url);
    else if(path==='ops/case') {
      caseReads+=1;
      if(new URLSearchParams(window.location.search).has('withdrawAfterRead') && caseReads>1)
        return Response.json({success:false,code:'CASE_NOT_ACCESSIBLE',message:'El cliente retiró el acceso a este caso.'},{status:409});
      data=opsCase;
    }
    else if(path==='ops/assignees') data=[{actor:'RIMMET:demo',name:'Administrador de pruebas'}];
    else if(path==='ops/staff') data=opsStaff;
    else if(path==='ops/equipment-updates') data=paginate([opsEquipmentUpdate,opsRegistrationUpdate].filter((item)=>
      (!url.searchParams.get('clientId') || item.cliente_id===url.searchParams.get('clientId'))
      && (!url.searchParams.get('search') || item.snapshot.code.includes(url.searchParams.get('search')))),url);
    else if(path==='ops/readiness') data=paginate(clients.filter((c)=>c.id).map((c)=>({id:c.id,code:c.codigo,name:c.nombre,contract:true,subscription:true,users:true,equipment:true,standards:false,plans:false,syncedAt:date})),url);
    else if(path==='ops/billing') data=paginate([],url);
    else if(path==='ops/privacy') data={contractVersion:4,privateEvidenceExport:false,sharedCasesOnly:true,queue:{PENDING:2}};
    else if(path==='ops/audit') data={items:[]};
    else if(options.method==='POST') {
      const {payload}=JSON.parse(options.body);
      if(path==='ops/actions/case.update') {opsCase.estado=payload.status;opsCase.responsable=payload.assignee;opsCase.row_version=String(Number(opsCase.row_version)+1);opsCase.eventos.push({id:id(860+opsCase.eventos.length),actor_externo:'RIMMET:demo',created_at:new Date().toISOString(),comentario:payload.comment});}
      if(path==='ops/actions/equipment-update.review') {opsEquipmentUpdate.estado='REVIEWED';opsEquipmentUpdate.comentario=payload.comment;opsEquipmentUpdate.row_version=String(Number(opsEquipmentUpdate.row_version)+1);}
      data={id:payload.id || id(999)};
    }
    return Response.json({success:true,data});
  }
  if (options.method === 'POST') {
    const { payload } = JSON.parse(options.body);
    if (path === 'actions/plan.save' && !payload.id)
      plans.push({
        id: id(100 + plans.length),
        codigo: `PLAN-${String(plans.length + 1).padStart(6, '0')}`,
        nombre: payload.name,
        descripcion: payload.description,
        cuentas_incluidas: payload.seats,
        dias_gracia: payload.graceDays,
        activo: true,
        row_version: '1',
        prices: [],
      });
    data = { id: id(99) };
    if (path === 'actions/scope.request') {
      const existing = scopes.find(
        (scope) => scope.legacy_cliente_id === payload.legacyClientId,
      );
      if (existing)
        return Response.json(
          {
            code: 'SCOPE_ALREADY_EXISTS',
            message: 'Este cliente ya tiene una incorporación.',
          },
          { status: 409 },
        );
      const scope = {
        id: id(99),
        legacy_cliente_id: payload.legacyClientId,
        legacy_codigo_cliente: payload.clientCode,
        client_name: 'Cliente demostración (DataMET)',
        solicitado_at: date,
        estado: 'REQUESTED',
        syncStatus: 'QUEUED',
        plants: payload.plantCodes,
        equipmentCodes: payload.equipmentCodes,
        equipmentCount: payload.equipmentCodes.length,
        row_version: '1',
        issues: [],
        issueCount: 0,
      };
      scopes.push(scope);
      clients.push({
        id: null,
        scope_id: scope.id,
        codigo: payload.clientCode,
        nombre: scope.client_name,
        plants: 0,
        equipment: 0,
        licenses: 0,
        onboarding: scope,
      });
    }
    if (path === 'actions/equipment.bulk-configure') {
      const targets = equipment.filter((e) => payload.ids.includes(e.id));
      const state = payload.enabled ? 'READY' : 'SUSPENDED';
      const changed = targets.filter((e) => e.habilitado !== payload.enabled || e.estado_configuracion !== state);
      for (const e of changed) Object.assign(e, { habilitado: payload.enabled, estado_configuracion: state });
      data = { requested: targets.length, changed: changed.length, enabled: payload.enabled };
    }
    if (path === 'actions/scope.retry') {
      scopes.find((scope) => scope.id === payload.id).syncStatus = 'QUEUED';
      data = { id: payload.id };
    }
  } else if (path === 'overview')
    data = {
      clients: 2,
      plants: 3,
      equipment: 4,
      review: 1,
      licenses: 2,
      subscriptions: 1,
      expiresSoon: 0,
    };
  else if (path === 'plans') data = plans;
  else if (path === 'clients') {
    data = paged(
      clients.filter((c) =>
        JSON.stringify(c)
          .toLowerCase()
          .includes((url.searchParams.get('search') || '').toLowerCase()),
      ),
      url.searchParams,
    );
    data.items = data.items.map((c) => ({
      ...(limited ? { id: c.id, codigo: c.codigo, nombre: c.nombre, razon_social: c.razon_social,
        activo: c.activo, plants: c.plants, equipment: c.equipment, review: c.review } : c),
      ...(support ? attention(c.id) : {}),
    }));
  }
  else if (path === 'integration' || path === 'onboarding')
    data = {
      scopes: scopes.filter(
        (scope) =>
          (!url.searchParams.get('legacyClientId') ||
            String(scope.legacy_cliente_id) ===
              url.searchParams.get('legacyClientId')) &&
          (!url.searchParams.get('scopeId') ||
            scope.id === url.searchParams.get('scopeId')),
      ),
      total: scopes.length,
      workers: new URLSearchParams(window.location.search).has('workerOffline')
        ? []
        : [
            {
              worker_id: 'worker-demo',
              available: true,
              mode: 'daemon',
              state: 'ONLINE',
              scope_id: null,
            },
          ],
      runs: [
        {
          id: id(71),
          direccion: 'DATAMET_TO_SUPABASE',
          worker_id: 'worker-demo',
          estado: 'SUCCEEDED',
          started_at: date,
          accepted_count: 3,
          rejected_count: 0,
        },
      ],
      outbox: { PENDING: 0, CLAIMED: 0, PROCESSED: 42, DEAD: 0 },
    };
  else if (path === 'legacy/clients')
    data = [{ id: 3, code: '0003', name: 'Cliente demostración (DataMET)' }];
  else if (path === 'legacy/clients/3/catalog')
    data = {
      client: { id: 3, code: '0003', name: 'Cliente demostración (DataMET)' },
      plants: [
        { code: '0003-01', name: 'Planta piloto' },
        { code: '0003-02', name: 'Planta embotelladora' },
        { code: '0003-03', name: 'Planta sin balanzas' },
      ],
      equipment: [
        '0003-01-001',
        '0003-01-002',
        '0003-01-003',
        '0003-02-001',
        '0003-02-002',
      ].map((code) => ({
        code,
        name: 'Balanza',
        brand: 'DEMO',
        status: 'ACTIVO',
      })),
    };
  else if (path === 'legacy/clients/1/catalog')
    data = {
      client: { id: 1, code: '0001', name: 'Andina Alimentos (demo)' },
      plants: plants
        .filter((p) => p.cliente_id === id(1))
        .map((p) => ({ code: p.legacy_codigo_planta, name: p.nombre })),
      equipment: [
        ...equipment
          .filter((e) => e.cliente_id === id(1))
          .map((e) => ({
            id: e.id,
            code: e.cod_metrica,
            name: e.instrumento,
            brand: e.marca,
            status: 'ACTIVO',
          })),
        {
          id: id(99),
          code: '0001-02-002',
          name: 'Balanza nueva (demo)',
          brand: 'DEMO',
          status: 'ACTIVO',
        },
      ],
    };
  else if (path.startsWith('clients/')) {
    const [, clientId, section] = path.split('/');
    if (section === 'equipment') {
      data = paged(
        equipment.filter(
          (e) =>
            e.cliente_id === clientId &&
            (!url.searchParams.get('plantId') ||
              e.planta_id === url.searchParams.get('plantId')) &&
            (!url.searchParams.get('status') ||
              e.estado_catalogo === url.searchParams.get('status')) &&
            JSON.stringify(e)
              .toLowerCase()
              .includes((url.searchParams.get('search') || '').toLowerCase()),
        ),
        url.searchParams,
      );
      data.pendingEnable = equipment.filter((e) => e.cliente_id === clientId && pendingEnable(e)
        && (!url.searchParams.get('plantId') || e.planta_id === url.searchParams.get('plantId'))).length;
    } else if (section === 'users')
      data = paged(
        users.filter((u) => u.cliente_id === clientId),
        url.searchParams,
      );
    else if (section === 'activity')
      data = paged(
        [
          {
            id: id(80),
            accion: 'contract.create',
            actor_externo: 'RIMMET:demo',
            created_at: date,
          },
        ],
        url.searchParams,
      );
    else
      data = {
        client: clients.find((c) => c.id === clientId),
        plants: plants.filter((p) => p.cliente_id === clientId),
        areas: [],
        patterns: [],
        contracts:
          clientId === id(1)
            ? [
                {
                  id: id(40),
                  numero_contrato: 'IV-DEMO-2026',
                  estado: 'ACTIVE',
                  vigente_desde: date,
                  vigente_hasta: '2099-12-31',
                  row_version: '1',
                },
              ]
            : [],
        subscriptions: clientId === id(1) ? subscriptions : [],
        invoices: clientId === id(1) ? invoices : [],
        metrologyPlans: [],
      };
    if (limited && !section)
      data = { client: data.client, plants: data.plants };
    if (support && !section) data.attention = attention(clientId);
  } else throw new Error(`Ruta sin fixture: ${path}`);
  return Response.json({ success: true, data });
};

// El fixture sigue el tema del sistema; ?theme=light|dark lo fuerza.
const fixtureTheme = new URLSearchParams(window.location.search).get('theme')
  || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
document.documentElement.classList.toggle('dark', fixtureTheme === 'dark');
document.documentElement.style.colorScheme = fixtureTheme;
createRoot(document.getElementById('root')).render(
  <>
    <div
      style={{
        padding: '12px 24px',
        color: 'rgb(var(--c-fg-muted))',
        font: '12px system-ui',
        textAlign: 'center',
      }}
    >
      PRUEBA LOCAL · Datos ficticios · Ninguna operación se envía a un servidor
    </div>
    <IvmetManagementPage />
    <Toaster richColors theme={fixtureTheme} />
  </>,
);
