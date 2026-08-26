import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Factory,
  Gauge,
  KeyRound,
  Loader2,
  RefreshCw,
  Scale,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { ivmetApi } from './api/ivmet';

const TABS = [
  { id: 'overview', label: 'Resumen', icon: ShieldCheck },
  { id: 'clients', label: 'Clientes y licencias', icon: Building2 },
  { id: 'plans', label: 'Planes', icon: CircleDollarSign },
  { id: 'review', label: 'Revisión de equipos', icon: ClipboardCheck },
];

const STATUS_STYLES = {
  ACTIVE: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
  READY: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
  GRACE: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
  REQUIRES_REVIEW: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
  QUARANTINED: 'border-red-400/20 bg-red-400/10 text-red-300',
};

const STATUS_LABELS = {
  ACTIVE: 'Activo',
  GRACE: 'En gracia',
  REQUIRES_REVIEW: 'Requiere revisión',
  QUARANTINED: 'En cuarentena',
};

function StatusBadge({ status, fallback = 'Sin configurar' }) {
  if (!status) {
    return <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-slate-400">{fallback}</span>;
  }
  return (
    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${STATUS_STYLES[status] || 'border-white/10 bg-white/5 text-slate-300'}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function MetricCard({ icon, label, value, detail, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-400/10 text-blue-300 ring-blue-400/20',
    green: 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/20',
    amber: 'bg-amber-400/10 text-amber-300 ring-amber-400/20',
    violet: 'bg-violet-400/10 text-violet-300 ring-violet-400/20',
  };
  return (
    <article className="rounded-2xl border border-white/10 bg-[#17191f]/80 p-4 shadow-xl shadow-black/10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-white">{value ?? '—'}</p>
          <p className="mt-1 text-[11px] text-slate-500">{detail}</p>
        </div>
        <div className={`rounded-xl p-2.5 ring-1 ${tones[tone]}`}>{React.createElement(icon, { className: 'h-5 w-5' })}</div>
      </div>
    </article>
  );
}

function EmptyState({ title, message }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 text-center">
      <CheckCircle2 className="mb-3 h-8 w-8 text-emerald-400" />
      <p className="font-semibold text-white">{title}</p>
      <p className="mt-1 max-w-md text-sm text-slate-400">{message}</p>
    </div>
  );
}

function Overview({ data }) {
  const metrics = [
    { icon: Building2, label: 'Clientes habilitados', value: data?.clients, detail: `${data?.plants ?? 0} plantas sincronizadas`, tone: 'blue' },
    { icon: Scale, label: 'Equipos en IvMET', value: data?.equipment, detail: `${data?.equipmentReview ?? 0} requieren revisión`, tone: data?.equipmentReview ? 'amber' : 'green' },
    { icon: KeyRound, label: 'Licencias activas', value: data?.activeLicenses, detail: `${data?.activeUsers ?? 0} usuarios activos`, tone: 'violet' },
    { icon: CircleDollarSign, label: 'Suscripciones vigentes', value: data?.activeSubscriptions, detail: `${data?.activeContracts ?? 0} contratos activos`, tone: 'green' },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <section className="rounded-2xl border border-white/10 bg-[#17191f]/80 p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-400/10 p-2 text-blue-300"><Factory className="h-5 w-5" /></div>
            <div>
              <h2 className="font-semibold text-white">Flujo operativo conectado</h2>
              <p className="text-xs text-slate-400">DataMET → Supabase → base espejo IvMET</p>
            </div>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            {[
              ['1', 'Catálogo selectivo', 'Solo clientes contratados'],
              ['2', 'Gestión central', 'Licencias y usuarios en Supabase'],
              ['3', 'Retorno de evidencia', 'Resultados hacia Métrica'],
            ].map(([number, title, text]) => (
              <div key={number} className="rounded-xl border border-white/5 bg-white/[0.025] p-3">
                <span className="text-[10px] font-bold text-blue-300">PASO {number}</span>
                <p className="mt-1 text-sm font-medium text-white">{title}</p>
                <p className="mt-1 text-xs text-slate-500">{text}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border border-white/10 bg-[#17191f]/80 p-5">
          <h2 className="font-semibold text-white">Atención requerida</h2>
          <div className="mt-4 flex items-center gap-4 rounded-xl border border-amber-400/15 bg-amber-400/[0.06] p-4">
            <AlertTriangle className="h-7 w-7 flex-none text-amber-300" />
            <div>
              <p className="text-2xl font-semibold text-white">{data?.equipmentReview ?? 0}</p>
              <p className="text-xs text-slate-400">equipos deben validarse antes de habilitarse en la app.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Clients({ clients }) {
  if (!clients.length) return <EmptyState title="Sin clientes IvMET" message="Los clientes aparecerán aquí cuando se incorporen mediante el proceso comercial." />;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {clients.map((client) => {
        const seats = client.subscription?.plan?.cuentas_incluidas;
        return (
          <article key={client.id} className="rounded-2xl border border-white/10 bg-[#17191f]/80 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-300">Cliente {client.codigo}</p>
                <h2 className="mt-1 truncate text-lg font-semibold text-white">{client.nombre || client.razon_social || 'Sin nombre'}</h2>
                <p className="truncate text-xs text-slate-500">{client.razon_social}</p>
              </div>
              <StatusBadge status={client.subscription?.estado || client.contract?.estado} />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                ['Plantas', client.plants],
                ['Equipos', client.equipment],
                ['Usuarios', client.users],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-white/[0.035] px-3 py-2.5">
                  <p className="text-lg font-semibold text-white">{value}</p>
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-white/5 pt-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Licencias asignadas</span>
                <span className="font-semibold text-white">{client.activeLicenses}{seats ? ` / ${seats}` : ''}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
                <div className="h-full rounded-full bg-blue-400" style={{ width: seats ? `${Math.min(100, (client.activeLicenses / seats) * 100)}%` : '0%' }} />
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                <span>{client.subscription?.plan?.nombre || 'Plan aún no asignado'}</span>
                <span>{client.contract?.numero_contrato || 'Sin contrato'}</span>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function Plans({ plans }) {
  if (!plans.length) return <EmptyState title="Sin planes comerciales" message="El catálogo está listo para definir planes mensuales o anuales y sus cupos incluidos." />;
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {plans.map((plan) => (
        <article key={plan.id} className="rounded-2xl border border-white/10 bg-[#17191f]/80 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-300">{plan.codigo}</p>
              <h2 className="mt-1 text-lg font-semibold text-white">{plan.nombre}</h2>
            </div>
            <StatusBadge status={plan.activo ? 'ACTIVE' : 'INACTIVE'} />
          </div>
          <p className="mt-3 min-h-10 text-sm text-slate-400">{plan.descripcion || 'Sin descripción comercial.'}</p>
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-white/[0.035] p-3">
            <Users className="h-4 w-4 text-blue-300" />
            <span className="text-sm text-slate-300"><strong className="text-white">{plan.cuentas_incluidas}</strong> cuentas incluidas</span>
          </div>
          <div className="mt-4 space-y-2">
            {plan.prices.filter((price) => price.activo).map((price) => (
              <div key={price.id} className="flex items-center justify-between text-xs">
                <span className="text-slate-500">{price.periodicidad === 'MONTHLY' ? 'Mensual' : 'Anual'}</span>
                <span className="font-semibold text-white">{price.moneda} {Number(price.importe).toLocaleString('es-BO', { minimumFractionDigits: 2 })}</span>
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

function EquipmentReview({ equipment }) {
  if (!equipment.length) return <EmptyState title="Catálogo validado" message="No existen equipos pendientes de revisión para los clientes habilitados." />;
  return (
    <div className="space-y-3">
      {equipment.map((item) => (
        <article key={item.id} className="rounded-2xl border border-white/10 bg-[#17191f]/80 p-4 sm:p-5">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 items-start gap-3">
              <div className="rounded-xl bg-amber-400/10 p-2.5 text-amber-300"><Gauge className="h-5 w-5" /></div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-mono text-sm font-semibold text-white">{item.cod_metrica}</h2>
                  <StatusBadge status={item.estado_catalogo} />
                </div>
                <p className="mt-1 text-sm text-slate-300">{item.instrumento || item.tipo_instrumento || 'Equipo de pesaje'} · {item.marca || 'Marca no registrada'} {item.modelo || ''}</p>
                <p className="mt-1 text-xs text-slate-500">{item.customer?.nombre || item.customer?.razon_social} · {item.plant?.legacy_codigo_planta} {item.plant?.nombre ? `— ${item.plant.nombre}` : ''}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:min-w-64">
              {item.ranges.slice(0, 2).map((range) => (
                <div key={range.numero_rango} className="rounded-xl bg-white/[0.035] px-3 py-2">
                  <p className="text-[10px] text-slate-500">Rango {range.numero_rango}</p>
                  <p className="mt-0.5 text-xs font-medium text-white">Max {range.capacidad_max} {range.unidad}</p>
                  <p className="text-[10px] text-slate-400">d = {range.division_escala}</p>
                </div>
              ))}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export function IvmetManagementPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [state, setState] = useState({ loading: true, error: '', overview: null, clients: [], plans: [], review: [] });

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const [overview, clients, plans, review] = await Promise.all([
        ivmetApi.getOverview(),
        ivmetApi.getClients(),
        ivmetApi.getPlans(),
        ivmetApi.getEquipmentReview(),
      ]);
      setState({ loading: false, error: '', overview: overview.data, clients: clients.data, plans: plans.data, review: review.data });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message || 'No se pudo cargar Gestión IvMET.' }));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const content = useMemo(() => {
    if (activeTab === 'clients') return <Clients clients={state.clients} />;
    if (activeTab === 'plans') return <Plans plans={state.plans} />;
    if (activeTab === 'review') return <EquipmentReview equipment={state.review} />;
    return <Overview data={state.overview} />;
  }, [activeTab, state]);

  return (
    <main className="mx-auto w-full max-w-7xl px-3 pb-10 pt-4 sm:px-5">
      <section className="mb-5 flex flex-col justify-between gap-4 rounded-2xl border border-white/10 bg-[#111319]/75 p-5 shadow-2xl shadow-black/20 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-300"><ShieldCheck className="h-4 w-4" /> Administración interna</div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">Gestión IvMET</h1>
          <p className="mt-1 text-sm text-slate-400">Clientes, licencias y catálogo operativo de la aplicación metrológica.</p>
        </div>
        <button onClick={load} disabled={state.loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${state.loading ? 'animate-spin' : ''}`} /> Actualizar
        </button>
      </section>

      <nav className="mb-5 flex gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-[#111319]/75 p-1.5" aria-label="Secciones de Gestión IvMET">
        {TABS.map(({ id, label, icon }) => (
          <button key={id} onClick={() => setActiveTab(id)} className={`flex min-w-max items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition sm:px-4 ${activeTab === id ? 'bg-blue-500/15 text-blue-300 ring-1 ring-blue-400/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
            {React.createElement(icon, { className: 'h-4 w-4' })} {label}
            {id === 'review' && state.review.length > 0 && <span className="rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[9px] text-amber-300">{state.review.length}</span>}
          </button>
        ))}
      </nav>

      {state.loading && !state.overview ? (
        <div className="flex min-h-72 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-blue-300" /></div>
      ) : state.error ? (
        <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.06] p-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-red-300" />
          <p className="mt-3 font-semibold text-white">No se pudo abrir Gestión IvMET</p>
          <p className="mx-auto mt-1 max-w-xl text-sm text-slate-400">{state.error}</p>
          <button onClick={load} className="mt-4 rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/15">Reintentar</button>
        </div>
      ) : content}
    </main>
  );
}
