import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AlertOctagon, AlertTriangle, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../../../shared/utils/cn';
import { Button } from '../../../../shared/components/ui/Button';
import { calibrationApi } from '../../api/calibration';
import { Segmented } from '../primitives';
import { CertificadoDocumento } from '../certificado/CertificadoDocumento';
import { CertificadoProfesional } from '../certificado/CertificadoProfesional';
import { PdfCertificado } from '../certificado/PdfCertificado';
import { descargar } from '../certificado/descargar';

const ANCHO_HOJA = (210 / 25.4) * 96;
const ESPERA = 700;

const MODELOS = [
  { value: 'actual', label: 'Modelo actual' },
  { value: 'sugerido', label: 'Modelo sugerido' },
];

/** Hojas a escala del ancho del panel. */
function Hojas({ contenido, borrador, modelo }) {
  const ref = useRef(null);
  const [escala, setEscala] = useState(0.55);
  useLayoutEffect(() => {
    const nodo = ref.current;
    if (!nodo) return undefined;
    const medir = () => setEscala(Math.max(0.25, Math.min(1.2, (nodo.clientWidth - 32) / ANCHO_HOJA)));
    medir();
    const observer = new ResizeObserver(medir);
    observer.observe(nodo);
    return () => observer.disconnect();
  }, []);
  const Documento = modelo === 'sugerido' ? CertificadoProfesional : CertificadoDocumento;
  return (
    <div ref={ref} className={cn('rounded-2xl bg-surface-3 p-4', modelo === 'sugerido' ? 'cp-vista' : 'cc-vista')}>
      <div style={{ zoom: escala }}>
        <Documento contenido={contenido} borrador={borrador} />
      </div>
    </div>
  );
}

function Lista({ items, tono }) {
  if (!items?.length) return null;
  const Icono = tono === 'danger' ? AlertOctagon : AlertTriangle;
  return (
    <ul className="flex flex-col gap-1">
      {items.map(item => (
        <li key={item} className="flex gap-2 text-[12px] leading-snug text-fg">
          <Icono className={cn('mt-0.5 h-3.5 w-3.5 flex-none', tono === 'danger' ? 'text-danger' : 'text-warning')} aria-hidden="true" />
          {item}
        </li>
      ))}
    </ul>
  );
}

/**
 * El pre-informe: el certificado tal como saldría, con los cambios que aún
 * no se guardan (se recalcula en el servidor al dejar de escribir). Elige
 * entre el modelo actual (hoja CERT) y el sugerido; descarga el PDF.
 * `emision`: una emisión ya autorizada o emitida en particular.
 */
export function PreviaCertificado({ codigo, version, estado, cambios, pendientes, modelo, onModelo, emision = null, completo = false }) {
  const [previa, setPrevia] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [fallo, setFallo] = useState(null);
  const [generando, setGenerando] = useState(null);
  const pedido = useRef(0);
  const clave = JSON.stringify(cambios);

  useEffect(() => {
    const id = pedido.current + 1;
    pedido.current = id;
    const conCambios = pendientes > 0 && emision == null;
    const temporizador = setTimeout(async () => {
      setCargando(true);
      try {
        const resultado = conCambios
          ? await calibrationApi.vistaPreviaCertificado(codigo, JSON.parse(clave))
          : await calibrationApi.certificado(codigo, emision);
        if (pedido.current !== id) return;
        setPrevia(resultado);
        setFallo(null);
      } catch (error) {
        if (pedido.current === id) setFallo(error.message);
      } finally {
        if (pedido.current === id) setCargando(false);
      }
    }, conCambios ? ESPERA : 0);
    return () => clearTimeout(temporizador);
  }, [clave, codigo, emision, estado, pendientes, version]);

  const paraFirmar = previa && !previa.borrador && previa.emision?.estado === 'AUTORIZADO';
  // Se firma y se emite el modelo actual; el sugerido es una propuesta.
  const nombre = previa?.archivo
    ? previa.archivo.replace(/\.pdf$/i, `${previa.borrador || modelo === 'sugerido' ? ' BORRADOR' : ''}${modelo === 'sugerido' ? ' MODELO SUGERIDO' : ''}`)
    : `${codigo} BORRADOR`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented label="Modelo de certificado" value={modelo} onChange={onModelo} options={MODELOS} className="cal-tabs" />
        <span className="ml-auto flex items-center gap-2">
          {cargando && <Loader2 className="h-4 w-4 animate-spin text-fg-subtle" aria-label="Actualizando la vista previa" />}
          {previa && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setGenerando({ firmar: paraFirmar && modelo === 'actual' })}
              disabled={Boolean(generando) || pendientes > 0}
              title={pendientes > 0 ? 'Guarda los cambios para descargar el PDF' : undefined}
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              {paraFirmar && modelo === 'actual' ? 'PDF para firmar' : 'PDF borrador'}
            </Button>
          )}
        </span>
      </div>
      <p className="text-[12px] text-fg-muted">
        {pendientes > 0 && emision == null
          ? 'Con los cambios sin guardar. '
          : previa && !previa.borrador ? 'Contenido congelado de la emisión autorizada. ' : 'Con los datos guardados. '}
        {modelo === 'sugerido' ? 'El modelo sugerido es una propuesta de diseño: se emite con el modelo actual.' : 'Mismo diseño de la hoja CERT del libro.'}
      </p>
      {fallo && <p className="rounded-xl border border-danger/30 bg-danger/5 px-3 py-2 text-[12.5px] text-danger" role="alert">{fallo}</p>}
      {previa && (completo || previa.bloqueos?.length > 0) && (
        <div className="flex flex-col gap-1.5 rounded-xl border border-line bg-surface px-3 py-2.5">
          <Lista items={previa.bloqueos} tono="danger" />
          {completo && <Lista items={previa.avisos} tono="warning" />}
          {!previa.bloqueos?.length && !previa.avisos?.length && <p className="text-[12px] text-fg-muted">Nada pendiente para emitirlo.</p>}
        </div>
      )}
      {previa ? <Hojas contenido={previa.contenido} borrador={previa.borrador} modelo={modelo} /> : !fallo && (
        <div className="flex min-h-[40vh] items-center justify-center rounded-2xl bg-surface-3" role="status" aria-label="Armando el certificado">
          <Loader2 className="h-5 w-5 animate-spin text-fg-subtle" />
        </div>
      )}
      {generando && previa && (
        <PdfCertificado
          contenido={previa.contenido}
          modelo={modelo}
          borrador={previa.borrador || modelo === 'sugerido'}
          titulo={nombre}
          marca={generando.firmar ? previa.marca || '' : ''}
          onListo={(blob) => {
            descargar(blob, `${nombre}.pdf`);
            toast.success(`Se descargó ${nombre}.pdf`);
            setGenerando(null);
          }}
          onError={(error) => {
            toast.error(`No se pudo preparar el PDF: ${error.message}`);
            setGenerando(null);
          }}
        />
      )}
    </div>
  );
}
