import { describe, expect, it } from 'vitest';
import { cssDeLaPagina } from './rasterizar';

describe('estilos para pasar las hojas a imagen', () => {
  it('junta las reglas de la página y salta las hojas que no se pueden leer', () => {
    const propia = { cssRules: [{ cssText: '.st-doc { color: rgb(0, 0, 0); }' }, { cssText: '@media print { .x { display: none; } }' }] };
    const deOtroOrigen = { get cssRules() { throw new DOMException('No se puede leer', 'SecurityError'); } };
    const css = cssDeLaPagina([propia, deOtroOrigen, { cssRules: [{ cssText: '.st-pagina { width: 210mm; }' }] }]);
    expect(css).toBe('.st-doc { color: rgb(0, 0, 0); }\n@media print { .x { display: none; } }\n.st-pagina { width: 210mm; }');
  });
});
