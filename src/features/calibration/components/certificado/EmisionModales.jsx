import { useCallback, useId, useState } from 'react';
import { AlertOctagon, AlertTriangle, FileUp } from 'lucide-react';
import { useResource } from '../../../system/hooks/useResource';
import { calibrationApi } from '../../api/calibration';
import { CancelButton, FieldLabel, Modal, PrimaryButton } from '../primitives';

/**
 * Autorizar el certificado de un registro aprobado: muestra el número y la
 * emisión que se fijan y lo que impide autorizarlo. Al confirmar se congela
 * el contenido; después se descarga el PDF para firmar.
 */
export function AutorizarModal({ codigo, onClose, onAutorizado }) {
  const load = useCallback(() => calibrationApi.certificado(codigo), [codigo]);
  const { data, error } = useResource(load);
  const [busy, setBusy] = useState(false);
  const [fallo, setFallo] = useState(null);
  const bloqueado = !data || data.bloqueos.length > 0;

  const confirmar = async (close) => {
    setBusy(true);
    setFallo(null);
    try {
      await calibrationApi.autorizarCertificado(codigo);
      close();
      onAutorizado();
    } catch (failure) {
      setFallo(failure.message);
      setBusy(false);
    }
  };

  return (
    <Modal
      size="md"
      title="Autorizar el certificado"
      subtitle={data?.contenido ? `N.º ${data.contenido.numero} · emisión ${data.contenido.emision}` : codigo}
      onClose={onClose}
      busy={busy}
      footer={(close) => (
        <>
          <CancelButton onClick={close} disabled={busy} />
          <div className="ml-auto">
            <PrimaryButton onClick={() => confirmar(close)} busy={busy} busyLabel="Autorizando" disabled={bloqueado}>Autorizar</PrimaryButton>
          </div>
        </>
      )}
    >
      <div className="space-y-3 px-5 py-5 text-[13px] leading-relaxed text-fg-muted sm:px-6">
        {!data && <p>{error ? <span className="text-danger">{error.message}</span> : 'Revisando el certificado…'}</p>}
        {data?.bloqueos.length > 0 && (
          <section className="rounded-2xl border border-danger/30 bg-danger/5 p-3 text-fg">
            <p className="mb-1 flex items-center gap-2 font-semibold"><AlertOctagon className="h-4 w-4 text-danger" aria-hidden="true" />No se puede autorizar</p>
            <ul className="list-disc pl-5 text-[12.5px]">{data.bloqueos.map(b => <li key={b}>{b}</li>)}</ul>
          </section>
        )}
        {data?.avisos.length > 0 && (
          <section className="rounded-2xl border border-warning/30 bg-warning/5 p-3 text-fg">
            <p className="mb-1 flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />Revisa</p>
            <ul className="list-disc pl-5 text-[12.5px]">{data.avisos.map(a => <li key={a}>{a}</li>)}</ul>
          </section>
        )}
        {data && (
          <>
            <p className="text-fg">
              Se fija el n.º <strong>{data.contenido.numero}</strong>, emisión <strong>{data.contenido.emision}</strong>, y el contenido del
              certificado queda congelado tal como lo ves en la vista previa.
            </p>
            <p>Después descarga el «PDF para firmar», fírmalo con tu firma digital y súbelo: la fecha de la firma es la fecha de emisión.</p>
            <p>Si el PDF sale con un error antes de firmarlo, puedes anular la autorización con su motivo.</p>
          </>
        )}
        {fallo && <p className="field-error" role="alert">{fallo}</p>}
      </div>
    </Modal>
  );
}

/**
 * Subir el PDF firmado de la emisión autorizada. DataMET+ comprueba la firma
 * digital y que sea el PDF de esta emisión, y lee la fecha de la firma; si no
 * puede leerla, la pide.
 */
export function SubirFirmadoModal({ codigo, emision, onClose, onEmitido }) {
  const baseId = useId();
  const [archivo, setArchivo] = useState(null);
  const [fecha, setFecha] = useState('');
  const [pedirFecha, setPedirFecha] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fallo, setFallo] = useState(null);

  const subir = async (close) => {
    if (!archivo) return;
    setBusy(true);
    setFallo(null);
    try {
      const resultado = await calibrationApi.subirFirmado(codigo, archivo, pedirFecha ? fecha : null);
      close();
      onEmitido(resultado);
    } catch (failure) {
      if (/fecha de la firma/i.test(failure.message) && /Indícala/i.test(failure.message)) setPedirFecha(true);
      setFallo(failure.message);
      setBusy(false);
    }
  };

  return (
    <Modal
      size="md"
      title="Subir el certificado firmado"
      subtitle={emision ? `${emision.numero} · emisión ${String(emision.emision).padStart(2, '0')}` : codigo}
      onClose={onClose}
      busy={busy}
      footer={(close) => (
        <>
          <CancelButton onClick={close} disabled={busy} />
          <div className="ml-auto">
            <PrimaryButton onClick={() => subir(close)} busy={busy} busyLabel="Subiendo" disabled={!archivo || (pedirFecha && !fecha)}>
              <FileUp className="h-4 w-4" aria-hidden="true" /> Subir y emitir
            </PrimaryButton>
          </div>
        </>
      )}
    >
      <div className="space-y-4 px-5 py-5 text-[13px] leading-relaxed text-fg-muted sm:px-6">
        <p>
          Sube el «PDF para firmar» de esta emisión ya firmado con tu firma digital. Queda archivado en la carpeta del año
          {emision?.archivo ? <> como <span className="font-medium text-fg">{emision.archivo}</span></> : null}; no se sobrescribe ni se borra.
        </p>
        <div>
          <FieldLabel htmlFor={`${baseId}-pdf`}>PDF firmado</FieldLabel>
          <input
            id={`${baseId}-pdf`}
            type="file"
            accept="application/pdf"
            disabled={busy}
            onChange={event => { setArchivo(event.target.files?.[0] || null); setFallo(null); }}
            className="block w-full text-[13px] text-fg file:mr-3 file:h-9 file:rounded-lg file:border file:border-line file:bg-surface file:px-3 file:font-semibold file:text-fg hover:file:bg-surface-2"
          />
        </div>
        {pedirFecha && (
          <div className="max-w-[220px]">
            <FieldLabel htmlFor={`${baseId}-fecha`}>Fecha de la firma</FieldLabel>
            <input id={`${baseId}-fecha`} type="date" value={fecha} onChange={event => setFecha(event.target.value)} disabled={busy} className="field h-11" />
          </div>
        )}
        {fallo && <p className="field-error" role="alert">{fallo}</p>}
      </div>
    </Modal>
  );
}
