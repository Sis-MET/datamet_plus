import { useId, useMemo, useState } from 'react';
import { Search, UserRound, UsersRound } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../../shared/utils/cn';
import { Dropdown } from '../../calibration/components/Dropdown';
import {
  CancelButton, FieldLabel, Modal, ModalColumns, ModalSection, PrimaryButton, Segmented,
} from '../../calibration/components/primitives';
import { systemApi } from '../api/system';
import { alcanza, describirRegla, filtrarPersonal, ganarianAlConceder } from '../domain/permisos';

const TIPOS = [
  { value: 'PERSONA', label: 'Una persona', icon: <UserRound className="h-4 w-4" aria-hidden="true" /> },
  { value: 'GRUPO', label: 'Un grupo', icon: <UsersRound className="h-4 w-4" aria-hidden="true" /> },
];

const nombres = (personas, max = 6) => {
  const lista = personas.slice(0, max).map(persona => persona.nombre).join(', ');
  return personas.length > max ? `${lista} y ${personas.length - max} más` : lista;
};

/**
 * Conceder un permiso a una persona o a un grupo (área, cargo o un cargo de un
 * área), con su motivo. Muestra a quiénes alcanza antes de guardar.
 */
export function ConcederPermisoModal({ gestion, permisoInicial = null, personaInicial = null, onClose, onSaved }) {
  const baseId = useId();
  const [permiso, setPermiso] = useState(permisoInicial || gestion.catalogo[0]?.clave || '');
  const [tipo, setTipo] = useState(personaInicial || !permisoInicial ? 'PERSONA' : 'GRUPO');
  const [usuarioId, setUsuarioId] = useState(personaInicial);
  const [area, setArea] = useState('');
  const [cargo, setCargo] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [motivo, setMotivo] = useState('');
  const [intentado, setIntentado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const regla = useMemo(() => (tipo === 'PERSONA'
    ? { usuarioId }
    : { usuarioId: null, area: area || null, cargo: cargo || null }), [area, cargo, tipo, usuarioId]);
  const sujeto = describirRegla(regla, gestion);
  const alcanzados = useMemo(() => gestion.personal.filter(persona => alcanza(regla, persona)), [gestion.personal, regla]);
  const ganan = useMemo(() => ganarianAlConceder(regla, permiso, gestion.personal), [gestion.personal, permiso, regla]);
  const candidatos = useMemo(() => filtrarPersonal(gestion.personal, { texto: busqueda }), [busqueda, gestion.personal]);
  const yaConcedida = gestion.concesiones.some(concesion => concesion.permiso === permiso
    && (tipo === 'PERSONA'
      ? concesion.usuarioId === usuarioId
      : concesion.tipo === 'GRUPO' && (concesion.area || null) === (area || null) && (concesion.cargo || null) === (cargo || null)));

  const errores = {
    sujeto: tipo === 'PERSONA'
      ? (usuarioId ? null : 'Elige a la persona.')
      : (area || cargo ? null : 'Elige un área, un cargo o los dos.'),
    motivo: motivo.trim() ? null : 'Escribe por qué se concede el permiso.',
    repetido: yaConcedida ? `«${sujeto}» ya tiene este permiso.` : null,
  };

  const guardar = async (cerrar) => {
    setIntentado(true);
    const error = errores.sujeto || errores.repetido || errores.motivo;
    if (error) {
      toast.error(error);
      return;
    }
    setGuardando(true);
    try {
      await systemApi.concederPermiso({
        permiso, tipo, motivo: motivo.trim(),
        ...(tipo === 'PERSONA' ? { usuarioId } : { area: area || null, cargo: cargo || null }),
      });
      toast.success(`Permiso concedido a ${sujeto}`);
      setGuardando(false);
      onSaved();
      cerrar();
    } catch (fallo) {
      toast.error(fallo.message || 'No se pudo conceder el permiso.');
      setGuardando(false);
    }
  };

  const permisoActual = gestion.catalogo.find(item => item.clave === permiso);

  return (
    <Modal
      onClose={onClose}
      title="Conceder permiso"
      subtitle="Queda en el historial con tu usuario, la fecha y el motivo."
      busy={guardando}
      footer={(cerrar) => (
        <div className="ml-auto flex items-center gap-2">
          <CancelButton onClick={cerrar} disabled={guardando} />
          <PrimaryButton onClick={() => guardar(cerrar)} busy={guardando}>Conceder</PrimaryButton>
        </div>
      )}
    >
      <ModalColumns>
        <ModalSection title="Qué y a quién" description="Un permiso se concede a una persona o a todo un grupo.">
          <div className="space-y-5">
            <div>
              <FieldLabel htmlFor={`${baseId}-permiso`}>Permiso</FieldLabel>
              <Dropdown
                id={`${baseId}-permiso`}
                value={permiso}
                onChange={setPermiso}
                options={gestion.catalogo.map(item => ({ value: item.clave, label: item.nombre, group: item.modulo }))}
                disabled={guardando}
              />
              {permisoActual && <p className="mt-1.5 text-xs leading-relaxed text-fg-muted">{permisoActual.descripcion}</p>}
            </div>

            <div>
              <p className="field-label" id={`${baseId}-tipo`}>A quién</p>
              <Segmented value={tipo} onChange={setTipo} options={TIPOS} label="A quién se concede" className="cal-segmented-fill" disabled={guardando} />
            </div>

            {tipo === 'PERSONA' ? (
              <div>
                <FieldLabel htmlFor={`${baseId}-buscar`}>Persona</FieldLabel>
                <label className="flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-3 shadow-xs focus-within:border-focus focus-within:ring-4 focus-within:ring-focus/15">
                  <Search className="h-4 w-4 flex-none text-fg-subtle" aria-hidden="true" />
                  <input
                    id={`${baseId}-buscar`}
                    data-autofocus
                    type="search"
                    value={busqueda}
                    onChange={event => setBusqueda(event.target.value)}
                    placeholder="Nombre, usuario, área o cargo"
                    className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-fg-subtle"
                  />
                </label>
                <div role="radiogroup" aria-label="Persona" className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-line">
                  {candidatos.length === 0 && <p className="px-3 py-4 text-center text-[13px] text-fg-muted">Nadie coincide con la búsqueda.</p>}
                  {candidatos.map((persona) => {
                    const elegida = persona.id === usuarioId;
                    const loTiene = persona.permisos.some(item => item.clave === permiso);
                    return (
                      <button
                        key={persona.id}
                        type="button"
                        role="radio"
                        aria-checked={elegida}
                        onClick={() => setUsuarioId(persona.id)}
                        disabled={guardando}
                        className={cn(
                          'flex w-full items-center gap-3 border-b border-line px-3 py-2.5 text-left last:border-0 transition-colors hover:bg-fg/[0.03]',
                          elegida && 'bg-accent/[0.07] hover:bg-accent/[0.09]',
                        )}
                      >
                        <span className={cn('h-4 w-4 flex-none rounded-full border-2', elegida ? 'border-accent bg-accent shadow-[inset_0_0_0_3px_rgb(var(--c-surface))]' : 'border-line-strong')} aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-fg">{persona.nombre}</span>
                          <span className="block truncate text-xs text-fg-muted">{[persona.area, persona.cargo].filter(Boolean).join(' · ') || 'Sin área ni cargo'}</span>
                        </span>
                        {loTiene && <span className="flex-none text-[11.5px] font-medium text-fg-subtle">Ya lo tiene</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel htmlFor={`${baseId}-area`}>Área</FieldLabel>
                  <Dropdown
                    id={`${baseId}-area`}
                    value={area}
                    onChange={setArea}
                    options={[{ value: '', label: 'Todas las áreas' }, ...gestion.areas.map(item => ({ value: item.clave, label: item.nombre, hint: `${item.personas}` }))]}
                    disabled={guardando}
                  />
                </div>
                <div>
                  <FieldLabel htmlFor={`${baseId}-cargo`}>Cargo</FieldLabel>
                  <Dropdown
                    id={`${baseId}-cargo`}
                    value={cargo}
                    onChange={setCargo}
                    options={[{ value: '', label: 'Todos los cargos' }, ...gestion.cargos.map(item => ({ value: item.clave, label: item.nombre, hint: `${item.personas}` }))]}
                    disabled={guardando}
                  />
                </div>
                <p className="text-xs leading-relaxed text-fg-muted sm:col-span-2">
                  Vale para quien tenga hoy o tenga después esa área y ese cargo en DATA_USERS: si alguien cambia de cargo, gana o pierde el permiso solo.
                </p>
              </div>
            )}
            {intentado && errores.sujeto && <p className="field-error">{errores.sujeto}</p>}

            <div>
              <FieldLabel htmlFor={`${baseId}-motivo`}>Motivo</FieldLabel>
              <textarea
                id={`${baseId}-motivo`}
                value={motivo}
                maxLength={300}
                onChange={event => setMotivo(event.target.value)}
                placeholder="Por qué lo necesita, quién lo pidió."
                disabled={guardando}
                aria-invalid={intentado && errores.motivo ? true : undefined}
                className={cn('field min-h-[84px] resize-y py-3 leading-relaxed', intentado && errores.motivo && 'field-invalid')}
              />
              {intentado && errores.motivo && <p className="field-error">{errores.motivo}</p>}
            </div>
          </div>
        </ModalSection>

        <ModalSection aside title="Resultado" description="Así queda antes de guardar.">
          <dl className="space-y-4 text-[13px]">
            <div>
              <dt className="text-xs font-medium text-fg-subtle">Se concede a</dt>
              <dd className="mt-0.5 font-semibold text-fg">{sujeto}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-fg-subtle">Alcanza hoy</dt>
              <dd className="mt-0.5 text-fg">
                {alcanzados.length === 1 ? '1 persona' : `${alcanzados.length} personas`}
                {alcanzados.length > 0 && <span className="block text-xs leading-relaxed text-fg-muted">{nombres(alcanzados)}</span>}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-fg-subtle">Lo ganan</dt>
              <dd className="mt-0.5 text-fg">
                {ganan.length === 0
                  ? <span className="text-fg-muted">Nadie: los alcanzados ya lo tienen por otra concesión o por ser Sistemas.</span>
                  : <>{ganan.length === 1 ? '1 persona' : `${ganan.length} personas`}<span className="block text-xs leading-relaxed text-fg-muted">{nombres(ganan)}</span></>}
              </dd>
            </div>
            {errores.repetido && (
              <p className="rounded-xl border border-warning/35 bg-warning/[0.06] px-3.5 py-3 text-[12.5px] leading-relaxed text-fg-muted">{errores.repetido}</p>
            )}
          </dl>
        </ModalSection>
      </ModalColumns>
    </Modal>
  );
}
