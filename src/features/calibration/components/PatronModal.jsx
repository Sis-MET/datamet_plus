import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, Info, Plus, ShieldCheck, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../../shared/utils/cn';
import { calibrationApi } from '../api/calibration';
import { formatDate } from '../domain/format';
import {
  CLASES_R111,
  EXPRESIONES,
  MAGNITUDES,
  ORIGENES_DENSIDAD,
  TIPOS_PATRON,
  UNIDADES_MASA,
  VERIFICACION,
  aptaPieza,
  cambiarExpresion,
  densidadSupuestaDe,
  esPegadoMultiple,
  expresionDe,
  formatNumber,
  materialDeLista,
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

const valorVacio = () => ({ correccion: '', u: '', k: '', documento: '' });

const filaPunto = (magnitud, punto = null) => ({
  key: nuevaClave(),
  magnitud,
  // Solo en humedad: la temperatura a la que se calibró el punto.
  temperatura: texto(punto?.temperatura),
  punto: texto(punto?.punto),
  // Como lo da el certificado: la corrección o el error (expresion de la magnitud).
  correccion: texto(cambiarExpresion(punto?.correccion, punto?.expresadoComo)),
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
    };
  }
  return {
    tipo: data.patron.tipo || 'PESAS',
    clase: data.patron.clase || '',
    piezas: data.piezas.map(filaPieza),
    valores,
    puntos: data.puntos.map(punto => filaPunto(punto.magnitud, punto)),
    // Qué da el certificado en cada magnitud. Los de presión suelen dar el error
    // (formulario EMCA): sin puntos guardados, la presión empieza en «Error».
    expresion: {
      T: expresionDe(data.puntos, 'T'),
      HR: expresionDe(data.puntos, 'HR'),
      P: expresionDe(data.puntos, 'P', 'ERROR'),
    },
    condiciones: {
      temperatura: texto(data.transcripcion?.temperatura),
      humedad: texto(data.transcripcion?.humedad),
      presion: texto(data.transcripcion?.presion),
      temperaturaU: texto(data.transcripcion?.temperaturaU),
      humedadU: texto(data.transcripcion?.humedadU),
      presionU: texto(data.transcripcion?.presionU),
      condicionesK: texto(data.transcripcion?.condicionesK),
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
      temperaturaU: numero(form.condiciones.temperaturaU, 'Incertidumbre de la temperatura'),
      humedadU: numero(form.condiciones.humedadU, 'Incertidumbre de la humedad'),
      presionU: numero(form.condiciones.presionU, 'Incertidumbre de la presión'),
      condicionesK: numero(form.condiciones.condicionesK, 'k de las incertidumbres de las condiciones'),
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
        });
      }
    } else {
      certificado.puntos = form.puntos
        .filter(fila => [fila.temperatura, fila.punto, fila.correccion, fila.u, fila.k].some(item => String(item).trim()))
        .map((fila) => {
          const etiqueta = `${MAGNITUDES.find(m => m.id === fila.magnitud)?.label} ${fila.punto || ''}`.trim();
          const expresadoComo = form.expresion[fila.magnitud] || 'CORRECCION';
          const valor = numero(fila.correccion, `${etiqueta}, ${expresadoComo === 'ERROR' ? 'error' : 'corrección'}`, true);
          return {
            magnitud: fila.magnitud,
            documento: fila.documento.trim() || null,
            temperatura: fila.magnitud === 'HR' ? numero(fila.temperatura, `${etiqueta}, temperatura`) : null,
            punto: numero(fila.punto, `${etiqueta}, punto`, true),
            // El cálculo usa la corrección: el error con el signo cambiado.
            correccion: cambiarExpresion(valor, expresadoComo),
            expresadoComo,
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
const subencabezado = 'whitespace-nowrap px-2 pb-2 pt-0.5 text-left text-[11.5px] font-semibold text-fg-muted';

/**
 * Una condición de la R111 para una pieza (5.2 o 5.3): marca y comparación
 * («0,003 > 0,002667»). Nunca solo el color: la marca ✓/✗ y el signo dicen lo
 * mismo. Sin datos para decidir, una raya.
 */
function Condicion({ condicion }) {
  if (!condicion) return <span className="text-[13px] text-fg-subtle">—</span>;
  const Icono = condicion.cumple ? Check : X;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] tabular-nums" title={condicion.detalle}>
      <Icono className={cn('h-4 w-4 flex-none', condicion.cumple ? 'text-success' : 'text-danger')} aria-hidden="true" />
      <span className={condicion.cumple ? 'text-fg-muted' : 'font-semibold text-fg'}>
        {condicion.valor} {condicion.cumple ? '≤' : '>'} {condicion.limite}
      </span>
      <span className="sr-only">{condicion.cumple ? `cumple la ${condicion.norma}` : `no cumple la ${condicion.norma}`}</span>
    </span>
  );
}

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
function Selector({ value, onChange, options, disabled, label, className, menuWidth }) {
  return (
    <Dropdown
      value={value}
      onChange={onChange}
      options={options}
      ariaLabel={label}
      disabled={disabled}
      size="sm"
      maxHeight={menuWidth ? 280 : 200}
      menuWidth={menuWidth}
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
// En humedad, la temperatura va primero, como en el certificado.
const columnasPunto = (magnitud) => (magnitud === 'HR' ? ['temperatura'] : []).concat(['punto', 'correccion', 'u', 'k', 'documento']);

/**
 * Al elegir el material, la densidad supuesta de la tabla del método (R111,
 * Tabla B.7) con su U y k = 2, si la pieza no tiene densidad o tenía la
 * supuesta del material anterior.
 */
const conMaterial = (fila, material, materiales) => {
  const anterior = densidadSupuestaDe(fila.material, materiales);
  const nueva = densidadSupuestaDe(material, materiales);
  const sinDensidad = !fila.densidad.trim() && !fila.densidadU.trim() && !fila.densidadK.trim();
  const eraSupuesta = anterior && fila.densidadOrigen === 'SUPUESTA' && parseNumber(fila.densidad) === anterior.densidad;
  if (!nueva || !(sinDensidad || eraSupuesta)) return { ...fila, material };
  return {
    ...fila,
    material,
    densidad: texto(nueva.densidad),
    densidadU: texto(nueva.densidadU),
    densidadK: texto(nueva.densidadK),
    densidadOrigen: 'SUPUESTA',
  };
};

const asignarPieza = (materiales) => (fila, campo, valor) => {
  if (campo === 'nominal') {
    const nominal = parseNominalText(valor, fila.unidad);
    return nominal ? { ...fila, nominal: nominal.valor, unidad: nominal.unidad } : { ...fila, nominal: valor };
  }
  if (campo === 'material') {
    // Lo pegado se lleva al nombre de la lista; si no coincide, queda marcado.
    return { ...fila, material: materialDeLista(valor, materiales)?.material || valor };
  }
  if (campo === 'densidadOrigen') {
    const normal = valor.toLowerCase();
    return { ...fila, densidadOrigen: normal.startsWith('med') ? 'MEDIDA' : normal.startsWith('sup') ? 'SUPUESTA' : '' };
  }
  return { ...fila, [campo]: valor };
};

// ─── Puntos de un termohigrómetro ──────────────────────────────────────────

/** Columnas de los puntos de una magnitud, en el orden del certificado. */
const columnasDePuntos = (magnitud, comoError) => [
  ...(magnitud.id === 'HR' ? [{ campo: 'temperatura', titulo: 'Temperatura de calibración', unidad: '°C' }] : []),
  { campo: 'punto', titulo: magnitud.id === 'HR' ? 'Humedad del punto' : 'Punto calibrado', unidad: magnitud.unidad },
  { campo: 'correccion', titulo: comoError ? 'Error' : 'Corrección', unidad: magnitud.unidad },
  { campo: 'u', titulo: 'Incertidumbre (U)', unidad: magnitud.unidad },
  { campo: 'k', titulo: 'k', unidad: null, angosta: true },
];

const tituloColumna = (columna) => `${columna.titulo}${columna.unidad ? ` (${columna.unidad})` : ''}`;

/**
 * Puntos calibrados de una magnitud: un bloque a todo lo ancho con su
 * encabezado. En pantallas chicas cada punto es una tarjeta con sus etiquetas
 * (calibration.css, .cal-puntos).
 */
function PuntosMagnitud({ magnitud, filas, expresion, editable, disabled, onExpresion, onAgregar, onCambiar, onQuitar, onPegar }) {
  const comoError = expresion === 'ERROR';
  const columnas = columnasDePuntos(magnitud, comoError);
  const plantilla = { '--cal-puntos-columnas': `${columnas.map(c => (c.angosta ? 'minmax(0, 0.6fr)' : 'minmax(0, 1fr)')).join(' ')} 2.5rem` };
  return (
    <section className="rounded-xl border border-line bg-surface shadow-xs" aria-label={magnitud.label}>
      <header className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-line px-4 py-3">
        <div className="min-w-[10rem] flex-1">
          <h4 className="text-[14px] font-semibold text-fg">
            {magnitud.label} <span className="font-normal text-fg-muted">({magnitud.unidad})</span>
          </h4>
          <p className="mt-0.5 text-xs text-fg-muted">
            {filas.length === 1 ? '1 punto' : `${filas.length} puntos`}
            {comoError && ' · el cálculo usa la corrección, que es el error con el signo cambiado'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12.5px] text-fg-muted">El certificado da</span>
          <Selector
            value={expresion}
            onChange={onExpresion}
            options={EXPRESIONES}
            disabled={disabled}
            label={`${magnitud.label}: el certificado da la corrección o el error`}
            className="w-32"
          />
        </div>
        {editable && (
          <button type="button" className={botonSecundario} disabled={disabled} onClick={onAgregar}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Agregar punto
          </button>
        )}
      </header>
      {filas.length === 0 ? (
        <p className="px-4 py-6 text-center text-[13px] text-fg-subtle">
          Sin puntos. Agrega el primero o pega las filas copiadas del certificado.
        </p>
      ) : (
        <div className="px-4 py-3.5">
          <div className="cal-puntos">
            <div className="cal-puntos-fila cal-puntos-encabezado" style={plantilla} aria-hidden="true">
              {columnas.map(columna => <span key={columna.campo}>{tituloColumna(columna)}</span>)}
              <span />
            </div>
            {filas.map((fila, indice) => (
              <div key={fila.key} className="cal-puntos-fila" style={plantilla}>
                {columnas.map(columna => (
                  <label key={columna.campo} className="block min-w-0">
                    <span className="cal-puntos-etiqueta">{tituloColumna(columna)}</span>
                    <Celda
                      value={fila[columna.campo]}
                      onChange={valor => onCambiar(fila.key, { [columna.campo]: valor })}
                      onPaste={onPegar(indice, columna.campo)}
                      disabled={disabled}
                      label={`${magnitud.label}, punto ${indice + 1}: ${tituloColumna(columna).toLowerCase()}`}
                      className="h-10 w-full"
                    />
                  </label>
                ))}
                <div className="cal-puntos-quitar">
                  {editable && (
                    <button
                      type="button"
                      onClick={() => onQuitar(fila.key)}
                      aria-label={`Quitar el punto ${indice + 1} de ${magnitud.label.toLowerCase()}`}
                      title="Quitar punto"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-fg-muted hover:bg-fg/[0.06] hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {magnitud.id === 'HR' && (
            <p className="cal-hint mt-3">Anota la temperatura de cada punto como en el certificado: el cálculo corrige la humedad a la temperatura medida.</p>
          )}
        </div>
      )}
    </section>
  );
}

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
  const materiales = data.materiales || [];
  const opcionesMaterial = [
    { value: '', label: '—' },
    ...materiales.map(m => ({ value: m.material, label: m.material, hint: `${formatNumber(m.rho)} kg/m³` })),
  ];
  // Un material guardado antes de la lista (texto libre) se muestra para cambiarlo.
  const opcionesMaterialDe = (material) => (
    !material || materiales.some(m => m.material === material)
      ? opcionesMaterial
      : [...opcionesMaterial, { value: material, label: `${material} (no está en la lista)` }]
  );

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
        asignar: asignarPieza(materiales),
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
        columnas: columnasPunto(magnitud),
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
                      <td className="px-2 py-1.5">
                        <Selector
                          value={fila.material}
                          onChange={(material) => set({ piezas: form.piezas.map(item => (item.key === fila.key ? conMaterial(item, material, materiales) : item)) })}
                          options={opcionesMaterialDe(fila.material)}
                          disabled={disabled}
                          label="Material"
                          className="w-48"
                          menuWidth={300}
                        />
                      </td>
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
              Al elegir el material se llena su densidad supuesta (OIML R111, Tabla B.7) con la U para k = 2; cámbiala si el certificado da una medida.
              Los materiales son los de Método de cálculo › Densidades. Las piezas guardadas no se borran: se desactivan.
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
                  <Tabla minWidth={960}>
                    <thead className="bg-surface-2/60">
                      <tr>
                        <th rowSpan={2} className={encabezado}>Pieza</th>
                        <th rowSpan={2} className={encabezado}>Corrección (mg)</th>
                        <th rowSpan={2} className={encabezado}>U (mg)</th>
                        <th rowSpan={2} className={encabezado}>k</th>
                        <th rowSpan={2} className={encabezado}>Documento</th>
                        <th colSpan={3} className={cn(encabezado, 'pb-1')}>Apta (R111)</th>
                        <th rowSpan={2} className={encabezado}><span className="sr-only">Avisos</span></th>
                      </tr>
                      <tr>
                        <th className={subencabezado} title="R111 5.2: la U (k = 2) del certificado no debe superar un tercio del emp de la clase">
                          5.2 · U ≤ emp/3
                        </th>
                        <th className={subencabezado} title="R111 5.3: la corrección no debe superar el emp menos la U">
                          5.3 · |corr.| ≤ emp − U
                        </th>
                        <th className={subencabezado}>Resultado</th>
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
                        const apta = aptaPieza({
                          r111: data.r111,
                          clase: form.clase,
                          nominalMg: Number.isFinite(nominal) ? toMg(nominal, fila.unidad) : Number.NaN,
                          correccion: valor.correccion,
                          u: valor.u,
                          k: valor.k,
                        });
                        return (
                          <tr key={fila.key} className="border-t border-line">
                            <td className="whitespace-nowrap px-3 py-1.5 font-medium tabular-nums text-fg">
                              {pieza}
                            </td>
                            <td className="px-2 py-1.5"><Celda value={valor.correccion} onChange={(correccion) => setValor(fila.key, { correccion })} onPaste={pegarValor(indice, 'correccion')} disabled={disabled} label={`Corrección de ${pieza}`} className="w-28" /></td>
                            <td className="px-2 py-1.5"><Celda value={valor.u} onChange={(u) => setValor(fila.key, { u })} onPaste={pegarValor(indice, 'u')} disabled={disabled} label={`U de ${pieza}`} className="w-24" /></td>
                            <td className="px-2 py-1.5"><Celda value={valor.k} onChange={(k) => setValor(fila.key, { k })} onPaste={pegarValor(indice, 'k')} disabled={disabled} label={`k de ${pieza}`} className="w-14" /></td>
                            <td className="px-2 py-1.5"><Celda numeric={false} value={valor.documento} onChange={(documento) => setValor(fila.key, { documento })} onPaste={pegarValor(indice, 'documento')} disabled={disabled} label={`Documento de ${pieza}`} className="w-40" /></td>
                            {/* Cada condición en su columna (5.2 y 5.3) y, al final, el resultado: apta si cumple las dos. */}
                            <td className="px-2 py-1.5"><Condicion condicion={apta.condiciones?.[0]} /></td>
                            <td className="px-2 py-1.5"><Condicion condicion={apta.condiciones?.[1]} /></td>
                            <td className="px-2 py-1.5" title={apta.motivo}>
                              {apta.apta == null ? (
                                <span className="text-[13px] text-fg-subtle" aria-label={`${pieza}: ${apta.motivo}`}>—</span>
                              ) : (
                                <span aria-label={`${pieza}: ${apta.apta ? 'apta' : `no apta, no cumple la ${apta.fallas.map(f => f.norma).join(' ni la ')}`}. ${apta.motivo}`}>
                                  <ToneBadge tone={apta.apta ? 'success' : 'danger'}>{apta.apta ? 'Sí' : 'No'}</ToneBadge>
                                </span>
                              )}
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
              ) : null}
              {form.tipo === 'PESAS' && piezasActivas.length > 0 && (
                <p className="cal-hint -mt-2">
                  «Apta» se calcula con la clase del juego y los valores del certificado: U (k = 2) ≤ emp/3 y |corrección| ≤ emp − U
                  (OIML R111, 5.2 y 5.3); hacen falta las dos y cada una tiene su columna, en mg. Pasa el cursor para ver las cuentas.
                  Una pieza no apta igual se usa con su corrección y su U del certificado, pero no puede presentarse con esa clase.
                </p>
              )}
              {form.tipo !== 'PESAS' && (
                <div className="space-y-4">
                  {MAGNITUDES.map(magnitud => (
                    <PuntosMagnitud
                      key={magnitud.id}
                      magnitud={magnitud}
                      filas={form.puntos.filter(fila => fila.magnitud === magnitud.id)}
                      expresion={form.expresion[magnitud.id]}
                      editable={editable}
                      disabled={disabled}
                      onExpresion={expresion => set({ expresion: { ...form.expresion, [magnitud.id]: expresion } })}
                      onAgregar={() => set({ puntos: [...form.puntos, filaPunto(magnitud.id)] })}
                      onCambiar={setPunto}
                      onQuitar={key => set({ puntos: form.puntos.filter(item => item.key !== key) })}
                      onPegar={(indice, campo) => pegarPunto(magnitud.id, indice, campo)}
                    />
                  ))}
                  <p className="cal-hint">
                    Copia cada valor tal como está en el certificado y elige en cada magnitud si da la corrección o el error. El cálculo
                    usa la corrección: si el certificado da el error, le cambia el signo.
                  </p>
                </div>
              )}

              {form.tipo === 'PESAS' && (
                <div>
                  <p className="field-label">Condiciones durante la calibración del juego</p>
                  <div className="flex flex-wrap items-start gap-4">
                    <Tabla minWidth={420}>
                      <thead className="bg-surface-2/60">
                        <tr>
                          <th className={encabezado}>Parámetro</th>
                          <th className={encabezado}>Promedio</th>
                          <th className={encabezado}>Incertidumbre</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { campo: 'temperatura', etiqueta: 'Temperatura', unidad: '°C' },
                          { campo: 'humedad', etiqueta: 'Humedad relativa', unidad: '%' },
                          { campo: 'presion', etiqueta: 'Presión', unidad: 'hPa = mbar' },
                        ].map(({ campo, etiqueta, unidad }) => (
                          <tr key={campo} className="border-t border-line">
                            <td className="whitespace-nowrap px-3 py-1.5 text-[13px] text-fg">
                              {etiqueta} <span className="text-fg-muted">({unidad})</span>
                            </td>
                            <td className="px-2 py-1.5">
                              <Celda value={form.condiciones[campo]} onChange={(valor) => set({ condiciones: { ...form.condiciones, [campo]: valor } })} disabled={disabled} label={`${etiqueta} durante la calibración`} className="w-28" />
                            </td>
                            <td className="px-2 py-1.5">
                              <Celda value={form.condiciones[`${campo}U`]} onChange={(valor) => set({ condiciones: { ...form.condiciones, [`${campo}U`]: valor } })} disabled={disabled} label={`Incertidumbre de la ${etiqueta.toLowerCase()} durante la calibración`} className="w-28" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Tabla>
                    <label className="block w-40">
                      <span className="mb-1 block text-xs text-fg-muted">k de las incertidumbres</span>
                      <Celda value={form.condiciones.condicionesK} onChange={(condicionesK) => set({ condiciones: { ...form.condiciones, condicionesK } })} disabled={disabled} label="k de las incertidumbres de las condiciones" className="h-10 w-20" />
                      <span className="mt-1 block text-xs leading-snug text-fg-subtle">Si el certificado lo indica.</span>
                    </label>
                  </div>
                  <p className="cal-hint mt-2">
                    Las que declara el certificado del juego, con su incertidumbre. El promedio sirve para la densidad del aire de su calibración (EURAMET cg-18, 7.1.2-5b).
                  </p>
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
