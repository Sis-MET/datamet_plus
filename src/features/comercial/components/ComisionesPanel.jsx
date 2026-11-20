import { useCallback, useState } from 'react';
import { Ban, Eye, FileSpreadsheet, Loader2, Lock, Percent } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../shared/components/ui/Button';
import { cn } from '../../../shared/utils/cn';
import { Dropdown } from '../../calibration/components/Dropdown';
import { BlockTitle, CancelButton, DangerButton, EmptyState, Modal, PrimaryButton, Segmented, ToneBadge } from '../../calibration/components/primitives';
import { ReasonModal } from '../../calibration/components/ReasonModal';
import { useResource } from '../../system/hooks/useResource';
import { comercialApi } from '../api/comercial';
import { ESTADOS_LINEA_COMISION, ESTADOS_MES_COMISION, NOMBRES_MES, bs, bsCorto, fecha, fechaHora, hoyLaPaz, pct } from '../domain/comercial';
import { Cargando, Cifras, ErrorCarga, FilaAbrible } from './comunes';
import { ReglasComision } from './ReglasComision';
import { Barras } from './reportes/Graficos';

const nombreMes = (gestion, mes) => `${NOMBRES_MES[mes - 1]} ${gestion}`;

// Para el resumen «3 de categorías que no comisionan · 1 por costear».
const MOTIVOS_CORTOS = {
  categoria: 'de categorías que no comisionan', por_costear: 'por costear', bajo_tramo: 'bajo el primer tramo',
  sin_responsable: 'sin responsable', sin_regla: 'sin reglas vigentes',
};

function EstadoMes({ estado }) {
  const info = ESTADOS_MES_COMISION[estado] || ESTADOS_MES_COMISION.abierto;
  return <ToneBadge tone={info.tone}>{info.label}</ToneBadge>;
}

