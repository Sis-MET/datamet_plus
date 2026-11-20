import { Eye } from 'lucide-react';
import { soloConsulta as esSoloConsulta } from '../../shared/components/layout/navigation';
import { usePestanaRuta } from '../../shared/navigation/ruta';
import { BitrixPanel } from './components/BitrixPanel';
import { CobranzaPanel } from './components/CobranzaPanel';
import { FacturasPanel } from './components/FacturasPanel';
import { PagosPanel } from './components/PagosPanel';
import { ReportesPanel } from './components/ReportesPanel';
import '../calibration/calibration.css';
import './comercial.css';

const PESTANAS = ['facturas', 'cobranza', 'pagos', 'reportes', 'bitrix'];
const STORAGE_KEY = 'datamet_comercial_tab';

/**
 * Apartado Comercial: facturas, cuentas por cobrar y pagos en las tablas COM_*
 * de DataMET (fase 1) y la copia de las negociaciones de Bitrix24 (fase 2).
 * Lo usa el área Comercial; Administración y Gerencia lo consultan sin
 * registrar. El servidor vuelve a comprobarlo.
 */
export function ComercialPage({ currentUser }) {
  const { pestana } = usePestanaRuta('comercial', PESTANAS, { clave: STORAGE_KEY, predeterminada: 'facturas' });
  const consulta = esSoloConsulta('comercial', currentUser);

  return (
    <div className="vt-panel">
      <main className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        {consulta && (
          <p className="flex items-center gap-2 rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-[13px] text-fg-muted">
            <Eye className="h-4 w-4 flex-none" aria-hidden="true" />
            Tu área consulta Comercial: ves las facturas, los pagos y las cuentas por cobrar sin registrar ni anular.
          </p>
        )}
        {pestana === 'facturas' && <FacturasPanel soloConsulta={consulta} />}
        {pestana === 'cobranza' && <CobranzaPanel soloConsulta={consulta} />}
        {pestana === 'pagos' && <PagosPanel soloConsulta={consulta} />}
        {pestana === 'reportes' && <ReportesPanel />}
        {pestana === 'bitrix' && <BitrixPanel soloConsulta={consulta} />}
      </main>
    </div>
  );
}
