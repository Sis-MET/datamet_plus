import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RegisteredEquipment } from './RegisteredEquipment';
import { equipmentLabel } from '../format';

const registration = {
  kind: 'registration',
  code: 'BAL-NUEVA',
  area: 'Despacho',
  catalog: {},
  customer: { ubicacion: 'Patio de carga', cod_interno: 'BAL-NUEVA', marca: 'Toledo', modelo: 'IND570', serie: '' },
  technical: {
    type: 'Báscula camionera',
    class: 'III',
    unit: 'kg',
    ranges: [
      { number: 1, capacity: '30000', division: '10', interval: '10', decimals: 0 },
      { number: 2, capacity: '60000', division: '20', interval: '', decimals: 0 },
    ],
  },
};

describe('balanzas registradas por el cliente en IvMET', () => {
  it('muestra lo informado por el cliente, sin columna de catálogo', () => {
    const html = renderToStaticMarkup(<RegisteredEquipment snapshot={registration} />);
    expect(html).toContain('No existe en DataMET');
    expect(html).not.toContain('Catálogo consultado');
    expect(html).toContain('Báscula camionera');
    expect(html).toContain('Despacho');
    expect(html).toContain('30000 kg · d 10 kg · e 10 kg');
    expect(html).toContain('60000 kg · d 20 kg');
    expect(html).not.toContain('60000 kg · d 20 kg · e');
    // Un dato vacío se ve como ausente, no como una celda en blanco.
    expect(html).toMatch(/Serie<\/th><td>—<\/td>/);
  });

  it('rotula una balanza sin código de Métrica', () => {
    expect(equipmentLabel({ cod_metrica: '0001-01-001' })).toBe('0001-01-001');
    expect(equipmentLabel({ cod_metrica: null, origen: 'CLIENTE', cod_interno: 'BAL-NUEVA' }))
      .toBe('Registrada por el cliente · BAL-NUEVA');
    expect(equipmentLabel({ codigo: '0001-01-002' })).toBe('0001-01-002');
    expect(equipmentLabel()).toBeUndefined();
  });
});
