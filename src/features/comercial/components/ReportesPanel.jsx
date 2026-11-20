import { useCallback, useId, useMemo, useState } from 'react';
import { BarChart3, FileSpreadsheet, Loader2, Table2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../shared/components/ui/Button';
import { cn } from '../../../shared/utils/cn';
import { Dropdown } from '../../calibration/components/Dropdown';
import { EmptyState, FieldLabel, Segmented } from '../../calibration/components/primitives';
import { useResource } from '../../system/hooks/useResource';
import { comercialApi } from '../api/comercial';
import {
  AREAS, AREA_COLOR, PERIODOS, REGIONALES, TIPOS, bs, bsCorto, fecha, hoyLaPaz, paramsReporte, periodoDe, porcentaje,
} from '../domain/comercial';
import { Cargando, Cifras, ErrorCarga } from './comunes';
import { Barras, ColumnasPorMes, LeyendaAreas, TablaPorMes } from './reportes/Graficos';

const TIPOS_CLIENTE = { nuevo: 'Nuevos', regular: 'Regulares', sin_cliente: 'Sin cliente de DataMET' };

function Tarjeta({ titulo, descripcion, accion, children, className }) {
  return (
    <section aria-label={titulo} className={cn('card flex min-w-0 flex-col gap-4 p-4 shadow-card sm:p-5', className)}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[14.5px] font-semibold text-fg">{titulo}</h3>
          {descripcion && <p className="mt-0.5 text-[12.5px] text-fg-muted">{descripcion}</p>}
        </div>
        {accion}
      </header>
      {children}
    </section>
  );
}

/** Lista de partes de un total (nuevos / regulares, regional): nombre, barra neutra y cifras. */
function Partes({ partes, total, etiqueta }) {
  return (
    <Barras etiqueta={etiqueta} total={total} items={partes.filter(p => p.monto > 0 || p.mostrarCero)} />
  );
}

/** Descarga el libro de Excel para Contabilidad con los filtros del reporte. */
function ExportarExcel({ params }) {
  const [bajando, setBajando] = useState(false);
  const exportar = async () => {
    setBajando(true);
    try {
      const blob = await comercialApi.reportesExcel(params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `comercial-${params.desde}-a-${params.hasta}${params.area ? `-${params.area.toLowerCase()}` : ''}.xlsx`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success('Excel listo: Resumen, Facturas, Líneas y Pagos.');
    } catch (error) {
      toast.error(error.message || 'No se pudo generar el Excel.');
    } finally {
      setBajando(false);
    }
  };
  return (
    <Button size="sm" variant="secondary" className="h-9" onClick={exportar} disabled={bajando}>
      {bajando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />}
      Exportar a Excel
    </Button>
  );
}

/**
 * Reportes de Comercial (fase 4): reemplazan las 51 tablas dinámicas del
 * Excel. Todos los cortes salen de las mismas facturas vigentes del período
 * y los filtros valen para todo lo de abajo; el Excel para Contabilidad sale
 * con los mismos filtros.
 */
export function ReportesPanel() {
  const baseId = useId();
  const [periodo, setPeriodo] = useState('gestion');
  const [rango, setRango] = useState(() => periodoDe('gestion'));
  const [area, setArea] = useState('');
  const [tipo, setTipo] = useState('');
  const [vista, setVista] = useState('grafico');
  const [todasCategorias, setTodasCategorias] = useState(false);

  const params = useMemo(() => paramsReporte({ ...rango, area, tipo }), [rango, area, tipo]);
  const load = useCallback(() => comercialApi.reportes(params), [params]);
  const { data: r, error, loading, reload } = useResource(load);

  const elegirPeriodo = (clave) => {
    setPeriodo(clave);
    if (clave !== 'personalizado') setRango(periodoDe(clave));
  };

  const areas = r?.areas || [];
  const total = r?.resumen.facturado || 0;
  const categorias = r ? (todasCategorias ? r.porCategoria : r.porCategoria.slice(0, 10)) : [];

  return (
    <div className="flex flex-col gap-4">
      <h2 className="sr-only">Reportes</h2>

      {/* Una fila de filtros arriba: valen para todo lo de abajo. */}
      <div className="flex flex-wrap items-end gap-3">
        <Segmented
          label="Período"
          value={periodo}
          onChange={elegirPeriodo}
          className="cal-tabs"
          options={[...Object.entries(PERIODOS).map(([value, label]) => ({ value, label })), { value: 'personalizado', label: 'Otro' }]}
        />
        {periodo === 'personalizado' && (
          <div className="flex items-end gap-2">
            <div>
              <FieldLabel htmlFor={`${baseId}-desde`}>Desde</FieldLabel>
              <input id={`${baseId}-desde`} type="date" value={rango.desde} max={rango.hasta}
                onChange={(e) => e.target.value && setRango(x => ({ ...x, desde: e.target.value }))} className="field h-9 font-medium tabular-nums" />
            </div>
            <div>
              <FieldLabel htmlFor={`${baseId}-hasta`}>Hasta</FieldLabel>
              <input id={`${baseId}-hasta`} type="date" value={rango.hasta} min={rango.desde} max={hoyLaPaz()}
                onChange={(e) => e.target.value && setRango(x => ({ ...x, hasta: e.target.value }))} className="field h-9 font-medium tabular-nums" />
            </div>
          </div>
        )}
        <Dropdown ariaLabel="Área" value={area} onChange={setArea} size="sm" className="w-[11.5rem]"
          options={[{ value: '', label: 'Todas las áreas' }, ...Object.entries(AREAS).map(([value, label]) => ({ value, label }))]} />
        <Dropdown ariaLabel="Tipo de factura" value={tipo} onChange={setTipo} size="sm" className="w-[10.5rem]"
          options={[{ value: '', label: 'Servicio y venta' }, ...Object.entries(TIPOS).map(([value, label]) => ({ value, label }))]} />
        <div className="ml-auto"><ExportarExcel params={params} /></div>
      </div>

      {error && <ErrorCarga titulo="No se pudo armar el reporte." error={error} onRetry={reload} />}
      {!r && !error && <Cargando label="Armando el reporte" filas={5} />}

      {r && (
        <div className={cn('flex flex-col gap-4 transition-opacity', loading && 'opacity-60')}>
          <p className="text-[12.5px] text-fg-muted">
            Del {fecha(r.periodo.desde)} al {fecha(r.periodo.hasta)} · facturas vigentes{area ? ` · solo ${AREAS[area]}` : ''}{tipo ? ` · ${TIPOS[tipo].toLowerCase()}` : ''}
            {r.resumen.anuladas ? ` · ${r.resumen.anuladas} anuladas no se cuentan` : ''}
          </p>

          <Cifras items={[
            { label: 'Facturado', value: bsCorto(r.resumen.facturado), hint: `${r.resumen.facturas} facturas · ticket ${bsCorto(r.resumen.ticketPromedio)}` },
            { label: 'Cobrado', value: bsCorto(r.resumen.cobrado), hint: `${porcentaje(r.resumen.cobrado, r.resumen.facturado)} de lo facturado` },
            { label: 'Por cobrar', value: bsCorto(r.resumen.saldo), tone: r.resumen.saldo > 0 ? 'warning' : undefined, hint: 'De estas facturas' },
            {
              label: 'Margen', value: r.resumen.margenPorcentaje === null ? '—' : `${r.resumen.margenPorcentaje.toLocaleString('es-BO')} %`,
              hint: r.resumen.porCostear ? `${bsCorto(r.resumen.porCostear)} por costear` : `${bsCorto(r.resumen.margen)} de margen`,
            },
          ]} />

          {!r.resumen.facturas ? (
            <EmptyState icon={BarChart3} title="No hay facturas en este período">Cambie el período o los filtros.</EmptyState>
          ) : (
            <>
              <Tarjeta
                titulo="Facturación por mes"
                descripcion="Por área, según la fecha de emisión."
                accion={(
                  <div className="flex items-center gap-3">
                    <LeyendaAreas areas={areas} />
                    <Button size="sm" variant="secondary" className="h-8" onClick={() => setVista(v => (v === 'grafico' ? 'tabla' : 'grafico'))}
                      aria-pressed={vista === 'tabla'}>
                      {vista === 'grafico' ? <Table2 className="h-4 w-4" aria-hidden="true" /> : <BarChart3 className="h-4 w-4" aria-hidden="true" />}
                      {vista === 'grafico' ? 'Ver tabla' : 'Ver gráfico'}
                    </Button>
                  </div>
                )}
              >
                {vista === 'grafico' ? <ColumnasPorMes meses={r.porMes} areas={areas} /> : <TablaPorMes meses={r.porMes} areas={areas} />}
              </Tarjeta>

              <div className="grid gap-4 lg:grid-cols-2">
                <Tarjeta titulo="Por área" descripcion="Monto, neto de impuestos y margen como en la ficha de cada factura.">
                  <ul className="flex flex-col gap-3">
                    {r.porArea.map(a => (
                      <li key={a.area}>
                        <Barras total={total} escala={Math.max(...r.porArea.map(x => x.monto))} items={[{ clave: a.area, nombre: AREAS[a.area] || a.area, detalle: `${a.facturas} facturas`, monto: a.monto, color: AREA_COLOR[a.area] }]} etiqueta={AREAS[a.area]} />
                        <p className="mt-1 text-[12px] text-fg-muted">
                          Neto {bs(a.neto)} · margen {a.margenPorcentaje === null ? '—' : `${a.margenPorcentaje.toLocaleString('es-BO')} %`}
                          {a.porCostear ? ` · ${bs(a.porCostear)} por costear` : ''}
                        </p>
                      </li>
                    ))}
                  </ul>
                </Tarjeta>
                <Tarjeta titulo="Por responsable comercial" descripcion="Con su porcentaje en cada factura (50 / 50 si son dos).">
                  <Barras etiqueta="Por responsable" total={total} items={r.porResponsable.map(p => ({
                    clave: p.usuarioId ?? p.nombre, nombre: p.nombre, detalle: `${p.facturas} facturas`, monto: p.monto,
                  }))} />
                </Tarjeta>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Tarjeta
                  titulo="Por categoría"
                  descripcion={`${r.porCategoria.length} categorías con ventas; el color es su área.`}
                  accion={r.porCategoria.length > 10 && (
                    <button type="button" onClick={() => setTodasCategorias(v => !v)}
                      className="text-[12.5px] font-medium text-fg-muted underline decoration-fg/30 underline-offset-4 hover:text-fg">
                      {todasCategorias ? 'Ver las 10 primeras' : `Ver las ${r.porCategoria.length}`}
                    </button>
                  )}
                >
                  <Barras etiqueta="Por categoría" total={total} items={categorias.map(c => ({
                    clave: c.categoriaId, nombre: c.nombre, detalle: c.cantidad ? `${c.cantidad} equipos` : null, monto: c.monto, color: AREA_COLOR[c.area],
                  }))} />
                </Tarjeta>
                <Tarjeta
                  titulo="Clientes"
                  descripcion={`${r.resumen.clientes} clientes. Nuevos: registrados en DataMET en la misma gestión de la factura y sin facturas anteriores.`}
                >
                  <Partes etiqueta="Clientes nuevos y regulares" total={total} partes={Object.entries(TIPOS_CLIENTE).map(([k, nombre]) => ({
                    clave: k, nombre, detalle: `${r.tiposCliente[k].clientes} ${r.tiposCliente[k].clientes === 1 ? 'cliente' : 'clientes'}`, monto: r.tiposCliente[k].monto,
                  }))} />
                  <div className="border-t border-line pt-4">
                    <p className="mb-2.5 text-[12.5px] font-medium text-fg-muted">Los que más facturaron</p>
                    <Barras etiqueta="Clientes con más facturación" total={total} items={r.porCliente.slice(0, 10).map(c => ({
                      clave: c.codigo || c.razonSocial, nombre: c.razonSocial, detalle: c.codigo || null, monto: c.monto,
                    }))} />
                    {r.otrosClientes.clientes > 0 && (
                      <p className="mt-2.5 text-[12px] text-fg-muted">
                        Y {r.otrosClientes.clientes + Math.max(0, r.porCliente.length - 10)} clientes más.
                      </p>
                    )}
                  </div>
                </Tarjeta>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <Tarjeta titulo="Regional" descripcion="Por la regional que atiende cada línea.">
                  <Partes etiqueta="Por regional" total={total} partes={r.porRegional.map(x => ({
                    clave: x.regional || 'sin', nombre: REGIONALES[x.regional] || 'Sin regional', monto: x.monto,
                  }))} />
                </Tarjeta>
                <Tarjeta titulo="Rubro" descripcion={`${r.rubroCobertura.conRubro} de ${r.rubroCobertura.facturas} facturas tienen el rubro del cliente en DataMET.`}>
                  <Barras etiqueta="Por rubro" total={total} items={r.porRubro.slice(0, 8).map(x => ({
                    clave: x.rubro || 'sin', nombre: x.rubro || 'Sin rubro', detalle: `${x.facturas} facturas`, monto: x.monto,
                  }))} />
                </Tarjeta>
                <Tarjeta titulo="Facturas con varias áreas" descripcion="Lo que un área aporta a otra en la misma factura.">
                  {r.variasAreas.length ? (
                    <Barras etiqueta="Facturas con varias áreas" total={total} items={r.variasAreas.map(x => ({
                      clave: x.areas, nombre: x.areas.split(' + ').map(a => AREAS[a] || a).join(' + '), detalle: `${x.facturas} facturas`, monto: x.monto,
                    }))} />
                  ) : <p className="text-[13px] text-fg-muted">Ninguna en el período.</p>}
                </Tarjeta>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
