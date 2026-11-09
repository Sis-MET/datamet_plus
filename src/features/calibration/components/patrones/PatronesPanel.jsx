import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, CircleDashed, Loader2, Scale, Search, X } from 'lucide-react';
import { cn } from '../../../../shared/utils/cn';
import { Button } from '../../../../shared/components/ui/Button';
import { calibrationApi } from '../../api/calibration';
import { formatDate } from '../../domain/format';
import { TIPOS, filtrarPatrones, pasosDe, siguientePaso } from '../../domain/patronesEstado';
import { Dropdown } from '../Dropdown';
import { EmptyState, Segmented, ToneBadge } from '../primitives';

const ICONO_PASO = { ok: Check, falta: X, espera: CircleDashed };
const TONO_PASO = {
  ok: 'border-success/30 bg-success/5 text-success',
  falta: 'border-danger/30 bg-danger/5 text-danger',
  espera: 'border-line bg-surface-2 text-fg-subtle',
};

function Pasos({ patron }) {
  return (
    <ol className="flex flex-wrap gap-1.5" aria-label={`Pasos de ${patron.codigo}`}>
      {pasosDe(patron).map((paso) => {
        const Icono = ICONO_PASO[paso.estado];
        return (
          <li
            key={paso.codigo}
            className={cn('inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[12px] font-medium', TONO_PASO[paso.estado])}
            title={paso.estado === 'espera' ? 'Espera a que se complete el paso anterior' : undefined}
          >
            <Icono className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
            <span className="sr-only">{paso.estado === 'ok' ? 'Listo: ' : paso.estado === 'falta' ? 'Falta: ' : 'En espera: '}</span>
            {paso.label}
            {paso.detalle && <span className="font-normal text-fg-muted">· {paso.detalle}</span>}
          </li>
        );
      })}
    </ol>
  );
}

function Patron({ patron: p, anio, onPiezas, onEquipos }) {
  const siguiente = siguientePaso(p);
  return (
    <li className="rounded-xl border border-line bg-surface px-4 py-3">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[14px] font-semibold tracking-wide text-fg">{p.codigo}</span>
            <ToneBadge tone={p.listo ? 'success' : 'warning'}>{p.listo ? 'Listo' : 'Por completar'}</ToneBadge>
            {p.tipo && <span className="text-[12.5px] text-fg-muted">{TIPOS[p.tipo]}{p.clase ? ` ${p.clase}` : ''}</span>}
          </p>
          {p.instrumento && <p className="mt-0.5 truncate text-[12.5px] text-fg-muted">{p.instrumento}</p>}
        </div>
        <div className="text-right text-[12.5px] leading-snug">
          {p.uso.servicios > 0 ? (
            <>
              <p className="text-fg">Usado en {p.uso.servicios} {p.uso.servicios === 1 ? 'servicio' : 'servicios'} de {anio}</p>
              {p.uso.provisionales > 0
                ? <p className="font-medium text-warning">{p.uso.provisionales} provisionales por este patrón</p>
                : <p className="text-success">Ninguno provisional por él</p>}
              {p.uso.ultimo && <p className="text-fg-muted">Último: {formatDate(p.uso.ultimo)}</p>}
            </>
          ) : <p className="text-fg-muted">Sin servicios en {anio}</p>}
        </div>
      </div>
      <div className="mt-2.5"><Pasos patron={p} /></div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {siguiente && <p className="min-w-0 flex-1 text-[12.5px] text-fg"><span className="text-fg-muted">Siguiente: </span>{siguiente.texto}.</p>}
        {p.equipoId ? (
          <Button size="sm" variant="secondary" onClick={() => onPiezas(p.equipoId)} className="ml-auto">
            <Scale className="h-3.5 w-3.5" aria-hidden="true" /> Piezas y valores
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={onEquipos} className="ml-auto">Ir a Equipos</Button>
        )}
      </div>
    </li>
  );
}

/**
 * Calibración › Certificados › Patrones: qué le falta a cada juego de pesas
 * y termohigrómetro para que los cálculos dejen de ser provisionales, en el
 * orden en que más servicios destraba. «Piezas y valores» abre su ficha.
 */
