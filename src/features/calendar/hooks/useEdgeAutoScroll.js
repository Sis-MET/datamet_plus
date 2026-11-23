import { useEffect } from 'react';
import { EDGE_SCROLL, getEdgeIntent, getEdgeSpeed } from '../utils/edgeScroll';

const RUNNING_CLASS = 'is-edge-scrolling';
const NO_INTENT = { direction: 0, strength: 0 };
const HANDLE_MARGIN = 36;
const MAX_FRAME_MS = 50;

/**
 * Recorre el cronograma cuando el cursor se acerca a un borde, también al
 * arrastrar una ficha. Escucha al contenedor en vez de poner zonas encima, para
 * que las celdas del borde sigan recibiendo clics. Todo se aplica directo al
 * DOM: repintar la grilla en cada movimiento del cursor sería costoso.
 */
export function useEdgeAutoScroll({ viewportRef, scrollRef, leftCueRef, rightCueRef }) {
  useEffect(() => {
    const viewport = viewportRef.current;
    const scroller = scrollRef.current;
    if (!viewport || !scroller) return undefined;

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const maxSpeed = reducedMotion ? EDGE_SCROLL.reducedMaxSpeed : EDGE_SCROLL.maxSpeed;
    const state = {
      inside: false,
      dragging: false,
      // Tras un clic no se mueve hasta que el cursor salga de la zona del borde.
      paused: false,
      x: 0,
      y: 0,
      direction: 0,
      since: 0,
      last: 0,
      position: 0,
      frame: null,
    };

    const edgeIntent = () => {
      const rect = viewport.getBoundingClientRect();
      const nameColumn = viewport.querySelector('.gantt-name-col');
      return getEdgeIntent({
        x: state.x,
        left: rect.left + (nameColumn?.offsetWidth || 0),
        right: rect.right,
        zone: state.dragging ? EDGE_SCROLL.dragZone : EDGE_SCROLL.zone,
      });
    };

    const readIntent = () => (state.inside && !state.paused ? edgeIntent() : NO_INTENT);

    const paintCue = (cue, available, active, y) => {
      if (!cue) return;
      cue.classList.toggle('is-available', available);
      cue.classList.toggle('is-active', active);
      if (state.inside) cue.style.setProperty('--edge-y', `${y}px`);
    };

    const paint = () => {
      const rect = viewport.getBoundingClientRect();
      const maxScroll = scroller.scrollWidth - scroller.clientWidth;
      const y = Math.max(HANDLE_MARGIN, Math.min(state.y - rect.top, rect.height - HANDLE_MARGIN));
      paintCue(leftCueRef.current, state.inside && scroller.scrollLeft > 1, state.direction === -1, y);
      paintCue(rightCueRef.current, state.inside && scroller.scrollLeft < maxScroll - 1, state.direction === 1, y);
    };

    const stop = () => {
      if (state.frame !== null) cancelAnimationFrame(state.frame);
      state.frame = null;
      state.direction = 0;
      viewport.classList.remove(RUNNING_CLASS);
      paint();
    };

    const step = (now) => {
      state.frame = null;
      const { direction, strength } = readIntent();
      const maxScroll = scroller.scrollWidth - scroller.clientWidth;
      const canMove = direction < 0 ? scroller.scrollLeft > 0 : direction > 0 && scroller.scrollLeft < maxScroll;
      // Con un diálogo o menú sobre la grilla, no se mueve por detrás.
      const topElement = document.elementFromPoint(state.x, state.y);
      if (!canMove || !topElement || !viewport.contains(topElement)) {
        stop();
        return;
      }

      if (direction !== state.direction) {
        state.direction = direction;
        state.since = now;
        state.last = now;
        paint();
      }

      const speed = getEdgeSpeed({
        strength,
        elapsed: now - state.since,
        dwell: state.dragging ? EDGE_SCROLL.dragDwell : EDGE_SCROLL.dwell,
        ramp: EDGE_SCROLL.ramp,
        minSpeed: EDGE_SCROLL.minSpeed,
        maxSpeed,
      });

      if (speed === 0) {
        state.position = scroller.scrollLeft;
      } else {
        const elapsedFrame = Math.min(now - state.last, MAX_FRAME_MS);
        state.position = Math.max(0, Math.min(maxScroll, state.position + direction * speed * elapsedFrame / 1000));
        scroller.scrollLeft = state.position;
        // Las fichas no reaccionan al pasar bajo el cursor; soltar una sí debe funcionar.
        if (!state.dragging) viewport.classList.add(RUNNING_CLASS);
      }

      state.last = now;
      state.frame = requestAnimationFrame(step);
    };

    const track = (event) => {
      state.x = event.clientX;
      state.y = event.clientY;
      state.inside = true;
      const { direction } = edgeIntent();
      if (state.paused && direction === 0) state.paused = false;
      if (!state.paused && direction !== 0 && state.frame === null) {
        state.frame = requestAnimationFrame(step);
      }
      paint();
    };

    const leave = () => {
      state.inside = false;
      state.dragging = false;
      stop();
    };

    const onPointerMove = (event) => {
      if (event.pointerType !== 'mouse') return;
      state.dragging = false;
      if (event.buttons) {
        state.paused = true;
        stop();
        return;
      }
      track(event);
    };

    const onPointerDown = () => {
      state.paused = true;
      stop();
    };

    const onDragOver = (event) => {
      state.dragging = true;
      state.paused = false;
      track(event);
    };

    const onDragLeave = (event) => {
      if (!viewport.contains(event.relatedTarget)) leave();
    };

    const onScroll = () => {
      if (state.inside) paint();
    };

    viewport.addEventListener('pointermove', onPointerMove, { passive: true });
    viewport.addEventListener('pointerdown', onPointerDown, { passive: true });
    viewport.addEventListener('pointerleave', leave);
    viewport.addEventListener('dragover', onDragOver);
    viewport.addEventListener('dragleave', onDragLeave);
    scroller.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('drop', leave, true);
    window.addEventListener('dragend', leave, true);
    window.addEventListener('blur', leave);

    return () => {
      if (state.frame !== null) cancelAnimationFrame(state.frame);
      viewport.classList.remove(RUNNING_CLASS);
      viewport.removeEventListener('pointermove', onPointerMove);
      viewport.removeEventListener('pointerdown', onPointerDown);
      viewport.removeEventListener('pointerleave', leave);
      viewport.removeEventListener('dragover', onDragOver);
      viewport.removeEventListener('dragleave', onDragLeave);
      scroller.removeEventListener('scroll', onScroll);
      window.removeEventListener('drop', leave, true);
      window.removeEventListener('dragend', leave, true);
      window.removeEventListener('blur', leave);
    };
  }, [leftCueRef, rightCueRef, scrollRef, viewportRef]);
}
