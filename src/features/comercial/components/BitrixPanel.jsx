import { useCallback, useEffect, useRef, useState } from 'react';
import { Handshake, Loader2, RefreshCw, Unplug, UsersRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../shared/components/ui/Button';
import { cn } from '../../../shared/utils/cn';
import { Dropdown } from '../../calibration/components/Dropdown';
import { EmptyState, Segmented } from '../../calibration/components/primitives';
import { useResource } from '../../system/hooks/useResource';
import { comercialApi } from '../api/comercial';
import {
  PAGE_SIZE, SITUACIONES_BITRIX, SITUACIONES_BITRIX_ORDEN, bs, bsCorto, fecha, fechaHora, haceCuanto,
} from '../domain/comercial';
import { Busqueda, Cargando, Cifras, ErrorCarga, FilaAbrible, Paginacion, SituacionBitrix as Situacion } from './comunes';
import { FacturaModal } from './FacturaModal';
import { NegociacionModal } from './NegociacionModal';
import { NuevaFacturaModal } from './NuevaFacturaModal';
import { ResponsablesBitrix } from './ResponsablesBitrix';

const filtrosVacios = () => ({ q: '', situacion: '', embudo: '' });

const negociaciones = (n) => `${n} ${n === 1 ? 'negociación' : 'negociaciones'}`;

/** Cómo conectar el webhook de Comercial (lo hace Sistemas en el servidor). */
function GuiaWebhook({ error }) {
  return (
    <section aria-labelledby="com-bitrix-guia" className="card p-5 shadow-card">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-surface-2 text-fg-muted">
          <Unplug className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 id="com-bitrix-guia" className="text-[15px] font-semibold text-fg">Conecta Bitrix24 con un webhook de Comercial</h3>
          <p className="mt-1 text-[13px] text-fg-muted">
            DataMET+ copia las negociaciones y empresas del CRM para enlazarlas con las facturas. Solo lee: no escribe nada en Bitrix24.
            {' '}Lo configura Sistemas en el servidor.
          </p>
          {error && <p className="mt-2 text-[13px] font-medium text-danger">{error}</p>}
        </div>
      </div>
      <ol className="mt-4 grid gap-3 text-[13px] text-fg sm:grid-cols-3">
        {[
          ['Crea el webhook', 'En Bitrix24: Recursos para desarrolladores › Otro › Webhook entrante, con un usuario de Comercial.'],
          ['Dale permisos', 'CRM (crm) y Usuarios (user). Sin «user» funciona, pero los responsables quedan sin nombre.'],
          ['Cárgalo en el servidor', 'Su URL va en backend/.env como BITRIX_WEBHOOK_URL. Luego reinicia DataMET+.'],
        ].map(([titulo, texto], index) => (
          <li key={titulo} className="rounded-xl bg-surface-2/60 px-3 py-2.5">
            <p className="flex items-center gap-2 font-semibold">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-fg/[0.08] text-[11px] tabular-nums">{index + 1}</span>
              {titulo}
            </p>
            <p className="mt-1 text-[12.5px] leading-snug text-fg-muted">{texto}</p>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[12px] text-fg-subtle">
        Opcionales: BITRIX_SYNC_MINUTOS (cada cuánto, 15 por omisión) y BITRIX_SYNC_DESDE (desde qué fecha de creación se copian, 2025-01-01).
      </p>
    </section>
  );
}

/** Cómo está la copia: última sincronización, conteos y el botón para sincronizar. */
function EstadoCopia({ estado, soloConsulta, onSincronizar, pidiendo }) {
  const { ultima, ultimaCorrecta, copia } = estado;
  const sincronizando = estado.enCurso || pidiendo;
  let tono = 'muted';
  let texto = 'Todavía sin sincronizar';
  if (sincronizando) {
    tono = 'info';
    texto = 'Sincronizando…';
  } else if (ultima?.estado === 'ERROR') {
    tono = 'danger';
    texto = 'Falló la última sincronización';
  } else if (ultimaCorrecta) {
    tono = 'success';
    texto = `Sincronizada ${haceCuanto(ultimaCorrecta.fin || ultimaCorrecta.inicio)}`;
  }

  return (
    <section aria-label="Copia de Bitrix24" className="card flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3 shadow-card">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className={cn('cal-tone-' + tono, 'relative flex h-2.5 w-2.5 flex-none rounded-full bg-[var(--tone)]')} aria-hidden="true">
          {sincronizando && <span className="absolute inset-0 animate-ping rounded-full bg-[var(--tone)] opacity-60" />}
        </span>
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold text-fg" role="status">{texto}</p>
          <p className="truncate text-[12px] text-fg-muted">
            {[
              copia && `${copia.negociaciones.toLocaleString('es-BO')} negociaciones copiadas`,
              copia && `${copia.facturas.toLocaleString('es-BO')} facturas enlazadas`,
              estado.automatica ? `automática cada ${estado.minutos} min` : 'sin sincronización automática',
              `creadas desde ${fecha(estado.desde)}`,
            ].filter(Boolean).join(' · ')}
          </p>
          {ultima?.estado === 'ERROR' && !sincronizando && (
            <p className="mt-0.5 text-[12px] text-danger">{fechaHora(ultima.inicio)}: {ultima.error}</p>
          )}
        </div>
      </div>
      {!soloConsulta && (
        <div className="flex items-center gap-3">
          {ultimaCorrecta && (
            <button
              type="button"
              disabled={sincronizando}
              onClick={() => onSincronizar(true)}
              title="Vuelve a copiar todas las negociaciones desde la fecha de inicio, no solo lo modificado"
              className="text-[12.5px] font-medium text-fg-muted underline decoration-fg/30 underline-offset-4 hover:text-fg disabled:opacity-50"
            >
              Copia completa
            </button>
          )}
          <Button size="sm" variant="secondary" className="h-9" disabled={sincronizando} onClick={() => onSincronizar(false)}>
            {sincronizando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
            Sincronizar ahora
          </Button>
        </div>
      )}
    </section>
  );
}

function Facturas({ facturas }) {
  if (!facturas.length) return <span className="text-fg-subtle">—</span>;
  return (
    <span className="flex flex-col">
      {facturas.slice(0, 2).map(f => (
        <span key={f.id} className="font-mono text-[12.5px] text-fg">N.º {f.numero}<span className="text-fg-subtle">/{String(f.gestion).slice(2)}</span></span>
      ))}
      {facturas.length > 2 && <span className="text-[11.5px] text-fg-subtle">+{facturas.length - 2} más</span>}
    </span>
  );
}

function Negociaciones({ estado, soloConsulta, clave, onAbrir }) {
  const [filtros, setFiltros] = useState(filtrosVacios);
  const [page, setPage] = useState(1);
  const [reinicio, setReinicio] = useState(0);

  const load = useCallback(
    () => comercialApi.bitrixNegociaciones({ ...Object.fromEntries(Object.entries(filtros).filter(([, v]) => v !== '')), page, pageSize: PAGE_SIZE }),
    [filtros, page],
  );
  const { data, error, loading, reload } = useResource(load);
  // Otra copia o una factura nueva: se vuelve a cargar con los mismos filtros.
  const [claveCargada, setClaveCargada] = useState(clave);
  if (claveCargada !== clave) {
    setClaveCargada(clave);
    reload();
  }
  const cambiar = useCallback((cambios) => {
    setFiltros(actual => ({ ...actual, ...cambios }));
    setPage(1);
  }, []);
  const buscar = useCallback((q) => cambiar({ q }), [cambiar]);
  const hayFiltros = Object.values(filtros).some(Boolean);
  const situaciones = data?.resumen?.situaciones;
  const items = data?.items || [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Busqueda key={reinicio} value={filtros.q} onChange={buscar} label="Buscar negociaciones" placeholder="Negociación, empresa, cotización o N.º…" />
        <Dropdown
          ariaLabel="Embudo"
          value={filtros.embudo}
          onChange={(embudo) => cambiar({ embudo })}
          options={[{ value: '', label: 'Todos los embudos' }, ...(data?.embudos || []).map(e => ({ value: String(e.id), label: e.nombre || `Embudo ${e.id}`, hint: String(e.negociaciones) }))]}
          size="sm"
          menuWidth={260}
          className="w-[13rem]"
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <div role="group" aria-label="Filtrar por situación" className="flex flex-wrap gap-1.5">
          {SITUACIONES_BITRIX_ORDEN.map(situacion => (
            <button
              key={situacion}
              type="button"
              title={SITUACIONES_BITRIX[situacion].ayuda}
              aria-pressed={filtros.situacion === situacion}
              onClick={() => cambiar({ situacion: filtros.situacion === situacion ? '' : situacion })}
              disabled={!situaciones?.[situacion]?.negociaciones && filtros.situacion !== situacion}
              className={cn('cal-filter-chip', `cal-tone-${SITUACIONES_BITRIX[situacion].tone}`)}
            >
              <span className="cal-dot" aria-hidden="true" />
              {SITUACIONES_BITRIX[situacion].label}
              <strong>{situaciones?.[situacion]?.negociaciones ?? 0}</strong>
            </button>
          ))}
        </div>
        {hayFiltros && (
          <button
            type="button"
            onClick={() => { setReinicio(v => v + 1); cambiar(filtrosVacios()); }}
            className="ml-1 text-[13px] font-medium text-fg-muted underline decoration-fg/30 underline-offset-4 hover:text-fg"
          >
            Quitar filtros
          </button>
        )}
      </div>

      {situaciones?.por_facturar && (
        <Cifras items={[
          { label: 'Por facturar', value: bsCorto(situaciones.por_facturar.monto), hint: negociaciones(situaciones.por_facturar.negociaciones), tone: situaciones.por_facturar.negociaciones ? 'warning' : undefined },
          { label: 'Facturadas sin registrar', value: bsCorto(situaciones.sin_registrar.monto), hint: `${situaciones.sin_registrar.negociaciones} sin factura en DataMET+`, tone: situaciones.sin_registrar.negociaciones ? 'danger' : undefined },
          { label: 'Etapa por actualizar', value: String(situaciones.etapa_desactualizada.negociaciones), hint: 'Ya facturadas en DataMET+' },
          { label: 'Con factura', value: String(situaciones.con_factura.negociaciones), hint: bsCorto(situaciones.con_factura.monto) },
        ]} />
      )}

      {error && <ErrorCarga titulo="No se pudieron cargar las negociaciones." error={error} onRetry={reload} />}
      {!data && !error && <Cargando label="Cargando negociaciones" />}

      {data && items.length === 0 && (
        <EmptyState icon={Handshake} title={hayFiltros ? 'Ninguna negociación coincide con los filtros' : 'Todavía no hay negociaciones copiadas'}>
          {hayFiltros
            ? 'Cambie o limpie los filtros para ver otras negociaciones.'
            : estado.configurado
              ? (soloConsulta ? 'Aparecen aquí después de la primera sincronización.' : 'Pulsa «Sincronizar ahora» para traer las negociaciones de Bitrix24.')
              : 'Aparecen aquí cuando Sistemas conecte el webhook de Comercial.'}
        </EmptyState>
      )}

      {items.length > 0 && (
        <div className={cn('card overflow-hidden shadow-card transition-opacity', loading && 'opacity-60')}>
          {/* Tabla desde 1024 px; el embudo, desde 1280 (antes va bajo el título)
              para que el título no quede apretado con el menú abierto. */}
          <table className="hidden w-full table-fixed text-left lg:table">
            <caption className="sr-only">Negociaciones de Bitrix24; primero las que piden atención</caption>
            <thead className="border-b border-line bg-surface-2/60 text-xs text-fg-muted">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Negociación</th>
                <th scope="col" className="hidden w-[11rem] px-3 py-2.5 font-medium xl:table-cell">Embudo y etapa</th>
                <th scope="col" className="hidden w-[10rem] px-3 py-2.5 font-medium xl:table-cell">Responsable</th>
                <th scope="col" className="w-[8.5rem] px-3 py-2.5 text-right font-medium">Monto</th>
                <th scope="col" className="w-[6.5rem] px-3 py-2.5 font-medium">Factura</th>
                <th scope="col" className="w-[10.5rem] px-4 py-2.5 text-right font-medium">Situación</th>
              </tr>
            </thead>
            <tbody className="stagger-in divide-y divide-line">
              {items.map(neg => (
                <FilaAbrible key={neg.dealId} onOpen={() => onAbrir(neg.dealId)}>
                  <td className="px-4 py-3 text-[13px]">
                    <span className="block truncate font-medium text-fg" title={neg.titulo}>{neg.titulo || `Negociación ${neg.dealId}`}</span>
                    <span className="block truncate text-fg-muted">
                      <span className="font-mono text-[12px]">#{neg.dealId}</span>
                      {neg.empresa ? ` · ${neg.empresa}` : ''}
                      {neg.cotizacion ? <span className="font-mono text-[12px]"> · {neg.cotizacion}</span> : ''}
                    </span>
                    <span className="block truncate text-[12px] text-fg-subtle xl:hidden">{neg.embudo} › {neg.etapa}</span>
                  </td>
                  <td className="hidden px-3 py-3 text-[13px] xl:table-cell">
                    <span className="block truncate text-fg">{neg.embudo || '—'}</span>
                    <span className="block truncate text-fg-muted">{neg.etapa || '—'}</span>
                  </td>
                  <td className="hidden truncate px-3 py-3 text-[13px] text-fg-muted xl:table-cell">{neg.responsable || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right text-[13px] font-semibold tabular-nums text-fg">{bs(neg.monto)}</td>
                  <td className="px-3 py-3 text-[13px]"><Facturas facturas={neg.facturas} /></td>
                  <td className="px-4 py-3 text-right"><Situacion situacion={neg.situacion} /></td>
                </FilaAbrible>
              ))}
            </tbody>
          </table>
          <ul className="stagger-in divide-y divide-line lg:hidden">
            {items.map(neg => (
              <li key={neg.dealId}>
                <button type="button" onClick={() => onAbrir(neg.dealId)} className="flex w-full flex-col gap-1.5 px-4 py-3.5 text-left hover:bg-fg/[0.025]">
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0 text-[13.5px] font-medium text-fg">{neg.titulo || `Negociación ${neg.dealId}`}</span>
                    <Situacion situacion={neg.situacion} />
                  </span>
                  <span className="text-[12.5px] text-fg-muted">#{neg.dealId} · {neg.embudo} › {neg.etapa}</span>
                  <span className="flex items-center justify-between gap-3 text-[12.5px] text-fg-muted">
                    <span className="truncate">{neg.empresa || 'Sin empresa'}</span>
                    <span className="font-semibold tabular-nums text-fg">{bs(neg.monto)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data && <Paginacion total={data.total} page={page} pageSize={data.pageSize || PAGE_SIZE} loading={loading} onPage={setPage} unidad="negociaciones" />}
    </div>
  );
}

/**
 * Bitrix24: copia de solo lectura de las negociaciones del CRM, su situación
 * frente a las facturas de DataMET+ y las equivalencias de los responsables.
 * Desde una negociación se registra su factura con los datos ya puestos.
 */
export function BitrixPanel({ soloConsulta }) {
  const [vista, setVista] = useState('negociaciones');
  const [abierta, setAbierta] = useState(null);
  const [propuesta, setPropuesta] = useState(null);
  const [factura, setFactura] = useState(null);
  const [pidiendo, setPidiendo] = useState(false);
  // Sube cuando se registra una factura o una equivalencia.
  const [version, setVersion] = useState(0);
  const { data: estado, error: errorEstado, reload: recargarEstado } = useResource(comercialApi.bitrixEstado);
  // Las listas se recargan al terminar una copia correcta o con un cambio aquí.
  const clave = `${estado?.ultimaCorrecta?.id ?? 0}:${version}`;

  // Mientras sincroniza, vuelve a preguntar cada 3 s; al terminar, avisa.
  const enCursoAntes = useRef(false);
  useEffect(() => {
    if (!estado) return undefined;
    if (enCursoAntes.current && !estado.enCurso) {
      if (estado.ultima?.estado === 'ERROR') toast.error(`La sincronización falló: ${estado.ultima.error}`);
      else if (estado.ultima) toast.success(`Sincronizado: ${estado.ultima.negociaciones} negociaciones y ${estado.ultima.enlaces} enlaces con facturas.`);
    }
    enCursoAntes.current = estado.enCurso;
    if (!estado.enCurso) return undefined;
    const timer = setTimeout(recargarEstado, 3000);
    return () => clearTimeout(timer);
  }, [estado, recargarEstado]);

  const sincronizar = async (completa) => {
    setPidiendo(true);
    try {
      await comercialApi.bitrixSincronizar(completa);
      enCursoAntes.current = true;
      recargarEstado();
    } catch (error) {
      toast.error(error.message || 'No se pudo iniciar la sincronización.');
    } finally {
      setPidiendo(false);
    }
  };

  if (errorEstado) return <ErrorCarga titulo="No se pudo leer el estado de Bitrix24." error={errorEstado} onRetry={recargarEstado} />;
  if (!estado) return <Cargando label="Cargando Bitrix24" filas={3} />;

  const pendientes = estado.copia?.responsablesSinConfirmar || 0;
  // Sin webhook y sin nada copiado antes, solo la guía: no hay qué filtrar.
  const vacia = !estado.configurado && !estado.copia?.negociaciones;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="sr-only">Bitrix24</h2>
      {!estado.configurado && <GuiaWebhook error={estado.errorConfiguracion} />}
      {!estado.tablas && <EmptyState icon={Handshake} title="Falta preparar la base de datos">{estado.aviso}</EmptyState>}
      {estado.tablas && !vacia && (
        <>
          {(estado.configurado || estado.ultima) && (
            <EstadoCopia estado={estado} soloConsulta={soloConsulta || !estado.configurado} onSincronizar={sincronizar} pidiendo={pidiendo} />
          )}
          <Segmented
            label="Vista de Bitrix24"
            value={vista}
            onChange={setVista}
            className="cal-tabs self-start"
            options={[
              { value: 'negociaciones', label: 'Negociaciones', icon: <Handshake className="h-4 w-4" aria-hidden="true" /> },
              { value: 'responsables', label: 'Responsables', icon: <UsersRound className="h-4 w-4" aria-hidden="true" />, count: pendientes || null, alert: pendientes > 0 },
            ]}
          />
          {vista === 'negociaciones' && <Negociaciones estado={estado} soloConsulta={soloConsulta} clave={clave} onAbrir={setAbierta} />}
          {vista === 'responsables' && (
            <ResponsablesBitrix soloConsulta={soloConsulta} clave={clave} onChanged={() => { recargarEstado(); setVersion(v => v + 1); }} />
          )}
        </>
      )}

      {abierta && (
        <NegociacionModal
          id={abierta}
          soloConsulta={soloConsulta}
          onClose={() => setAbierta(null)}
          onFacturar={(p) => { setAbierta(null); setPropuesta(p); }}
          onAbrirFactura={(id) => { setAbierta(null); setFactura(id); }}
        />
      )}
      {propuesta && (
        <NuevaFacturaModal
          propuesta={propuesta}
          onClose={() => setPropuesta(null)}
          onCreated={(nueva) => { setVersion(v => v + 1); recargarEstado(); setFactura(nueva.id); }}
        />
      )}
      {factura && (
        <FacturaModal id={factura} soloConsulta={soloConsulta} onClose={() => setFactura(null)} onChanged={() => setVersion(v => v + 1)} />
      )}
    </div>
  );
}
