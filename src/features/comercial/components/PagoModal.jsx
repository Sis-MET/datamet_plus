import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Loader2, Plus, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../../shared/utils/cn';
import { Dropdown } from '../../calibration/components/Dropdown';
import { BlockTitle, CancelButton, FieldLabel, Modal, ModalSection, PrimaryButton } from '../../calibration/components/primitives';
import { comercialApi } from '../api/comercial';
import { MEDIOS, bs, centavos, fecha, hoyLaPaz, leerMonto, repartirPago } from '../domain/comercial';

const aplicacionDe = (factura, monto) => ({
  factura: { id: factura.id, numero: factura.numero, razonSocial: factura.razonSocial, saldo: factura.saldo, fechaEmision: factura.fechaEmision },
  monto: monto ? String(monto).replace('.', ',') : '',
});

/** Busca facturas con saldo por número o cliente, para aplicarles el pago. */
function BuscarPendientes({ excluir, onAdd }) {
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const ultimo = useRef('');

  // Con menos de dos letras no se busca ni se muestra la lista.
  useEffect(() => {
    const q = texto.trim();
    if (q.length < 2) return undefined;
    const timer = setTimeout(() => {
      ultimo.current = q;
      setBuscando(true);
      comercialApi.cobranza({ q })
        .then((res) => { if (ultimo.current === q) setResultados(res.facturas.slice(0, 12)); })
        .catch(() => { if (ultimo.current === q) setResultados([]); })
        .finally(() => { if (ultimo.current === q) setBuscando(false); });
    }, 300);
    return () => clearTimeout(timer);
  }, [texto]);

  const visibles = resultados.filter(f => !excluir.includes(f.id));
  return (
    <div>
      <div className="flex h-10 items-center gap-2 rounded-xl border border-line-strong bg-surface px-3 focus-within:border-focus focus-within:ring-4 focus-within:ring-focus/15">
        <Search className="h-4 w-4 flex-none text-fg-subtle" aria-hidden="true" />
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Agregar factura: número o cliente"
          aria-label="Buscar facturas con saldo" className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-fg-subtle" />
        {buscando && <Loader2 className="h-4 w-4 animate-spin text-fg-subtle" aria-hidden="true" />}
      </div>
      {texto.trim().length >= 2 && !buscando && (
        <ul className="mt-2 flex flex-col gap-1">
          {visibles.length === 0 && <li className="px-1 text-[13px] text-fg-muted">Ninguna factura con saldo coincide.</li>}
          {visibles.map(factura => (
            <li key={factura.id}>
              <button type="button" onClick={() => { onAdd(factura); setTexto(''); }}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-fg/[0.05]">
                <Plus className="h-4 w-4 flex-none text-fg-muted" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-[13px] text-fg">N.º {factura.numero} · {factura.razonSocial}</span>
                <span className="text-[12.5px] tabular-nums text-fg-muted">saldo {bs(factura.saldo)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Registrar un pago: fecha, monto, medio y verificación, aplicado a una o
 * varias facturas sin pasar su saldo. Lo que no se aplica queda como saldo
 * del pago (anticipo) para aplicarlo después.
 */
export function PagoModal({ facturasIniciales = [], onClose, onCreated }) {
  const baseId = useId();
  const total = facturasIniciales.reduce((s, f) => s + centavos(f.saldo), 0) / 100;
  const [form, setForm] = useState({
    fecha: hoyLaPaz(),
    monto: total ? String(total).replace('.', ',') : '',
    medio: 'DEPOSITO',
    referencia: '',
    verificacion: '',
    observacion: '',
  });
  const [aplicaciones, setAplicaciones] = useState(() => facturasIniciales.map(f => aplicacionDe(f, f.saldo)));
  const [guardando, setGuardando] = useState(false);
  const set = (cambios) => setForm(actual => ({ ...actual, ...cambios }));

  const monto = leerMonto(form.monto);
  const aplicado = aplicaciones.reduce((s, a) => s + centavos(leerMonto(a.monto)), 0) / 100;
  const sinAplicar = (centavos(monto) - centavos(aplicado)) / 100;
  const problemas = useMemo(() => {
    const lista = [];
    if (!(monto > 0)) lista.push('Escribe el monto del pago.');
    if (sinAplicar < 0) lista.push(`Se aplican ${bs(aplicado)} y el pago es de ${bs(monto)}.`);
    for (const a of aplicaciones) {
      const valor = leerMonto(a.monto);
      if (!(valor > 0)) lista.push(`Escribe cuánto va a la factura N.º ${a.factura.numero} o quítala.`);
      else if (centavos(valor) > centavos(a.factura.saldo)) lista.push(`A la factura N.º ${a.factura.numero} le quedan ${bs(a.factura.saldo)}.`);
    }
    return lista;
  }, [aplicaciones, aplicado, monto, sinAplicar]);

  const repartir = () => {
    const reparto = repartirPago(form.monto, aplicaciones.map(a => a.factura));
    setAplicaciones(actual => actual.map((a, i) => ({ ...a, monto: reparto[i].monto ? String(reparto[i].monto).replace('.', ',') : '' })));
  };

  const guardar = async (close) => {
    if (problemas.length) {
      toast.error(problemas[0]);
      return;
    }
    setGuardando(true);
    try {
      const pago = await comercialApi.registrarPago({
        fecha: form.fecha,
        monto,
        medio: form.medio,
        referencia: form.referencia.trim() || null,
        verificacion: form.verificacion.trim() || null,
        observacion: form.observacion.trim() || null,
        aplicaciones: aplicaciones.map(a => ({ facturaId: a.factura.id, monto: leerMonto(a.monto) })),
      });
      onCreated?.(pago);
      close();
    } catch (error) {
      toast.error(error.message || 'No se pudo registrar el pago.');
      setGuardando(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      size="md"
      busy={guardando}
      title="Registrar pago"
      subtitle="Un pago se registra una vez y se aplica a una o varias facturas."
      footer={(close) => (
        <div className="ml-auto flex items-center gap-2">
          <CancelButton onClick={close} disabled={guardando} />
          <PrimaryButton onClick={() => guardar(close)} busy={guardando}>Registrar pago</PrimaryButton>
        </div>
      )}
    >
      <ModalSection title="Pago">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <FieldLabel htmlFor={`${baseId}-fecha`}>Fecha</FieldLabel>
            <input id={`${baseId}-fecha`} type="date" value={form.fecha} max={hoyLaPaz()} onChange={(e) => set({ fecha: e.target.value })} className="field h-11 font-medium tabular-nums" />
          </div>
          <div>
            <FieldLabel htmlFor={`${baseId}-monto`}>Monto (Bs)</FieldLabel>
            <input id={`${baseId}-monto`} inputMode="decimal" value={form.monto} onChange={(e) => set({ monto: e.target.value })} className="field h-11 text-right font-semibold tabular-nums" data-autofocus />
          </div>
          <div>
            <FieldLabel htmlFor={`${baseId}-medio`}>Medio</FieldLabel>
            <Dropdown id={`${baseId}-medio`} ariaLabel="Medio de pago" value={form.medio} onChange={(medio) => set({ medio })}
              options={Object.entries(MEDIOS).map(([value, label]) => ({ value, label }))} />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel htmlFor={`${baseId}-ref`} hint="(opcional)">Referencia</FieldLabel>
            <input id={`${baseId}-ref`} value={form.referencia} maxLength={120} placeholder="N.º de depósito, banco…" onChange={(e) => set({ referencia: e.target.value })} className="field h-11" />
          </div>
          <div>
            <FieldLabel htmlFor={`${baseId}-ver`} hint="(opcional)">Verificado con</FieldLabel>
            <input id={`${baseId}-ver`} value={form.verificacion} maxLength={120} placeholder="Extracto nov 2026" onChange={(e) => set({ verificacion: e.target.value })} className="field h-11" />
          </div>
        </div>

        <div className="mt-6">
          <BlockTitle>Facturas que paga</BlockTitle>
          {aplicaciones.length > 0 && (
            <ul className="mb-3 flex flex-col gap-2">
              {aplicaciones.map((a, index) => (
                <li key={a.factura.id} className="grid grid-cols-[minmax(0,1fr)_130px_36px] items-center gap-2 rounded-xl border border-line px-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-fg">N.º {a.factura.numero} · {a.factura.razonSocial}</span>
                    <span className="block text-[12px] text-fg-muted">{fecha(a.factura.fechaEmision)} · saldo {bs(a.factura.saldo)}</span>
                  </span>
                  <input aria-label={`Monto aplicado a la factura N.º ${a.factura.numero}`} inputMode="decimal" value={a.monto}
                    onChange={(e) => setAplicaciones(actual => actual.map((x, i) => (i === index ? { ...x, monto: e.target.value } : x)))}
                    className="field h-9 rounded-lg text-right text-[13px] font-semibold tabular-nums" />
                  <button type="button" aria-label={`Quitar la factura N.º ${a.factura.numero}`} onClick={() => setAplicaciones(actual => actual.filter((_, i) => i !== index))}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-fg-muted hover:bg-fg/[0.06] hover:text-fg">
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <BuscarPendientes excluir={aplicaciones.map(a => a.factura.id)} onAdd={(factura) => setAplicaciones(actual => [...actual, aplicacionDe(factura, '')])} />
          {aplicaciones.length > 1 && (
            <button type="button" onClick={repartir} className="mt-2 text-[13px] font-medium text-fg-muted underline underline-offset-4 hover:text-fg">
              Repartir el monto en orden
            </button>
          )}
          <div role="status" className={cn('mt-4 flex flex-wrap justify-between gap-2 rounded-xl px-3 py-2 text-[13px] font-semibold',
            sinAplicar < 0 ? 'bg-danger/10 text-danger' : sinAplicar > 0 ? 'bg-info/10 text-info' : 'bg-success/10 text-success')}>
            <span>
              {sinAplicar < 0 ? 'Se aplica más de lo que se pagó.' : sinAplicar > 0 ? `Quedan ${bs(sinAplicar)} sin aplicar (anticipo).` : 'Todo el pago queda aplicado.'}
            </span>
            <span className="tabular-nums">{bs(aplicado)} aplicados</span>
          </div>
        </div>

        <div className="mt-5">
          <FieldLabel htmlFor={`${baseId}-obs`} hint="(opcional)">Observación</FieldLabel>
          <textarea id={`${baseId}-obs`} value={form.observacion} maxLength={1000} onChange={(e) => set({ observacion: e.target.value })} className="field min-h-[72px] resize-y py-2.5" />
        </div>
      </ModalSection>
    </Modal>
  );
}
