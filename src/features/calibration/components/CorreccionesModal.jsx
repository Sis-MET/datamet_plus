import { useId, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '../../../shared/utils/cn';
import {
  CLASES_INSTRUMENTO, aTexto, columnasCambiadas, columnasDeSeccion, etiquetaColumna, opcionesDeColumna,
} from '../domain/registro';
import { Dropdown } from './Dropdown';
import { CancelButton, FieldLabel, Modal, ModalSection, PrimaryButton } from './primitives';

/** Un campo corregible: valor actual editable y, si difiere, el de ServiceMET debajo. */
function Campo({ columna, valor, original, onChange, disabled, compacto = false, etiqueta }) {
  const corregido = aTexto(valor).replace(',', '.') !== aTexto(original).replace(',', '.');
  const opciones = opcionesDeColumna(columna, valor);
  return (
    <div className="min-w-0">
      {!compacto && <FieldLabel htmlFor={`campo-${columna}`}>{etiqueta || etiquetaColumna(columna)}</FieldLabel>}
      {opciones ? (
        <div className={cn('rounded-xl', corregido && 'ring-2 ring-warning/40')}>
          <Dropdown
            id={`campo-${columna}`}
            ariaLabel={etiquetaColumna(columna)}
            value={valor}
            onChange={onChange}
            options={opciones}
            disabled={disabled}
            size={compacto ? 'sm' : 'md'}
          />
        </div>
      ) : (
        <input
          id={`campo-${columna}`}
          value={valor}
          onChange={event => onChange(event.target.value)}
          disabled={disabled}
          aria-label={etiquetaColumna(columna)}
          title={corregido ? `En ServiceMET: ${aTexto(original) || 'vacío'}` : undefined}
          className={cn('field tabular-nums', compacto ? 'h-9 rounded-lg px-2.5 text-[13px]' : 'h-11', corregido && 'border-warning ring-2 ring-warning/20')}
        />
      )}
      {corregido && (
        <p className="mt-0.5 truncate text-[11px] text-fg-subtle">ServiceMET: {aTexto(original) || 'vacío'}</p>
      )}
    </div>
  );
}

/**
 * Corrección de los datos de una sección del registro. Muestra los valores
 * efectivos (ServiceMET con las correcciones) y guarda solo lo que cambia;
 * volver al valor de ServiceMET quita la corrección.
 */
export function CorreccionesModal({
  titulo, campos, fuente, efectivos, clase, origenesClase, onClose, onGuardar,
}) {
  const baseId = useId();
  const columnas = useMemo(() => columnasDeSeccion(campos), [campos]);
  const [valores, setValores] = useState(() => Object.fromEntries(columnas.map(c => [c, aTexto(efectivos[c])])));
  const [claseValor, setClaseValor] = useState(clase?.valor || '');
  const [claseOrigen, setClaseOrigen] = useState(clase?.origen || '');
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (columna) => (texto) => setValores(actuales => ({ ...actuales, [columna]: texto }));

  const guardar = async (close) => {
    const cambiadas = columnasCambiadas(efectivos, valores);
    const claseCambio = campos.clase && ((claseValor || null) !== (clase?.valor || null) || (claseOrigen || null) !== (clase?.origen || null));
    if (campos.clase && claseValor && !claseOrigen) {
      toast.error('Indica de dónde sale la clase del instrumento.');
      return;
    }
    if (!Object.keys(cambiadas).length && !claseCambio) {
      toast.info('No hay cambios que guardar.');
      return;
    }
    setSaving(true);
    try {
      await onGuardar({
        columnas: cambiadas,
        ...(claseCambio ? { clase: claseValor ? { valor: claseValor, origen: claseOrigen } : null } : {}),
        motivo: motivo.trim() || null,
      });
      setSaving(false);
      close();
    } catch (error) {
      toast.error(error.message || 'No se pudieron guardar las correcciones.');
      setSaving(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      size="lg"
      busy={saving}
      title={`Corregir: ${titulo}`}
      subtitle="Los datos de ServiceMET no se modifican: la corrección queda en el registro con su historial."
      footer={(close) => (
        <div className="ml-auto flex items-center gap-2">
          <CancelButton onClick={close} disabled={saving} />
          <PrimaryButton onClick={() => guardar(close)} busy={saving}>Guardar correcciones</PrimaryButton>
        </div>
      )}
    >
      <div className="divide-y divide-line">
        {(campos.lista.length > 0 || campos.clase) && (
          <ModalSection title="Datos">
            <div className="grid gap-4 sm:grid-cols-2">
              {campos.lista.map(columna => (
                <Campo key={columna} columna={columna} valor={valores[columna]} original={fuente[columna]} onChange={set(columna)} disabled={saving} />
              ))}
              {campos.clase && (
                <>
                  <div>
                    <FieldLabel htmlFor={`${baseId}-clase`}>Clase del instrumento</FieldLabel>
                    <Dropdown
                      id={`${baseId}-clase`}
                      ariaLabel="Clase del instrumento"
                      value={claseValor}
                      onChange={setClaseValor}
                      options={[{ value: '', label: 'No declarada' }, ...CLASES_INSTRUMENTO.map(c => ({ value: c, label: `Clase ${c}` }))]}
                      disabled={saving}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor={`${baseId}-origen`}>Origen de la clase</FieldLabel>
                    <Dropdown
                      id={`${baseId}-origen`}
                      ariaLabel="Origen de la clase"
                      value={claseOrigen}
                      onChange={setClaseOrigen}
                      options={[{ value: '', label: 'Elegir' }, ...Object.entries(origenesClase || {}).map(([value, label]) => ({ value, label }))]}
                      disabled={saving || !claseValor}
                    />
                  </div>
                </>
              )}
            </div>
          </ModalSection>
        )}

        {campos.tablas.map(tabla => (
          <ModalSection key={tabla.titulo} title={tabla.titulo}>
            {tabla.cabecera && (
              <div className="mb-3 max-w-[220px]">
                <Campo columna={tabla.cabecera} etiqueta="Carga" valor={valores[tabla.cabecera]} original={fuente[tabla.cabecera]} onChange={set(tabla.cabecera)} disabled={saving} />
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-[11.5px] uppercase tracking-[0.04em] text-fg-muted">
                    <th className="px-1.5 py-1.5 text-left font-semibold"> </th>
                    {tabla.columnas.map(c => <th key={c} className="px-1.5 py-1.5 text-left font-semibold">{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {tabla.filas.map(fila => (
                    <tr key={fila.etiqueta} className="align-top">
                      <td className="whitespace-nowrap px-1.5 py-1 pt-3 text-[12.5px] text-fg-muted">{fila.etiqueta}</td>
                      {fila.celdas.map(columna => (
                        <td key={columna} className="px-1.5 py-1">
                          <Campo compacto columna={columna} valor={valores[columna]} original={fuente[columna]} onChange={set(columna)} disabled={saving} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ModalSection>
        ))}

        <ModalSection title="Motivo" description="Opcional mientras el registro es un borrador; queda en el historial.">
          <input
            value={motivo}
            maxLength={500}
            onChange={event => setMotivo(event.target.value)}
            disabled={saving}
            aria-label="Motivo de la corrección"
            className="field h-11"
            placeholder="Ej.: lectura mal digitada en ServiceMET"
          />
        </ModalSection>
      </div>
    </Modal>
  );
}
