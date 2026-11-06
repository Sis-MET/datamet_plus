import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Info, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../../shared/utils/cn';
import { calibrationApi } from '../api/calibration';
import { formatDate } from '../domain/format';
import {
  CLASES_R111,
  MAGNITUDES,
  ORIGENES_DENSIDAD,
  TIPOS_PATRON,
  UNIDADES_MASA,
  VERIFICACION,
  esPegadoMultiple,
  formatNumber,
  parseNominalText,
  parseNumber,
  parsePegado,
  pegarEnFilas,
  piezaKey,
  piezaLabel,
  splitNominal,
  toMg,
} from '../domain/patrones';
import { Dropdown } from './Dropdown';
import { CancelButton, FieldLabel, Modal, ModalSection, PrimaryButton, Segmented, ToneBadge } from './primitives';

// ─── Estado editable ────────────────────────────────────────────────────────

let secuencia = 0;
const nuevaClave = () => `n${(secuencia += 1)}`;
const texto = (value) => formatNumber(value);

const filaPieza = (pieza) => {
  const { valor, unidad } = splitNominal(pieza.nominalMg);
  return {
    key: `p${pieza.id}`,
    id: pieza.id,
    nominal: formatNumber(valor),
    unidad,
    identificacion: pieza.identificacion || '',
    material: pieza.material || '',
    densidad: texto(pieza.densidad),
    densidadU: texto(pieza.densidadU),
    densidadK: texto(pieza.densidadK),
    densidadOrigen: pieza.densidadOrigen || '',
    activa: pieza.activa,
  };
};

const piezaVacia = (unidad = 'g', material = '') => ({
  key: nuevaClave(),
  id: null,
  nominal: '',
  unidad,
  identificacion: '',
  material,
  densidad: '',
  densidadU: '',
  densidadK: '',
  densidadOrigen: '',
  activa: true,
});

const valorVacio = () => ({ correccion: '', u: '', k: '', documento: '', conforme: '' });

const filaPunto = (magnitud, punto = null) => ({
  key: nuevaClave(),
  magnitud,
  punto: texto(punto?.punto),
  correccion: texto(punto?.correccion),
  u: texto(punto?.u),
  k: texto(punto?.k),
  documento: punto?.documento || '',
});

const estadoInicial = (data) => {
  const valores = {};
  for (const valor of data.valores) {
    valores[`p${valor.piezaId}`] = {
      correccion: texto(valor.correccionMg),
      u: texto(valor.uMg),
      k: texto(valor.k),
      documento: valor.documento || '',
      conforme: valor.conforme === true ? 'SI' : valor.conforme === false ? 'NO' : '',
    };
  }
  return {
    tipo: data.patron.tipo || 'PESAS',
    clase: data.patron.clase || '',
    piezas: data.piezas.map(filaPieza),
    valores,
    puntos: data.puntos.map(punto => filaPunto(punto.magnitud, punto)),
    condiciones: {
      temperatura: texto(data.transcripcion?.temperatura),
      humedad: texto(data.transcripcion?.humedad),
      presion: texto(data.transcripcion?.presion),
      observaciones: data.transcripcion?.observaciones || '',
    },
  };
};

