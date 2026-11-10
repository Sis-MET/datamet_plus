import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, BadgeCheck, FilePenLine, History, Loader2, SlidersHorizontal, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../../../shared/utils/cn';
import { Button } from '../../../../shared/components/ui/Button';
import { useResource } from '../../../system/hooks/useResource';
import { calibrationApi } from '../../api/calibration';
import {
  ACCIONES_METODO, AIRE, CIFRAS_U, CLASE_SUGERIDA, COBERTURA, EMPUJE, ESTADOS_VERSION, EXCENTRICIDAD, REPETIBILIDAD, SENTIDO_U,
  avisosMetodo, conRuta, diferencias, etiquetaRuta, leerRuta, textoValor, tocaRuta, validar,
} from '../../domain/metodo';
import { CancelButton, PrimaryButton, Segmented, ToneBadge } from '../primitives';
import { ReasonModal } from '../ReasonModal';
import {
  CampoClases, CampoInterruptor, CampoLista, CampoNumero, CampoOpciones, CampoTexto, EdicionMetodo, ListaTextos, Si, TablaDensidades, TablaEstabilizacion,
} from './CamposMetodo';

const fechaHora = iso => (iso ? new Date(/Z$/.test(iso) ? iso : `${iso}Z`).toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const fecha = iso => (iso ? new Date(/Z$/.test(iso) ? iso : `${iso}Z`).toLocaleDateString('es-BO', { dateStyle: 'medium' }) : '—');

const SECCIONES = [
  {
    id: 'calculo',
    label: 'Cálculo',
    rutas: ['parametros.repetibilidad', 'parametros.cobertura', 'parametros.redondeoU', 'parametros.aire', 'parametros.excentricidad', 'parametros.empuje', 'parametros.kD'],
  },
  { id: 'conformidad', label: 'Conformidad', rutas: ['parametros.conformidad', 'parametros.empServicio', 'parametros.claseSugerida'] },
  { id: 'conveccion', label: 'Convección', rutas: ['parametros.conveccion'] },
  { id: 'densidades', label: 'Densidades', rutas: ['parametros.densidades'] },
  { id: 'avisos', label: 'Avisos', rutas: ['parametros.avisos'] },
  { id: 'uso', label: 'En uso y pesada mínima', rutas: ['parametros.enUso', 'parametros.pesadaMinima'] },
  { id: 'usp', label: 'USP ⟨41⟩', rutas: ['parametros.usp'] },
  { id: 'textos', label: 'Textos del certificado', rutas: ['textos'] },
];
const S = Object.fromEntries(SECCIONES.map(s => [s.id, s]));

function Seccion({ meta, titulo, descripcion, cambios, children }) {
  const n = cambios.filter(d => meta.rutas.some(r => d.ruta === r || d.ruta.startsWith(`${r}.`) || d.ruta.startsWith(`${r}[`))).length;
  return (
    <section id={`metodo-${meta.id}`} aria-labelledby={`metodo-titulo-${meta.id}`} className="card scroll-mt-24 p-4 shadow-card sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 id={`metodo-titulo-${meta.id}`} className="text-sm font-semibold text-fg">{titulo || meta.label}</h3>
        {n > 0 && <span className="cal-badge cal-tone-info">{n} {n === 1 ? 'cambio' : 'cambios'}</span>}
      </div>
      {descripcion && <p className="-mt-1 mb-4 max-w-prose text-[12.5px] leading-relaxed text-fg-muted">{descripcion}</p>}
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

/** Las secciones editables (o de solo lectura) de una versión. */
function Secciones({ cambios, avisos = [] }) {
  return (
    <>
      <Seccion meta={S.calculo} titulo="Reglas de cálculo" cambios={cambios} descripcion="Las fórmulas están programadas y validadas con los ejemplos de EURAMET, la Guía SIM y la GUM (ver Validación); aquí el laboratorio elige entre las opciones que las guías permiten y fija sus valores. La primera opción de cada regla es la de la versión 1.">
        {avisos.length > 0 && (
          <ul className="flex flex-col gap-1.5" role="status">
            {avisos.map(a => (
              <li key={a} className="flex items-start gap-2 rounded-xl border border-warning/35 bg-warning/[0.06] px-3 py-2 text-[12.5px] text-fg">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-none text-warning" aria-hidden="true" /> {a}
              </li>
            ))}
          </ul>
        )}
        <CampoOpciones ruta="parametros.repetibilidad.regla" etiqueta="Desviación estándar de repetibilidad en cada carga" opciones={REPETIBILIDAD} />
        <CampoOpciones ruta="parametros.cobertura.metodo" etiqueta="Factor de cobertura k" opciones={COBERTURA} />
        <Si ruta="parametros.cobertura.metodo" igual="T_STUDENT">
          <CampoNumero ruta="parametros.cobertura.probabilidad" etiqueta="Probabilidad de cobertura" ayuda="95,45 % es la de EURAMET 7.3 (k = 2 con muchos grados de libertad); 95 % da k = 1,96." />
        </Si>
        <Si ruta="parametros.cobertura.metodo" igual="FIJO">
          <CampoNumero ruta="parametros.cobertura.k" etiqueta="k fijo" ayuda="El que se imprime en todos los puntos." />
        </Si>
        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
          <CampoOpciones ruta="parametros.redondeoU.cifras" etiqueta="Cifras significativas de U" opciones={CIFRAS_U} />
          <CampoOpciones ruta="parametros.redondeoU.sentido" etiqueta="Redondeo de U" opciones={SENTIDO_U} />
        </div>
        <p className="-mt-2 text-[11.5px] text-fg-muted">El error se imprime con los mismos decimales que U.</p>
        <CampoOpciones ruta="parametros.aire.formula" etiqueta="Densidad del aire" opciones={AIRE} />
        <CampoOpciones ruta="parametros.excentricidad.metodo" etiqueta="Excentricidad" opciones={EXCENTRICIDAD} />
        <CampoOpciones ruta="parametros.empuje" etiqueta="Incertidumbre del empuje del aire" opciones={EMPUJE} />
        <CampoNumero ruta="parametros.kD" etiqueta="Factor de deriva kD" ayuda="Límite de la deriva D = kD·U del certificado de la pesa (EURAMET 7.1.2-10), entre 1 y 3." />
      </Seccion>

      <Seccion meta={S.conformidad} titulo="Tolerancia y conformidad" cambios={cambios} descripcion="Cómo se arma el emp NB 23001 y cómo se decide la conformidad (NB/ISO/IEC 17025 7.8.6). La regla de cada servicio (simple o conservadora) la pide el cliente en ServiceMET.">
        <CampoNumero ruta="parametros.empServicio.factor" etiqueta="emp en servicio" ayuda="El emp de verificación inicial de la OIML R76 (Tabla 6) por este factor. La NB 23001 y la R76 (3.5.2) usan el doble: 2." />
        <CampoNumero ruta="parametros.conformidad.bandaGuarda" etiqueta="Banda de guarda de la regla conservadora" ayuda="Conforme si |E| + factor · U ≤ T. Con 1: |E| + U ≤ T (decisión 7); con 0 queda igual que la regla simple." />
        <CampoNumero ruta="parametros.conformidad.riesgoUmbral" etiqueta="Riesgo que se escribe «menor que»" ayuda="Por debajo de este riesgo el certificado escribe «< 5,00» en vez del valor." />
        <CampoOpciones ruta="parametros.claseSugerida.regla" etiqueta="Clase sugerida cuando el instrumento no la tiene" opciones={CLASE_SUGERIDA} />
      </Seccion>

      <Seccion meta={S.conveccion} cambios={cambios} descripcion="Con pesas a distinta temperatura que el aire (EURAMET 7.1.2-13, Anexo F). El ΔT sale del tiempo de estabilización que registra ServiceMET; el texto se compara sin tildes ni mayúsculas.">
        <CampoInterruptor ruta="parametros.conveccion.activa" etiqueta="Incluir la convección" ayuda="En las pesas de las clases elegidas, con el límite de la tabla F2.1." />
        <CampoClases ruta="parametros.conveccion.clases" etiqueta="Clases de pesas" ayuda="EURAMET la pide en F1 o mejores." />
        <TablaEstabilizacion />
        <CampoNumero ruta="parametros.conveccion.deltaTSinDato" etiqueta="ΔT sin dato de estabilización" />
      </Seccion>

      <Seccion meta={S.densidades} titulo="Densidades por material" cambios={cambios} descripcion="Cuando la pieza no tiene su densidad medida, se supone la del material (OIML R111 B.7). Gana la primera fila con una palabra clave contenida en el material: el orden importa.">
        <TablaDensidades />
      </Seccion>

      <Seccion meta={S.avisos} cambios={cambios} descripcion="Umbrales de los avisos que ve el revisor; no cambian el resultado.">
        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-3">
          <CampoNumero ruta="parametros.avisos.excentricidadEnD" etiqueta="Excentricidad mayor que" ayuda="Diferencia máxima de excentricidad." />
          <CampoNumero ruta="parametros.avisos.lecturaVsCargaEnD" etiqueta="Lectura lejos de la carga" ayuda="Indicación frente a la carga aplicada." />
          <CampoNumero ruta="parametros.avisos.uEnD" etiqueta="Incertidumbre mayor que" ayuda="U(E) frente a la división." />
        </div>
      </Seccion>

      <Seccion meta={S.uso} cambios={cambios} descripcion="Información adicional del anexo, que no forma parte del certificado (EURAMET 7.4, 7.5 y Anexo G). Son supuestos del lugar de uso y se declaran en el anexo.">
        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
          <CampoNumero ruta="parametros.enUso.k" etiqueta="Factor de cobertura en uso" />
          <CampoNumero ruta="parametros.enUso.deltaT" etiqueta="Variación de temperatura del lugar" />
          <CampoNumero ruta="parametros.enUso.kT" etiqueta="Coeficiente de temperatura KT" placeholder="Por la clase (R76)" ayuda="Vacío: el límite de la R76 para la clase del instrumento." />
          <CampoNumero ruta="parametros.enUso.factorKT" etiqueta="Factor sobre el KT de la R76" ayuda="1 si el instrumento tiene aprobación de modelo; 3 a 10 si no." />
        </div>
        <CampoLista ruta="parametros.enUso.fracciones" etiqueta="Cargas de la tabla en uso" ayuda="Porcentajes de Max, separados por punto y coma." />
        <CampoLista ruta="parametros.pesadaMinima.exactitudes" etiqueta="Exactitudes de la pesada mínima" ayuda="Porcentajes, separados por punto y coma." />
        <CampoLista ruta="parametros.pesadaMinima.factores" etiqueta="Factores de seguridad" ayuda="Separados por punto y coma. También son los del peso mínimo de muestra de la USP ⟨41⟩." />
      </Seccion>

      <Seccion meta={S.usp} titulo="Evaluación USP ⟨41⟩" cambios={cambios} descripcion="Para clientes farmacéuticos: va en el anexo cuando el registro la pide, como la hoja INCO del libro. Los valores iniciales son los que usaba el libro.">
        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
          <CampoNumero ruta="parametros.usp.tolerancia" etiqueta="Tolerancia" ayuda="Límite de la repetibilidad (factor · s / carga) y del error en la exactitud." />
          <CampoNumero ruta="parametros.usp.cargaEvaluacion" etiqueta="Carga de evaluación" ayuda="Carga de la repetibilidad y menor carga de la exactitud." />
          <CampoNumero ruta="parametros.usp.factorS" etiqueta="Factor de la desviación estándar" ayuda="Se compara factor · s / carga con la tolerancia." />
          <CampoNumero ruta="parametros.usp.sMinimaEnD" etiqueta="Desviación estándar mínima" ayuda="Si la s medida es menor, se usa esta." />
          <CampoNumero ruta="parametros.usp.divisorPesas" etiqueta="Divisor para las pesas" ayuda="Las pesas son adecuadas si su U (k = 2) no supera la tolerancia dividida por este número." />
        </div>
      </Seccion>

      <Seccion meta={S.textos} titulo="Textos del certificado" cambios={cambios} descripcion="Van en los dos modelos del certificado. Los ya emitidos conservan el texto con el que se autorizaron.">
        <CampoTexto ruta="textos.metodo" etiqueta="Método" />
        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
          <CampoTexto ruta="textos.fechaEmision" etiqueta="Fecha de emisión" filas={2} />
          <CampoTexto ruta="textos.alcanceNota" etiqueta="Nota del alcance" filas={2} />
        </div>
        <ListaTextos ruta="textos.leyenda" etiqueta="Leyenda" minimo={1} maximo={4} />
        <CampoTexto ruta="textos.pruebasConExcentricidad" etiqueta="Pruebas realizadas (con excentricidad)" filas={2} />
        <CampoTexto ruta="textos.pruebasSinExcentricidad" etiqueta="Pruebas realizadas (sin excentricidad)" filas={2} />
        <ListaTextos ruta="textos.pruebas" etiqueta="Frases de las pruebas" ayuda="Se agregan después de la frase de las pruebas realizadas." maximo={8} />
        <CampoTexto ruta="textos.sustitucion" etiqueta="Cargas de sustitución" filas={2} />
        <CampoTexto ruta="textos.incertidumbre" etiqueta="Incertidumbre" filas={4} />
        <CampoTexto ruta="textos.repetibilidad" etiqueta="Repetibilidad" filas={2} />
        <CampoTexto ruta="textos.reglas.SIMPLE" etiqueta="Regla de decisión simple" filas={3} />
        <CampoTexto ruta="textos.reglas.CONSERVADORA" etiqueta="Regla de decisión conservadora" filas={3} />
        <CampoTexto ruta="textos.reglas.NINGUNA" etiqueta="Sin declaración de conformidad" filas={2} />
        <CampoTexto ruta="textos.datosCliente" etiqueta="Datos del cliente" filas={2} />
      </Seccion>
    </>
  );
}

function ListaCambios({ cambios, pendientes = [], vacio }) {
  if (!cambios.length) return <p className="text-[12.5px] text-fg-muted">{vacio}</p>;
  return (
    <ul className="flex flex-col gap-1.5">
      {cambios.map(c => (
        <li key={c.ruta} className="rounded-lg border border-line px-3 py-2 text-[12.5px]">
          <p className="flex items-center gap-1.5 font-medium text-fg">
            {tocaRuta(pendientes, c.ruta) && <span className="h-1.5 w-1.5 flex-none rounded-full bg-warning" title="Sin guardar" aria-label="Sin guardar" />}
            {etiquetaRuta(c.ruta)}
          </p>
          <p className="mt-0.5 break-words text-fg-muted">
            <span className="line-through decoration-fg-subtle/60">{textoValor(c.antes, c.ruta)}</span> → <span className="text-fg">{textoValor(c.despues, c.ruta)}</span>
          </p>
        </li>
      ))}
    </ul>
  );
}

function EstadoMetodo({ data, pendientes, onAccion }) {
  const { vigente, borrador, permisos } = data;
  const pendiente = data.versiones.find(v => v.version === data.porAprobar);
  return (
    <section aria-label="Estado de la configuración" className="rounded-2xl border border-line bg-surface-2 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 text-[13px]">
          {vigente && (
            <p className="flex flex-wrap items-center gap-2">
              <ToneBadge tone="success">Vigente: versión {vigente.version}</ToneBadge>
              <span className="text-fg-muted">
                {vigente.aprobadoPor ? `Aprobada por ${vigente.aprobadoPor} · ${fecha(vigente.aprobadoEn)}` : 'Configuración inicial del sistema (fase 0), sin aprobar'}
                {vigente.vigenteDesde ? ` · rige desde ${fecha(vigente.vigenteDesde)}` : ''}
              </span>
            </p>
          )}
          {borrador && (
            <p className="mt-2 flex flex-wrap items-center gap-2">
              <ToneBadge tone="warning">Borrador: versión {borrador.version}</ToneBadge>
              <span className="text-fg-muted">
                Desde la {borrador.base} · {borrador.diferencias.length} {borrador.diferencias.length === 1 ? 'cambio' : 'cambios'} · redactado por {borrador.creadoPor}
                {borrador.modificadoEn ? ` · guardado ${fechaHora(borrador.modificadoEn)}` : ''}
              </span>
            </p>
          )}
          {borrador?.motivo && <p className="mt-1.5 break-words text-fg"><strong>Motivo:</strong> {borrador.motivo}</p>}
          <p className="mt-2 text-fg-muted">
            Los registros sin aprobar se calculan con la versión vigente; los aprobados, autorizados y emitidos conservan la versión con la que se aprobaron.
          </p>
          {pendiente && !permisos.aprobar && permisos.motivoAprobar && <p className="mt-1.5 text-fg-muted">{permisos.motivoAprobar}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {permisos.descartar && (
            <Button variant="ghost" onClick={() => onAccion('descartar')}><Trash2 className="h-4 w-4" aria-hidden="true" /> Descartar borrador</Button>
          )}
          {permisos.redactar && (
            <Button variant="secondary" onClick={() => onAccion('crear')}><FilePenLine className="h-4 w-4" aria-hidden="true" /> Nueva versión</Button>
          )}
          {permisos.aprobar && pendiente && (
            <Button onClick={() => onAccion('aprobar')} disabled={pendientes > 0} title={pendientes > 0 ? 'Guarda los cambios primero' : undefined}>
              <BadgeCheck className="h-4 w-4" aria-hidden="true" /> Aprobar versión {pendiente.version}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

function HistorialMetodo({ data }) {
  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Versiones" className="card p-4 shadow-card sm:p-5">
        <h3 className="text-sm font-semibold text-fg">Versiones</h3>
        <p className="mt-0.5 text-[12.5px] text-fg-muted">Ninguna se borra: las reemplazadas y descartadas quedan con sus diferencias.</p>
        <ul className="mt-3 flex flex-col gap-2">
          {data.versiones.map((v) => {
            const meta = ESTADOS_VERSION[v.estado] || { label: v.estado, tone: 'muted' };
            return (
              <li key={v.version} className="rounded-xl border border-line px-3.5 py-2.5 text-[12.5px]">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="font-semibold text-fg">Versión {v.version}</span>
                  <ToneBadge tone={meta.tone}>{meta.label}</ToneBadge>
                  <span className="min-w-0 flex-1 text-fg-muted">
                    {v.inicial ? 'Inicial del sistema' : `Redactada por ${v.creadoPor}`}
                    {v.aprobadoPor ? ` · aprobada por ${v.aprobadoPor} (${fecha(v.aprobadoEn)})` : ''}
                    {v.vigenteHasta ? ` · rigió hasta ${fecha(v.vigenteHasta)}` : ''}
                  </span>
                </div>
                {v.motivo && <p className="mt-1 text-fg">{v.motivo}</p>}
                {v.diferencias.length > 0 && (
                  <details className="mt-1.5">
                    <summary className="cursor-pointer font-medium text-info">{v.diferencias.length} {v.diferencias.length === 1 ? 'cambio' : 'cambios'} frente a la versión {v.base}</summary>
                    <div className="mt-2"><ListaCambios cambios={v.diferencias} /></div>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      </section>
      <section aria-label="Historial" className="card p-4 shadow-card sm:p-5">
        <h3 className="text-sm font-semibold text-fg">Historial</h3>
        <ol className="mt-3 flex flex-col">
          {data.historial.map(item => (
            <li key={item.id} className="relative border-l border-line pb-3.5 pl-4 last:pb-0">
              <span className="absolute -left-[4.5px] top-1.5 h-2 w-2 rounded-full bg-fg-subtle" aria-hidden="true" />
              <p className="text-[12.5px]">
                <span className="font-semibold text-fg">
                  {item.accion === 'CREACION' && data.versiones.find(v => v.version === item.version)?.inicial
                    ? 'Creada por el sistema'
                    : ACCIONES_METODO[item.accion] || item.accion}
                </span>
                <span className="text-fg-muted"> · versión {item.version} · {item.usuario} · {fechaHora(item.fecha)}</span>
              </p>
              {item.motivo && <p className="text-[12.5px] text-fg">{item.motivo}</p>}
              {item.cambios.length > 0 && (
                <ul className="mt-1 flex flex-col gap-0.5 text-[12px] text-fg-muted">
                  {item.cambios.map(c => <li key={c.ruta}>{etiquetaRuta(c.ruta)}: {textoValor(c.antes, c.ruta)} → <span className="font-medium text-fg">{textoValor(c.despues, c.ruta)}</span></li>)}
                </ul>
              )}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

/**
 * Calibración > Método: la configuración del método por versiones (fase 6),
 * como página. Se edita el borrador con las marcas del registro; al costado,
 * sus cambios frente a la versión de la que partió. El jefe la aprueba.
 */
export function MetodoPagina() {
  const { data, error, loading, reload } = useResource(calibrationApi.metodo);
  const [vista, setVista] = useState(null);
  const [edicion, setEdicion] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [confirmar, setConfirmar] = useState(null);

  const borrador = data?.borrador || null;
  const vistaActual = vista === 'historial' ? 'historial' : borrador && vista !== 'vigente' ? 'borrador' : 'vigente';
  const editable = vistaActual === 'borrador' && Boolean(data?.permisos.editar);
  const baseContenido = borrador ? data.versiones.find(v => v.version === borrador.base)?.contenido : null;
  const mostrado = vistaActual === 'borrador' ? (edicion || borrador.contenido) : data?.vigente?.contenido;
  const pendientes = useMemo(() => (edicion && borrador ? diferencias(borrador.contenido, edicion) : []), [edicion, borrador]);
  const frenteBase = useMemo(() => (vistaActual === 'borrador' && mostrado ? diferencias(baseContenido, mostrado) : []), [vistaActual, baseContenido, mostrado]);
  const problemas = useMemo(() => (editable && mostrado ? validar(mostrado) : {}), [editable, mostrado]);
  const avisos = useMemo(() => (mostrado ? avisosMetodo(mostrado) : []), [mostrado]);
  const nProblemas = Object.keys(problemas).length;

  const contexto = useMemo(() => ({
    editable,
    valor: ruta => leerRuta(mostrado, ruta),
    cambiar: (ruta, valor) => setEdicion(actual => conRuta(actual || borrador.contenido, ruta, valor)),
    marca: ruta => (tocaRuta(pendientes, ruta) ? 'pendiente' : tocaRuta(frenteBase, ruta) ? 'cambiado' : null),
    problema: ruta => problemas[ruta] || null,
  }), [editable, mostrado, borrador, pendientes, frenteBase, problemas]);

  const guardar = useCallback(async () => {
    if (!edicion || !pendientes.length || guardando) return;
    if (nProblemas) { toast.error('Hay valores por corregir antes de guardar.'); return; }
    setGuardando(true);
    try {
      const r = await calibrationApi.guardarBorradorMetodo({ revision: borrador.revision, contenido: edicion, motivo: motivo.trim() || null });
      toast.success(r.cambios === 1 ? 'Se guardó 1 cambio' : `Se guardaron ${r.cambios} cambios`);
      setEdicion(null);
      setMotivo('');
      reload();
    } catch (failure) {
      toast.error(failure.message);
    } finally {
      setGuardando(false);
    }
  }, [edicion, pendientes.length, guardando, nProblemas, borrador, motivo, reload]);

  // Ctrl+S guarda, como en el registro y en Soporte.
  const guardarRef = useRef(guardar);
  useEffect(() => { guardarRef.current = guardar; }, [guardar]);
  useEffect(() => {
    const handler = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        guardarRef.current();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  useEffect(() => {
    if (!pendientes.length) return undefined;
    const handler = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [pendientes.length]);

  if (!data) {
    return error ? (
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3" role="alert">
        <AlertCircle className="h-[18px] w-[18px] flex-none text-danger" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-[13px] text-fg">{error.message}</p>
        <Button size="sm" variant="secondary" onClick={reload}>Reintentar</Button>
      </div>
    ) : (
      <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-label="Cargando la configuración del método">
        {loading && <Loader2 className="h-5 w-5 animate-spin text-fg-subtle" />}
      </div>
    );
  }

  const opciones = [
    ...(borrador ? [{ value: 'borrador', label: `Borrador v${borrador.version}`, icon: <FilePenLine className="h-4 w-4" aria-hidden="true" />, count: frenteBase.length || undefined }] : []),
    { value: 'vigente', label: `Vigente v${data.vigente.version}`, icon: <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> },
    { value: 'historial', label: 'Historial', icon: <History className="h-4 w-4" aria-hidden="true" />, count: data.versiones.length },
  ];
  const pendienteAprobar = data.versiones.find(v => v.version === data.porAprobar);
  const cambiosAprobar = pendienteAprobar?.estado === 'BORRADOR' ? pendienteAprobar.diferencias : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="min-w-0">
        <h2 className="text-xl font-semibold text-fg">Configuración del método</h2>
        <p className="mt-1 max-w-3xl text-[13px] text-fg-muted">
          Reglas de cálculo, parámetros, tablas y textos del certificado de balanzas, por versión: el laboratorio los define sin cambiar el programa. Cada versión nueva se redacta como borrador y la aprueba el jefe de Calibración; quien la redacta no la aprueba (NB/ISO/IEC 17025, 7.11.2).
        </p>
      </div>

      <EstadoMetodo data={data} pendientes={pendientes.length} onAccion={setConfirmar} />

      <Segmented label="Versión que se muestra" value={vistaActual} onChange={(v) => { if (v !== 'borrador' && pendientes.length) { toast.message('Guarda o descarta los cambios antes de salir del borrador.'); return; } setVista(v); }} options={opciones} className="cal-tabs self-start" />

      {vistaActual === 'historial' ? <HistorialMetodo data={data} /> : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.55fr)]">
          <div className="flex min-w-0 flex-col gap-4">
            <nav aria-label="Secciones de la configuración" className="flex flex-wrap gap-1.5">
              {SECCIONES.map(s => (
                <button key={s.id} type="button" className="cal-filter-chip" onClick={() => document.getElementById(`metodo-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                  {s.label}
                </button>
              ))}
            </nav>
            {vistaActual === 'borrador' && !editable && (
              <p className="rounded-2xl border border-line bg-surface-2 px-4 py-3 text-[13px] text-fg-muted">Solo el personal de Calibración edita el borrador.</p>
            )}
            <EdicionMetodo value={contexto}>
              <Secciones cambios={vistaActual === 'borrador' ? frenteBase : []} avisos={avisos} />
            </EdicionMetodo>
          </div>
          <aside className="min-w-0" aria-label="Cambios de la versión">
            <div className="card sticky top-[calc(var(--topbar-height)+16px)] max-h-[calc(100dvh-var(--topbar-height)-32px)] overflow-y-auto overscroll-contain p-4 shadow-card">
              {vistaActual === 'borrador' ? (
                <>
                  <h3 className="text-sm font-semibold text-fg">Cambios frente a la versión {borrador.base}</h3>
                  <p className="mb-3 mt-0.5 text-[12px] text-fg-muted">Es lo que el jefe revisa al aprobar. El punto amarillo marca lo que aún no se guarda.</p>
                  <ListaCambios cambios={frenteBase} pendientes={pendientes} vacio="Aún igual a la versión vigente: edita los valores que cambian." />
                </>
              ) : (
                <>
                  <h3 className="text-sm font-semibold text-fg">Versión {data.vigente.version}, vigente</h3>
                  <p className="mt-1 text-[12.5px] text-fg-muted">
                    {data.vigente.inicial ? 'Configuración inicial del sistema, con los valores acordados en la fase 0.' : `Redactada por ${data.vigente.creadoPor}.`}
                    {data.vigente.aprobadoPor ? ` Aprobada por ${data.vigente.aprobadoPor} el ${fecha(data.vigente.aprobadoEn)}.` : ' Aún sin aprobar.'}
                  </p>
                  {data.vigente.motivo && <p className="mt-2 text-[12.5px] text-fg">{data.vigente.motivo}</p>}
                  {data.permisos.redactar && <p className="mt-3 text-[12.5px] text-fg-muted">Para cambiarla, crea una versión nueva: se edita como borrador sin afectar los cálculos hasta que se aprueba.</p>}
                </>
              )}
            </div>
          </aside>
        </div>
      )}

      {pendientes.length > 0 && (
        <div className="sticky bottom-4 z-20 mx-auto flex w-full max-w-2xl flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-pop" role="status">
          <span className={cn('h-2 w-2 flex-none rounded-full', nProblemas ? 'bg-danger' : 'bg-warning')} aria-hidden="true" />
          <p className="text-[13px] text-fg">
            {pendientes.length === 1 ? '1 cambio sin guardar' : `${pendientes.length} cambios sin guardar`}
            {nProblemas > 0 && <span className="text-danger"> · {nProblemas === 1 ? '1 valor por corregir' : `${nProblemas} valores por corregir`}</span>}
          </p>
          <input value={motivo} maxLength={500} onChange={e => setMotivo(e.target.value)} aria-label="Nota de los cambios" placeholder="Nota (opcional)" className="field h-9 min-w-[160px] flex-1 rounded-lg text-[13px]" />
          <CancelButton onClick={() => { setEdicion(null); setMotivo(''); }} disabled={guardando}>Descartar</CancelButton>
          <PrimaryButton onClick={guardar} busy={guardando} disabled={nProblemas > 0}>Guardar</PrimaryButton>
        </div>
      )}

      {confirmar === 'crear' && (
        <ReasonModal
          title="Nueva versión del método" subtitle={`Parte de la versión ${data.vigente.version}, vigente`} heading="Crear el borrador"
          description="Se copia la versión vigente para editarla. No cambia ningún cálculo hasta que el jefe de Calibración la aprueba."
          confirmLabel="Crear borrador" reasonLabel="Motivo del cambio" reasonPlaceholder="Ej.: ΔT de convección según el ensayo de estabilización del laboratorio"
          onConfirm={async (texto) => { await calibrationApi.crearBorradorMetodo({ motivo: texto }); toast.success('Borrador creado'); setVista('borrador'); reload(); }}
          onClose={() => setConfirmar(null)}
        />
      )}
      {confirmar === 'descartar' && (
        <ReasonModal
          title={`Descartar el borrador v${borrador?.version}`} heading="Descartar" danger
          description="El borrador queda como descartado en el historial (no se borra) y la versión vigente sigue rigiendo."
          confirmLabel="Descartar" reasonPlaceholder="Por qué no se aprueba"
          onConfirm={async (texto) => { await calibrationApi.descartarBorradorMetodo({ motivo: texto }); toast.success('Borrador descartado'); setEdicion(null); setVista(null); reload(); }}
          onClose={() => setConfirmar(null)}
        />
      )}
      {confirmar === 'aprobar' && pendienteAprobar && (
        <ReasonModal
          title={`Aprobar la versión ${pendienteAprobar.version}`}
          subtitle={pendienteAprobar.estado === 'BORRADOR' ? `Reemplaza a la versión ${data.vigente.version}` : 'Configuración inicial del sistema'}
          heading="Aprobación del jefe de Calibración"
          description={pendienteAprobar.estado === 'BORRADOR'
            ? 'Desde ahora los registros sin aprobar se calculan con esta versión. Los aprobados, autorizados y emitidos conservan la suya.'
            : 'Queda registrada tu aprobación de la configuración con la que el sistema calcula desde el inicio.'}
          confirmLabel="Aprobar" requireReason={false} reasonLabel="Comentario" reasonPlaceholder="Opcional"
          onConfirm={async (texto) => { await calibrationApi.aprobarMetodo({ revision: pendienteAprobar.revision, motivo: texto }); toast.success(`Versión ${pendienteAprobar.version} aprobada`); setVista(null); reload(); }}
          onClose={() => setConfirmar(null)}
        >
          {cambiosAprobar.length > 0 && (
            <div className="max-h-64 overflow-y-auto">
              <p className="mb-2 text-[12.5px] font-semibold text-fg">{cambiosAprobar.length} {cambiosAprobar.length === 1 ? 'cambio' : 'cambios'}</p>
              <ListaCambios cambios={cambiosAprobar} />
            </div>
          )}
        </ReasonModal>
      )}
    </div>
  );
}
