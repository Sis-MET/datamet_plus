import { useCallback, useId, useMemo, useState } from 'react';
import { Plus, SlidersHorizontal, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../shared/components/ui/Button';
import { cn } from '../../../shared/utils/cn';
import { Dropdown } from '../../calibration/components/Dropdown';
import { BlockTitle, CancelButton, FieldLabel, Modal, ModalColumns, ModalSection, PrimaryButton, Switch } from '../../calibration/components/primitives';
import { useResource } from '../../system/hooks/useResource';
import { comercialApi } from '../api/comercial';
import { AREAS, fecha, fechaHora, hoyLaPaz, leerPorcentaje, pct } from '../domain/comercial';
import { Cargando, ErrorCarga } from './comunes';

const BASES = { MONTO: 'Monto de la línea', NETO: 'Neto de impuestos de la línea' };

/** «De 20 % a 30 %: 0,6 %», a partir de los tramos ordenados. */
const filasTramos = (tramos) => {
  const orden = [...tramos].sort((a, b) => a.desde - b.desde);
  return orden.map((t, i) => ({
    ...t,
    rango: orden[i + 1] ? `De ${pct(t.desde)} a menos de ${pct(orden[i + 1].desde)}` : `Desde ${pct(t.desde)}`,
  }));
};

function TablaTramos({ tramos }) {
  return (
    <table className="w-full text-left text-[13px]">
      <caption className="sr-only">Tramos de margen y su tasa</caption>
      <thead className="text-xs text-fg-muted">
        <tr className="border-b border-line">
          <th scope="col" className="py-2 pr-3 font-medium">Margen de la línea</th>
          <th scope="col" className="py-2 pl-3 text-right font-medium">Comisión</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line tabular-nums">
        {filasTramos(tramos).map(t => (
          <tr key={t.desde}>
            <td className="py-2 pr-3 text-fg">{t.rango}</td>
            <td className={cn('py-2 pl-3 text-right font-semibold', t.tasa ? 'text-fg' : 'text-fg-subtle')}>{t.tasa ? pct(t.tasa) : 'No comisiona'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Categorías agrupadas por área, para mostrar o elegir cuáles comisionan. */
function Categorias({ categorias, elegidas, onChange }) {
  const porArea = useMemo(() => {
    const grupos = new Map();
    for (const c of categorias) grupos.set(c.area, [...(grupos.get(c.area) || []), c]);
    return [...grupos];
  }, [categorias]);
  return (
    <div className="flex flex-col gap-3">
      {porArea.map(([area, lista]) => {
        const marcadas = lista.filter(c => elegidas.has(c.id)).length;
        return (
          <fieldset key={area} className="min-w-0">
            <legend className="mb-1.5 flex items-center gap-2 text-[12.5px] font-semibold text-fg">
              {AREAS[area] || area}
              <span className="font-normal text-fg-muted">{marcadas} de {lista.length}</span>
              {onChange && (
                <button type="button" className="text-[12px] font-medium text-fg-muted underline decoration-fg/30 underline-offset-4 hover:text-fg"
                  onClick={() => onChange(lista.map(c => c.id), marcadas < lista.length)}>
                  {marcadas < lista.length ? 'Todas' : 'Ninguna'}
                </button>
              )}
            </legend>
            <ul className="flex flex-wrap gap-1.5">
              {lista.map(c => (
                <li key={c.id}>
                  {onChange ? (
                    <label className={cn('flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1 text-[12.5px] transition-colors',
                      elegidas.has(c.id) ? 'border-line-strong bg-surface text-fg' : 'border-line bg-surface-2/50 text-fg-subtle')}>
                      <input type="checkbox" checked={elegidas.has(c.id)} onChange={(e) => onChange([c.id], e.target.checked)} className="accent-[rgb(var(--c-fg))]" />
                      {c.nombre}
                    </label>
                  ) : (
                    <span className={cn('block rounded-lg px-2 py-1 text-[12.5px]', elegidas.has(c.id) ? 'bg-surface-2 text-fg' : 'text-fg-subtle line-through decoration-fg/20')}>
                      {c.nombre}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </fieldset>
        );
      })}
    </div>
  );
}

const siguienteMes = (hoy) => {
  const [a, m] = hoy.split('-').map(Number);
  return m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, '0')}-01`;
};

/** Versión nueva de las reglas: parte de la vigente; rige desde su fecha (nunca antes del último mes cerrado). */
function ReglaModal({ datos, onClose, onCreada }) {
  const baseId = useId();
  const vigente = datos.vigente;
  const [form, setForm] = useState(() => ({
    vigenteDesde: [siguienteMes(hoyLaPaz()), datos.desdeMinimo].filter(Boolean).sort().at(-1),
    base: vigente?.base || 'MONTO',
    tramos: (vigente?.tramos || [{ desde: 0, tasa: 0 }]).map(t => ({ clave: Math.random().toString(36).slice(2), desde: String(t.desde).replace('.', ','), tasa: String(t.tasa).replace('.', ',') })),
    ventaSinCosto: Boolean(vigente?.ventaSinCosto),
    categorias: new Set(vigente?.categorias || []),
    nota: '',
  }));
  const [guardando, setGuardando] = useState(false);
  const set = (cambios) => setForm(f => ({ ...f, ...cambios }));
  const setTramo = (clave, cambios) => setForm(f => ({ ...f, tramos: f.tramos.map(t => (t.clave === clave ? { ...t, ...cambios } : t)) }));
  const tramos = form.tramos.map(t => ({ desde: leerPorcentaje(t.desde), tasa: leerPorcentaje(t.tasa) }));
  const tramosValidos = tramos.every(t => t.desde !== null && t.tasa !== null);

  const guardar = async (close) => {
    if (!tramosValidos) {
      toast.error('Cada tramo necesita su margen y su tasa.');
      return;
    }
    setGuardando(true);
    try {
      await comercialApi.crearReglaComision({
        vigenteDesde: form.vigenteDesde, base: form.base, tramos, ventaSinCosto: form.ventaSinCosto,
        categorias: [...form.categorias], nota: form.nota.trim(),
      });
      toast.success(`Reglas nuevas: rigen desde el ${fecha(form.vigenteDesde)}.`);
      onCreada();
      close();
    } catch (error) {
      toast.error(error.message || 'No se pudieron guardar las reglas.');
      setGuardando(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      size="xl"
      busy={guardando}
      title="Nueva versión de las reglas"
      subtitle="Las versiones anteriores no cambian: cada mes se calcula con la que regía en la fecha de cada factura."
      footer={(close) => (
        <div className="ml-auto flex items-center gap-2">
          <CancelButton onClick={close} disabled={guardando} />
          <PrimaryButton onClick={() => guardar(close)} busy={guardando} disabled={form.nota.trim().length < 10 || !form.vigenteDesde}>Guardar la versión</PrimaryButton>
        </div>
      )}
    >
      <ModalColumns>
        <ModalSection title="Tramos" description="Desde qué margen de la línea rige cada tasa. El primero empieza en 0 %.">
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_36px] gap-2 text-[12px] font-medium text-fg-muted">
              <span>Margen desde (%)</span><span>Comisión (%)</span><span />
            </div>
            {form.tramos.map((t, i) => (
              <div key={t.clave} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_36px] items-center gap-2">
                <input aria-label={`Margen desde del tramo ${i + 1}`} inputMode="decimal" value={t.desde} onChange={(e) => setTramo(t.clave, { desde: e.target.value })}
                  className={cn('field h-9 rounded-lg text-right tabular-nums', leerPorcentaje(t.desde) === null && 'field-invalid')} />
                <input aria-label={`Comisión del tramo ${i + 1}`} inputMode="decimal" value={t.tasa} onChange={(e) => setTramo(t.clave, { tasa: e.target.value })}
                  className={cn('field h-9 rounded-lg text-right tabular-nums', leerPorcentaje(t.tasa) === null && 'field-invalid')} />
                <button type="button" aria-label={`Quitar el tramo ${i + 1}`} disabled={form.tramos.length === 1}
                  onClick={() => set({ tramos: form.tramos.filter(x => x.clave !== t.clave) })}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-fg-muted hover:bg-fg/[0.06] hover:text-danger disabled:opacity-40">
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => set({ tramos: [...form.tramos, { clave: Math.random().toString(36).slice(2), desde: '', tasa: '' }] })}
              className="flex h-9 w-max items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold text-fg-muted hover:bg-fg/[0.06] hover:text-fg">
              <Plus className="h-4 w-4" aria-hidden="true" /> Agregar tramo
            </button>
            {tramosValidos && <div className="mt-2 rounded-xl border border-line p-3"><TablaTramos tramos={tramos} /></div>}
          </div>
          <div className="mt-6">
            <BlockTitle>Categorías que comisionan</BlockTitle>
            <Categorias
              categorias={datos.categorias}
              elegidas={form.categorias}
              onChange={(ids, marcar) => setForm(f => {
                const s = new Set(f.categorias);
                ids.forEach(id => (marcar ? s.add(id) : s.delete(id)));
                return { ...f, categorias: s };
              })}
            />
          </div>
        </ModalSection>
        <ModalSection aside title="Cómo se aplica">
          <div className="flex flex-col gap-4">
            <div>
              <FieldLabel htmlFor={`${baseId}-desde`}>Rige desde</FieldLabel>
              <input id={`${baseId}-desde`} type="date" value={form.vigenteDesde} min={datos.desdeMinimo || undefined}
                onChange={(e) => set({ vigenteDesde: e.target.value })} className="field h-11 font-medium tabular-nums" />
              {datos.desdeMinimo && <p className="mt-1 text-[12px] text-fg-muted">Desde el {fecha(datos.desdeMinimo)}: los meses anteriores ya están cerrados.</p>}
            </div>
            <div>
              <FieldLabel htmlFor={`${baseId}-base`}>La tasa se aplica sobre</FieldLabel>
              <Dropdown id={`${baseId}-base`} ariaLabel="La tasa se aplica sobre" value={form.base} onChange={(base) => set({ base })}
                options={Object.entries(BASES).map(([value, label]) => ({ value, label }))} />
            </div>
            <Switch
              checked={form.ventaSinCosto}
              onChange={(ventaSinCosto) => set({ ventaSinCosto })}
              label="Una venta sin costo comisiona"
              description="Apagado (como el Excel corregido): no comisiona hasta que se cargue su costo. Encendido: comisiona como si su margen fuera el neto (84 %)."
            />
            <div>
              <FieldLabel htmlFor={`${baseId}-nota`}>Por qué cambian</FieldLabel>
              <textarea id={`${baseId}-nota`} value={form.nota} maxLength={300} onChange={(e) => set({ nota: e.target.value })}
                placeholder="Por ejemplo: Gerencia sube el tramo de 20 % a 30 % al 0,8 % desde diciembre."
                className="field min-h-[96px] resize-y py-2.5 leading-relaxed" />
              <p className="mt-1 text-[12px] text-fg-muted">Queda en el historial con tu usuario. Al menos 10 caracteres.</p>
            </div>
          </div>
        </ModalSection>
      </ModalColumns>
    </Modal>
  );
}

/**
 * Reglas de comisión: la versión que rige hoy, las anteriores y, con el
 * permiso de gestionar, una versión nueva. Se ven en Comercial para que todos
 * sepan cómo se calcula su comisión.
 */
export function ReglasComision({ onCambio }) {
  const { data, error, reload } = useResource(comercialApi.comisionesReglas);
  const [nueva, setNueva] = useState(false);
  const creada = useCallback(() => { reload(); onCambio?.(); }, [reload, onCambio]);

  if (error) return <ErrorCarga titulo="No se pudieron leer las reglas." error={error} onRetry={reload} />;
  if (!data) return <Cargando label="Cargando las reglas" filas={3} />;
  const v = data.vigente;
  const elegidas = new Set(v?.categorias || []);

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Reglas vigentes" className="card flex flex-col gap-5 p-4 shadow-card sm:p-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-[14.5px] font-semibold text-fg">Reglas que rigen hoy</h3>
            {v && <p className="mt-0.5 text-[12.5px] text-fg-muted">Desde el {fecha(v.vigenteDesde)} · {v.nota}</p>}
          </div>
          {data.puede?.gestionar && (
            <Button size="sm" variant="secondary" className="h-9" onClick={() => setNueva(true)}>
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Nueva versión
            </Button>
          )}
        </header>
        {v ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
            <div className="flex flex-col gap-3">
              <TablaTramos tramos={v.tramos} />
              <p className="text-[12.5px] text-fg-muted">
                Sobre el {BASES[v.base].toLowerCase()}. {v.ventaSinCosto ? 'Una venta sin costo comisiona como si su margen fuera el neto.' : 'Una venta sin costo no comisiona hasta que tenga costo.'}
                {' '}El margen es el de la ficha de cada factura. Cada responsable comisiona según su porcentaje en la factura.
              </p>
            </div>
            <div>
              <BlockTitle>Categorías que comisionan ({elegidas.size} de {data.categorias.length})</BlockTitle>
              <Categorias categorias={data.categorias} elegidas={elegidas} />
            </div>
          </div>
        ) : <p className="text-[13px] text-fg-muted">No hay reglas vigentes hoy.</p>}
      </section>

      <section aria-label="Versiones de las reglas" className="card overflow-hidden shadow-card">
        <h3 className="border-b border-line bg-surface-2/60 px-4 py-2.5 text-[13px] font-semibold text-fg">Versiones</h3>
        <ul className="divide-y divide-line">
          {data.reglas.map(r => (
            <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 text-[13px]">
              <span className="min-w-0">
                <span className="font-semibold text-fg">Desde el {fecha(r.vigenteDesde)}</span>
                {r.id === v?.id && <span className="ml-2 text-[12px] text-success">rige hoy</span>}
                <span className="block text-fg-muted">{r.nota}</span>
              </span>
              <span className="text-[12px] text-fg-subtle">{r.creado.nombre || r.creado.usuario} · {fechaHora(r.creado.fecha)}</span>
            </li>
          ))}
        </ul>
      </section>

      {nueva && <ReglaModal datos={data} onClose={() => setNueva(false)} onCreada={creada} />}
    </div>
  );
}
