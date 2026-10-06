import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Mail, Pencil, Plus, Send, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../shared/components/ui/Button';
import { cn } from '../../../shared/utils/cn';
import { calibrationApi } from '../api/calibration';
import { ALERT_FREQUENCIES, EMAIL_ALERTS_UI, TIPOS } from '../domain/format';
import { AttentionPanel } from './AttentionPanel';
import { AnticipationField, ResponsableSelect } from './fields';
import { FieldLabel, Segmented, Switch, ToneBadge } from './primitives';

const MOTIVO = { PREVIO: 'Aviso previo', HOY: 'Es hoy', VENCIDO: 'Vencida' };
const FREQUENCY_SENTENCE = { UNICA: 'una sola vez', SEMANAL: 'una vez por semana', DIARIA: 'cada día' };

/** Explicación en lenguaje llano de cómo funcionan los avisos. */
export function AlertExplanation({ ajustes, horaEnvio }) {
  if (ajustes.alertaFrecuencia === 'NINGUNA') {
    return <p className="cal-hint">Los avisos generales están apagados. Solo avisan los equipos y actividades con avisos propios.</p>;
  }
  const dias = ajustes.alertaDias;
  const plazo = `${dias} ${dias === 1 ? 'día' : 'días'}`;
  if (!EMAIL_ALERTS_UI) {
    return (
      <p className="cal-hint">
        Cuando a una fecha le faltan {plazo} o menos, aparece en «Requieren atención» y en el contador de la barra
        lateral, y se queda ahí hasta que se registra como realizada o cancelada. Lo vencido se muestra primero.
      </p>
    );
  }
  return (
    <p className="cal-hint">
      Cada día{horaEnvio ? ` a las ${horaEnvio}` : ''} se revisa el plan. Cuando una fecha está a {plazo} o menos,
      aparece en «Requieren atención» y{ajustes.alertaCorreo ? ` el responsable recibe un correo ${FREQUENCY_SENTENCE[ajustes.alertaFrecuencia]}` : ' se marca en el cronograma'}
      {' '}hasta que se registre como realizada. El mismo día y si se vence, se vuelve a avisar.
    </p>
  );
}

