import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Handshake, Plus, TriangleAlert, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../../shared/utils/cn';
import { Dropdown } from '../../calibration/components/Dropdown';
import { BlockTitle, CancelButton, FieldLabel, Modal, ModalColumns, ModalSection, PrimaryButton } from '../../calibration/components/primitives';
import { useResource } from '../../system/hooks/useResource';
import { comercialApi } from '../api/comercial';
import {
  REGIONALES, ROLES, bs, cuadre, facturaDesdeFormulario, formularioDesdePropuesta, hoyLaPaz, lineaVacia, opcionesCategorias, problemasFactura,
} from '../domain/comercial';
import { ClienteBuscador } from './comunes';

const formularioInicial = () => ({
  numero: '',
  fechaEmision: hoyLaPaz(),
  cliente: null,
  razonSocial: '',
  nit: '',
  monto: '',
  observacion: '',
  cotizacion: '',
  cotizacionCal: '',
  notaSalida: '',
  responsable1: '',
  responsable2: '',
  cotizo: '',
  lineas: [lineaVacia()],
  extras: null,
});

const cargarCatalogos = () => Promise.all([comercialApi.categorias(), comercialApi.personal()])
  .then(([categorias, personal]) => ({ categorias, personal }));

function MensajeError({ children }) {
  return children ? <p className="mt-1 text-[12.5px] font-medium text-danger">{children}</p> : null;
}

/** Los avisos de la propuesta que el formulario todavía no resolvió. */
const avisosPendientes = (avisos = [], form, estadoCuadre) => avisos.filter(({ codigo }) => {
  if (codigo === 'cliente') return !form.cliente;
  if (codigo === 'responsable') return !form.responsable1;
  if (codigo === 'repartir') return !estadoCuadre.cuadra;
  if (codigo === 'categorias') return !form.lineas.some(linea => linea.categoriaId);
  return true;
});