async function descargar(promesa, nombre) {
  const blob = await promesa;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Lo que no comisiona del mes, agrupado por motivo (solo quien ve todas). */
function NoComisionan({ lineas }) {
  const grupos = {};
  for (const l of lineas) if (!l.personas.length) (grupos[l.estado] = grupos[l.estado] || []).push(l);
  const claves = Object.keys(grupos);
  if (!claves.length) return null;
  return (
    <details className="rounded-xl border border-line">
      <summary className="cursor-pointer px-3 py-2 text-[13px] font-medium text-fg">
        Líneas que no comisionan · {claves.map(k => `${grupos[k].length} ${MOTIVOS_CORTOS[k] || k}`).join(' · ')}
      </summary>
      <ul className="divide-y divide-line border-t border-line text-[12.5px]">
        {claves.flatMap(k => grupos[k]).map((l, i) => (
          <li key={`${l.facturaId}-${l.categoria}-${i}`} className="flex flex-wrap justify-between gap-x-3 px-3 py-1.5">
            <span className="min-w-0 truncate text-fg">N.º {l.numero} · {l.razonSocial} · {l.categoria}</span>
            <span className="text-fg-muted">{bs(l.montoLinea)} · {ESTADOS_LINEA_COMISION[l.estado]}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * Un mes: por responsable y el detalle por línea de factura. Abierto, es el
 * cálculo de hoy; cerrado, lo congelado (y si las facturas de hoy darían
 * otra cosa). Con el permiso de gestionar se cierra o se anula el cierre.
 */
function MesModal({ gestion, mes, onClose, onCambio }) {
  const load = useCallback(() => comercialApi.comisionesMes(gestion, mes), [gestion, mes]);
  const { data: d, error, reload } = useResource(load);
  const [confirmando, setConfirmando] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [anulando, setAnulando] = useState(false);
  const [bajando, setBajando] = useState(false);
  const comisionan = d ? d.lineas.filter(l => l.personas.length) : [];
  const puedeCerrar = d?.puede?.gestionar && !d.cierre && d.estado === 'abierto';

  const cerrar = async () => {
    setTrabajando(true);
    try {
      await comercialApi.cerrarComisiones(gestion, mes);
      toast.success(`Comisiones de ${nombreMes(gestion, mes)} cerradas.`);
      setConfirmando(false);
      reload();
      onCambio();
    } catch (err) {
      toast.error(err.message || 'No se pudo cerrar el mes.');
    } finally {
      setTrabajando(false);
    }
  };

  const exportar = async () => {
    setBajando(true);
    try {
      await descargar(comercialApi.comisionesExcel(gestion, mes), `comisiones-${gestion}-${String(mes).padStart(2, '0')}.xlsx`);
    } catch (err) {
      toast.error(err.message || 'No se pudo generar el Excel.');
    } finally {
      setBajando(false);
    }
  };

  return (
    <>
      <Modal
        onClose={onClose}
        size="xl"
        busy={trabajando}
        title={`Comisiones de ${nombreMes(gestion, mes)}`}
        subtitle={d ? (d.todos ? 'De todos los responsables comerciales.' : 'Las tuyas.') : 'Cargando…'}
        actions={d ? <EstadoMes estado={d.estado} /> : null}
        footer={(close) => (
          <div className="flex w-full flex-wrap items-center gap-2">
            {d?.cierre && d.puede?.gestionar && (
              <DangerButton onClick={() => setAnulando(true)} label="Anular el cierre para volver a cerrarlo">
                <Ban className="h-4 w-4" aria-hidden="true" /> Anular el cierre
              </DangerButton>
            )}
            <Button size="sm" variant="secondary" className="h-10" onClick={exportar} disabled={!d || bajando}>
              {bajando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />} Exportar a Excel
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <CancelButton onClick={close}>Cerrar</CancelButton>
              {puedeCerrar && !confirmando && (
                <PrimaryButton onClick={() => setConfirmando(true)}><Lock className="h-4 w-4" aria-hidden="true" /> Cerrar el mes</PrimaryButton>
              )}
            </div>
          </div>
        )}
      >
        <div className="flex flex-col gap-5 p-5">
          {error && <ErrorCarga titulo="No se pudo leer el mes." error={error} onRetry={reload} />}
          {!d && !error && <Cargando label="Calculando" filas={3} />}
          {d && (
            <>
              {confirmando && (
                <div role="alertdialog" aria-label={`Confirmar el cierre de ${nombreMes(gestion, mes)}`} className="rounded-xl bg-surface-2/70 p-3">
                  <p className="text-[13px] text-fg">
                    Se congela lo calculado: <strong className="font-semibold">{bs(d.totales.comision)}</strong> para {d.personas.length} {d.personas.length === 1 ? 'persona' : 'personas'}.
                    Una corrección posterior (una factura anulada, un costo cargado) ya no lo cambia; para eso se anula el cierre con su motivo y se vuelve a cerrar.
                  </p>
                  <div className="mt-3 flex justify-end gap-2">
                    <CancelButton onClick={() => setConfirmando(false)} disabled={trabajando} />
                    <PrimaryButton onClick={cerrar} busy={trabajando} busyLabel="Cerrando">Sí, cerrar {NOMBRES_MES[mes - 1]}</PrimaryButton>
                  </div>
                </div>
              )}
              {d.cierre && (
                <p className="rounded-xl bg-surface-2/60 px-3 py-2 text-[13px] text-fg">
                  <Lock className="mr-1.5 inline h-4 w-4 align-[-3px] text-fg-muted" aria-hidden="true" />
                  Cerrado por {d.cierre.cerrado.nombre || d.cierre.cerrado.usuario} el {fechaHora(d.cierre.cerrado.fecha)}: es lo que se paga.
                  {d.cierre.diferencia !== 0 && (
                    <span className="text-fg-muted"> Con las facturas de hoy daría {bs(Math.abs(d.cierre.diferencia))} {d.cierre.diferencia > 0 ? 'más' : 'menos'} (algo cambió después del cierre).</span>
                  )}
                </p>
              )}
              <Cifras items={[
                { label: 'Comisión', value: bs(d.totales.comision) },
                { label: 'Base comisionable', value: bsCorto(d.totales.base), hint: `${comisionan.length} líneas que comisionan` },
                ...(d.todos ? [
                  { label: 'Sin responsable', value: bs(d.totales.sinResponsable || 0), hint: 'No se paga a nadie', tone: d.totales.sinResponsable ? 'warning' : undefined },
                  {
                    label: 'Por costear', value: bsCorto(d.totales.porCostear || 0), tone: d.totales.porCostear ? 'warning' : undefined,
                    hint: `${d.totales.lineasPorCostear || 0} ${d.totales.lineasPorCostear === 1 ? 'venta' : 'ventas'} sin costo`,
                  },
                ] : []),
              ]} />

              {d.personas.length ? (
                <div>
                  <BlockTitle>Por responsable</BlockTitle>
                  <div className="overflow-x-auto rounded-xl border border-line">
                    <table className="w-full min-w-[480px] text-left text-[13px]">
                      <thead className="bg-surface-2/60 text-xs text-fg-muted">
                        <tr>
                          <th scope="col" className="px-3 py-2 font-medium">Responsable</th>
                          <th scope="col" className="px-3 py-2 text-right font-medium">Facturas</th>
                          <th scope="col" className="px-3 py-2 text-right font-medium">Base</th>
                          <th scope="col" className="px-3 py-2 text-right font-medium">Comisión</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line tabular-nums">
                        {d.personas.map(p => (
                          <tr key={p.usuarioId ?? p.nombre}>
                            <th scope="row" className="px-3 py-2 font-medium text-fg">{p.nombre}</th>
                            <td className="px-3 py-2 text-right text-fg-muted">{p.facturas}</td>
                            <td className="px-3 py-2 text-right text-fg-muted">{bs(p.base)}</td>
                            <td className="px-3 py-2 text-right font-semibold text-fg">{bs(p.comision)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="text-[13px] text-fg-muted">{d.todos ? 'Nadie comisiona en este mes.' : 'No tienes comisiones en este mes.'}</p>
              )}

              {comisionan.length > 0 && (
                <div>
                  <BlockTitle>Detalle por línea de factura</BlockTitle>
                  <div className="overflow-x-auto rounded-xl border border-line">
                    <table className="w-full min-w-[760px] text-left text-[12.5px]">
                      <thead className="bg-surface-2/60 text-xs text-fg-muted">
                        <tr>
                          <th scope="col" className="px-3 py-2 font-medium">Factura</th>
                          <th scope="col" className="px-3 py-2 font-medium">Categoría</th>
                          <th scope="col" className="px-3 py-2 text-right font-medium">Base</th>
                          <th scope="col" className="px-3 py-2 text-right font-medium">Margen</th>
                          <th scope="col" className="px-3 py-2 text-right font-medium">Tasa</th>
                          <th scope="col" className="px-3 py-2 font-medium">Responsables</th>
                          <th scope="col" className="px-3 py-2 text-right font-medium">Comisión</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line tabular-nums">
                        {comisionan.map((l, i) => (
                          <tr key={`${l.facturaId}-${l.categoria}-${i}`} className="align-top">
                            <td className="px-3 py-2">
                              <span className="block font-mono font-semibold text-fg">N.º {l.numero}</span>
                              <span className="block max-w-[14rem] truncate text-fg-muted" title={l.razonSocial}>{fecha(l.fecha)} · {l.razonSocial}</span>
                            </td>
                            <td className="px-3 py-2 text-fg">{l.categoria}</td>
                            <td className="px-3 py-2 text-right text-fg-muted">{bs(l.base)}</td>
                            <td className="px-3 py-2 text-right text-fg-muted">{pct(l.margen)}</td>
                            <td className="px-3 py-2 text-right text-fg">{pct(l.tasa)}</td>
                            <td className="px-3 py-2 text-fg-muted">{l.personas.map(p => `${p.nombre}${p.porcentaje < 100 ? ` (${pct(p.porcentaje)})` : ''}`).join(' · ')}</td>
                            <td className="px-3 py-2 text-right font-semibold text-fg">{bs(l.personas.reduce((s, p) => s + p.comision, 0))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {d.todos && !d.cierre && <NoComisionan lineas={d.lineas} />}

              {d.historialCierres.some(c => c.estado === 'ANULADO') && (
                <div>
                  <BlockTitle>Cierres anulados</BlockTitle>
                  <ul className="flex flex-col gap-1.5 text-[12.5px] text-fg-muted">
                    {d.historialCierres.filter(c => c.estado === 'ANULADO').map(c => (
                      <li key={c.id}>
                        {bs(c.comision)} cerrado por {c.cerrado.nombre || c.cerrado.usuario} ({fechaHora(c.cerrado.fecha)}); anulado por {c.anulado.nombre || c.anulado.usuario}
                        {' '}({fechaHora(c.anulado.fecha)}): «{c.anulado.motivo}»
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-[12px] text-fg-subtle">Reglas aplicadas: {d.reglas.map(r => `desde el ${fecha(r.vigenteDesde)}`).join(' · ') || '—'}.</p>
            </>
          )}
        </div>
      </Modal>
      {anulando && d?.cierre && (
        <ReasonModal
          title={`Anular el cierre de ${nombreMes(gestion, mes)}`}
          subtitle={`${bs(d.totales.comision)} cerrado por ${d.cierre.cerrado.nombre || d.cierre.cerrado.usuario}`}
          heading="El cierre no se borra"
          description="Queda anulado con el motivo, tu usuario y la hora; el mes vuelve a calcularse con las facturas de hoy y se puede cerrar de nuevo."
          confirmLabel="Anular el cierre"
          danger
          reasonPlaceholder="Por ejemplo: la factura N.º 512 se anuló y se reemplazó después del cierre."
          onConfirm={async (motivo) => {
            await comercialApi.anularCierreComisiones(d.cierre.id, motivo);
            toast.success('Cierre anulado.');
            reload();
            onCambio();
          }}
          onClose={() => setAnulando(false)}
        />
      )}
    </>
  );
}

function Meses({ gestion, clave, onAbrir }) {
  const load = useCallback(() => comercialApi.comisiones(gestion), [gestion]);
  const { data: r, error, loading, reload } = useResource(load);
  const [claveCargada, setClaveCargada] = useState(clave);
  if (claveCargada !== clave) {
    setClaveCargada(clave);
    reload();
  }
  if (error) return <ErrorCarga titulo="No se pudieron calcular las comisiones." error={error} onRetry={reload} />;
  if (!r) return <Cargando label="Calculando las comisiones" filas={4} />;
  const visibles = r.meses.filter(m => m.estado !== 'futuro');
  const cerrados = visibles.filter(m => m.estado === 'cerrado').length;
  const porCerrar = visibles.filter(m => m.estado === 'abierto').length;

  return (
    <div className={cn('flex flex-col gap-4 transition-opacity', loading && 'opacity-60')}>
      {!r.todos && (
        <p className="flex items-center gap-2 rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-[13px] text-fg-muted">
          <Eye className="h-4 w-4 flex-none" aria-hidden="true" />
          Ves tus comisiones. Las de todos las ve quien tiene el permiso de comisiones (lo concede Sistemas en Gestión de permisos).
        </p>
      )}
      <Cifras items={[
        { label: r.todos ? 'Comisiones de la gestión' : 'Tus comisiones de la gestión', value: bs(r.total) },
        { label: 'Meses cerrados', value: `${cerrados} de ${visibles.length}`, hint: porCerrar ? `${porCerrar} por cerrar` : 'Al día' },
        { label: 'Responsables', value: String(r.personas.length), hint: r.todos ? 'Con comisión en la gestión' : null },
        { label: 'Promedio por mes', value: bsCorto(visibles.length ? r.total / visibles.length : 0) },
      ]} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section aria-label="Comisiones por mes" className="card overflow-hidden shadow-card">
          <table className="w-full text-left text-[13px]">
            <caption className="sr-only">Comisiones de {gestion} por mes</caption>
            <thead className="border-b border-line bg-surface-2/60 text-xs text-fg-muted">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Mes</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Estado</th>
                <th scope="col" className="hidden px-3 py-2.5 text-right font-medium sm:table-cell">Base</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Comisión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular-nums">
              {visibles.map(m => (
                <FilaAbrible key={m.mes} onOpen={() => onAbrir(m.mes)} className="align-middle">
                  <th scope="row" className="px-4 py-2.5 text-left font-medium capitalize text-fg">{NOMBRES_MES[m.mes - 1]}</th>
                  <td className="px-3 py-2.5">
                    <EstadoMes estado={m.estado} />
                    {m.cierre && <span className="ml-2 hidden text-[12px] text-fg-subtle md:inline">{m.cierre.cerrado.nombre || m.cierre.cerrado.usuario}</span>}
                  </td>
                  <td className="hidden px-3 py-2.5 text-right text-fg-muted sm:table-cell">{bs(m.base)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-fg">{bs(m.comision)}</td>
                </FilaAbrible>
              ))}
            </tbody>
          </table>
        </section>
        <section aria-label="Comisiones por responsable" className="card flex flex-col gap-4 p-4 shadow-card sm:p-5">
          <div>
            <h3 className="text-[14.5px] font-semibold text-fg">{r.todos ? 'Por responsable en la gestión' : 'En la gestión'}</h3>
            <p className="mt-0.5 text-[12.5px] text-fg-muted">Lo cerrado, congelado; lo abierto, con las facturas de hoy.</p>
          </div>
          {r.personas.length ? (
            <Barras etiqueta="Por responsable" total={r.total} items={r.personas.map(p => ({ clave: p.usuarioId ?? p.nombre, nombre: p.nombre, monto: p.comision }))} />
          ) : <p className="text-[13px] text-fg-muted">{r.todos ? 'Nadie tiene comisiones en la gestión.' : 'No tienes comisiones en la gestión.'}</p>}
        </section>
      </div>
    </div>
  );
}

/**
 * Comisiones de Comercial (fase 4): por mes y responsable, con cierre
 * mensual congelado, y las reglas configurables por versiones. Cada
 * responsable ve las suyas; con el permiso, las de todos.
 */
export function ComisionesPanel() {
  const actual = Number(hoyLaPaz().slice(0, 4));
  const [gestion, setGestion] = useState(actual);
  const [vista, setVista] = useState('meses');
  const [abierto, setAbierto] = useState(null);
  const [version, setVersion] = useState(0);
  const gestiones = Array.from({ length: 4 }, (_, i) => actual - i);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="sr-only">Comisiones</h2>
      <div className="flex flex-wrap items-center gap-3">
        <Segmented label="Vista de comisiones" value={vista} onChange={setVista} className="cal-tabs"
          options={[{ value: 'meses', label: 'Por mes', icon: <Percent className="h-4 w-4" aria-hidden="true" /> }, { value: 'reglas', label: 'Reglas' }]} />
        {vista === 'meses' && (
          <Dropdown ariaLabel="Gestión" value={String(gestion)} onChange={(g) => setGestion(Number(g))} size="sm" className="w-[8rem]"
            options={gestiones.map(g => ({ value: String(g), label: `Gestión ${g}` }))} />
        )}
      </div>
      {vista === 'meses' && <Meses gestion={gestion} clave={version} onAbrir={setAbierto} />}
      {vista === 'reglas' && <ReglasComision onCambio={() => setVersion(v => v + 1)} />}
      {abierto && <MesModal gestion={gestion} mes={abierto} onClose={() => setAbierto(null)} onCambio={() => setVersion(v => v + 1)} />}
      {!gestiones.length && <EmptyState icon={Percent} title="Sin gestiones" />}
    </div>
  );
}
