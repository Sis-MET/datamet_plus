import { createContext, useContext, useId, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { cn } from '../../../../shared/utils/cn';
import {
  CLASES_PESAS, LARGO_TEXTO, LISTAS, NUMEROS, escribirLista, escribirNumero, leerLista, leerNumero, rutaGenerica,
} from '../../domain/metodo';
import { Segmented } from '../primitives';
import '../registro/registro.css';

/*
 * Campos de la configuración del método. Leen y escriben por ruta
 * (parametros.kD, textos.reglas.SIMPLE…) con la edición que da EdicionMetodo:
 * { valor(ruta), cambiar(ruta, valor), marca(ruta), problema(ruta), editable }.
 * Las marcas son las del registro: amarillo sin guardar, azul distinto de la
 * versión de la que partió el borrador.
 */
const Edicion = createContext(null);
const useEdicion = () => useContext(Edicion);

export function EdicionMetodo({ value, children }) {
  return <Edicion.Provider value={value}>{children}</Edicion.Provider>;
}

const MARCAS = { pendiente: 'cc-campo-pendiente', cambiado: 'cc-campo-corregido' };
const TITULO_MARCA = { pendiente: 'Sin guardar', cambiado: 'Distinto de la versión anterior' };

function Campo({ ruta, etiqueta, ayuda, error, htmlFor, children, className }) {
  const { marca, problema } = useEdicion();
  const m = marca(ruta);
  const mensaje = error || problema(ruta);
  return (
    <div className={cn('-ml-3 rounded-r-lg py-1 pl-3', MARCAS[m], className)} title={TITULO_MARCA[m]}>
      {etiqueta && <label htmlFor={htmlFor} className="field-label">{etiqueta}</label>}
      {children}
      {ayuda && <p className="mt-1 text-[11.5px] leading-snug text-fg-muted">{ayuda}</p>}
      {mensaje && <p className="mt-1 text-[11.5px] text-danger" role="alert">{mensaje}</p>}
    </div>
  );
}

/** Texto local que sigue al valor guardado salvo mientras se escribe. */
function useTexto(valor, escribir) {
  const [texto, setTexto] = useState(() => escribir(valor));
  const [visto, setVisto] = useState(valor);
  if (JSON.stringify(valor) !== JSON.stringify(visto)) {
    setVisto(valor);
    setTexto(escribir(valor));
  }
  return { texto, setTexto, setVisto };
}

export function CampoNumero({ ruta, etiqueta, ayuda, unidad, placeholder, className, anchoInput = 'w-32' }) {
  const { valor, cambiar, editable } = useEdicion();
  const id = useId();
  const regla = NUMEROS[rutaGenerica(ruta)] || {};
  const actual = valor(ruta);
  const { texto, setTexto, setVisto } = useTexto(actual, escribirNumero);
  const leido = leerNumero(texto);
  const error = Number.isNaN(leido) ? 'Escribe un número (con coma o punto).' : leido == null && !regla.vacio ? 'Falta el valor.' : null;
  const medida = unidad ?? regla.unidad;
  return (
    <Campo ruta={ruta} etiqueta={etiqueta} ayuda={ayuda} error={error} htmlFor={id} className={className}>
      <div className="flex items-center gap-2">
        <input
          id={id}
          value={texto}
          inputMode="decimal"
          readOnly={!editable}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          onChange={(event) => {
            const nuevo = event.target.value;
            setTexto(nuevo);
            const n = leerNumero(nuevo);
            if (!Number.isNaN(n) && (n != null || regla.vacio)) { setVisto(n); cambiar(ruta, n); }
          }}
          className={cn('field h-9 rounded-lg text-[13px] tabular-nums', anchoInput, error && 'field-invalid')}
        />
        {medida && <span className="text-[12px] text-fg-muted">{medida}</span>}
      </div>
    </Campo>
  );
}

export function CampoLista({ ruta, etiqueta, ayuda }) {
  const { valor, cambiar, editable } = useEdicion();
  const id = useId();
  const regla = LISTAS[ruta];
  const escribir = lista => escribirLista(lista, regla.escala);
  const { texto, setTexto, setVisto } = useTexto(valor(ruta), escribir);
  const leida = leerLista(texto, regla.escala);
  const error = leida == null ? 'Escribe números separados por punto y coma (;).' : null;
  return (
    <Campo ruta={ruta} etiqueta={etiqueta} ayuda={ayuda} error={error} htmlFor={id}>
      <div className="flex items-center gap-2">
        <input
          id={id}
          value={texto}
          readOnly={!editable}
          aria-invalid={error ? true : undefined}
          onChange={(event) => {
            setTexto(event.target.value);
            const lista = leerLista(event.target.value, regla.escala);
            if (lista) { setVisto(lista); cambiar(ruta, lista); }
          }}
          className={cn('field h-9 min-w-0 flex-1 rounded-lg text-[13px] tabular-nums', error && 'field-invalid')}
        />
        {regla.unidad && <span className="flex-none text-[12px] text-fg-muted">{regla.unidad}</span>}
      </div>
    </Campo>
  );
}

export function CampoTexto({ ruta, etiqueta, ayuda, filas = 3 }) {
  const { valor, cambiar, editable } = useEdicion();
  const id = useId();
  const largo = LARGO_TEXTO[rutaGenerica(ruta)] || 600;
  const texto = valor(ruta) ?? '';
  // Crece con el texto (unas 95 letras por línea), hasta 8 líneas.
  const lineas = Math.min(8, Math.max(filas, Math.ceil(texto.length / 95)));
  return (
    <Campo ruta={ruta} etiqueta={etiqueta} ayuda={ayuda} htmlFor={id}>
      <textarea
        id={id}
        value={texto}
        rows={lineas}
        maxLength={largo}
        readOnly={!editable}
        onChange={event => cambiar(ruta, event.target.value)}
        className="field min-h-[72px] w-full resize-y rounded-lg py-2 text-[13px] leading-relaxed"
      />
      {editable && texto.length > largo * 0.8 && <p className="mt-0.5 text-right text-[11px] text-fg-muted">{texto.length} / {largo}</p>}
    </Campo>
  );
}

export function CampoOpciones({ ruta, etiqueta, opciones }) {
  const { valor, cambiar, editable } = useEdicion();
  const actual = valor(ruta);
  const elegida = opciones.find(o => o.value === actual);
  return (
    <Campo ruta={ruta} etiqueta={etiqueta} ayuda={elegida?.descripcion}>
      <Segmented label={etiqueta} value={actual} onChange={v => cambiar(ruta, v)} options={opciones} disabled={!editable} className="self-start" />
    </Campo>
  );
}

export function CampoInterruptor({ ruta, etiqueta, ayuda }) {
  const { valor, cambiar, editable } = useEdicion();
  const id = useId();
  return (
    <Campo ruta={ruta}>
      <div className="flex items-start gap-3">
        <input id={id} type="checkbox" role="switch" className="cal-switch mt-0.5" checked={Boolean(valor(ruta))} disabled={!editable} onChange={e => cambiar(ruta, e.target.checked)} />
        <label htmlFor={id} className="min-w-0">
          <span className="block text-[13px] font-medium text-fg">{etiqueta}</span>
          {ayuda && <span className="mt-0.5 block text-xs leading-snug text-fg-muted">{ayuda}</span>}
        </label>
      </div>
    </Campo>
  );
}

export function CampoClases({ ruta, etiqueta, ayuda }) {
  const { valor, cambiar, editable } = useEdicion();
  const elegidas = valor(ruta) || [];
  return (
    <Campo ruta={ruta} etiqueta={etiqueta} ayuda={ayuda}>
      <div role="group" aria-label={etiqueta} className="flex flex-wrap gap-1.5">
        {CLASES_PESAS.map(clase => (
          <button
            key={clase}
            type="button"
            aria-pressed={elegidas.includes(clase)}
            disabled={!editable}
            onClick={() => cambiar(ruta, elegidas.includes(clase) ? elegidas.filter(c => c !== clase) : CLASES_PESAS.filter(c => c === clase || elegidas.includes(c)))}
            className="cal-filter-chip aria-pressed:border-fg aria-pressed:bg-fg aria-pressed:text-surface disabled:cursor-default"
          >
            {clase}
          </button>
        ))}
      </div>
    </Campo>
  );
}

function BotonFila({ etiqueta, onClick, disabled, children }) {
  return (
    <button type="button" aria-label={etiqueta} title={etiqueta} onClick={onClick} disabled={disabled}
      className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-30">
      {children}
    </button>
  );
}

const mover = (lista, i, paso) => {
  const copia = [...lista];
  [copia[i], copia[i + paso]] = [copia[i + paso], copia[i]];
  return copia;
};

/** ΔT pesas–aire según el tiempo de estabilización que registra ServiceMET. */
export function TablaEstabilizacion() {
  const { valor, cambiar, editable, marca } = useEdicion();
  const ruta = 'parametros.conveccion.porEstabilizacion';
  const filas = valor(ruta) || [];
  return (
    <div className={cn('-ml-3 rounded-r-lg pl-3', MARCAS[marca(ruta)])}>
      <p className="field-label">ΔT por tiempo de estabilización</p>
      <div className="flex flex-col gap-2">
        {filas.map((fila, i) => (
          <div key={i} className="flex flex-wrap items-start gap-2">
            <CampoTextoCorto ruta={`${ruta}[${i}].texto`} etiqueta={`Estabilización, fila ${i + 1}`} className="min-w-[200px] flex-1" />
            <CampoNumero ruta={`${ruta}[${i}].deltaT`} />
            {editable && <BotonFila etiqueta={`Quitar la fila ${i + 1}`} onClick={() => cambiar(ruta, filas.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" aria-hidden="true" /></BotonFila>}
          </div>
        ))}
        {!filas.length && <p className="text-[12.5px] text-fg-muted">Sin filas: se usa el ΔT sin dato.</p>}
      </div>
      {editable && filas.length < 10 && (
        <button type="button" onClick={() => cambiar(ruta, [...filas, { texto: '', deltaT: 5 }])} className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-info hover:underline">
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Agregar fila
        </button>
      )}
    </div>
  );
}

function CampoTextoCorto({ ruta, etiqueta, className, oculto = true }) {
  const { valor, cambiar, editable, problema } = useEdicion();
  return (
    <div className={className}>
      <input
        aria-label={oculto ? etiqueta : undefined}
        value={valor(ruta) ?? ''}
        maxLength={60}
        readOnly={!editable}
        onChange={e => cambiar(ruta, e.target.value)}
        className={cn('field h-9 w-full rounded-lg text-[13px]', problema(ruta) && 'field-invalid')}
      />
      {problema(ruta) && <p className="mt-1 text-[11.5px] text-danger">{problema(ruta)}</p>}
    </div>
  );
}

/** Densidad supuesta por material: gana la primera fila con una palabra clave en el material. */
export function TablaDensidades() {
  const { valor, cambiar, editable, marca, problema } = useEdicion();
  const ruta = 'parametros.densidades';
  const filas = valor(ruta) || [];
  return (
    <div className="flex flex-col gap-2">
      {filas.map((fila, i) => {
        const base = `${ruta}[${i}]`;
        return (
          <div key={i} className={cn('-ml-3 rounded-r-xl border border-line py-3 pl-6 pr-3', MARCAS[marca(base)])}>
            <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
              <div className="min-w-[160px] flex-1 py-1">
                <p className="field-label">Material</p>
                <CampoTextoCorto ruta={`${base}.material`} etiqueta={`Material, fila ${i + 1}`} />
              </div>
              <CampoNumero ruta={`${base}.rho`} etiqueta="ρ (kg/m³)" unidad="" anchoInput="w-24" />
              <CampoNumero ruta={`${base}.u`} etiqueta="u(ρ) (kg/m³)" unidad="" anchoInput="w-24" />
              {editable && (
                <div className="flex gap-0.5 pb-1.5">
                  <BotonFila etiqueta="Subir" disabled={i === 0} onClick={() => cambiar(ruta, mover(filas, i, -1))}><ArrowUp className="h-4 w-4" aria-hidden="true" /></BotonFila>
                  <BotonFila etiqueta="Bajar" disabled={i === filas.length - 1} onClick={() => cambiar(ruta, mover(filas, i, 1))}><ArrowDown className="h-4 w-4" aria-hidden="true" /></BotonFila>
                  <BotonFila etiqueta={`Quitar ${fila.material || `la fila ${i + 1}`}`} disabled={filas.length === 1} onClick={() => cambiar(ruta, filas.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" aria-hidden="true" /></BotonFila>
                </div>
              )}
            </div>
            <Claves ruta={`${base}.claves`} />
            {problema(`${base}.claves`) && <p className="mt-1 text-[11.5px] text-danger">{problema(`${base}.claves`)}</p>}
          </div>
        );
      })}
      {editable && filas.length < 30 && (
        <button type="button" onClick={() => cambiar(ruta, [...filas, { material: '', claves: [''], rho: 8000, u: 100 }])} className="inline-flex w-max items-center gap-1.5 text-[12.5px] font-semibold text-info hover:underline">
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Agregar material
        </button>
      )}
    </div>
  );
}

/** Palabras clave separadas por coma; se comparan sin tildes ni mayúsculas. */
function Claves({ ruta }) {
  const { valor, cambiar, editable, problema } = useEdicion();
  const id = useId();
  const escribir = lista => (lista || []).join(', ');
  const { texto, setTexto, setVisto } = useTexto(valor(ruta), escribir);
  const errores = (valor(ruta) || []).map((_, i) => problema(`${ruta}[${i}]`)).find(Boolean);
  return (
    <div className="mt-2">
      <label htmlFor={id} className="field-label">Palabras clave <span className="font-normal text-fg-subtle">(separadas por coma)</span></label>
      <input
        id={id}
        value={texto}
        readOnly={!editable}
        onChange={(event) => {
          setTexto(event.target.value);
          const lista = event.target.value.split(',').map(c => c.trim()).filter(Boolean);
          setVisto(lista);
          cambiar(ruta, lista);
        }}
        className={cn('field h-9 w-full rounded-lg text-[13px]', errores && 'field-invalid')}
      />
      {errores && <p className="mt-1 text-[11.5px] text-danger">{errores}</p>}
    </div>
  );
}

/** Párrafos o frases de un texto del certificado (leyenda, pruebas). */
export function ListaTextos({ ruta, etiqueta, ayuda, minimo = 0, maximo, nuevo = '' }) {
  const { valor, cambiar, editable, marca } = useEdicion();
  const filas = valor(ruta) || [];
  return (
    <div className={cn('-ml-3 rounded-r-lg pl-3', MARCAS[marca(ruta)])}>
      <p className="field-label">{etiqueta}</p>
      {ayuda && <p className="-mt-0.5 mb-1.5 text-[11.5px] text-fg-muted">{ayuda}</p>}
      <div className="flex flex-col gap-2">
        {filas.map((_, i) => (
          <div key={i} className="flex items-start gap-1">
            <div className="min-w-0 flex-1"><CampoTexto ruta={`${ruta}[${i}]`} filas={2} /></div>
            {editable && filas.length > minimo && (
              <BotonFila etiqueta={`Quitar el párrafo ${i + 1}`} onClick={() => cambiar(ruta, filas.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" aria-hidden="true" /></BotonFila>
            )}
          </div>
        ))}
        {!filas.length && <p className="text-[12.5px] text-fg-muted">Ninguna.</p>}
      </div>
      {editable && filas.length < maximo && (
        <button type="button" onClick={() => cambiar(ruta, [...filas, nuevo])} className="mt-1.5 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-info hover:underline">
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Agregar
        </button>
      )}
    </div>
  );
}