function Card({ title, icon: Icon, children, action }) {
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

function GeneralForm({ ajustes, onSaved }) {
  const baseId = useId();
  const [form, setForm] = useState(ajustes);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(ajustes);
  const active = form.alertaFrecuencia !== 'NINGUNA';

  const save = async () => {
    setSaving(true);
    try {
      // Frecuencia, correo y hora se envían tal cual aunque no se muestren.
      await calibrationApi.saveAjustes({
        alertaDias: form.alertaDias,
        alertaFrecuencia: form.alertaFrecuencia,
        alertaCorreo: form.alertaCorreo,
        horaEnvio: form.horaEnvio,
      });
      toast.success('Avisos generales guardados');
      onSaved();
    } catch (error) {
      toast.error(error.message || 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Avisos generales" icon={ShieldCheck}>
      <p className="cal-hint -mt-2 mb-4">Se aplican a todo equipo o actividad que no tenga avisos propios.</p>
      <div className="flex flex-col gap-4">
        {!EMAIL_ALERTS_UI && (
          <Switch
            label="Avisar en el cronograma"
            description="Si se apaga, solo avisan los equipos y actividades con avisos propios."
            checked={active}
            onChange={(on) => setForm(current => ({
              ...current,
              alertaFrecuencia: on ? (ajustes.alertaFrecuencia !== 'NINGUNA' ? ajustes.alertaFrecuencia : 'SEMANAL') : 'NINGUNA',
            }))}
          />
        )}
        {(active || EMAIL_ALERTS_UI) && (
          <div>
            <FieldLabel htmlFor={`${baseId}-dias`}>Empezar a avisar</FieldLabel>
            <AnticipationField
              id={`${baseId}-dias`}
              value={form.alertaDias}
              onChange={(alertaDias) => setForm(current => ({ ...current, alertaDias }))}
            />
          </div>
        )}
        {EMAIL_ALERTS_UI && (
          <>
            <div>
              <FieldLabel htmlFor={`${baseId}-hora`}>Hora de envío</FieldLabel>
              <input
                id={`${baseId}-hora`}
                type="time"
                value={form.horaEnvio}
                onChange={(event) => setForm(current => ({ ...current, horaEnvio: event.target.value }))}
                className="field h-11 w-32 font-medium tabular-nums"
              />
            </div>
            <div>
              <p className="field-label">Repetir el aviso</p>
              <Segmented
                label="Repetir el aviso"
                value={form.alertaFrecuencia}
                onChange={(alertaFrecuencia) => setForm(current => ({ ...current, alertaFrecuencia }))}
                options={ALERT_FREQUENCIES}
              />
            </div>
            <Switch
              label="Enviar por correo"
              description="Si se apaga, los avisos solo aparecen en el cronograma."
              checked={form.alertaCorreo}
              onChange={(alertaCorreo) => setForm(current => ({ ...current, alertaCorreo }))}
            />
          </>
        )}
        <AlertExplanation ajustes={form} horaEnvio={form.horaEnvio} />
        <div className="flex justify-end gap-2">
          {dirty && <Button variant="ghost" onClick={() => setForm(ajustes)} disabled={saving}>Descartar</Button>}
          <Button onClick={save} isLoading={saving} disabled={!dirty}>Guardar</Button>
        </div>
      </div>
    </Card>
  );
}

function MailCard({ correo, onRan }) {
  const baseId = useId();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [running, setRunning] = useState(false);

  const sendTest = async (event) => {
    event.preventDefault();
    setSending(true);
    try {
      await calibrationApi.sendTest(email);
      toast.success(`Correo de prueba enviado a ${email}`);
    } catch (error) {
      toast.error(error.message || 'No se pudo enviar el correo de prueba.');
    } finally {
      setSending(false);
    }
  };

  const runNow = async () => {
    setRunning(true);
    try {
      const result = await calibrationApi.runAlerts();
      if (result.errores.length > 0) toast.error(`${result.errores.length} correos no se pudieron enviar. Revisa el historial.`);
      else if (result.avisos === 0) toast.info('No había avisos pendientes para enviar hoy.');
      else toast.success(`${result.avisos} ${result.avisos === 1 ? 'aviso enviado' : 'avisos enviados'} a ${result.destinatarios} ${result.destinatarios === 1 ? 'destinatario' : 'destinatarios'}`);
      onRan();
    } catch (error) {
      toast.error(error.message || 'No se pudo ejecutar la revisión.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card title="Correo del servidor" icon={Mail}>
      {correo.configurado ? (
        <p className="flex items-start gap-2 text-[13px] text-fg">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-success" aria-hidden="true" />
          <span>
            Configurado. Se envía desde <strong className="font-semibold">{correo.remitente}</strong>
            <span className="text-fg-muted"> por {correo.servidor}.</span>
            {!correo.alertasActivas && <span className="block text-warning">La revisión diaria está desactivada (CAL_ALERTS_ENABLED=false).</span>}
          </span>
        </p>
      ) : (
        <p className="flex items-start gap-2 text-[13px] text-fg">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-none text-warning" aria-hidden="true" />
          <span>
            Sin configurar: los avisos solo aparecen en el cronograma. Para enviarlos por correo, define
            {' '}<code className="rounded bg-surface-2 px-1 py-0.5 text-xs">SMTP_HOST</code>,{' '}
            <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">SMTP_USER</code>,{' '}
            <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">SMTP_PASSWORD</code> y{' '}
            <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">SMTP_FROM</code> en el archivo .env del servidor y reinícialo.
          </span>
        </p>
      )}

      <form onSubmit={sendTest} className="mt-4 flex flex-wrap items-end gap-2">
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
        <Button type="submit" variant="secondary" isLoading={sending} disabled={!correo.configurado || !email}>
          <Send className="h-4 w-4" /> Probar
        </Button>
      </form>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="cal-hint max-w-sm">Envía ahora los avisos que tocan hoy, sin esperar a la hora programada. No duplica los ya enviados.</p>
        <Button variant="secondary" onClick={runNow} isLoading={running} disabled={!correo.configurado}>
          Revisar y enviar ahora
        </Button>
      </div>
    </Card>
  );
}

const emptyContact = { usuarioId: null, nombre: '', email: '', recibeTodas: false, activo: true };

function ContactForm({ initial, personal, onCancel, onSaved }) {
  const baseId = useId();
  const [form, setForm] = useState(initial || emptyContact);
  const [saving, setSaving] = useState(false);

  const choosePerson = (usuarioId) => {
    const persona = personal.find(item => item.id === usuarioId);
    setForm(current => ({ ...current, usuarioId, nombre: persona ? persona.nombre : current.nombre }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (initial?.id) await calibrationApi.updateContacto(initial.id, form);
      else await calibrationApi.createContacto(form);
      toast.success(initial?.id ? 'Destinatario actualizado' : 'Destinatario agregado');
      onSaved();
    } catch (error) {
      toast.error(error.message || 'No se pudo guardar.');
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl bg-surface-2 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor={`${baseId}-persona`}>Persona</FieldLabel>
          <ResponsableSelect
            id={`${baseId}-persona`}
            value={form.usuarioId}
            onChange={choosePerson}
            personal={personal}
            emptyLabel="Otra persona (fuera del personal)"
          />
        </div>
        <div>
          <FieldLabel htmlFor={`${baseId}-nombre`}>Nombre</FieldLabel>
          <input
            id={`${baseId}-nombre`}
            required
            maxLength={100}
            value={form.nombre}
            onChange={(event) => setForm(current => ({ ...current, nombre: event.target.value }))}
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
          onChange={(event) => setForm(current => ({ ...current, email: event.target.value }))}
          placeholder="nombre@metrica.com.bo"
          className="field h-10"
          data-autofocus
        />
      </div>
      <Switch
        label="Recibe todas las alertas"
        description="Si está apagado, solo recibe las de los equipos y actividades a su cargo."
        checked={form.recibeTodas}
        onChange={(recibeTodas) => setForm(current => ({ ...current, recibeTodas }))}
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>Cancelar</Button>
        <Button type="submit" isLoading={saving}>{initial?.id ? 'Guardar' : 'Agregar'}</Button>
      </div>
    </form>
  );
}

function RecipientsCard({ contactos, personal, onChanged }) {
  const [editing, setEditing] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const toggleActive = async (contacto) => {
    setBusyId(contacto.id);
    try {
      await calibrationApi.updateContacto(contacto.id, { ...contacto, activo: !contacto.activo });
      onChanged();
    } catch (error) {
      toast.error(error.message || 'No se pudo actualizar.');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (contacto) => {
    setBusyId(contacto.id);
    try {
      await calibrationApi.deleteContacto(contacto.id);
      toast.success(`${contacto.nombre} ya no recibirá alertas`);
      onChanged();
    } catch (error) {
      toast.error(error.message || 'No se pudo eliminar.');
    } finally {
      setBusyId(null);
    }
  };

  const missingResponsables = personal.filter(persona => persona.esCalibracion)
    .filter(persona => !contactos.some(contacto => contacto.usuarioId === persona.id));

  return (
    <Card
      title="Destinatarios"
      icon={UserRound}
      action={editing === null && (
        <Button size="sm" variant="secondary" onClick={() => setEditing('new')}>
          <Plus className="h-3.5 w-3.5" /> Agregar
        </Button>
      )}
    >
      <p className="cal-hint -mt-2 mb-4">
        Cada responsable recibe los avisos de lo que tiene a su cargo, si su correo está aquí. Quien «recibe todas» se entera de todo el plan.
      </p>

      {editing === 'new' && (
        <div className="mb-4">
          <ContactForm
            personal={personal}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              onChanged();
            }}
          />
        </div>
      )}

      {contactos.length === 0 && editing !== 'new' ? (
        <p className="rounded-2xl border border-dashed border-line-strong px-4 py-6 text-center text-[13px] text-fg-muted">
          Nadie recibe correos todavía. Agrega al personal de Calibración con su correo.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {contactos.map(contacto => (
            <li key={contacto.id} className="py-3 first:pt-0 last:pb-0">
              {editing === contacto.id ? (
                <ContactForm
                  initial={contacto}
                  personal={personal}
                  onCancel={() => setEditing(null)}
                  onSaved={() => {
                    setEditing(null);
                    onChanged();
                  }}
                />
              ) : (
                <div className={cn('flex flex-wrap items-center gap-3', !contacto.activo && 'opacity-60')}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold text-fg">{contacto.nombre}</span>
                    <span className="block truncate text-xs text-fg-muted">{contacto.email}</span>
                  </span>
                  <ToneBadge tone={contacto.recibeTodas ? 'info' : 'neutral'}>
                    {contacto.recibeTodas ? 'Recibe todas' : 'Solo lo suyo'}
                  </ToneBadge>
                  <input
                    type="checkbox"
                    role="switch"
                    className="cal-switch"
                    aria-label={`${contacto.activo ? 'Pausar' : 'Reanudar'} los correos a ${contacto.nombre}`}
                    title={contacto.activo ? 'Recibe correos' : 'En pausa'}
                    checked={contacto.activo}
                    disabled={busyId === contacto.id}
                    onChange={() => toggleActive(contacto)}
                  />
                  <span className="flex gap-0.5">
                    <button
                      type="button"
                      onClick={() => setEditing(contacto.id)}
                      aria-label={`Editar a ${contacto.nombre}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(contacto)}
                      disabled={busyId === contacto.id}
                      aria-label={`Quitar a ${contacto.nombre}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-danger/10 hover:text-danger"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {missingResponsables.length > 0 && (
        <p className="mt-4 text-xs text-fg-muted">
          Sin correo registrado: {missingResponsables.map(persona => persona.nombre).join(', ')}.
        </p>
      )}
    </Card>
  );
}

function HistoryCard({ envios, serieLabel }) {
  return (
    <Card title="Últimos envíos" icon={Send}>
      {envios.length === 0 ? (
        <p className="text-[13px] text-fg-muted">Aún no se ha enviado ningún correo.</p>
      ) : (
        <div className="-mx-5 -mb-5 overflow-x-auto border-t border-line">
          <table className="cal-table">
            <thead>
              <tr>
                <th>Enviado</th>
                <th>Para</th>
                <th>Sobre</th>
                <th>Motivo</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {envios.map(envio => (
                <tr key={envio.id} className="!cursor-default">
                  <td>{envio.enviadoEn ? new Date(envio.enviadoEn).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
                  <td>{envio.email}</td>
                  <td>{serieLabel(envio.serie)}</td>
                  <td>{MOTIVO[envio.motivo] || envio.motivo}</td>
                  <td>
                    {envio.estado === 'ENVIADO' ? (
                      <ToneBadge tone="success">Enviado</ToneBadge>
                    ) : (
                      <span title={envio.error || undefined}><ToneBadge tone="danger">Error</ToneBadge></span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/**
 * Pestaña de alertas: todo lo que requiere atención y los avisos generales.
 * Con EMAIL_ALERTS_UI también el correo, los destinatarios y el historial.
 */
export function AlertSettings({ canEdit, ajustes, alertas, equipos, actividades, personal, onSelectEvent, onPlanChanged }) {
  const [state, setState] = useState({ loading: canEdit, data: null, error: null });

  const load = useCallback(async () => {
    try {
      const data = await calibrationApi.alertSettings();
      setState({ loading: false, data, error: null });
    } catch (error) {
      setState(current => ({ ...current, loading: false, error }));
    }
  }, []);

  useEffect(() => {
    if (canEdit) load();
  }, [canEdit, load]);

  const serieLabel = useMemo(() => {
    const equiposById = new Map(equipos.map(equipo => [equipo.id, equipo]));
    const actividadesById = new Map(actividades.map(actividad => [actividad.id, actividad]));
    return (serie) => {
      const [prefix, rawId] = serie.split('-');
      const id = Number(rawId);
      if (prefix === 'ACT') return actividadesById.get(id)?.titulo || 'Actividad retirada';
      const tipo = prefix === 'CAL' ? TIPOS.CALIBRACION.label : TIPOS.VERIFICACION.label;
      return `${tipo} · ${equiposById.get(id)?.codigo || 'equipo'}`;
    };
  }, [equipos, actividades]);

  let settings;
  if (!canEdit) {
    settings = (
      <section className="card p-5 shadow-card">
        <h3 className="text-sm font-semibold text-fg">Cómo funcionan los avisos</h3>
        <div className="mt-2"><AlertExplanation ajustes={ajustes} /></div>
        <p className="mt-4 text-[13px] text-fg-muted">Solo el área de Calibración administra los avisos.</p>
      </section>
    );
  } else if (state.loading) {
    settings = (
      <div className="card flex min-h-40 items-center justify-center shadow-card" role="status" aria-label="Cargando avisos">
        <Loader2 className="h-5 w-5 animate-spin text-fg-subtle" />
      </div>
    );
  } else if (state.error && !state.data) {
    settings = (
      <p className="flex items-center gap-2 rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-[13px] text-danger" role="alert">
        <AlertCircle className="h-4 w-4" /> {state.error.message}
      </p>
    );
  } else {
    const { data } = state;
    settings = (
      <>
        <GeneralForm
          key={JSON.stringify(data.ajustes)}
          ajustes={{
            alertaDias: data.ajustes.alertaDias,
            alertaFrecuencia: data.ajustes.alertaFrecuencia,
            alertaCorreo: data.ajustes.alertaCorreo,
            horaEnvio: data.ajustes.horaEnvio,
          }}
          onSaved={() => {
            load();
            onPlanChanged();
          }}
        />
        {EMAIL_ALERTS_UI && (
          <>
            <MailCard correo={data.correo} onRan={load} />
            <RecipientsCard contactos={data.contactos} personal={personal} onChanged={load} />
            <HistoryCard envios={data.envios} serieLabel={serieLabel} />
          </>
        )}
      </>
    );
  }

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <AttentionPanel alertas={alertas} onSelectEvent={onSelectEvent} initialExpanded />
      <div className="flex flex-col gap-5">{settings}</div>
    </div>
  );
}
