import { Check, Minus, ShieldCheck, UsersRound } from 'lucide-react';
import { Button } from '../../../shared/components/ui/Button';
import { Modal, ToneBadge } from '../../calibration/components/primitives';
import { nivelDe, origenDe } from '../domain/permisos';

/**
 * Los permisos de una persona y de dónde le viene cada uno: por ser Sistemas,
 * a su nombre (se le revoca solo a ella) o por un grupo (se revoca al grupo).
 */
export function PersonaPermisosModal({ gestion, personaId, onClose, onConceder, onRevocar }) {
  const persona = gestion.personal.find(item => item.id === personaId);
  if (!persona) return null;
  return (
    <Modal
      size="md"
      onClose={onClose}
      title={persona.nombre}
      subtitle={[persona.area, persona.cargo, nivelDe(persona.nivel), persona.usuario].filter(Boolean).join(' · ')}
    >
      <ul className="divide-y divide-line">
        {gestion.catalogo.map((permiso) => {
          const origen = origenDe(persona, permiso.clave, gestion.concesiones);
          return (
            <li key={permiso.clave} className="flex flex-wrap items-start gap-x-4 gap-y-3 px-5 py-4 sm:px-6">
              <span
                className={origen ? 'mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-success/10 text-success' : 'mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-fg/[0.05] text-fg-subtle'}
                aria-hidden="true"
              >
                {origen ? <Check className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1 basis-64">
                <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-semibold text-fg">
                  {permiso.nombre}
                  <ToneBadge tone={origen ? 'success' : 'neutral'}>{origen ? 'Lo tiene' : 'No lo tiene'}</ToneBadge>
                </p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-fg-muted">{permiso.descripcion}</p>
                {origen?.sistemas && (
                  <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-fg">
                    <ShieldCheck className="h-3.5 w-3.5 text-info" aria-hidden="true" /> Por ser Sistemas (nivel 3): tiene todos los permisos.
                  </p>
                )}
                {origen?.propia && (
                  <p className="mt-2 text-[12.5px] text-fg">Concedido a esta persona{origen.propia.motivo ? `: ${origen.propia.motivo}` : '.'}</p>
                )}
                {origen?.grupos.map(grupo => (
                  <p key={grupo.id} className="mt-2 flex items-start gap-1.5 text-[12.5px] text-fg">
                    <UsersRound className="mt-0.5 h-3.5 w-3.5 flex-none text-fg-subtle" aria-hidden="true" />
                    <span>Por el grupo «{grupo.sujeto}». Para quitárselo, revoca el grupo en «Por permiso».</span>
                  </p>
                ))}
              </div>
              <div className="flex flex-none items-center gap-2">
                {origen?.propia && (
                  <Button size="sm" variant="ghost" className="text-danger hover:bg-danger/10 hover:text-danger" onClick={() => onRevocar(origen.propia)}>
                    Revocar
                  </Button>
                )}
                {!origen && (
                  <Button size="sm" variant="secondary" onClick={() => onConceder(permiso.clave, persona.id)}>Conceder</Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
