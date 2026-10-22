import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import {
  AlertCircle, CheckCircle2, History, Loader2, Mail, Pencil, Plus, Send, ShieldCheck, Trash2, UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../../shared/components/ui/Button';
import { cn } from '../../../../shared/utils/cn';
import { ALERT_FREQUENCIES, formatDate } from '../../../calibration/domain/format';
import { AnticipationField } from '../../../calibration/components/fields';
import { Dropdown } from '../../../calibration/components/Dropdown';
import { FieldLabel, Segmented, Switch, ToneBadge } from '../../../calibration/components/primitives';
import { soporteApi } from '../../api/soporte';
import { SEGUIMIENTO_UI, tipoLabel } from '../../domain/proximos';
import { EquipoFicha } from './EquipoFicha';
import { AtencionPanel } from './Listas';

const MOTIVO = { PREVIO: 'Aviso previo', HOY: 'Es hoy', VENCIDO: 'Vencido' };
const REPETICION = { UNICA: 'una sola vez', SEMANAL: 'una vez por semana', DIARIA: 'cada día' };

const fechaHora = (iso) => (iso ? new Date(iso).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' }) : '—');

/** Explicación en lenguaje llano de cómo funcionan los avisos. */
function Explicacion({ ajustes }) {
  if (ajustes.alertaFrecuencia === 'NINGUNA') {
    return <p className="cal-hint">Los avisos están apagados: nada aparece en «Requieren atención», en el contador ni por correo.</p>;
  }
  const plazo = `${ajustes.alertaDias} ${ajustes.alertaDias === 1 ? 'día' : 'días'}`;
  return (
    <p className="cal-hint">
      Cuando a un próximo servicio le faltan {plazo} o menos, aparece en «Requieren atención» y en el contador de la
      barra lateral{ajustes.alertaCorreo ? `, y cada día a las ${ajustes.horaEnvio} se envía un correo a los destinatarios ${REPETICION[ajustes.alertaFrecuencia]}` : ''}.
      Sigue ahí hasta que el equipo tenga un servicio nuevo{SEGUIMIENTO_UI ? ', se reprograme o se descarte' : ''}. Lo vencido va primero
      {ajustes.alertaCorreo ? ' y se vuelve a avisar con la misma repetición' : ''}.
    </p>
  );
}

function Tarjeta({ title, icon: Icon, children, action }) {
  return (
    <section className="card p-5 shadow-card">
      <div className="mb-4 flex items-center gap-2.5">
        {Icon && <Icon className="h-[18px] w-[18px] text-fg-muted" aria-hidden="true" />}
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </section>
  );
}

function Generales({ ajustes, editar, onSaved }) {
  const baseId = useId();
  const [form, setForm] = useState(ajustes);
  const [guardando, setGuardando] = useState(false);
  const cambiado = JSON.stringify(form) !== JSON.stringify(ajustes);
  const activos = form.alertaFrecuencia !== 'NINGUNA';

  const guardar = async () => {
    setGuardando(true);
    try {
      await soporteApi.guardarAjustes(form);
      toast.success('Avisos guardados');
      onSaved();
    } catch (error) {
      toast.error(error.message || 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Tarjeta title="Avisos" icon={ShieldCheck}>
      <div className="flex flex-col gap-4">
        <div>
          <FieldLabel htmlFor={`${baseId}-dias`}>Empezar a avisar</FieldLabel>
          <AnticipationField
            id={`${baseId}-dias`}
            value={form.alertaDias}
            disabled={!editar}
            onChange={(alertaDias) => setForm(actual => ({ ...actual, alertaDias }))}
          />
        </div>
        <div>
          <p className="field-label">Repetir el aviso</p>
          <Segmented
            label="Repetir el aviso"
            value={form.alertaFrecuencia}
            disabled={!editar}
            onChange={(alertaFrecuencia) => setForm(actual => ({ ...actual, alertaFrecuencia }))}
            options={ALERT_FREQUENCIES}
          />
        </div>
        <Switch
          label="Enviar por correo"
          description="Si se apaga, los avisos solo aparecen en la aplicación."
          checked={form.alertaCorreo}
          disabled={!editar || !activos}
          onChange={(alertaCorreo) => setForm(actual => ({ ...actual, alertaCorreo }))}
        />
        {form.alertaCorreo && activos && (
          <div>
            <FieldLabel htmlFor={`${baseId}-hora`}>Hora de envío</FieldLabel>
            <input
              id={`${baseId}-hora`}
              type="time"
              value={form.horaEnvio}
              disabled={!editar}
              onChange={(event) => setForm(actual => ({ ...actual, horaEnvio: event.target.value }))}
              className="field h-11 w-32 font-medium tabular-nums"
            />
          </div>
        )}
        <Explicacion ajustes={form} />
        {editar && (
          <div className="flex justify-end gap-2">
            {cambiado && <Button variant="ghost" onClick={() => setForm(ajustes)} disabled={guardando}>Descartar</Button>}
            <Button onClick={guardar} isLoading={guardando} disabled={!cambiado}>Guardar</Button>
          </div>
        )}
      </div>
    </Tarjeta>
  );
}

function Correo({ correo, editar, onRan }) {
  const baseId = useId();
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [revisando, setRevisando] = useState(false);

  const probar = async (event) => {
    event.preventDefault();
    setEnviando(true);
    try {
      await soporteApi.probarCorreo(email);
      toast.success(`Correo de prueba enviado a ${email}`);
    } catch (error) {
      toast.error(error.message || 'No se pudo enviar el correo de prueba.');
    } finally {
      setEnviando(false);
    }
  };

  const enviarAhora = async () => {
    setRevisando(true);
    try {
      const r = await soporteApi.enviarAvisos();
      if (r.errores.length > 0) toast.error(`${r.errores.length} correos no se pudieron enviar. Revise los últimos envíos.`);
      else if (r.avisos === 0) toast.info('No había avisos pendientes para enviar hoy.');
      else toast.success(`${r.avisos} ${r.avisos === 1 ? 'aviso enviado' : 'avisos enviados'} a ${r.destinatarios} ${r.destinatarios === 1 ? 'destinatario' : 'destinatarios'}`);
      onRan();
    } catch (error) {
      toast.error(error.message || 'No se pudo enviar.');
    } finally {
      setRevisando(false);
    }
  };

  return (
    <Tarjeta title="Correo del servidor" icon={Mail}>
      {correo.configurado ? (
        <p className="flex items-start gap-2 text-[13px] text-fg">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-success" aria-hidden="true" />
          <span>
            Configurado. Se envía desde <strong className="font-semibold">{correo.remitente}</strong>
            <span className="text-fg-muted"> por {correo.servidor}.</span>
            {!correo.alertasActivas && <span className="block text-warning">La revisión diaria está desactivada en el servidor (ST_ALERTS_ENABLED=false).</span>}
          </span>
        </p>
      ) : (
        <p className="flex items-start gap-2 text-[13px] text-fg">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-none text-warning" aria-hidden="true" />
          <span>
            Sin configurar: los avisos solo aparecen en la aplicación. Para enviarlos por correo, Sistemas debe definir
            {' '}<code className="rounded bg-surface-2 px-1 py-0.5 text-xs">SMTP_HOST</code> y{' '}
            <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">SMTP_FROM</code> en el servidor (los mismos de calibración).
          </span>
        </p>
      )}

      {editar && (
        <>
          <form onSubmit={probar} className="mt-4 flex flex-wrap items-end gap-2">
            <div className="min-w-[200px] flex-1">
              <FieldLabel htmlFor={`${baseId}-prueba`}>Enviar un correo de prueba a</FieldLabel>
              <input
                id={`${baseId}-prueba`}
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nombre@metrica.com.bo"
                className="field h-10"
                disabled={!correo.configurado}
              />
            </div>
            <Button type="submit" variant="secondary" isLoading={enviando} disabled={!correo.configurado || !email}>
              <Send className="h-4 w-4" /> Probar
            </Button>
          </form>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className="cal-hint max-w-sm">Envía ahora los avisos que tocan hoy, sin esperar a la hora programada. No repite los ya enviados.</p>
            <Button variant="secondary" onClick={enviarAhora} isLoading={revisando} disabled={!correo.configurado}>
              Revisar y enviar ahora
            </Button>
          </div>
        </>
      )}
    </Tarjeta>
  );
}

const contactoVacio = { usuarioId: null, nombre: '', email: '', activo: true };

function FormContacto({ inicial, personal, onCancel, onSaved }) {
  const baseId = useId();
  const [form, setForm] = useState(inicial || contactoVacio);
  const [guardando, setGuardando] = useState(false);

  const opciones = useMemo(() => [
    { value: '', label: 'Otra persona (fuera del personal)' },
    ...personal.map(persona => ({
      value: persona.id,
      label: persona.nombre,
      hint: persona.esSoporte ? undefined : persona.area,
      group: persona.esSoporte ? 'Soporte técnico' : 'Otras áreas',
    })),
  ], [personal]);

  const elegir = (valor) => {
    const usuarioId = valor === '' || valor == null ? null : Number(valor);
    const persona = personal.find(item => item.id === usuarioId);
    setForm(actual => ({ ...actual, usuarioId, nombre: persona ? persona.nombre : actual.nombre }));
  };

  const guardar = async (event) => {
    event.preventDefault();
    setGuardando(true);
    try {
      if (inicial?.id) await soporteApi.editarContacto(inicial.id, form);
      else await soporteApi.crearContacto(form);
      toast.success(inicial?.id ? 'Destinatario actualizado' : 'Destinatario agregado');
      onSaved();
    } catch (error) {
      toast.error(error.message || 'No se pudo guardar.');
      setGuardando(false);
    }
  };

  return (
    <form onSubmit={guardar} className="flex flex-col gap-3 rounded-2xl bg-surface-2 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor={`${baseId}-persona`}>Persona</FieldLabel>
          <Dropdown id={`${baseId}-persona`} ariaLabel="Persona" value={form.usuarioId ?? ''} onChange={elegir} options={opciones} />
        </div>
        <div>
          <FieldLabel htmlFor={`${baseId}-nombre`}>Nombre</FieldLabel>
          <input
            id={`${baseId}-nombre`}
            required
            maxLength={100}
            value={form.nombre}
            onChange={(event) => setForm(actual => ({ ...actual, nombre: event.target.value }))}
            placeholder="Nombre de quien recibe"
            className="field h-10"
          />
        </div>
      </div>
      <div>
        <FieldLabel htmlFor={`${baseId}-email`}>Correo</FieldLabel>
        <input
          id={`${baseId}-email`}
          type="email"
          required
          maxLength={150}
          value={form.email}
          onChange={(event) => setForm(actual => ({ ...actual, email: event.target.value }))}
          placeholder="nombre@metrica.com.bo"
          className="field h-10"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={guardando}>Cancelar</Button>
        <Button type="submit" isLoading={guardando}>{inicial?.id ? 'Guardar' : 'Agregar'}</Button>
      </div>
    </form>
  );
}

function Destinatarios({ contactos, editar, onChanged }) {
  const [editando, setEditando] = useState(null);
  const [ocupado, setOcupado] = useState(null);
  const [personal, setPersonal] = useState([]);

  useEffect(() => {
    if (!editar) return;
    soporteApi.personal().then(setPersonal).catch(() => setPersonal([]));
  }, [editar]);

  const alternar = async (contacto) => {
    setOcupado(contacto.id);
    try {
      await soporteApi.editarContacto(contacto.id, { ...contacto, activo: !contacto.activo });
      onChanged();
    } catch (error) {
      toast.error(error.message || 'No se pudo actualizar.');
    } finally {
      setOcupado(null);
    }
  };

  const quitar = async (contacto) => {
    setOcupado(contacto.id);
    try {
      await soporteApi.quitarContacto(contacto.id);
      toast.success(`${contacto.nombre} ya no recibirá avisos`);
      onChanged();
    } catch (error) {
      toast.error(error.message || 'No se pudo quitar.');
    } finally {
      setOcupado(null);
    }
  };

  const listo = () => {
    setEditando(null);
    onChanged();
  };

  return (
    <Tarjeta
      title="Destinatarios"
      icon={UserRound}
      action={editar && editando === null && (
        <Button size="sm" variant="secondary" onClick={() => setEditando('nuevo')}>
          <Plus className="h-3.5 w-3.5" /> Agregar
        </Button>
      )}
    >
      <p className="cal-hint -mt-2 mb-4">Cada destinatario recibe un solo correo al día con todo lo vencido y lo próximo, agrupado por cliente.</p>

      {editando === 'nuevo' && (
        <div className="mb-4"><FormContacto personal={personal} onCancel={() => setEditando(null)} onSaved={listo} /></div>
      )}

      {contactos.length === 0 && editando !== 'nuevo' ? (
        <p className="rounded-2xl border border-dashed border-line-strong px-4 py-6 text-center text-[13px] text-fg-muted">
          Nadie recibe correos todavía. Agregue al personal de Soporte técnico con su correo.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {contactos.map(contacto => (
            <li key={contacto.id} className="py-3 first:pt-0 last:pb-0">
              {editando === contacto.id ? (
                <FormContacto inicial={contacto} personal={personal} onCancel={() => setEditando(null)} onSaved={listo} />
              ) : (
                <div className={cn('flex flex-wrap items-center gap-3', !contacto.activo && 'opacity-60')}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold text-fg">{contacto.nombre}</span>
                    <span className="block truncate text-xs text-fg-muted">{contacto.email}</span>
                  </span>
                  {!contacto.activo && <ToneBadge tone="muted">En pausa</ToneBadge>}
                  {editar && (
                    <>
                      <input
                        type="checkbox"
                        role="switch"
                        className="cal-switch"
                        aria-label={`${contacto.activo ? 'Pausar' : 'Reanudar'} los correos a ${contacto.nombre}`}
                        title={contacto.activo ? 'Recibe correos' : 'En pausa'}
                        checked={contacto.activo}
                        disabled={ocupado === contacto.id}
                        onChange={() => alternar(contacto)}
                      />
                      <span className="flex gap-0.5">
                        <button
                          type="button"
                          onClick={() => setEditando(contacto.id)}
                          aria-label={`Editar a ${contacto.nombre}`}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => quitar(contacto)}
                          disabled={ocupado === contacto.id}
                          aria-label={`Quitar a ${contacto.nombre}`}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-danger/10 hover:text-danger"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}

function Envios({ envios }) {
  return (
    <Tarjeta title="Últimos envíos" icon={Send}>
      {envios.length === 0 ? (
        <p className="text-[13px] text-fg-muted">Aún no se ha enviado ningún correo.</p>
      ) : (
        <div className="-mx-5 -mb-5 overflow-x-auto border-t border-line">
          <table className="cal-table">
            <thead>
              <tr>
                <th>Enviado</th>
                <th>Para</th>
                <th>Equipo</th>
                <th>Motivo</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {envios.map(envio => (
                <tr key={envio.id} className="!cursor-default">
                  <td>{fechaHora(envio.enviadoEn)}</td>
                  <td>{envio.email}</td>
                  <td title={`${tipoLabel(envio.origenTipo)} · ${envio.origenCodigo}`}>{envio.codMetrica} · {formatDate(envio.fechaAviso)}</td>
                  <td>{MOTIVO[envio.motivo] || envio.motivo}</td>
                  <td>
                    {envio.estado === 'ENVIADO'
                      ? <ToneBadge tone="success">Enviado</ToneBadge>
                      : <span title={envio.error || undefined}><ToneBadge tone="danger">Error</ToneBadge></span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Tarjeta>
  );
}

function Cambios({ historial }) {
  if (historial.length === 0) return null;
  return (
    <Tarjeta title="Cambios en los avisos" icon={History}>
      <ol className="flex flex-col gap-2.5">
        {historial.map(item => (
          <li key={item.id} className="text-[13px]">
            <p className="text-fg">{item.detalle}</p>
            <p className="text-xs text-fg-muted">{item.usuario} · {fechaHora(item.fecha)}</p>
          </li>
        ))}
      </ol>
    </Tarjeta>
  );
}

/**
 * Pestaña «Avisos»: todo lo que requiere atención y la configuración del
 * correo diario (anticipación, repetición, hora, destinatarios).
 */
export function AvisosPanel({ onAbrirInforme }) {
  const [estado, setEstado] = useState({ cargando: true, data: null, error: null });
  const [ficha, setFicha] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const data = await soporteApi.avisos();
      setEstado({ cargando: false, data, error: null });
    } catch (error) {
      setEstado(actual => ({ ...actual, cargando: false, error }));
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  let ajustes;
  if (estado.cargando) {
    ajustes = (
      <div className="card flex min-h-40 items-center justify-center shadow-card" role="status" aria-label="Cargando los avisos">
        <Loader2 className="h-5 w-5 animate-spin text-fg-subtle" />
      </div>
    );
  } else if (!estado.data) {
    ajustes = (
      <p className="flex items-center gap-2 rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-[13px] text-danger" role="alert">
        <AlertCircle className="h-4 w-4" /> {estado.error?.message || 'No se pudieron cargar los avisos.'}
      </p>
    );
  } else {
    const { data } = estado;
    const editar = data.permisos.editar;
    ajustes = (
      <>
        <Generales
          key={JSON.stringify(data.ajustes)}
          ajustes={{
            alertaDias: data.ajustes.alertaDias,
            alertaFrecuencia: data.ajustes.alertaFrecuencia,
            alertaCorreo: data.ajustes.alertaCorreo,
            horaEnvio: data.ajustes.horaEnvio,
          }}
          editar={editar}
          onSaved={cargar}
        />
        <Correo correo={data.correo} editar={editar} onRan={cargar} />
        <Destinatarios contactos={data.contactos} editar={editar} onChanged={cargar} />
        <Envios envios={data.envios} />
        <Cambios historial={data.historial} />
      </>
    );
  }

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
      {estado.data
        ? <AtencionPanel alertas={estado.data.alertas} onSelect={(alerta) => setFicha(alerta.equipoId)} expandido />
        : <div />}
      <div className="flex flex-col gap-5">{ajustes}</div>
      {ficha && (
        <EquipoFicha
          key={ficha}
          codMetrica={ficha}
          onClose={() => {
            setFicha(null);
            cargar();
          }}
          onAbrirInforme={onAbrirInforme}
        />
      )}
    </div>
  );
}
