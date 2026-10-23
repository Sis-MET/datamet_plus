import { useState } from 'react';
import { CancelButton, FieldLabel, Modal, PrimaryButton } from '../../../calibration/components/primitives';
import { MESES_PLAN, periodoPlan, seleccionarProximos } from '../../domain/proximosExport';
import { pedirDestino } from '../destinoPdf';

export function ExportarPlanModal({ anio, mes, eventos, filtros, onClose }) {
  const [alcance, setAlcance] = useState('anio');
  const [desde, setDesde] = useState(mes + 1);
  const [hasta, setHasta] = useState(mes + 1);
  const [descartados, setDescartados] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const opciones = { anio, desdeMes: alcance === 'anio' ? 1 : desde, hastaMes: alcance === 'anio' ? 12 : alcance === 'mes' ? desde : hasta, incluirDescartados: descartados };
  const filas = seleccionarProximos(eventos, opciones);
  const periodo = periodoPlan(opciones);
  const exportar = async close => {
    setBusy(true);
    setError(null);
    try {
      const nombre = `Proximos-servicios-${anio}-${String(opciones.desdeMes).padStart(2, '0')}-${String(opciones.hastaMes).padStart(2, '0')}`;
      const destino = await pedirDestino(nombre);
      if (destino === undefined) return;
      const { generarPlanPdf } = await import('./PlanServiciosPdf');
      const blob = await generarPlanPdf({ eventos: filas, periodo, filtros, generado: new Date().toLocaleDateString('es-BO') });
      if (destino) {
        const archivo = await destino.createWritable();
        try { await archivo.write(blob); await archivo.close(); }
        catch (failure) { await archivo.abort().catch(() => {}); throw failure; }
      } else {
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = `${nombre}.pdf`;
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      }
      close();
    } catch (failure) {
      setError(failure.message || 'No se pudo generar el PDF. Inténtelo nuevamente.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Exportar próximos servicios" subtitle={`Plan de ${anio}`} onClose={onClose} busy={busy} size="md"
      footer={close => <><CancelButton onClick={close} disabled={busy} /><PrimaryButton onClick={() => exportar(close)} busy={busy} disabled={!filas.length || opciones.desdeMes > opciones.hastaMes} busyLabel="Generando PDF">Guardar PDF</PrimaryButton></>}>
      <div className="space-y-4 px-5 py-5 sm:px-6">
        <div><FieldLabel htmlFor="plan-alcance">Período</FieldLabel>
          <select id="plan-alcance" className="field h-11" value={alcance} disabled={busy} onChange={e => setAlcance(e.target.value)}>
            <option value="anio">Todo el año {anio}</option><option value="mes">Un mes</option><option value="rango">Intervalo de meses</option>
          </select>
        </div>
        {alcance !== 'anio' && <div className="grid gap-3 sm:grid-cols-2">
          <div><FieldLabel htmlFor="plan-desde">{alcance === 'mes' ? 'Mes' : 'Desde'}</FieldLabel>
            <select id="plan-desde" className="field h-11" disabled={busy} value={desde} onChange={e => { const n = Number(e.target.value); setDesde(n); if (n > hasta) setHasta(n); }}>
              {MESES_PLAN.map((nombre, i) => <option key={nombre} value={i + 1}>{nombre}</option>)}
            </select>
          </div>
          {alcance === 'rango' && <div><FieldLabel htmlFor="plan-hasta">Hasta</FieldLabel>
            <select id="plan-hasta" className="field h-11" disabled={busy} value={hasta} onChange={e => setHasta(Number(e.target.value))}>
              {MESES_PLAN.map((nombre, i) => <option key={nombre} disabled={i + 1 < desde} value={i + 1}>{nombre}</option>)}
            </select>
          </div>}
        </div>}
        <label className="flex items-center gap-2 text-[13px] text-fg"><input type="checkbox" checked={descartados} disabled={busy} onChange={e => setDescartados(e.target.checked)} /> Incluir servicios descartados</label>
        <p className="text-[13px] text-fg">{periodo} · <strong>{filas.length} {filas.length === 1 ? 'servicio sugerido' : 'servicios sugeridos'}</strong></p>
        <p className="text-xs leading-relaxed text-fg-muted">Se aplican los filtros actuales de cliente, ciudad, búsqueda, tipo y situación. Se incluyen capacidades, divisiones y rangos registrados; las fechas están sujetas a coordinación.</p>
        {filtros && <p className="text-xs text-fg-muted">{filtros}</p>}
        {!filas.length && <p className="text-[13px] text-fg-muted" role="status">No hay próximos servicios para este período y estos filtros.</p>}
        {error && <p role="alert" className="field-error">{error}</p>}
      </div>
    </Modal>
  );
}
