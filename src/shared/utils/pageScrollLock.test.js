import { describe, expect, it, vi } from 'vitest';
import { lockPageScroll } from './pageScrollLock';

function style() {
  const values = new Map();
  return {
    setProperty: (key, value, priority = '') =>
      values.set(key, { value, priority }),
    getPropertyValue: (key) => values.get(key)?.value || '',
    getPropertyPriority: (key) => values.get(key)?.priority || '',
    removeProperty: (key) => values.delete(key),
    snapshot: () => Object.fromEntries(values),
  };
}
function fixture({ scrollbar = 15, gutter = 'auto' } = {}) {
  const view = {
    innerWidth: 1280,
    scrollX: 0,
    scrollY: 350,
    getComputedStyle: () => ({ scrollbarGutter: gutter }),
  };
  view.scrollTo = vi.fn((x, y) => {
    view.scrollX = x;
    view.scrollY = y;
  });
  return {
    documentElement: { clientWidth: 1280 - scrollbar, style: style() },
    body: { style: style() },
    defaultView: view,
  };
}

describe('bloqueo compartido del scroll de fondo', () => {
  it('bloquea el desplazamiento de html, restaura sus estilos y no toca el contenido del modal', () => {
    const doc = fixture();
    const release = lockPageScroll(doc);
    expect(doc.documentElement.style.getPropertyValue('overflow-y')).toBe('hidden');
    expect(doc.documentElement.style.getPropertyValue('overflow-x')).toBe('hidden');
    for (const element of [doc.documentElement, doc.body]) {
      expect(element.style.getPropertyValue('overscroll-behavior-y')).toBe(
        'none'
      );
    }
    release();
    expect(doc.body.style.snapshot()).toEqual({});
    expect(doc.documentElement.style.snapshot()).toEqual({});
    expect(doc.defaultView.scrollTo).not.toHaveBeenCalled();
  });
  it('no convierte body en contenedor de scroll: los sticky siguen pegados a la ventana', () => {
    // Con html en overflow: hidden, un overflow en body ya no se propaga a la
    // ventana y body pasa a desplazarse solo: la barra lateral y la superior
    // (sticky) saltaban hacia arriba tanto como la página estuviera bajada.
    const doc = fixture();
    const release = lockPageScroll(doc);
    expect(doc.body.style.getPropertyValue('overflow-y')).toBe('');
    expect(doc.body.style.getPropertyValue('overflow-x')).toBe('');
    release();
  });
  it('reserva el ancho de la barra existente, pero no lo inventa en páginas cortas', () => {
    const long = fixture();
    const release = lockPageScroll(long);
    expect(
      long.documentElement.style.getPropertyValue('scrollbar-gutter')
    ).toBe('stable');
    release();
    const short = fixture({ scrollbar: 0 });
    const releaseShort = lockPageScroll(short);
    expect(
      short.documentElement.style.getPropertyValue('scrollbar-gutter')
    ).toBe('');
    releaseShort();
  });
  it('conserva un gutter definido previamente por CSS', () => {
    const doc = fixture({ gutter: 'stable both-edges' });
    const release = lockPageScroll(doc);
    expect(doc.documentElement.style.getPropertyValue('scrollbar-gutter')).toBe(
      ''
    );
    release();
  });
  it('no libera el fondo hasta cerrar el último modal; el cleanup es idempotente', () => {
    const doc = fixture();
    const first = lockPageScroll(doc);
    const second = lockPageScroll(doc);
    first();
    first();
    expect(doc.documentElement.style.getPropertyValue('overflow-y')).toBe('hidden');
    const third = lockPageScroll(doc);
    second();
    expect(doc.documentElement.style.getPropertyValue('overflow-y')).toBe('hidden');
    third();
    expect(doc.documentElement.style.snapshot()).toEqual({});
    expect(doc.body.style.snapshot()).toEqual({});
  });
  it('recupera valores y prioridades originales sin borrar cambios de otros estilos', () => {
    const doc = fixture();
    doc.body.style.setProperty('overflow-y', 'scroll', 'important');
    doc.documentElement.style.setProperty('overflow-x', 'clip');
    doc.documentElement.style.setProperty('overscroll-behavior-y', 'contain');
    const bodyBefore = doc.body.style.snapshot();
    const rootBefore = doc.documentElement.style.snapshot();
    const release = lockPageScroll(doc);
    doc.body.style.setProperty('color', 'white');
    release();
    expect(doc.documentElement.style.snapshot()).toEqual(rootBefore);
    expect(doc.body.style.snapshot()).toEqual({
      ...bodyBefore,
      color: { value: 'white', priority: '' },
    });
  });
  it('restaura la posición sin desplazamiento suave después del último cierre', () => {
    const doc = fixture();
    doc.documentElement.style.setProperty(
      'scroll-behavior',
      'smooth',
      'important'
    );
    const first = lockPageScroll(doc);
    const second = lockPageScroll(doc);
    doc.defaultView.scrollY = 0;
    first();
    expect(doc.defaultView.scrollTo).not.toHaveBeenCalled();
    second();
    expect(doc.defaultView.scrollTo).toHaveBeenCalledWith(0, 350);
    expect(doc.documentElement.style.getPropertyValue('scroll-behavior')).toBe(
      'smooth'
    );
    expect(
      doc.documentElement.style.getPropertyPriority('scroll-behavior')
    ).toBe('important');
  });
  it('tolera montaje y desmontaje repetido como en StrictMode', () => {
    const doc = fixture();
    for (let i = 0; i < 3; i++) {
      const release = lockPageScroll(doc);
      expect(doc.documentElement.style.getPropertyValue('overflow-y')).toBe('hidden');
      release();
      expect(doc.documentElement.style.snapshot()).toEqual({});
      expect(doc.body.style.snapshot()).toEqual({});
    }
  });
});
