const fields = { ubicacion: 'Ubicación', cod_interno: 'Código interno', marca: 'Marca', modelo: 'Modelo', serie: 'Serie' };

// El cliente registró la balanza en IvMET: no existe en DataMET y no hay catálogo contra el que comparar.
export function RegisteredEquipment({ snapshot }) {
  const technical = snapshot.technical || {}, unit = technical.unit || '';
  return <>
    <p>Balanza registrada por el cliente en IvMET. No existe en DataMET; incorporarla al catálogo requiere revisión por Métrica.</p>
    <div className="iv-table-wrap"><table className="iv-table"><thead><tr><th>Dato</th><th>Informado por el cliente</th></tr></thead><tbody>
      {Object.entries(fields).map(([key, label]) => <tr key={key}><th scope="row">{label}</th><td>{snapshot.customer?.[key] || '—'}</td></tr>)}
      <tr><th scope="row">Área</th><td>{snapshot.area || 'Sin área'}</td></tr>
      <tr><th scope="row">Tipo</th><td>{technical.type || '—'}</td></tr>
      <tr><th scope="row">Clase</th><td>{technical.class || '—'}</td></tr>
      {(technical.ranges || []).map((range) => <tr key={range.number}><th scope="row">Rango {range.number}</th>
        <td>{`${range.capacity} ${unit} · d ${range.division} ${unit}${range.interval ? ` · e ${range.interval} ${unit}` : ''}`}</td></tr>)}
    </tbody></table></div>
  </>;
}
