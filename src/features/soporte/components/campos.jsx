import { useId, useState } from 'react';
import { Loader2, RotateCcw, Sparkles } from 'lucide-react';
import { cn } from '../../../shared/utils/cn';
import { SuggestInput } from '../../calibration/components/Dropdown';
import { textoOriginal } from '../domain/informe';
import { OPCIONES_AJUSTE, OPCIONES_RECOMENDACION } from '../domain/plantillas';
import { CLASES_VALORACION, OPCIONES_ESTADO, claseValoracion } from '../domain/valoraciones';
import { Simbolo } from './documento/Simbolo';

const vacio = (valor) => valor === null || valor === undefined || String(valor).trim() === '';

/**
 * Estado con los cuatro símbolos del informe. Un valor que no es una
 * valoración (p. ej. «Polvoso») se muestra como texto al lado.
 */
export function CampoValoracion({ id, value, onChange, disabled, label }) {
  const actual = claseValoracion(value);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div id={id} role="radiogroup" aria-label={label} className="st-valoracion">
        {OPCIONES_ESTADO.map(opcion => (
          <button
            key={opcion.value}
            type="button"
            role="radio"
            aria-checked={actual === opcion.clase}
            aria-pressed={actual === opcion.clase}
            aria-label={opcion.value}
            title={opcion.value}
            disabled={disabled}
            onClick={() => onChange(actual === opcion.clase ? null : opcion.value)}
          >
            <Simbolo clase={opcion.clase} size="17px" />
          </button>
        ))}
      </div>
      <span className="text-[12.5px] text-fg-muted">
        {actual ? CLASES_VALORACION[actual].label : vacio(value) ? 'Sin estado' : <span className="font-medium text-fg">{String(value)}</span>}
      </span>
    </div>
  );
}

const NUMERICO = new Set(['numero', 'entero']);

/** Control del campo según su tipo. */
export function Control({ id, definicion, value, onChange, disabled, maxLength, sugerencias, invalido }) {
  const texto = value === null || value === undefined ? '' : String(value);
  const comun = { id, disabled, maxLength: maxLength || undefined };

  switch (definicion.tipo) {
    case 'estado':
      return <CampoValoracion id={id} label={definicion.label.replace(/:$/, '')} value={value} onChange={onChange} disabled={disabled} />;
    case 'parrafo':
      return (
        <textarea
          {...comun}
          value={texto}
          onChange={(event) => onChange(event.target.value)}
          rows={Math.min(10, Math.max(3, texto.split('\n').length + 1))}
          className="field resize-y py-2.5 leading-relaxed"
        />
      );
    case 'fecha':
      return (
        <input
          {...comun}
          type="date"
          value={texto.slice(0, 10)}
          onChange={(event) => onChange(event.target.value || null)}
          className="field h-11 font-medium tabular-nums"
        />
      );
    case 'ajuste':
    case 'recomendacion':
    case 'opciones':
    case 'tecnico': {
      const lista = definicion.tipo === 'ajuste' ? OPCIONES_AJUSTE
        : definicion.tipo === 'recomendacion' ? OPCIONES_RECOMENDACION
          : definicion.tipo === 'tecnico' ? (sugerencias || [])
            : (definicion.opciones || []);
      return <SuggestInput {...comun} value={texto} onChange={onChange} suggestions={lista} />;
    }
    default:
      return (
        <input
          {...comun}
          value={texto}
          inputMode={NUMERICO.has(definicion.tipo) ? 'decimal' : undefined}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="off"
          className={cn('field h-11 font-medium', NUMERICO.has(definicion.tipo) && 'tabular-nums', invalido && 'field-invalid')}
        />
      );
  }
}

/** Aviso bajo un campo que ya no tiene el dato de ServiceMET. */
export function Original({ original, tipo, onRestaurar, disabled }) {
  return (
    <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-fg-muted">
      <span>
        ServiceMET: <span className="font-medium text-fg">{textoOriginal(original, tipo)}</span>
      </span>
      {!disabled && (
        <button
          type="button"
          onClick={onRestaurar}
          className="inline-flex items-center gap-1 font-medium text-info underline-offset-4 hover:underline"
        >
          <RotateCcw className="h-3 w-3" aria-hidden="true" /> Restaurar
        </button>
      )}
    </p>
  );
}

/**
 * «Mejorar redacción» de un texto con Gemini. La sugerencia se muestra para
 * revisarla: solo reemplaza el texto si el usuario la usa, y al guardar el
 * campo queda marcado en el historial como redactado con IA.
 */
