import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useIvmetQuery } from '../useIvmetQuery';
import { Empty, Pagination, QueryState, SearchInput, SectionTitle } from './Ui';
import { ActionDialog } from './ActionDialog';

const fields = { ubicacion: 'Ubicación', cod_interno: 'Código interno', marca: 'Marca', modelo: 'Modelo', serie: 'Serie' };
export function EquipmentUpdates({ revision, onSaved }) {
  const [page, setPage] = useState(1), [search, setSearch] = useState(''), [dialog, setDialog] = useState(null);
  const query = useIvmetQuery('ops/equipment-updates', { page, search }, revision, 15000);
  return <>
    <SectionTitle eyebrow="AUTORIZADO POR EL CLIENTE" title="Actualizaciones de balanzas"
      description="Información compartida para preparar próximas calibraciones. No incluye pruebas, planes ni patrones privados." />
    <div className="iv-privacy-note"><ShieldCheck size={20}/><p>Recibir o marcar una actualización como revisada no modifica DataMET. La aplicación al catálogo maestro requiere revisión por Métrica.</p></div>
    <div className="iv-toolbar"><SearchInput value={search} placeholder="Buscar código de balanza" onChange={(v) => { setSearch(v); setPage(1); }}/></div>
    <QueryState query={query}>
      {!query.data?.items.length && <Empty title="Sin actualizaciones autorizadas" text="El cliente decide desde su app qué cambios desea compartir con Métrica." />}
      {query.data?.items.map((item) => <article className="iv-plan-card" key={item.id}>
        <SectionTitle title={item.snapshot.code} description={`Cliente ${item.snapshot.clientCode} · planta ${item.snapshot.plantCode} · ${new Date(item.autorizado_at).toLocaleString('es-BO')}`}/>
        <p>{item.mensaje}</p>
        <div className="iv-table-wrap"><table className="iv-table"><thead><tr><th>Dato</th><th>Catálogo consultado</th><th>Confirmado por el cliente</th></tr></thead><tbody>
          {Object.entries(fields).map(([key, label]) => <tr key={key}><th scope="row">{label}</th><td>{item.snapshot.catalog?.[key] || '—'}</td><td>{item.snapshot.customer?.[key] || '—'}</td></tr>)}
          <tr><th scope="row">Área</th><td>—</td><td>{item.snapshot.area || 'Sin área'}</td></tr>
        </tbody></table></div>
        <p>{item.estado === 'REVIEWED' ? 'Revisado por Métrica' : 'Pendiente de revisión'}{item.comentario ? ` · ${item.comentario}` : ''}</p>
        <button className="iv-button secondary" onClick={() => setDialog({ops: true, action: 'equipment-update.review', title: 'Registrar revisión',
          description: 'El comentario será visible para el cliente. No actualiza automáticamente DataMET.',
          values: {id:item.id,version:String(item.row_version),comment:''}, fields:[{name:'comment',label:'Comentario para el cliente',type:'textarea',required:true,maxLength:2000}]})}>Registrar revisión</button>
      </article>)}
      <Pagination page={page} total={query.data?.total || 0} onChange={setPage}/>
    </QueryState>
    {dialog && <ActionDialog config={dialog} onClose={() => setDialog(null)} onSaved={onSaved}/>}
  </>;
}