export function PatronesPanel({ version, onPiezas, onEquipos }) {
  const anioActual = new Date().getFullYear();
  const [anio, setAnio] = useState(anioActual);
  const [estado, setEstado] = useState('TODOS');
  const [tipo, setTipo] = useState('TODOS');
  const [q, setQ] = useState('');
  const [intento, setIntento] = useState(0);
  // Se vuelve a leer al cambiar el año, al guardar piezas y valores (version) o al reintentar.
  const clave = `${anio}|${version}|${intento}`;
  const [estadoCarga, setEstadoCarga] = useState({ clave: null, data: null, error: null });
  useEffect(() => {
    let activo = true;
    calibrationApi.estadoPatrones(anio)
      .then((data) => { if (activo) setEstadoCarga({ clave, data, error: null }); })
      .catch((error) => { if (activo) setEstadoCarga(actual => ({ ...actual, clave, error })); });
    return () => { activo = false; };
  }, [anio, clave]);

  const { data, error } = estadoCarga;
  const loading = estadoCarga.clave !== clave;
  const patrones = useMemo(() => data?.patrones || [], [data]);
  const lista = useMemo(() => filtrarPatrones(patrones, { estado, tipo, q }), [patrones, estado, tipo, q]);
  const r = data?.resumen;
  const faltan = patrones.filter(p => !p.listo).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="min-w-0">
        <h2 className="text-xl font-semibold text-fg">Patrones de los certificados</h2>
        <p className="mt-1 max-w-3xl text-[13px] text-fg-muted">
          El cálculo de un servicio deja de ser provisional cuando cada juego de pesas y termohigrómetro que usó tenía ese día su certificado vigente, con los valores transcritos y verificados por otra persona, y el juego tiene sus piezas registradas. Arriba, los que más servicios dejan provisionales: conviene completarlos primero.
        </p>
      </div>

      {r && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="card px-4 py-3 shadow-card">
            <p className="text-[12px] text-fg-muted">Patrones listos</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-fg">{r.listos} <span className="text-[13px] font-normal text-fg-muted">de {r.patrones}</span></p>
          </div>
          <div className="card px-4 py-3 shadow-card">
            <p className="text-[12px] text-fg-muted">Servicios de {data.anio}</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-fg">{r.servicios}</p>
          </div>
          <div className="card px-4 py-3 shadow-card">
            <p className="text-[12px] text-fg-muted">Provisionales por sus patrones</p>
            <p className={cn('mt-0.5 text-xl font-semibold tabular-nums', r.serviciosProvisionales ? 'text-warning' : 'text-success')}>
              {r.serviciosProvisionales} <span className="text-[13px] font-normal text-fg-muted">de {r.servicios}</span>
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-line bg-surface px-3 focus-within:border-fg/40">
          <Search className="h-4 w-4 flex-none text-fg-subtle" aria-hidden="true" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por código o instrumento…" aria-label="Buscar patrones"
            className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-fg-subtle" />
        </label>
        <Dropdown
          value={tipo}
          onChange={setTipo}
          options={[{ value: 'TODOS', label: 'Pesas y termohigrómetros' }, { value: 'PESAS', label: 'Juegos de pesas' }, { value: 'AMBIENTE', label: 'Termohigrómetros' }]}
          ariaLabel="Tipo de patrón"
          className="w-56"
        />
        <Dropdown
          value={anio}
          onChange={v => setAnio(Number(v))}
          options={[anioActual, anioActual - 1, anioActual - 2].map(a => ({ value: a, label: `Servicios de ${a}` }))}
          ariaLabel="Año de los servicios"
          className="w-48"
        />
      </div>

      <Segmented
        label="Estado del patrón"
        value={estado}
        onChange={setEstado}
        options={[
          { value: 'TODOS', label: 'Todos', count: patrones.length },
          { value: 'FALTAN', label: 'Por completar', count: faltan, alert: faltan > 0 },
          { value: 'LISTOS', label: 'Listos', count: patrones.length - faltan },
        ]}
        className="cal-tabs self-start"
      />

      {!data && error && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3" role="alert">
          <AlertCircle className="h-[18px] w-[18px] flex-none text-danger" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-[13px] text-fg">{error.message}</p>
          <Button size="sm" variant="secondary" onClick={() => setIntento(n => n + 1)}>Reintentar</Button>
        </div>
      )}
      {!data && !error && (
        <div className="flex min-h-[30vh] items-center justify-center" role="status" aria-label="Cargando los patrones">
          {loading && <Loader2 className="h-5 w-5 animate-spin text-fg-subtle" />}
        </div>
      )}
      {data && !lista.length && (
        <EmptyState icon={Scale} title={patrones.length ? 'Ningún patrón coincide' : 'Sin patrones en este año'}>
          {patrones.length ? 'Prueba con otro texto, tipo o estado.' : 'Ningún servicio de ese año usó patrones registrados.'}
        </EmptyState>
      )}
      {lista.length > 0 && (
        <ul className={cn('flex flex-col gap-2 transition-opacity', loading && 'opacity-60')}>
          {lista.map(p => <Patron key={p.codigo} patron={p} anio={data.anio} onPiezas={onPiezas} onEquipos={onEquipos} />)}
        </ul>
      )}
    </div>
  );
}