/** Arma lo que se envía al servidor y junta los errores de lo escrito. */
const armarEnvio = (form, data) => {
  const errores = [];
  const numero = (valor, etiqueta, requerido = false) => {
    const n = parseNumber(valor);
    if (n === null) {
      if (requerido) errores.push(`${etiqueta}: falta el valor.`);
      return null;
    }
    if (Number.isNaN(n)) {
      errores.push(`${etiqueta}: «${valor}» no es un número.`);
      return null;
    }
    return n;
  };

  const body = { tipo: form.tipo, clase: form.tipo === 'PESAS' ? form.clase || null : null };
  let piezas = [];
  if (form.tipo === 'PESAS') {
    piezas = form.piezas
      .filter(fila => fila.id || fila.nominal.trim())
      .map((fila) => {
        const valor = numero(fila.nominal, `Pieza «${fila.nominal || 'sin valor'}»`, true);
        return {
          key: fila.key,
          id: fila.id,
          nominalMg: valor == null ? null : toMg(valor, fila.unidad),
          identificacion: fila.identificacion.trim(),
          material: fila.material.trim() || null,
          densidad: numero(fila.densidad, `Densidad de ${fila.nominal} ${fila.unidad}`),
          densidadU: numero(fila.densidadU, `U de la densidad de ${fila.nominal} ${fila.unidad}`),
          densidadK: numero(fila.densidadK, `k de la densidad de ${fila.nominal} ${fila.unidad}`),
          densidadOrigen: fila.densidadOrigen || null,
          activa: fila.activa,
        };
      });
    body.piezas = piezas.map(({ key: _key, ...pieza }) => pieza);
  }

  if (data.certificado) {
    const certificado = {
      version: data.transcripcion?.version ?? null,
      temperatura: numero(form.condiciones.temperatura, 'Temperatura'),
      humedad: numero(form.condiciones.humedad, 'Humedad'),
      presion: numero(form.condiciones.presion, 'Presión'),
      observaciones: form.condiciones.observaciones.trim() || null,
      valores: [],
      puntos: [],
    };
    if (form.tipo === 'PESAS') {
      for (const pieza of piezas.filter(item => item.activa && item.nominalMg)) {
        const valor = form.valores[pieza.key];
        if (!valor || ![valor.correccion, valor.u, valor.k, valor.documento].some(item => String(item).trim())) continue;
        const etiqueta = piezaLabel(pieza);
        certificado.valores.push({
          nominalMg: pieza.nominalMg,
          identificacion: pieza.identificacion,
          documento: valor.documento.trim() || null,
          correccionMg: numero(valor.correccion, `${etiqueta}, corrección`, true),
          uMg: numero(valor.u, `${etiqueta}, U`, true),
          k: numero(valor.k, `${etiqueta}, k`, true),
          conforme: valor.conforme === 'SI' ? true : valor.conforme === 'NO' ? false : null,
        });
      }
    } else {
      certificado.puntos = form.puntos
        .filter(fila => [fila.punto, fila.correccion, fila.u, fila.k].some(item => String(item).trim()))
        .map((fila) => {
          const etiqueta = `${MAGNITUDES.find(m => m.id === fila.magnitud)?.label} ${fila.punto || ''}`.trim();
          return {
            magnitud: fila.magnitud,
            documento: fila.documento.trim() || null,
            punto: numero(fila.punto, `${etiqueta}, punto`, true),
            correccion: numero(fila.correccion, `${etiqueta}, corrección`, true),
            u: numero(fila.u, `${etiqueta}, U`, true),
            k: numero(fila.k, `${etiqueta}, k`, true),
          };
        });
    }
    body.certificado = certificado;
  }
  return { body, errores };
};

// ─── Celdas ────────────────────────────────────────────────────────────────

const celda = 'field h-9 rounded-lg px-2.5 text-[13px] tabular-nums';
const encabezado = 'whitespace-nowrap px-2 py-2 text-left text-[11.5px] font-semibold uppercase tracking-[0.04em] text-fg-muted';

function Celda({ value, onChange, onPaste, disabled, label, numeric = true, className }) {
  return (
    <input
      type="text"
      inputMode={numeric ? 'decimal' : 'text'}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onPaste={onPaste}
      disabled={disabled}
      aria-label={label}
      className={cn(celda, numeric && 'text-right', Number.isNaN(parseNumber(value)) && numeric && 'field-invalid', className)}
    />
  );
}

/** Lista desplegable del módulo, a la altura de las celdas. */
function Selector({ value, onChange, options, disabled, label, className }) {
  return (
    <Dropdown
      value={value}
      onChange={onChange}
      options={options}
      ariaLabel={label}
      disabled={disabled}
      size="sm"
      maxHeight={200}
      className={className}
    />
  );
}

function Tabla({ children, minWidth = 640 }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-xs">
      <table className="w-full border-collapse text-sm" style={{ minWidth }}>{children}</table>
    </div>
  );
}