function MejorarRedaccion({ campo, label, texto, editor }) {
  const [estado, setEstado] = useState({ cargando: false, sugerencia: null, error: null });
  const vacio = String(texto ?? '').trim().length < 3;

  const pedir = async () => {
    setEstado({ cargando: true, sugerencia: null, error: null });
    try {
      const sugerencia = await editor.redaccion.sugerir({ campo, seccion: label, texto });
      setEstado({ cargando: false, sugerencia, error: null });
    } catch (failure) {
      setEstado({ cargando: false, sugerencia: null, error: failure.message });
    }
  };

  const usar = () => {
    editor.cambiar(campo, estado.sugerencia);
    editor.redaccion.marcar(campo);
    setEstado({ cargando: false, sugerencia: null, error: null });
  };

  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={pedir}
          disabled={vacio || estado.cargando}
          title={vacio ? 'Escriba primero el texto' : 'Analiza todos los datos del servicio y mejora su prerredacción'}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-[12.5px] font-semibold text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg disabled:cursor-not-allowed disabled:opacity-50"
        >
          {estado.cargando
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            : <Sparkles className="h-3.5 w-3.5 text-info" aria-hidden="true" />}
          {estado.cargando ? 'Mejorando…' : 'Mejorar redacción'}
        </button>
        {editor.redaccion.asistido(campo) && (
          <span className="cal-badge cal-tone-info" title="Al guardar, el historial registra que se usó la sugerencia de Gemini">Redactado con IA</span>
        )}
      </div>
      {estado.error && <p className="field-error" role="alert">{estado.error}</p>}
      {estado.sugerencia !== null && (
        <div className="rounded-2xl border border-info/30 bg-info/5 p-3" role="region" aria-label="Sugerencia de redacción">
          <p className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-fg">
            <Sparkles className="h-3.5 w-3.5 text-info" aria-hidden="true" /> Sugerencia de Gemini
          </p>
          <p className="whitespace-pre-line text-[13px] leading-relaxed text-fg">{estado.sugerencia}</p>
          <p className="mt-2 text-[12px] text-fg-muted">Basada en los datos del servicio y los cambios sin guardar. Revise las cifras y el sentido antes de usarla.</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={usar}
              className="h-8 rounded-lg bg-brand px-3 text-[12.5px] font-semibold text-brand-fg shadow-xs hover:bg-brand-hover"
            >
              Usar sugerencia
            </button>
            <button
              type="button"
              onClick={() => setEstado({ cargando: false, sugerencia: null, error: null })}
              className="h-8 rounded-lg px-3 text-[12.5px] font-semibold text-fg-muted hover:bg-fg/[0.06] hover:text-fg"
            >
              Descartar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Campo del formulario con su etiqueta, el aviso de «sin guardar» y el dato
 * original de ServiceMET cuando se corrigió.
 */
export function CampoInforme({ definicion, editor, className }) {
  const baseId = useId();
  const { campo, label, tipo } = definicion;
  const estado = editor.estadoCampo(campo, tipo);
  const id = `${baseId}-${campo}`;
  const invalido = NUMERICO.has(tipo) && estado.invalido;

  return (
    <div className={cn('min-w-0', className)}>
      <label htmlFor={tipo === 'estado' ? undefined : id} className="field-label flex items-center gap-2">
        <span className="min-w-0 truncate">{label.replace(/:$/, '')}</span>
        {estado.pendiente && <span className="h-1.5 w-1.5 flex-none rounded-full bg-info" title="Sin guardar" aria-label="Sin guardar" />}
      </label>
      <Control
        id={id}
        definicion={definicion}
        value={estado.valor}
        onChange={(valor) => editor.cambiar(campo, valor)}
        disabled={estado.bloqueado}
        maxLength={estado.max}
        sugerencias={editor.tecnicos}
        invalido={invalido}
      />
      {invalido && <p className="field-error">Escriba un número (use punto o coma decimal).</p>}
      {tipo === 'parrafo' && editor.redaccion?.disponible && !estado.bloqueado && (
        <MejorarRedaccion campo={campo} label={label.replace(/:$/, '')} texto={estado.valor} editor={editor} />
      )}
      {estado.distinto && (
        <Original
          original={estado.original}
          tipo={tipo}
          disabled={estado.bloqueado}
          onRestaurar={() => editor.cambiar(campo, estado.original)}
        />
      )}
    </div>
  );
}
