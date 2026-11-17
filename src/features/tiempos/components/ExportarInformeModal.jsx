import { useState } from 'react';
import { FileText } from 'lucide-react';
import { toast } from 'sonner';
import { CancelButton, Modal, PrimaryButton, Switch } from '../../calibration/components/primitives';

// Mismas secciones que InformeTiemposPdf (se repiten aquí para no cargar el
// generador de PDF hasta que se pide el informe).
const SECCIONES = [
  { id: 'meses', titulo: 'Evolución mensual', descripcion: 'Gráfico y tabla de horas, servicios y jornadas por mes.' },
  { id: 'personal', titulo: 'Personal', descripcion: 'Una fila por técnico: horas, servicios, jornadas y comparación con el área.' },
  { id: 'grupos', titulo: 'Por tipo de servicio', descripcion: 'Horas y servicios de cada grupo, con su parte del total.' },
  { id: 'departamentos', titulo: 'Por departamento', descripcion: 'Mapa de Bolivia con los servicios y su tabla por departamento.' },
  { id: 'detallePersonal', titulo: 'Detalle por técnico', descripcion: 'Cada técnico con sus meses y en qué tipos de servicio usó sus horas.' },
  { id: 'servicios', titulo: 'Servicios del período', descripcion: 'La lista completa de servicios con su horario y duración.' },
];

const descargar = (blob, nombre) => {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
};

/**
 * Elige qué secciones lleva el informe PDF y lo genera con los filtros y el
 * período que se ven en el panel. `preparar()` arma los datos del informe.
 */
export function ExportarInformeModal({ onClose, resumen, nombreArchivo, preparar, grupoLabel }) {
  const [secciones, setSecciones] = useState(() => Object.fromEntries(SECCIONES.map(seccion => [seccion.id, true])));
  const [generando, setGenerando] = useState(false);

  const generar = async (cerrar) => {
    setGenerando(true);
    try {
      const { generarInformeTiempos } = await import('./InformeTiemposPdf');
      const blob = await generarInformeTiempos({ ...preparar(), secciones });
      descargar(blob, nombreArchivo);
      toast.success('Informe PDF generado.', { description: nombreArchivo, duration: 4000 });
      cerrar();
    } catch (error) {
      toast.error('No se pudo generar el informe PDF.', { description: error?.message });
    } finally {
      setGenerando(false);
    }
  };

  return (
    <Modal
      title="Informe PDF de tiempos de servicio"
      subtitle="Con el encabezado de los RIM y los filtros que se ven en el panel."
      onClose={onClose}
      size="md"
      busy={generando}
      footer={cerrar => (
        <>
          <p className="mr-auto hidden text-[12px] text-fg-muted sm:block">Siempre incluye los datos del informe y el resumen general.</p>
          <CancelButton onClick={cerrar} disabled={generando} />
          <PrimaryButton onClick={() => generar(cerrar)} busy={generando} busyLabel="Generando">
            <FileText className="h-4 w-4" aria-hidden="true" /> Generar PDF
          </PrimaryButton>
        </>
      )}
    >
      <div className="flex flex-col gap-5 px-5 py-5 sm:px-6">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-2xl border border-line bg-surface-2/50 px-4 py-3 text-[13px] sm:grid-cols-2">
          {resumen.map(([etiqueta, valor]) => (
            <div key={etiqueta} className="flex min-w-0 justify-between gap-3 sm:block">
              <dt className="text-fg-muted">{etiqueta}</dt>
              <dd className="truncate font-semibold text-fg">{valor}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-col gap-4">
          <p className="text-[13px] font-semibold text-fg">Secciones del informe</p>
          {SECCIONES.map(seccion => (
            <Switch
              key={seccion.id}
              checked={secciones[seccion.id]}
              onChange={valor => setSecciones(prev => ({ ...prev, [seccion.id]: valor }))}
              label={seccion.id === 'grupos' ? `Por ${grupoLabel.toLowerCase()}` : seccion.titulo}
              description={seccion.descripcion}
              disabled={generando}
            />
          ))}
        </div>
      </div>
    </Modal>
  );
}
