// Todos los modales comparten el mismo bloqueo. Cerrar uno de ellos no libera
// la página si todavía hay otro abierto (por ejemplo, agenda + formulario).
const locks = new WeakMap();

function overrideStyle(element, property, value) {
  const previous = element.style.getPropertyValue(property);
  const priority = element.style.getPropertyPriority(property);
  element.style.setProperty(property, value, 'important');
  return () => {
    if (previous) element.style.setProperty(property, previous, priority);
    else element.style.removeProperty(property);
  };
}

export function lockPageScroll(doc = document) {
  const root = doc.documentElement;
  const body = doc.body;
  const view = doc.defaultView;
  if (!root || !body || !view) return () => {};
  let lock = locks.get(doc);
  if (!lock) {
    const restore = [];
    lock = { count: 0, restore, x: view.scrollX, y: view.scrollY };
    // Reservar el espacio de la barra SOLO si existía: evita desplazar toda
    // la interfaz al ocultarla, incluso cuando la página no llenaba la ventana.
    if (
      view.innerWidth > root.clientWidth &&
      !(view.getComputedStyle(root).scrollbarGutter || '').includes('stable')
    ) {
      restore.push(overrideStyle(root, 'scrollbar-gutter', 'stable'));
    }
    for (const element of [root, body]) {
      for (const axis of ['x', 'y']) {
        restore.push(overrideStyle(element, `overflow-${axis}`, 'hidden'));
        restore.push(
          overrideStyle(element, `overscroll-behavior-${axis}`, 'none')
        );
      }
    }
    locks.set(doc, lock);
  }
  lock.count += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    lock.count -= 1;
    if (lock.count) return;
    for (const restore of lock.restore.reverse()) restore();
    locks.delete(doc);
    if (view.scrollX !== lock.x || view.scrollY !== lock.y) {
      const restoreBehavior = overrideStyle(root, 'scroll-behavior', 'auto');
      view.scrollTo(lock.x, lock.y);
      restoreBehavior();
    }
  };
}
