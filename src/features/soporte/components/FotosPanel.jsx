import { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { ArrowLeft, ArrowRight, Camera, Loader2, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../../shared/utils/cn';
import { CancelButton, DangerButton, EmptyState, Modal } from '../../calibration/components/primitives';
import { fotoParaRegistro } from '../../rim/utils/fotos';
import { MAX_FOTOS, fechaHora } from '../domain/informe';

/** Descripción de una foto: se guarda al salir del campo. */
function Descripcion({ foto, editable, onGuardar }) {
  const [texto, setTexto] = useState(foto.descripcion || '');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setTexto(foto.descripcion || '');
  }, [foto.descripcion]);

  const guardar = async () => {
    if (texto.trim() === (foto.descripcion || '')) return;
    setGuardando(true);
    try {
      // false: no se guardó (se canceló la confirmación).
      const hecho = await onGuardar(texto.trim());
      if (!hecho) setTexto(foto.descripcion || '');
    } catch (error) {
      toast.error(error.message);
      setTexto(foto.descripcion || '');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="relative">
      <textarea
        value={texto}
        onChange={(event) => setTexto(event.target.value)}
        onBlur={guardar}
        rows={2}
        maxLength={300}
        disabled={!editable || guardando}
        placeholder={editable ? 'Descripción (sale bajo la foto)' : 'Sin descripción'}
        aria-label={`Descripción de la foto ${foto.posicion}`}
        className="field resize-none py-2 text-[13px] leading-snug"
      />
      {guardando && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-fg-subtle" aria-label="Guardando" />}
    </div>
  );
}

function QuitarFotoModal({ foto, onClose, onConfirm }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const confirmar = async (close) => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      close();
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  };
  return (
    <Modal
      size="md"
      title={`Quitar la foto ${foto.posicion}`}
      subtitle={foto.descripcion || 'Sin descripción'}
      onClose={onClose}
      busy={busy}
      footer={(close) => (
        <>
          <CancelButton onClick={close} disabled={busy} />
          <div className="ml-auto">
            <DangerButton onClick={() => confirmar(close)} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
              Quitar foto
            </DangerButton>
          </div>
        </>
      )}
    >
      <div className="space-y-3 px-5 py-5 sm:px-6">
        <img src={foto.url} alt="" className="max-h-56 rounded-xl border border-line object-contain" />
        <p className="text-[13px] leading-relaxed text-fg-muted">
          La foto sale del informe pero no se borra: queda en el historial con quién la quitó y cuándo.
        </p>
        {error && <p className="field-error" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}

/**
 * Registro fotográfico del informe: hasta 12 fotos (dos hojas de 6), cada
 * una con su descripción, en el orden en que se imprimen.
 */
export function FotosPanel({ informe, editable, acciones }) {
  const fotos = informe.fotos.map((foto, index) => ({ ...foto, posicion: index + 1 }));
  const libres = MAX_FOTOS - fotos.length;
  const [subiendo, setSubiendo] = useState(null);
  const [quitando, setQuitando] = useState(null);

  const subir = useCallback(async (archivos) => {
    const lote = archivos.slice(0, libres);
    if (archivos.length > libres) toast.warning(`El informe admite ${MAX_FOTOS} fotos: se subirán ${lote.length}.`);
    if (lote.length === 0) return;
    await acciones.conMotivo({
      titulo: lote.length === 1 ? 'Agregar una foto' : `Agregar ${lote.length} fotos`,
      accion: 'Agregar',
    }, async (motivo) => {
      for (const [index, archivo] of lote.entries()) {
        setSubiendo({ actual: index + 1, total: lote.length });
        const foto = await fotoParaRegistro(archivo, { maxLado: 1400, calidad: 0.8 });
        await acciones.agregarFoto({ contenido: foto.contenido, nombre: foto.nombre, motivo });
      }
      toast.success(lote.length === 1 ? 'Foto agregada.' : `${lote.length} fotos agregadas.`);
    }).finally(() => setSubiendo(null));
  }, [acciones, libres]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (aceptadas) => {
      subir(aceptadas).catch(error => toast.error(error.message));
    },
    accept: { 'image/jpeg': [], 'image/png': [], 'image/webp': [] },
    disabled: !editable || libres <= 0 || Boolean(subiendo),
    multiple: true,
  });

  const mover = (index, paso) => {
    const ids = fotos.map(foto => foto.id);
    const destino = index + paso;
    [ids[index], ids[destino]] = [ids[destino], ids[index]];
    acciones.conMotivo({ titulo: 'Cambiar el orden de las fotos', accion: 'Cambiar orden' }, motivo => acciones.ordenarFotos({ ids, motivo }))
      .catch(error => toast.error(error.message));
  };

  return (
    <div className="flex flex-col gap-4">
      {editable && libres > 0 && (
        <div
          {...getRootProps()}
          className={cn(
            'cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-colors',
            isDragActive ? 'border-fg/40 bg-surface-2' : 'border-line-strong hover:border-fg/30 hover:bg-surface-2/60',
            subiendo && 'cursor-wait opacity-70',
          )}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center justify-center gap-1.5">
            {subiendo
              ? <Loader2 className="h-7 w-7 animate-spin text-fg-subtle" aria-hidden="true" />
              : <Upload className="h-7 w-7 text-fg-subtle" aria-hidden="true" />}
            <p className="text-sm text-fg-muted">
              {subiendo
                ? `Subiendo ${subiendo.actual} de ${subiendo.total}…`
                : <><span className="font-semibold text-fg">Elija las fotos</span> o arrástrelas aquí</>}
            </p>
            <p className="text-xs text-fg-subtle">JPG, PNG o WEBP · quedan {libres} de {MAX_FOTOS} · se reducen antes de subirse.</p>
          </div>
        </div>
      )}

      {fotos.length === 0 ? (
        <EmptyState icon={Camera} title="Sin fotografías">
          {editable
            ? 'Las fotos salen en una hoja aparte del informe, 6 por hoja, con su descripción debajo.'
            : 'Este informe no tiene fotografías.'}
        </EmptyState>
      ) : (
        <ol className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {fotos.map((foto, index) => (
            <li key={foto.id} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold text-fg">Foto {foto.posicion}</span>
                {editable && (
                  <span className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => mover(index, -1)}
                      disabled={index === 0}
                      aria-label={`Mover la foto ${foto.posicion} antes`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted hover:bg-fg/[0.06] hover:text-fg disabled:opacity-30"
                    >
                      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => mover(index, 1)}
                      disabled={index === fotos.length - 1}
                      aria-label={`Mover la foto ${foto.posicion} después`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted hover:bg-fg/[0.06] hover:text-fg disabled:opacity-30"
                    >
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuitando(foto)}
                      aria-label={`Quitar la foto ${foto.posicion}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-danger hover:bg-danger/10"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </span>
                )}
              </div>
              <a href={foto.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-line bg-surface-2">
                <img src={foto.url} alt={foto.descripcion || `Foto ${foto.posicion}`} className="aspect-[4/3] w-full object-contain" />
              </a>
              <Descripcion
                foto={foto}
                editable={editable}
                onGuardar={(descripcion) => acciones.conMotivo(
                  { titulo: `Descripción de la foto ${foto.posicion}`, accion: 'Guardar' },
                  motivo => acciones.editarFoto(foto.id, { descripcion, motivo }),
                )}
              />
              <p className="text-[11.5px] text-fg-subtle">
                {[foto.subidoPor?.nombre || foto.subidoPor?.usuario, fechaHora(foto.subidoEn)].filter(Boolean).join(' · ')}
              </p>
            </li>
          ))}
        </ol>
      )}

      {quitando && (
        <QuitarFotoModal
          foto={quitando}
          onClose={() => setQuitando(null)}
          onConfirm={() => acciones.conMotivo(
            { titulo: `Quitar la foto ${quitando.posicion}`, accion: 'Quitar foto' },
            motivo => acciones.quitarFoto(quitando.id, { motivo }),
          )}
        />
      )}
    </div>
  );
}