function Nota({ children, tone = 'info' }) {
  const Icon = tone === 'aviso' ? AlertTriangle : Info;
  return (
    <p className={cn(
      'flex gap-2.5 rounded-xl border px-3.5 py-3 text-[12.5px] leading-relaxed',
      tone === 'aviso' ? 'border-warning/35 bg-warning/[0.06] text-fg' : 'border-line bg-surface text-fg-muted'
    )}
    >
      <Icon className={cn('mt-0.5 h-4 w-4 flex-none', tone === 'aviso' ? 'text-warning' : 'text-fg-subtle')} aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

const botonSecundario = 'inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-line-strong bg-surface px-3 text-[13px] font-semibold text-fg shadow-xs transition-colors hover:border-fg/25 hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50';

const COLUMNAS_PIEZA = ['nominal', 'identificacion', 'material', 'densidad', 'densidadU', 'densidadK', 'densidadOrigen'];
const COLUMNAS_VALOR = ['correccion', 'u', 'k', 'documento'];
const COLUMNAS_PUNTO = ['punto', 'correccion', 'u', 'k', 'documento'];

const asignarPieza = (fila, campo, valor) => {
  if (campo === 'nominal') {
    const nominal = parseNominalText(valor, fila.unidad);
    return nominal ? { ...fila, nominal: nominal.valor, unidad: nominal.unidad } : { ...fila, nominal: valor };
  }
  if (campo === 'densidadOrigen') {
    const normal = valor.toLowerCase();
    return { ...fila, densidadOrigen: normal.startsWith('med') ? 'MEDIDA' : normal.startsWith('sup') ? 'SUPUESTA' : '' };
  }
  return { ...fila, [campo]: valor };
};

// ─── Ficha ─────────────────────────────────────────────────────────────────

/**
 * Patrón de un equipo: si es un juego de pesas o un instrumento de
 * condiciones ambientales, sus piezas y los valores de su certificado
 * vigente, que usará el cálculo de los certificados de balanzas.
 */
export function PatronModal({ equipo, canEdit, desdeCertificado = false, onClose, onSaved }) {
  const baseId = useId();
  const valoresRef = useRef(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [observacion, setObservacion] = useState('');

  const cargar = useCallback(async () => {
    try {
      const respuesta = await calibrationApi.patron(equipo.id);
      setData(respuesta);
      setForm(estadoInicial(respuesta));
      setMotivo('');
      setError(null);
    } catch (err) {
      setError(err.message || 'No se pudo cargar el patrón.');
    }
  }, [equipo.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Al llegar desde «Registrar certificado nuevo», directo a los valores.
  const cargado = Boolean(data);
  useEffect(() => {
    if (cargado && desdeCertificado) valoresRef.current?.scrollIntoView({ block: 'start' });
  }, [cargado, desdeCertificado]);

  const editable = canEdit && data?.equipo.estado === 'ACTIVO';
  const disabled = !editable || saving;

  const inicial = useMemo(() => (data ? JSON.stringify(armarEnvio(estadoInicial(data), data).body) : null), [data]);
  const envio = useMemo(() => (form && data ? armarEnvio(form, data) : null), [form, data]);
  const actual = envio ? JSON.stringify(envio.body) : null;
  // Sin configuración guardada, lo sugerido también se registra al guardar.
  const dirty = Boolean(data && !data.patron.configurado) || Boolean(inicial && actual && inicial !== actual);
  const certificadoCambio = Boolean(envio && data?.transcripcion
    && JSON.stringify(envio.body.certificado) !== JSON.stringify(armarEnvio(estadoInicial(data), data).body.certificado));

  const avisosPorPieza = useMemo(() => {
    const mapa = new Map();
    for (const aviso of data?.avisos || []) {
      if (!aviso.pieza) continue;
      mapa.set(aviso.pieza, [...(mapa.get(aviso.pieza) || []), aviso]);
    }
    return mapa;
  }, [data]);

  if (!data || !form) {
    return (
      <Modal onClose={onClose} title={`Patrón ${equipo.codigo}`} subtitle={equipo.instrumento} size="xl">
        <div className="px-6 py-10 text-sm text-fg-muted">
          {error ? (
            <span className="text-danger">{error}</span>
          ) : 'Cargando…'}
        </div>
      </Modal>
    );
  }

  const set = (patch) => setForm(current => ({ ...current, ...patch }));
  const setPieza = (key, patch) => set({ piezas: form.piezas.map(fila => (fila.key === key ? { ...fila, ...patch } : fila)) });
  const setValor = (key, patch) => set({ valores: { ...form.valores, [key]: { ...(form.valores[key] || valorVacio()), ...patch } } });
  const setPunto = (key, patch) => set({ puntos: form.puntos.map(fila => (fila.key === key ? { ...fila, ...patch } : fila)) });
  const ultimaUnidad = form.piezas[form.piezas.length - 1]?.unidad || 'g';
  const materialComun = form.piezas.find(fila => fila.material)?.material || '';

  const pegarPieza = (indice, campo) => (event) => {
    const contenido = event.clipboardData.getData('text/plain');
    if (!esPegadoMultiple(contenido)) return;
    event.preventDefault();
    setForm(current => ({
      ...current,
      piezas: pegarEnFilas({
        filas: current.piezas,
        fila: indice,
        columna: campo,
        celdas: parsePegado(contenido),
        columnas: COLUMNAS_PIEZA,
        nuevaFila: () => piezaVacia(ultimaUnidad, materialComun),
        asignar: asignarPieza,
      }),
    }));
  };

  const piezasActivas = form.piezas.filter(fila => fila.activa && fila.nominal.trim());
  const pegarValor = (indice, campo) => (event) => {
    const contenido = event.clipboardData.getData('text/plain');
    if (!esPegadoMultiple(contenido)) return;
    event.preventDefault();
    setForm((current) => {
      const filas = piezasActivas.map(fila => ({ key: fila.key, ...(current.valores[fila.key] || valorVacio()) }));
      const pegadas = pegarEnFilas({ filas, fila: indice, columna: campo, celdas: parsePegado(contenido), columnas: COLUMNAS_VALOR });
      const valores = { ...current.valores };
      for (const { key, ...valor } of pegadas) valores[key] = valor;
      return { ...current, valores };
    });
  };

  const pegarPunto = (magnitud, indice, campo) => (event) => {
    const contenido = event.clipboardData.getData('text/plain');
    if (!esPegadoMultiple(contenido)) return;
    event.preventDefault();
    setForm((current) => {
      const propias = current.puntos.filter(fila => fila.magnitud === magnitud);
      const otras = current.puntos.filter(fila => fila.magnitud !== magnitud);
      const pegadas = pegarEnFilas({
        filas: propias,
        fila: indice,
        columna: campo,
        celdas: parsePegado(contenido),
        columnas: COLUMNAS_PUNTO,
        nuevaFila: () => filaPunto(magnitud),
      });
      return { ...current, puntos: [...otras, ...pegadas] };
    });
  };

  const guardar = async () => {
    if (envio.errores.length > 0) {
      toast.error(envio.errores[0]);
      return;
    }
    if (form.tipo === 'PESAS' && !form.clase) {
      toast.error('Elige la clase del juego de pesas.');
      return;
    }
    if (certificadoCambio && motivo.trim().length < 3) {
      toast.error('Escribe el motivo del cambio: los valores de este certificado ya estaban transcritos.');
      return;
    }
    setSaving(true);
    try {
      const result = await calibrationApi.savePatron(equipo.id, { ...envio.body, motivo: motivo.trim() || null });
      toast.success(result?.cambios ? `Patrón ${equipo.codigo} guardado` : 'No había cambios que guardar');
      await cargar();
      onSaved();
    } catch (err) {
      toast.error(err.message || 'No se pudo guardar el patrón.');
    } finally {
      setSaving(false);
    }
  };

  const verificar = async () => {
    setSaving(true);
    try {
      await calibrationApi.revisarCertificado(equipo.id, { observaciones: observacion.trim() || null });
      toast.success(`Certificado y valores de ${equipo.codigo} verificados`);
      setVerificando(false);
      setObservacion('');
      await cargar();
      onSaved();
    } catch (err) {
      toast.error(err.message || 'No se pudo registrar la verificación.');
    } finally {
      setSaving(false);
    }
  };

  const verificacion = data.verificacion;
  const estadoVerificacion = verificacion ? VERIFICACION[verificacion.estado] : null;
  const avisosGenerales = (data.avisos || []).filter(aviso => !aviso.pieza);
  const avisosPiezas = (data.avisos || []).filter(aviso => aviso.pieza && aviso.tipo !== 'info');

  return (
    <Modal
      onClose={onClose}
      size="xl"
      busy={saving}
      title={`Patrón ${data.equipo.codigo}`}
      subtitle={(
        <>
          <span className="font-medium text-fg">{data.equipo.instrumento}</span>
          <span aria-hidden="true" className="px-1.5 text-fg-subtle">·</span>
          <span>{data.equipo.planta}</span>
        </>
      )}
      footer={(close) => (
        <div className="ml-auto flex items-center gap-2">
          <CancelButton onClick={close} disabled={saving}>Cerrar</CancelButton>
          {editable && (
            <PrimaryButton onClick={guardar} busy={saving} disabled={!dirty}>Guardar</PrimaryButton>
          )}
        </div>
      )}
    >
      <div className="divide-y divide-line">
        <ModalSection
          title="Tipo de patrón"
          description="Lo que el cálculo de los certificados de balanzas toma de este equipo."
        >
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[260px] flex-1">
              <p className="field-label">Tipo</p>
              <Segmented
                label="Tipo de patrón"
                value={form.tipo}
                onChange={(tipo) => set({ tipo })}
                options={TIPOS_PATRON}
                disabled={disabled}
                className="cal-segmented-fill h-11"
              />
            </div>
            {form.tipo === 'PESAS' && (
              <div className="w-44">
                <FieldLabel htmlFor={`${baseId}-clase`}>Clase OIML R111</FieldLabel>
                <Dropdown
                  id={`${baseId}-clase`}
                  value={form.clase}
                  onChange={(clase) => set({ clase })}
                  options={CLASES_R111.map(clase => ({ value: clase, label: clase }))}
                  placeholder="Elegir"
                  ariaLabel="Clase OIML R111"
                  disabled={disabled}
                />
              </div>
            )}
          </div>
          {!data.patron.configurado && (
            <p className="cal-hint mt-3">
              Sugerido por el nombre y el código del equipo. Se registra al guardar.
            </p>
          )}
        </ModalSection>

        {form.tipo === 'PESAS' && (
          <ModalSection
            title="Piezas del juego"
            description="Valor nominal, identificación de los duplicados («*», «**») y densidad. Puedes pegar varias filas copiadas de Excel."
            action={editable && (
              <button type="button" className={botonSecundario} disabled={disabled} onClick={() => set({ piezas: [...form.piezas, piezaVacia(ultimaUnidad, materialComun)] })}>
                <Plus className="h-4 w-4" aria-hidden="true" /> Agregar pieza
              </button>
            )}
          >
            {form.piezas.length === 0 ? (
              <Nota>
                Aún no hay piezas. Agrega la primera o pega la lista de valores nominales desde Excel en la primera celda.
              </Nota>
            ) : (
              <Tabla minWidth={860}>
                <thead className="bg-surface-2/60">
                  <tr>
                    <th className={encabezado}>Valor nominal</th>
                    <th className={encabezado}>Identif.</th>
                    <th className={encabezado}>Material</th>
                    <th className={encabezado}>Densidad (kg/m³)</th>
                    <th className={encabezado}>U densidad</th>
                    <th className={encabezado}>k</th>
                    <th className={encabezado}>Origen</th>
                    <th className={encabezado}>Activa</th>
                    <th className={encabezado}><span className="sr-only">Quitar</span></th>
                  </tr>
                </thead>
                <tbody>
                  {form.piezas.map((fila, indice) => (
                    <tr key={fila.key} className={cn('border-t border-line', !fila.activa && 'opacity-55')}>
                      <td className="px-2 py-1.5">
                        <div className="flex gap-1">
                          <Celda value={fila.nominal} onChange={(nominal) => setPieza(fila.key, { nominal })} onPaste={pegarPieza(indice, 'nominal')} disabled={disabled} label="Valor nominal" className="w-20" />
                          <Selector value={fila.unidad} onChange={(unidad) => setPieza(fila.key, { unidad })} options={Object.keys(UNIDADES_MASA).map(u => ({ value: u, label: u }))} disabled={disabled} label="Unidad" className="w-[4.75rem]" />
                        </div>
                      </td>
                      <td className="px-2 py-1.5"><Celda numeric={false} value={fila.identificacion} onChange={(identificacion) => setPieza(fila.key, { identificacion })} onPaste={pegarPieza(indice, 'identificacion')} disabled={disabled} label="Identificación" className="w-16" /></td>
                      <td className="px-2 py-1.5"><Celda numeric={false} value={fila.material} onChange={(material) => setPieza(fila.key, { material })} onPaste={pegarPieza(indice, 'material')} disabled={disabled} label="Material" className="w-36" /></td>
                      <td className="px-2 py-1.5"><Celda value={fila.densidad} onChange={(densidad) => setPieza(fila.key, { densidad })} onPaste={pegarPieza(indice, 'densidad')} disabled={disabled} label="Densidad" className="w-24" /></td>
                      <td className="px-2 py-1.5"><Celda value={fila.densidadU} onChange={(densidadU) => setPieza(fila.key, { densidadU })} onPaste={pegarPieza(indice, 'densidadU')} disabled={disabled} label="U de la densidad" className="w-20" /></td>
                      <td className="px-2 py-1.5"><Celda value={fila.densidadK} onChange={(densidadK) => setPieza(fila.key, { densidadK })} onPaste={pegarPieza(indice, 'densidadK')} disabled={disabled} label="k de la densidad" className="w-14" /></td>
                      <td className="px-2 py-1.5"><Selector value={fila.densidadOrigen} onChange={(densidadOrigen) => setPieza(fila.key, { densidadOrigen })} options={ORIGENES_DENSIDAD} disabled={disabled} label="Origen de la densidad" className="w-28" /></td>
                      <td className="px-2 py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={fila.activa}
                          onChange={(event) => setPieza(fila.key, { activa: event.target.checked })}
                          disabled={disabled}
                          aria-label="Pieza activa"
                          className="h-4 w-4 accent-[rgb(var(--c-accent))]"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {!fila.id && editable && (
                          <button
                            type="button"
                            onClick={() => set({ piezas: form.piezas.filter(item => item.key !== fila.key) })}
                            aria-label="Quitar pieza nueva"
                            title="Quitar pieza nueva"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted hover:bg-fg/[0.06] hover:text-danger"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Tabla>
            )}
            <p className="cal-hint mt-3">
              Las piezas guardadas no se borran: se desactivan. Sin densidad, el cálculo usará la supuesta por material (OIML R111, Tabla B.7).
            </p>
          </ModalSection>
        )}

        <ModalSection
          title="Valores del certificado vigente"
          description={data.certificado
            ? `${data.certificado.numero || 'Sin número'} · emitido el ${formatDate(data.certificado.fecha)} · vence el ${formatDate(data.certificado.vence)}`
            : 'El equipo no tiene certificado vigente.'}
          action={estadoVerificacion && <ToneBadge tone={estadoVerificacion.tone}>{estadoVerificacion.label}</ToneBadge>}
        >
          <div ref={valoresRef} className="scroll-mt-4" />
          {!data.certificado ? (
            <Nota>Registra el certificado vigente del equipo para transcribir sus valores.</Nota>
          ) : (
            <div className="space-y-5">
              {desdeCertificado && !data.transcripcion && (
                <Nota tone="aviso">
                  Certificado {data.certificado.numero} registrado. Transcribe ahora sus valores
                  {data.patron.tipo === 'AMBIENTE' ? ' por punto' : ' por pieza'}: el cálculo de los certificados de balanzas
                  no puede usar este patrón hasta que estén transcritos y verificados.
                </Nota>
              )}
              {verificacion?.estado === 'VERIFICADO' && (
                <p className="flex items-start gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-3 text-[13px] leading-snug">
                  <ShieldCheck className="mt-px h-[18px] w-[18px] flex-none text-success" aria-hidden="true" />
                  <span>
                    <span className="font-semibold text-fg">Verificado por {verificacion.revisadoPor}</span>
                    <span className="block text-xs text-fg-muted">
                      Comparado con el certificado original{verificacion.revisadoEn ? ` el ${formatDate(verificacion.revisadoEn.slice(0, 10))}` : ''}
                      {verificacion.observaciones ? ` · ${verificacion.observaciones}` : ''}
                    </span>
                  </span>
                </p>
              )}
              {verificacion?.estado === 'PENDIENTE' && (
                <div className="rounded-xl border border-warning/35 bg-warning/[0.06] px-3.5 py-3">
                  <p className="text-[13px] font-semibold text-fg">Pendiente de verificación</p>
                  <p className="mt-0.5 text-[12.5px] leading-snug text-fg-muted">
                    Transcrito por {data.transcripcion?.transcritoPor || '—'}. Otra persona debe comparar los valores con el certificado original antes de que el cálculo los use.
                  </p>
                  {editable && (verificacion.puedeRevisar ? (
                    verificando ? (
                      <div className="mt-3 space-y-2">
                        <FieldLabel htmlFor={`${baseId}-obs-ver`}>Observación (opcional)</FieldLabel>
                        <input id={`${baseId}-obs-ver`} className="field h-10" value={observacion} onChange={(event) => setObservacion(event.target.value)} placeholder="Ej.: comparado con el PDF del certificado" />
                        <div className="flex gap-2">
                          <button type="button" className={botonSecundario} onClick={() => setVerificando(false)} disabled={saving}>Cancelar</button>
                          <button type="button" className={botonSecundario} onClick={verificar} disabled={saving}>
                            <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Confirmar verificación
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" className={cn(botonSecundario, 'mt-3')} onClick={() => setVerificando(true)} disabled={dirty || saving} title={dirty ? 'Guarda los cambios antes de verificar' : undefined}>
                        <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Verificar contra el original
                      </button>
                    )
                  ) : (
                    <p className="mt-2 text-xs text-fg-subtle">{verificacion.motivo}</p>
                  ))}
                </div>
              )}

              {form.tipo === 'PESAS' ? (
                piezasActivas.length === 0 ? (
                  <Nota>Agrega las piezas del juego para transcribir sus valores.</Nota>
                ) : (
                  <Tabla minWidth={720}>
                    <thead className="bg-surface-2/60">
                      <tr>
                        <th className={encabezado}>Pieza</th>
                        <th className={encabezado}>Corrección (mg)</th>
                        <th className={encabezado}>U (mg)</th>
                        <th className={encabezado}>k</th>
                        <th className={encabezado}>Documento</th>
                        <th className={encabezado}>Apta</th>
                        <th className={encabezado}><span className="sr-only">Avisos</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {piezasActivas.map((fila, indice) => {
                        const valor = form.valores[fila.key] || valorVacio();
                        const nominal = parseNumber(fila.nominal);
                        const clave = Number.isFinite(nominal) ? piezaKey({ nominalMg: toMg(nominal, fila.unidad), identificacion: fila.identificacion.trim() }) : null;
                        const avisos = (clave && avisosPorPieza.get(clave)) || [];
                        const serios = avisos.filter(aviso => aviso.tipo !== 'info');
                        const pieza = `${fila.nominal} ${fila.unidad}${fila.identificacion ? ` ${fila.identificacion}` : ''}`;
                        return (
                          <tr key={fila.key} className="border-t border-line">
                            <td className="whitespace-nowrap px-3 py-1.5 font-medium tabular-nums text-fg">
                              {pieza}
                            </td>
                            <td className="px-2 py-1.5"><Celda value={valor.correccion} onChange={(correccion) => setValor(fila.key, { correccion })} onPaste={pegarValor(indice, 'correccion')} disabled={disabled} label={`Corrección de ${pieza}`} className="w-28" /></td>
                            <td className="px-2 py-1.5"><Celda value={valor.u} onChange={(u) => setValor(fila.key, { u })} onPaste={pegarValor(indice, 'u')} disabled={disabled} label={`U de ${pieza}`} className="w-24" /></td>
                            <td className="px-2 py-1.5"><Celda value={valor.k} onChange={(k) => setValor(fila.key, { k })} onPaste={pegarValor(indice, 'k')} disabled={disabled} label={`k de ${pieza}`} className="w-14" /></td>
                            <td className="px-2 py-1.5"><Celda numeric={false} value={valor.documento} onChange={(documento) => setValor(fila.key, { documento })} onPaste={pegarValor(indice, 'documento')} disabled={disabled} label={`Documento de ${pieza}`} className="w-40" /></td>
                            <td className="px-2 py-1.5">
                              <Selector
                                value={valor.conforme}
                                onChange={(conforme) => setValor(fila.key, { conforme })}
                                options={[{ value: '', label: '—' }, { value: 'SI', label: 'Sí' }, { value: 'NO', label: 'No' }]}
                                disabled={disabled}
                                label={`Apta según el certificado: ${pieza}`}
                                className="w-20"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              {serios.length > 0 && (
                                <span title={serios.map(aviso => aviso.mensaje).join('\n')} className="inline-flex text-warning">
                                  <AlertTriangle className="h-4 w-4" aria-label={`${serios.length} avisos`} />
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Tabla>
                )
              ) : (
                <div className="grid gap-5 lg:grid-cols-3">
                  {MAGNITUDES.map((magnitud) => {
                    const filas = form.puntos.filter(fila => fila.magnitud === magnitud.id);
                    return (
                      <div key={magnitud.id}>
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-[13px] font-semibold text-fg">{magnitud.label} ({magnitud.unidad})</p>
                          {editable && (
                            <button type="button" className={botonSecundario} disabled={disabled} onClick={() => set({ puntos: [...form.puntos, filaPunto(magnitud.id)] })}>
                              <Plus className="h-4 w-4" aria-hidden="true" /> Punto
                            </button>
                          )}
                        </div>
                        {filas.length === 0 ? (
                          <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-xs text-fg-subtle">Sin puntos</p>
                        ) : (
                          <Tabla minWidth={340}>
                            <thead className="bg-surface-2/60">
                              <tr>
                                <th className={encabezado}>Punto</th>
                                <th className={encabezado}>Corr.</th>
                                <th className={encabezado}>U</th>
                                <th className={encabezado}>k</th>
                                <th className={encabezado}><span className="sr-only">Quitar</span></th>
                              </tr>
                            </thead>
                            <tbody>
                              {filas.map((fila, indice) => (
                                <tr key={fila.key} className="border-t border-line">
                                  <td className="px-1.5 py-1.5"><Celda value={fila.punto} onChange={(punto) => setPunto(fila.key, { punto })} onPaste={pegarPunto(magnitud.id, indice, 'punto')} disabled={disabled} label={`${magnitud.label}: punto`} className="w-16" /></td>
                                  <td className="px-1.5 py-1.5"><Celda value={fila.correccion} onChange={(correccion) => setPunto(fila.key, { correccion })} onPaste={pegarPunto(magnitud.id, indice, 'correccion')} disabled={disabled} label={`${magnitud.label}: corrección`} className="w-16" /></td>
                                  <td className="px-1.5 py-1.5"><Celda value={fila.u} onChange={(u) => setPunto(fila.key, { u })} onPaste={pegarPunto(magnitud.id, indice, 'u')} disabled={disabled} label={`${magnitud.label}: U`} className="w-14" /></td>
                                  <td className="px-1.5 py-1.5"><Celda value={fila.k} onChange={(k) => setPunto(fila.key, { k })} onPaste={pegarPunto(magnitud.id, indice, 'k')} disabled={disabled} label={`${magnitud.label}: k`} className="w-12" /></td>
                                  <td className="px-1 py-1.5 text-right">
                                    {editable && (
                                      <button
                                        type="button"
                                        onClick={() => set({ puntos: form.puntos.filter(item => item.key !== fila.key) })}
                                        aria-label={`Quitar punto de ${magnitud.label.toLowerCase()}`}
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted hover:bg-fg/[0.06] hover:text-danger"
                                      >
                                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </Tabla>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {form.tipo === 'PESAS' && (
                <div>
                  <p className="field-label">Condiciones durante la calibración del juego</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="block">
                      <span className="mb-1 block text-xs text-fg-muted">Temperatura (°C)</span>
                      <Celda value={form.condiciones.temperatura} onChange={(temperatura) => set({ condiciones: { ...form.condiciones, temperatura } })} disabled={disabled} label="Temperatura durante la calibración" className="h-10" />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs text-fg-muted">Humedad relativa (%)</span>
                      <Celda value={form.condiciones.humedad} onChange={(humedad) => set({ condiciones: { ...form.condiciones, humedad } })} disabled={disabled} label="Humedad durante la calibración" className="h-10" />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs text-fg-muted">Presión (hPa)</span>
                      <Celda value={form.condiciones.presion} onChange={(presion) => set({ condiciones: { ...form.condiciones, presion } })} disabled={disabled} label="Presión durante la calibración" className="h-10" />
                    </label>
                  </div>
                  <p className="cal-hint mt-2">Las que declara el certificado del juego. Sirven para la densidad del aire de su calibración (EURAMET cg-18, 7.1.2-5b).</p>
                </div>
              )}

              <div>
                <FieldLabel htmlFor={`${baseId}-obs`}>Observaciones de la transcripción</FieldLabel>
                <input
                  id={`${baseId}-obs`}
                  className="field h-10"
                  value={form.condiciones.observaciones}
                  onChange={(event) => set({ condiciones: { ...form.condiciones, observaciones: event.target.value } })}
                  disabled={disabled}
                  maxLength={300}
                  placeholder="Ej.: el certificado reúne tres documentos, uno por pieza"
                />
              </div>

              {certificadoCambio && editable && (
                <div>
                  <FieldLabel htmlFor={`${baseId}-motivo`}>Motivo del cambio</FieldLabel>
                  <input
                    id={`${baseId}-motivo`}
                    className="field h-10"
                    value={motivo}
                    onChange={(event) => setMotivo(event.target.value)}
                    maxLength={300}
                    placeholder="Ej.: se transcribió mal la corrección de 200 g"
                  />
                  <p className="cal-hint mt-1.5">Los valores ya estaban transcritos: el cambio queda en el historial con este motivo y el certificado vuelve a quedar pendiente de verificación.</p>
                </div>
              )}

              {(avisosGenerales.length > 0 || avisosPiezas.length > 0) && (
                <div className="space-y-2">
                  <p className="text-[13px] font-semibold text-fg">Avisos según lo guardado</p>
                  {[...avisosGenerales, ...avisosPiezas].map((aviso, i) => (
                    <Nota key={`${aviso.pieza || 'g'}-${i}`} tone={aviso.tipo === 'info' ? 'info' : 'aviso'}>{aviso.mensaje}</Nota>
                  ))}
                </div>
              )}
            </div>
          )}
        </ModalSection>
      </div>
    </Modal>
  );
}