/** Lo que trae la negociación de Bitrix24 y no es un campo del formulario. */
function DesdeBitrix({ extras, avisos, onQuitarPersona }) {
  return (
    <div className="mb-5 rounded-xl bg-surface-2/60 px-3 py-2.5">
      <p className="flex items-center gap-2 text-[13px] font-semibold text-fg">
        <Handshake className="h-4 w-4 text-fg-muted" aria-hidden="true" />
        Desde la negociación #{extras.dealId} de Bitrix24
      </p>
      {avisos.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {avisos.map(aviso => (
            <li key={aviso.texto} className="flex gap-2 text-[12.5px] text-fg">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 flex-none text-warning" aria-hidden="true" />
              <span>{aviso.texto}</span>
            </li>
          ))}
        </ul>
      )}
      {extras.personas.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Técnicos de la negociación">
          {extras.personas.map((persona, index) => (
            <li key={`${persona.rol}:${persona.nombre}`} className="flex items-center gap-1 rounded-lg bg-surface px-2 py-1 text-[12px] text-fg shadow-xs">
              <span className="text-fg-muted">{ROLES[persona.rol]}:</span> {persona.nombre}
              {!persona.usuarioId && <span className="text-fg-subtle" title="No se encontró su usuario en DataMET: se guarda con el nombre de Bitrix24.">(sin usuario)</span>}
              <button type="button" onClick={() => onQuitarPersona(index)} aria-label={`Quitar a ${persona.nombre}`}
                className="ml-0.5 rounded p-0.5 text-fg-subtle hover:bg-fg/[0.06] hover:text-fg">
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Alta de una factura: número y fecha, cliente de DataMET (con su NIT), monto
 * repartido en líneas por categoría que deben sumar el monto, cotizaciones,
 * nota de salida y responsables. Se registra una vez: una corrección es
 * anular y volver a registrar. Con `propuesta` (de una negociación de
 * Bitrix24) llega con esos datos puestos y anota la negociación.
 */
export function NuevaFacturaModal({ propuesta, onClose, onCreated }) {
  const baseId = useId();
  const [form, setForm] = useState(() => (propuesta ? formularioDesdePropuesta(propuesta, formularioInicial()) : formularioInicial()));
  const [intentado, setIntentado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const { data: catalogos, error: errorCatalogos } = useResource(cargarCatalogos);
  const gestion = Number(String(form.fechaEmision).slice(0, 4)) || new Date().getFullYear();

  // Sugiere el número que sigue en la gestión; lo escribe solo si el campo está vacío.
  const [sugerido, setSugerido] = useState(null);
  useEffect(() => {
    let activo = true;
    comercialApi.siguienteNumero(gestion)
      .then((res) => {
        if (!activo) return;
        setSugerido(res.numero);
        setForm(actual => (actual.numero ? actual : { ...actual, numero: String(res.numero) }));
      })
      .catch(() => {});
    return () => { activo = false; };
  }, [gestion]);

  const set = useCallback((cambios) => setForm(actual => ({ ...actual, ...cambios })), []);
  const setLinea = (clave, cambios) => setForm(actual => ({
    ...actual, lineas: actual.lineas.map(linea => (linea.clave === clave ? { ...linea, ...cambios } : linea)),
  }));

  const opciones = useMemo(() => opcionesCategorias(catalogos?.categorias), [catalogos]);
  const personas = useMemo(() => (catalogos?.personal || [])
    .map(persona => ({ value: String(persona.id), label: persona.nombre, group: persona.area || 'Sin área' }))
    .sort((a, b) => (a.group === 'Comercial' ? -1 : b.group === 'Comercial' ? 1 : a.group.localeCompare(b.group))), [catalogos]);

  const problemas = intentado ? problemasFactura(form) : {};
  const estadoCuadre = cuadre(form.monto, form.lineas.filter(linea => linea.categoriaId || linea.monto));

  const elegirCliente = (cliente) => {
    if (!cliente) {
      set({ cliente: null });
      return;
    }
    set({ cliente, razonSocial: cliente.razonSocial || form.razonSocial, nit: cliente.nit || form.nit });
  };

  const guardar = async (close) => {
    setIntentado(true);
    if (Object.keys(problemasFactura(form)).length) {
      toast.error('Revisa los datos marcados.');
      return;
    }
    setGuardando(true);
    try {
      const factura = await comercialApi.registrarFactura(facturaDesdeFormulario(form, catalogos?.personal || []));
      toast.success(`Factura N.º ${factura.numero} registrada.`);
      onCreated?.(factura);
      close();
    } catch (error) {
      toast.error(error.message || 'No se pudo registrar la factura.');
      setGuardando(false);
    }
  };

  const unaLineaVacia = form.lineas.length === 1 && !form.lineas[0].monto;

  return (
    <Modal
      onClose={onClose}
      size="xl"
      busy={guardando}
      title="Nueva factura"
      subtitle={propuesta
        ? 'Con los datos de la negociación. Revísalos: se registra una vez y, para corregirla, se anula.'
        : 'Se registra una vez. Para corregirla, se anula y se vuelve a registrar.'}
      footer={(close) => (
        <div className="ml-auto flex items-center gap-2">
          <CancelButton onClick={close} disabled={guardando} />
          <PrimaryButton onClick={() => guardar(close)} busy={guardando} disabled={!catalogos}>Registrar factura</PrimaryButton>
        </div>
      )}
    >
      {errorCatalogos && <p className="p-5 text-[13px] text-danger">No se pudieron cargar las categorías: {errorCatalogos.message}</p>}
      <ModalColumns>
        <ModalSection title="Factura" description="Como sale en la factura emitida.">
          {form.extras && (
            <DesdeBitrix
              extras={form.extras}
              avisos={avisosPendientes(propuesta?.avisos, form, estadoCuadre)}
              onQuitarPersona={(index) => set({ extras: { ...form.extras, personas: form.extras.personas.filter((_, i) => i !== index) } })}
            />
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <FieldLabel htmlFor={`${baseId}-numero`}>N.º de factura</FieldLabel>
              <input id={`${baseId}-numero`} inputMode="numeric" value={form.numero} onChange={(e) => set({ numero: e.target.value.replace(/\D/g, '') })}
                className={cn('field h-11 font-mono tabular-nums', problemas.numero && 'field-invalid')} data-autofocus />
              <MensajeError>{problemas.numero}</MensajeError>
              {sugerido && form.numero !== String(sugerido) && (
                <button type="button" onClick={() => set({ numero: String(sugerido) })} className="mt-1 text-[12px] font-medium text-fg-muted underline underline-offset-4">
                  Sigue el {sugerido}
                </button>
              )}
            </div>
            <div>
              <FieldLabel htmlFor={`${baseId}-fecha`}>Fecha de emisión</FieldLabel>
              <input id={`${baseId}-fecha`} type="date" value={form.fechaEmision} max={hoyLaPaz()} onChange={(e) => set({ fechaEmision: e.target.value })}
                className={cn('field h-11 font-medium tabular-nums', problemas.fechaEmision && 'field-invalid')} />
              <MensajeError>{problemas.fechaEmision}</MensajeError>
            </div>
            <div>
              <FieldLabel htmlFor={`${baseId}-monto`}>Monto (Bs)</FieldLabel>
              <input id={`${baseId}-monto`} inputMode="decimal" value={form.monto} placeholder="0,00" onChange={(e) => set({ monto: e.target.value })}
                className={cn('field h-11 text-right font-semibold tabular-nums', problemas.monto && 'field-invalid')} />
              <MensajeError>{problemas.monto}</MensajeError>
            </div>
          </div>

          <div className="mt-5">
            <FieldLabel htmlFor={`${baseId}-cliente`} hint="(DataMET)">Cliente</FieldLabel>
            <ClienteBuscador id={`${baseId}-cliente`} value={form.cliente} onSelect={elegirCliente} />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <FieldLabel htmlFor={`${baseId}-razon`}>Razón social de la factura</FieldLabel>
              <input id={`${baseId}-razon`} value={form.razonSocial} maxLength={255} onChange={(e) => set({ razonSocial: e.target.value })}
                className={cn('field h-11', problemas.razonSocial && 'field-invalid')} />
              <MensajeError>{problemas.razonSocial}</MensajeError>
            </div>
            <div>
              <FieldLabel htmlFor={`${baseId}-nit`}>NIT</FieldLabel>
              <input id={`${baseId}-nit`} value={form.nit} maxLength={20} inputMode="numeric" onChange={(e) => set({ nit: e.target.value })} className="field h-11 tabular-nums" />
            </div>
          </div>

          <div className="mt-6">
            <BlockTitle>Líneas por categoría</BlockTitle>
            <div className="flex flex-col gap-2">
              {form.lineas.map((linea, index) => (
                <div key={linea.clave} className="grid grid-cols-[minmax(0,1fr)_120px] gap-2 rounded-xl border border-line p-2 sm:grid-cols-[minmax(0,1fr)_86px_120px_130px_36px] sm:items-center sm:border-0 sm:p-0">
                  <Dropdown
                    ariaLabel={`Categoría de la línea ${index + 1}`}
                    value={linea.categoriaId}
                    onChange={(categoriaId) => setLinea(linea.clave, { categoriaId })}
                    options={opciones}
                    placeholder="Categoría…"
                    size="sm"
                    menuWidth={360}
                    className="col-span-2 sm:col-span-1"
                  />
                  <input aria-label={`Cantidad de equipos de la línea ${index + 1}`} inputMode="numeric" placeholder="Cant." value={linea.cantidad}
                    onChange={(e) => setLinea(linea.clave, { cantidad: e.target.value.replace(/\D/g, '') })} className="field h-9 rounded-lg text-[13px] tabular-nums" />
                  <Dropdown
                    ariaLabel={`Regional de la línea ${index + 1}`}
                    value={linea.regional}
                    onChange={(regional) => setLinea(linea.clave, { regional })}
                    options={[{ value: '', label: 'Regional' }, ...Object.entries(REGIONALES).map(([value, label]) => ({ value, label }))]}
                    size="sm"
                  />
                  <input aria-label={`Monto de la línea ${index + 1}`} inputMode="decimal" placeholder="0,00" value={linea.monto}
                    onChange={(e) => setLinea(linea.clave, { monto: e.target.value })} className="field h-9 rounded-lg text-right text-[13px] font-semibold tabular-nums" />
                  <button
                    type="button"
                    onClick={() => setForm(actual => ({ ...actual, lineas: actual.lineas.length > 1 ? actual.lineas.filter(l => l.clave !== linea.clave) : [lineaVacia()] }))}
                    aria-label={`Quitar la línea ${index + 1}`}
                    className="flex h-9 w-9 items-center justify-center justify-self-end rounded-lg text-fg-muted hover:bg-fg/[0.06] hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => set({ lineas: [...form.lineas, lineaVacia()] })}
                className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold text-fg-muted hover:bg-fg/[0.06] hover:text-fg">
                <Plus className="h-4 w-4" aria-hidden="true" /> Agregar línea
              </button>
              {unaLineaVacia && estadoCuadre.total > 0 && (
                <button type="button" onClick={() => setLinea(form.lineas[0].clave, { monto: form.monto })}
                  className="text-[13px] font-medium text-fg-muted underline underline-offset-4 hover:text-fg">
                  Usar todo el monto en esta línea
                </button>
              )}
            </div>
            <div
              role="status"
              className={cn('mt-3 flex flex-wrap justify-between gap-2 rounded-xl px-3 py-2 text-[13px] font-semibold',
                estadoCuadre.cuadra ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning')}
            >
              <span>{estadoCuadre.cuadra ? 'Las líneas suman el monto de la factura.' : estadoCuadre.total ? `Faltan ${bs(estadoCuadre.diferencia)} por repartir.` : 'Escribe el monto de la factura.'}</span>
              <span className="tabular-nums">{bs(estadoCuadre.suma)} de {bs(estadoCuadre.total || 0)}</span>
            </div>
            <MensajeError>{problemas.lineas}</MensajeError>
          </div>
        </ModalSection>

        <ModalSection aside title="Referencias y personas" description="Para encontrarla y para las comisiones.">
          <div className="flex flex-col gap-4">
            <div>
              <FieldLabel htmlFor={`${baseId}-cot`}>Cotización</FieldLabel>
              <input id={`${baseId}-cot`} value={form.cotizacion} placeholder="0114-S01-1-26" onChange={(e) => set({ cotizacion: e.target.value })} className="field h-11 font-mono uppercase" />
            </div>
            <div>
              <FieldLabel htmlFor={`${baseId}-cotcal`} hint="(si es otra)">Cotización de calibración</FieldLabel>
              <input id={`${baseId}-cotcal`} value={form.cotizacionCal} placeholder="0114-C04-26 1" onChange={(e) => set({ cotizacionCal: e.target.value })} className="field h-11 font-mono uppercase" />
            </div>
            <div>
              <FieldLabel htmlFor={`${baseId}-ns`} hint="(ventas)">Nota de salida</FieldLabel>
              <input id={`${baseId}-ns`} value={form.notaSalida} placeholder="NS-4401-2026" onChange={(e) => set({ notaSalida: e.target.value })} className="field h-11 font-mono uppercase" />
            </div>
            <div>
              <FieldLabel htmlFor={`${baseId}-resp1`}>Responsable comercial</FieldLabel>
              <Dropdown id={`${baseId}-resp1`} ariaLabel="Responsable comercial" value={form.responsable1} onChange={(responsable1) => set({ responsable1 })}
                options={[{ value: '', label: 'Sin responsable' }, ...personas]} menuWidth={320} />
            </div>
            <div>
              <FieldLabel htmlFor={`${baseId}-resp2`} hint="(reparten 50 / 50)">Segundo responsable</FieldLabel>
              <Dropdown id={`${baseId}-resp2`} ariaLabel="Segundo responsable" value={form.responsable2} onChange={(responsable2) => set({ responsable2 })}
                disabled={!form.responsable1}
                options={[{ value: '', label: 'Ninguno' }, ...personas.filter(p => p.value !== form.responsable1)]} menuWidth={320} />
            </div>
            <div>
              <FieldLabel htmlFor={`${baseId}-cotizo`}>Elaboró la cotización</FieldLabel>
              <Dropdown id={`${baseId}-cotizo`} ariaLabel="Elaboró la cotización" value={form.cotizo} onChange={(cotizo) => set({ cotizo })}
                options={[{ value: '', label: 'No registrar' }, ...personas]} menuWidth={320} />
            </div>
            <div>
              <FieldLabel htmlFor={`${baseId}-obs`} hint="(opcional)">Observación</FieldLabel>
              <textarea id={`${baseId}-obs`} value={form.observacion} maxLength={1000} onChange={(e) => set({ observacion: e.target.value })}
                className="field min-h-[80px] resize-y py-2.5 leading-relaxed" />
            </div>
          </div>
        </ModalSection>
      </ModalColumns>
    </Modal>
  );
}
