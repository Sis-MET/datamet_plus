import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const VIEWPORT_PADDING = 8;
const DROPDOWN_GAP = 6;

export function FloatingDropdown({
  open,
  anchorRef,
  onClose,
  children,
  className = '',
  width = 'anchor',
  maxHeight = 224,
  align = 'start',
  preferredPlacement = 'auto',
  ariaLabel,
}) {
  const layerRef = useRef(null);
  const [position, setPosition] = useState(null);

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    const layer = layerRef.current;
    if (!anchor || !layer) return;

    const anchorRect = anchor.getBoundingClientRect();
    const resolvedWidth = width === 'anchor' ? anchorRect.width : width;
    const measuredHeight = Math.min(layer.scrollHeight || maxHeight, maxHeight);
    const availableAbove = anchorRect.top - VIEWPORT_PADDING - DROPDOWN_GAP;
    const availableBelow = window.innerHeight - anchorRect.bottom - VIEWPORT_PADDING - DROPDOWN_GAP;
    const usefulHeight = Math.min(measuredHeight, 160);

    let placement = preferredPlacement;
    if (placement === 'auto') {
      placement = availableBelow >= usefulHeight || availableBelow >= availableAbove ? 'bottom' : 'top';
    } else if (placement === 'top' && availableAbove < usefulHeight && availableBelow > availableAbove) {
      placement = 'bottom';
    } else if (placement === 'bottom' && availableBelow < usefulHeight && availableAbove > availableBelow) {
      placement = 'top';
    }

    let left = anchorRect.left;
    if (align === 'end') left = anchorRect.right - resolvedWidth;
    if (align === 'center') left = anchorRect.left + (anchorRect.width - resolvedWidth) / 2;
    left = Math.max(VIEWPORT_PADDING, Math.min(left, window.innerWidth - resolvedWidth - VIEWPORT_PADDING));

    let top = placement === 'top'
      ? anchorRect.top - measuredHeight - DROPDOWN_GAP
      : anchorRect.bottom + DROPDOWN_GAP;
    top = Math.max(VIEWPORT_PADDING, Math.min(top, window.innerHeight - measuredHeight - VIEWPORT_PADDING));

    setPosition({ left, top, width: resolvedWidth, placement });
  }, [align, anchorRef, maxHeight, preferredPlacement, width]);

  useLayoutEffect(() => {
    if (!open) {
      const resetFrameId = requestAnimationFrame(() => setPosition(null));
      return () => cancelAnimationFrame(resetFrameId);
    }

    const frameId = requestAnimationFrame(updatePosition);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return undefined;

    const handleMouseDown = (event) => {
      if (anchorRef.current?.contains(event.target) || layerRef.current?.contains(event.target)) return;
      onClose();
    };

    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.stopImmediatePropagation();
      onClose();
      anchorRef.current?.focus();
    };

    document.addEventListener('mousedown', handleMouseDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [anchorRef, onClose, open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={layerRef}
      aria-label={ariaLabel}
      data-placement={position?.placement}
      className={`task-floating-menu fixed z-[9999] overflow-hidden ${className}`}
      style={{
        left: position?.left ?? -9999,
        top: position?.top ?? -9999,
        width: position?.width ?? (typeof width === 'number' ? width : undefined),
        maxHeight,
        visibility: position ? 'visible' : 'hidden',
      }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  );
}
