import { useCallback, useMemo, useState } from 'react';
import { AlertOctagon, AlertTriangle, Info, Pencil, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../../shared/utils/cn';
import { useResource } from '../../system/hooks/useResource';
import { calibrationApi } from '../api/calibration';
import { formatDate } from '../domain/format';
import {
  ESTADO_PATRON, METODOS, METODOS_CARGA, NIVELES, ORIGENES_ACORDADOS, REGLAS, SECCIONES, TIPOS_AJUSTE, VALORES_PATRON,
  conUnidad, instrumentoTexto, numero, ordenarAvisos, seccionDeAviso,
} from '../domain/servicios';
import {
  ACCIONES_REGISTRO, ESTADOS_REGISTRO, aTexto, camposDeSeccion, etiquetaColumna,
} from '../domain/registro';
import { CancelButton, Modal, ModalSection, PrimaryButton, ToneBadge } from './primitives';
import { CalculoServicio } from './CalculoServicio';
import { CorreccionesModal } from './CorreccionesModal';
import { PuntosAcordadosModal } from './PuntosAcordadosModal';
import { ReasonModal } from './ReasonModal';

const BOTON = 'flex h-9 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-[13px] font-semibold text-fg shadow-xs transition-colors hover:bg-surface-2 disabled:opacity-50';

const ICONOS = { error: AlertOctagon, aviso: AlertTriangle, info: Info };

const fechaHora = (iso) => new Date(iso).toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' });

const siNo = (valor) => (valor == null ? '—' : valor ? 'Sí' : 'No');

function ListaAvisos({ avisos }) {
  if (!avisos.length) return null;
  return (
    <ul className="mb-5 flex flex-col gap-1.5">
      {ordenarAvisos(avisos).map((aviso, index) => {
        const Icono = ICONOS[aviso.nivel];
        return (
          <li
            key={`${aviso.codigo}-${index}`}
            className={cn('flex gap-2.5 rounded-xl border px-3 py-2 text-[12.5px] leading-snug', `cal-tone-${NIVELES[aviso.nivel].tone}`)}
            style={{ borderColor: 'color-mix(in srgb, var(--tone) 35%, transparent)', background: 'color-mix(in srgb, var(--tone) 6%, transparent)' }}
          >
            <Icono className="mt-px h-4 w-4 flex-none" style={{ color: 'var(--tone)' }} aria-hidden="true" />
            <span className="text-fg">
              <span className="sr-only">{NIVELES[aviso.nivel].label}: </span>
              {aviso.mensaje}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Pares etiqueta–valor en dos columnas. */
function Datos({ filas }) {
  return (
    <dl className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
      {filas.filter(Boolean).map(([etiqueta, valor]) => (
        <div key={etiqueta} className="min-w-0">
          <dt className="text-[12px] text-fg-muted">{etiqueta}</dt>
          <dd className="break-words text-[13px] font-medium text-fg">{valor ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

function Tabla({ columnas, filas, vacio = 'Sin datos.' }) {
  if (!filas.length) return <p className="text-[13px] text-fg-muted">{vacio}</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-xs">
      <table className="w-full border-collapse text-[13px]">
        <thead className="bg-surface-2/60">
          <tr>
            {columnas.map(([titulo, alineacion]) => (
              <th key={titulo} className={cn('whitespace-nowrap px-3 py-2 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-fg-muted', alineacion === 'r' ? 'text-right' : 'text-left')}>
                {titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, index) => (
            <tr key={index} className="border-t border-line">
              {fila.map((celda, c) => (
                    <td key={c} className={cn('px-3 py-1.5 align-top', columnas[c][1] === 'r' ? 'text-right tabular-nums' : 'text-left')}>{celda ?? '—'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Subtitulo({ children }) {
  return <h4 className="mb-2 mt-5 text-[12.5px] font-semibold text-fg first:mt-0">{children}</h4>;
}

/** ¿La carga acordada se usó? Misma tolerancia que el servidor: d o 0,5 %. */
const usada = (carga, usadas, d) => usadas.some(valor => valor != null && Math.abs(valor - carga) <= Math.max(d || 0, Math.abs(carga) * 0.005));

function CargasAcordadas({ titulo, cargas, usadas, d, unidad }) {
  if (!cargas.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[12px] text-fg-muted">{titulo}</span>
      {cargas.map((carga) => {
        const ok = usada(carga, usadas, d);
        return (
          <span key={carga} className={cn('cal-badge', ok ? 'cal-tone-success' : 'cal-tone-warning')} title={ok ? 'Se usó' : 'No se usó'}>
            {conUnidad(carga, unidad)}
            <span className="sr-only">{ok ? ' (se usó)' : ' (no se usó)'}</span>
          </span>
        );
      })}
    </div>
  );
}

/**
 * Registro de calibración de un servicio, ordenado como RECA: los datos de
 * ServiceMET con sus correcciones, los avisos de cada sección, el cálculo y
 * el historial. Lo elabora el personal de Calibración (corrige por sección y
 * lo envía a revisión) y lo revisa el jefe de Calibración.
 */
export function ServicioModal({ codigo, canEdit, onClose, onChanged }) {
  const load = useCallback(() => calibrationApi.registro(codigo), [codigo]);
  const { data, error, reload } = useResource(load);
  const [editarPuntos, setEditarPuntos] = useState(false);
  const [corrigiendo, setCorrigiendo] = useState(null);
  const [confirmar, setConfirmar] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const porSeccion = useMemo(() => {
    const mapa = new Map(SECCIONES.map(seccion => [seccion.id, []]));
    for (const aviso of data?.avisos || []) mapa.get(seccionDeAviso(aviso)).push(aviso);
    return mapa;
  }, [data]);

  if (!data) {
    return (
      <Modal onClose={onClose} title="Servicio de calibración" subtitle={codigo} size="xl">
        <div className="px-6 py-10 text-sm text-fg-muted">
          {error ? <span className="text-danger">{error.message}</span> : 'Leyendo el servicio…'}
        </div>
      </Modal>
    );
  }

  const { modelo: m, avisos, versiones } = data;
  const conteo = (nivel) => avisos.filter(aviso => aviso.nivel === nivel).length;
  const unidad = m.instrumento.unidad;
  const dMin = Math.min(...m.instrumento.rangos.map(r => r.d).filter(d => d > 0), Infinity);
  const d = Number.isFinite(dMin) ? dMin : 0;
  const acordado = m.acordado;
  const cargasError = m.errores.puntos.map(p => p.carga);
  const patrones = [
    ...m.patrones.juegos.map(p => ({ ...p, tipo: 'Pesas' })),
    ...m.patrones.ambiente.map(p => ({ ...p, tipo: 'Ambiente' })),
  ];

  const permisos = data.permisos;
  const estado = ESTADOS_REGISTRO[data.estado] || ESTADOS_REGISTRO.PENDIENTE;
  const registro = data.registro;
  const efectivos = { ...data.fuente, ...data.datos.columnas };
  const etiquetaRegistro = `SECA ${m.servicio.seca?.libro || '—'} · RECA ${m.servicio.reca?.texto || '—'}`;

  const ejecutar = async (accion, mensaje) => {
    setOcupado(true);
    try {
      await accion();
      toast.success(mensaje);
      reload();
      onChanged?.();
    } catch (err) {
      toast.error(err.message || 'No se pudo completar la acción.');
    } finally {
      setOcupado(false);
    }
  };
  const guardar = async (cambios) => {
    await calibrationApi.guardarRegistro(codigo, { version: registro?.version ?? null, ...cambios });
    toast.success('Correcciones guardadas');
    reload();
    onChanged?.();
  };

  const seccion = (id, contenido, extra = {}) => {
    const meta = SECCIONES.find(item => item.id === id);
    const corregir = permisos.editar;
    return (
      <ModalSection
        title={meta.label}
        description={extra.descripcion}
        action={(extra.action || corregir) && (
          <div className="flex flex-wrap justify-end gap-2">
            {extra.action}
            {corregir && (
              <button type="button" onClick={() => setCorrigiendo(id)} className={BOTON}>
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                Corregir
              </button>
            )}
          </div>
        )}
      >
        <ListaAvisos avisos={porSeccion.get(id) || []} />
        {contenido}
      </ModalSection>
    );
  };

  return (
    <Modal
      onClose={onClose}
      size="xl"
      title={`SECA ${m.servicio.seca?.libro || m.servicio.seca?.original || '—'} · RECA ${m.servicio.reca?.texto || m.servicio.reca?.original || '—'}`}
      subtitle={(
        <>
          <span className="font-medium text-fg">{m.cliente.razonSocial || m.cliente.nombre || 'Sin cliente'}</span>
          <span aria-hidden="true" className="px-1.5 text-fg-subtle">·</span>
          <span>{[m.instrumento.codigoMetrica, instrumentoTexto(m.instrumento)].filter(Boolean).join(' · ')}</span>
        </>
      )}
      footer={(close) => (
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <p className="text-[12.5px] text-fg-muted">{estado.descripcion} Los datos de ServiceMET no se modifican.</p>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <CancelButton onClick={close} disabled={ocupado}>Cerrar</CancelButton>
            {permisos.retirar && (
              <button type="button" disabled={ocupado} className={BOTON} onClick={() => ejecutar(() => calibrationApi.retirarRegistro(codigo), 'Registro retirado de revisión')}>
                <Undo2 className="h-3.5 w-3.5" aria-hidden="true" /> Retirar de revisión
              </button>
            )}
            {permisos.reabrir && (
              <button type="button" disabled={ocupado} className={BOTON} onClick={() => setConfirmar('reabrir')}>Reabrir</button>
            )}
            {permisos.revisar && (
              <>
                <button type="button" disabled={ocupado} className={BOTON} onClick={() => setConfirmar('observar')}>Observar</button>
                <PrimaryButton busy={ocupado} busyLabel="Aprobando" onClick={() => ejecutar(() => calibrationApi.revisarRegistro(codigo, { decision: 'APROBAR' }), 'Registro aprobado')}>
                  Aprobar
                </PrimaryButton>
              </>
            )}
            {permisos.enviar && (
              <PrimaryButton busy={ocupado} busyLabel="Enviando" onClick={() => ejecutar(() => calibrationApi.enviarRegistro(codigo), 'Registro enviado a revisión')}>
                Enviar a revisión
              </PrimaryButton>
            )}
          </div>
        </div>
      )}
    >
      <div className="divide-y divide-line">
        <div className="flex flex-col gap-3 px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] text-fg-muted">Registro:</span>
            <ToneBadge tone={estado.tone}>{estado.label}</ToneBadge>
            {registro?.enviadoPor && data.estado !== 'BORRADOR' && (
              <span className="text-[12.5px] text-fg-muted">Enviado por {registro.enviadoPor} el {formatDate(registro.enviadoEn?.slice(0, 10))}</span>
            )}
            {registro?.revisadoPor && ['APROBADO', 'OBSERVADO'].includes(data.estado) && (
              <span className="text-[12.5px] text-fg-muted">· {data.estado === 'APROBADO' ? 'Aprobado' : 'Observado'} por {registro.revisadoPor} el {formatDate(registro.revisadoEn?.slice(0, 10))}</span>
            )}
          </div>
          {registro?.observacion && ['OBSERVADO', 'BORRADOR'].includes(data.estado) && (
            <p className="rounded-xl border border-danger/35 bg-danger/[0.06] px-3.5 py-2.5 text-[12.5px] text-fg">
              <span className="font-semibold">Observación del jefe de Calibración:</span> {registro.observacion}
            </p>
          )}
          {data.cambioDesdeEnvio && (
            <p className="rounded-xl border border-warning/35 bg-warning/[0.06] px-3.5 py-2.5 text-[12.5px] text-fg">
              Los datos cambiaron en ServiceMET desde el envío: no se puede aprobar sin retirarlo y volver a enviarlo.
            </p>
          )}
          {permisos.motivoRevisar && <p className="text-[12.5px] text-fg-muted">{permisos.motivoRevisar}</p>}
        </div>

        {data.correcciones.length > 0 && (
          <ModalSection title={`Correcciones (${data.correcciones.length})`} description="Datos de ServiceMET corregidos en este registro.">
            <Tabla
              columnas={[['Dato'], ['ServiceMET', 'r'], ['Corregido', 'r'], ...(permisos.editar ? [['']] : [])]}
              filas={data.correcciones.map(c => [
                etiquetaColumna(c.columna),
                aTexto(c.original) || 'vacío',
                <span key="v" className="font-semibold">{aTexto(c.corregido) || 'vacío'}</span>,
                ...(permisos.editar ? [(
                  <button
                    key="r"
                    type="button"
                    disabled={ocupado}
                    onClick={() => ejecutar(() => calibrationApi.guardarRegistro(codigo, { version: registro?.version ?? null, columnas: { [c.columna]: c.original } }), 'Valor de ServiceMET restaurado')}
                    className="text-[12.5px] font-medium text-fg-muted underline decoration-fg/30 underline-offset-4 hover:text-fg"
                  >
                    Restaurar
                  </button>
                )] : []),
              ])}
            />
          </ModalSection>
        )}

        <div className="flex flex-wrap items-center gap-2 px-5 py-4 sm:px-6">
          <span className="text-[13px] text-fg-muted">Calidad de los datos:</span>
          {conteo('error') > 0 && <ToneBadge tone="danger">{conteo('error')} {conteo('error') === 1 ? 'error' : 'errores'}</ToneBadge>}
          {conteo('aviso') > 0 && <ToneBadge tone="warning">{conteo('aviso')} {conteo('aviso') === 1 ? 'aviso' : 'avisos'}</ToneBadge>}
          {conteo('info') > 0 && <ToneBadge tone="info">{conteo('info')} {conteo('info') === 1 ? 'nota' : 'notas'}</ToneBadge>}
          {!conteo('error') && !conteo('aviso') && <ToneBadge tone="success">Sin observaciones</ToneBadge>}
          {conteo('error') > 0 && <span className="text-[12.5px] text-fg-muted">Con errores no se podría calcular el certificado.</span>}
        </div>

        {seccion('servicio', (
          <Datos filas={[
            ['Fecha del servicio', `${formatDate(m.servicio.fecha)}${m.servicio.horaInicio ? ` · ${m.servicio.horaInicio}${m.servicio.horaFin ? `–${m.servicio.horaFin}` : ''}` : ''}`],
            ['Técnico', m.servicio.tecnico.usuario
              ? `${m.servicio.tecnico.nombre} (${m.servicio.tecnico.iniciales || m.servicio.tecnico.usuario})`
              : `Sin identificar («${m.servicio.tecnico.original || 'vacío'}»)`],
            ['SECA', m.servicio.seca ? `${m.servicio.seca.libro || '—'} (en ServiceMET: ${m.servicio.seca.original})` : '—'],
            ['Negociación', m.servicio.seca?.negociacion],
            ['N.º de RECA', m.servicio.reca?.texto || m.servicio.reca?.original],
            ['Sticker', m.servicio.sticker],
            ['Tipo de servicio', m.servicio.tipo || 'No indicado'],
            ['Código en ServiceMET', <span key="codigo" className="font-mono text-[12.5px]">{m.servicio.codigo}</span>],
            versiones > 1 && ['Versiones', `ServiceMET lo envió ${versiones} veces; se muestra la última.`],
          ]}
          />
        ))}

        {seccion('instrumento', (
          <>
            <Datos filas={[
              ['Cliente', m.cliente.razonSocial || m.cliente.nombre],
              ['Planta', [m.cliente.planta, m.cliente.departamento].filter(Boolean).join(' · ')],
              ['Dirección', m.cliente.direccion],
              ['Instrumento', instrumentoTexto(m.instrumento)],
              ['Serie', m.instrumento.serie],
              ['Código Métrica', m.instrumento.codigoMetrica],
              ['Código interno', m.instrumento.codigoInterno],
              ['Ubicación', m.instrumento.ubicacion],
              ['Clase', m.instrumento.clase?.valor
                ? `${m.instrumento.clase.valor} (${data.origenesClase?.[m.instrumento.clase.origen] || m.instrumento.clase.origen})`
                : 'No declarada: se usará la que pida el cliente'],
            ]}
            />
            <Subtitulo>{m.instrumento.multirango ? 'Rangos (de menor a mayor)' : 'Rango'}</Subtitulo>
            <Tabla
              columnas={[['Max', 'r'], ['d', 'r'], ['e', 'r'], ['Decimales', 'r']]}
              filas={m.instrumento.rangos.map(r => [conUnidad(r.max, unidad), conUnidad(r.d, unidad), conUnidad(r.e, unidad), numero(r.decimales)])}
              vacio="ServiceMET no envió la capacidad máxima."
            />
          </>
        ))}

        {seccion('patrones', (
          <Tabla
            columnas={[['Tipo'], ['Código'], ['Cantidad', 'r'], ['En el gestor'], ['Certificado que regía'], ['Valores']]}
            filas={patrones.map(p => [
              p.tipo,
              <span key="c" className="font-mono text-[12.5px]">{p.original}</span>,
              numero(p.cantidad),
              <ToneBadge key="e" tone={ESTADO_PATRON[p.estado]?.tone || 'neutral'}>{ESTADO_PATRON[p.estado]?.label || p.estado}</ToneBadge>,
              p.certificado ? `${p.certificado.numero || 'Sin número'} · ${formatDate(p.certificado.fecha)}` : '—',
              p.valores ? <ToneBadge key="v" tone={VALORES_PATRON[p.valores].tone}>{VALORES_PATRON[p.valores].label}</ToneBadge> : '—',
            ])}
            vacio="No se indicaron patrones."
          />
        ), { descripcion: 'Cada juego de pesas y termohigrómetro comparado con el gestor de equipos en la fecha del servicio.' })}

        {seccion('ambiente', (
          <>
            <Tabla
              columnas={[['Momento'], ['Hora'], ['t (°C)', 'r'], ['HR (%)', 'r'], ['p (hPa)', 'r']]}
              filas={[
                ['Inicio', m.ambiente.inicio.hora, numero(m.ambiente.inicio.t), numero(m.ambiente.inicio.hr), numero(m.ambiente.inicio.p)],
                ['Fin', m.ambiente.fin.hora, numero(m.ambiente.fin.t), numero(m.ambiente.fin.hr), numero(m.ambiente.fin.p)],
              ]}
            />
            <Subtitulo>Inspección del lugar</Subtitulo>
            <Datos filas={[
              ['Estabilización de las pesas', m.lugar.estabilizacionPesas],
              ['Operación de la balanza', m.lugar.operacionBalanza],
              ...m.lugar.inspeccion.map(item => [item.etiqueta, item.comentario ? `${item.valor || '—'} · ${item.comentario}` : item.valor]),
            ]}
            />
          </>
        ))}

        {seccion('ajuste', (
          <>
            <Subtitulo>Precarga: lecturas antes del ajuste</Subtitulo>
            <Tabla
              columnas={[['Carga', 'r'], ['Indicación', 'r']]}
              filas={m.precarga.map(p => [conUnidad(p.carga, unidad), conUnidad(p.indicacion, unidad)])}
              vacio="Sin lecturas de precarga."
            />
            <Subtitulo>Ajuste</Subtitulo>
            <Datos filas={[
              ['¿Se ajustó?', siNo(m.ajuste.realizado)],
              ['Tipo', TIPOS_AJUSTE[m.ajuste.tipo] || '—'],
              ['Pesas usadas', m.ajuste.pesas?.original],
            ]}
            />
          </>
        ))}

        {seccion('excentricidad', (
          <>
            <Datos filas={[
              ['Plataforma', m.excentricidad.plataforma ? `${m.excentricidad.plataforma.charAt(0)}${m.excentricidad.plataforma.slice(1).toLowerCase()}` : '—'],
              ['Esquema indicado', m.excentricidad.indicador],
              ['Carga', conUnidad(m.excentricidad.carga, unidad)],
              m.excentricidad.comentario && ['Comentario', m.excentricidad.comentario],
            ]}
            />
            <div className="mt-4">
              <Tabla
                columnas={[['Posición', 'r'], ['Indicación', 'r'], ['Retorno', 'r']]}
                filas={m.excentricidad.posiciones.map(p => [p.posicion, conUnidad(p.indicacion, unidad), numero(p.retorno)])}
                vacio="Sin lecturas de excentricidad."
              />
            </div>
          </>
        ))}

        {seccion('repetibilidad', (
          <>
            <Tabla
              columnas={[['Carga', 'r'], ['Lecturas', 'r'], ['Indicaciones'], ['Retornos']]}
              filas={m.repetibilidad.ensayos.map(e => [
                conUnidad(e.carga, unidad),
                e.lecturas.length,
                e.lecturas.map(l => numero(l.indicacion)).join(' · '),
                e.lecturas.map(l => numero(l.retorno)).join(' · '),
              ])}
              vacio="Sin ensayo de repetibilidad."
            />
            {m.repetibilidad.comentario && <p className="mt-3 text-[12.5px] text-fg-muted">{m.repetibilidad.comentario}</p>}
          </>
        ))}

        {seccion('errores', (
          <>
            <Datos filas={[
              ['Método', METODOS[m.errores.metodo] || '—'],
              ['Método de carga', METODOS_CARGA[m.errores.metodoCarga] || '—'],
              m.errores.cargasValidadas != null && ['Cargas validadas en ServiceMET', m.errores.cargasValidadas],
              m.errores.validacionPesas === 'PENDIENTE' && ['Validación de las pesas', 'Pendiente en ServiceMET'],
            ]}
            />
            <div className="mt-4">
              <Tabla
                columnas={[['N.º', 'r'], ['Carga', 'r'], ['Indicación', 'r'], ['Retorno', 'r'], ['Acordada']]}
                filas={m.errores.puntos.map(p => [
                  p.n,
                  conUnidad(p.carga, unidad),
                  p.indicacion == null ? <ToneBadge key="s" tone="warning">Sin indicación</ToneBadge> : conUnidad(p.indicacion, unidad),
                  numero(p.retorno),
                  acordado?.errores.length ? (usada(p.carga, acordado.errores, d) ? 'Sí' : '—') : '—',
                ])}
                vacio="Sin puntos del ensayo de error."
              />
            </div>
            <Subtitulo>Puntos acordados del instrumento</Subtitulo>
            {acordado ? (
              <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface px-3.5 py-3">
                <p className="text-[12px] text-fg-muted">
                  Origen: {ORIGENES_ACORDADOS[acordado.origen] || acordado.origen}. En verde las que se usaron; en amarillo, las que no. Son una referencia: el certificado usa lo medido.
                </p>
                <CargasAcordadas titulo="Error" cargas={acordado.errores} usadas={cargasError} d={d} unidad={acordado.unidad} />
                <CargasAcordadas titulo="Repetibilidad" cargas={acordado.repetibilidad} usadas={m.repetibilidad.ensayos.map(e => e.carga)} d={d} unidad={acordado.unidad} />
                {acordado.excentricidad && (
                  <CargasAcordadas
                    titulo="Excentricidad"
                    cargas={[acordado.excentricidad]}
                    usadas={[m.excentricidad.carga, ...m.excentricidad.posiciones.map(p => p.indicacion)]}
                    d={d}
                    unidad={acordado.unidad}
                  />
                )}
              </div>
            ) : (
              <p className="text-[13px] text-fg-muted">Este instrumento no tiene puntos acordados en DataMET+.</p>
            )}
            {m.errores.comentario && <p className="mt-3 text-[12.5px] text-fg-muted">{m.errores.comentario}</p>}
          </>
        ), {
          action: canEdit && m.instrumento.codigoMetrica && (
            <button
              type="button"
              onClick={() => setEditarPuntos(true)}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-[13px] font-semibold text-fg shadow-xs transition-colors hover:bg-surface-2"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              Puntos acordados
            </button>
          ),
        })}

        <ModalSection
          title="Resultados (vista previa)"
          description="Calculados con el motor de DataMET+ (EURAMET cg-18 v4.0) con los datos corregidos. Al aprobar, el resultado queda guardado."
        >
          <CalculoServicio data={data.calculo} />
        </ModalSection>

        {seccion('criterio', (
          <Datos filas={[
            ['emp según NB 23001', siNo(m.criterio.empNB23001)],
            ['Tolerancia del cliente (%)', numero(m.criterio.toleranciaCliente)],
            ['Factor de seguridad', numero(m.criterio.factorSeguridad)],
            ['Regla de decisión', REGLAS[m.criterio.regla] || 'No indicada'],
            ['Mantenimiento del soporte', siNo(m.cierre.mantenimientoSoporte)],
            ['Venta de pesas', siNo(m.cierre.ventaPesas)],
            ['Reemplazo', siNo(m.cierre.reemplazo)],
            ['Observaciones', m.cierre.observaciones],
          ]}
          />
        ))}

        {data.historial.length > 0 && (
          <ModalSection title="Historial del registro">
            <ul className="flex flex-col gap-2.5">
              {data.historial.map(item => (
                <li key={item.id} className="text-[12.5px]">
                  <span className="font-medium text-fg">{ACCIONES_REGISTRO[item.accion] || item.accion}</span>
                  <span className="text-fg-muted"> · {item.usuario} · {fechaHora(item.fecha)}</span>
                  {item.motivo && <span className="block text-fg-muted">{item.motivo}</span>}
                  {item.cambios.length > 0 && (
                    <span className="block text-fg-muted">
                      {item.cambios.map(c => `${etiquetaColumna(c.campo)}: ${aTexto(c.antes) || 'vacío'} → ${aTexto(c.despues) || 'vacío'}`).join(' · ')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </ModalSection>
        )}
      </div>

      {corrigiendo && (
        <CorreccionesModal
          titulo={SECCIONES.find(item => item.id === corrigiendo)?.label}
          campos={camposDeSeccion(corrigiendo, efectivos)}
          fuente={data.fuente}
          efectivos={efectivos}
          clase={data.datos.clase}
          origenesClase={data.origenesClase}
          onClose={() => setCorrigiendo(null)}
          onGuardar={guardar}
        />
      )}
      {confirmar === 'observar' && (
        <ReasonModal
          title="Observar el registro"
          subtitle={etiquetaRegistro}
          heading="Devolver con una observación"
          description="El registro vuelve a quien lo elaboró para que lo corrija y lo envíe de nuevo."
          confirmLabel="Observar"
          reasonLabel="Observación"
          reasonPlaceholder="Qué debe revisar o corregir"
          onConfirm={async (observacion) => {
            await calibrationApi.revisarRegistro(codigo, { decision: 'OBSERVAR', observacion });
            toast.success('Registro observado');
            reload();
            onChanged?.();
          }}
          onClose={() => setConfirmar(null)}
        />
      )}
      {confirmar === 'reabrir' && (
        <ReasonModal
          title="Reabrir el registro aprobado"
          subtitle={etiquetaRegistro}
          heading="Volver a borrador"
          description="Se podrá corregir y deberá enviarse y aprobarse de nuevo. El motivo queda en el historial."
          confirmLabel="Reabrir"
          onConfirm={async (motivo) => {
            await calibrationApi.reabrirRegistro(codigo, { motivo });
            toast.success('Registro reabierto');
            reload();
            onChanged?.();
          }}
          onClose={() => setConfirmar(null)}
        />
      )}

      {editarPuntos && (
        <PuntosAcordadosModal
          codMetrica={m.instrumento.codigoMetrica}
          unidadInstrumento={unidad}
          instrumento={[m.instrumento.codigoMetrica, instrumentoTexto(m.instrumento)].filter(Boolean).join(' · ')}
          onClose={() => setEditarPuntos(false)}
          onSaved={() => {
            reload();
            onChanged?.();
          }}
        />
      )}
    </Modal>
  );
}
