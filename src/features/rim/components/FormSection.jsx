import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../../shared/utils/cn';

export function FormSection({ title, children, defaultOpen = true, className }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [height, setHeight] = useState(defaultOpen ? 'auto' : '0px');
  const contentRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !contentRef.current) return;
    const updateHeight = () => {
      if (height === 'auto') {
        setHeight(`${contentRef.current.scrollHeight}px`);
        requestAnimationFrame(() => setHeight('auto'));
      }
    };
    const observer = new MutationObserver(updateHeight);
    observer.observe(contentRef.current, { childList: true, subtree: true, attributes: true, characterData: true });
    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(contentRef.current);
    return () => { observer.disconnect(); resizeObserver.disconnect(); };
  }, [isOpen, height]);

  useEffect(() => {
    if (isOpen) {
      setHeight(`${contentRef.current.scrollHeight}px`);
      const timer = setTimeout(() => setHeight('auto'), 300);
      return () => clearTimeout(timer);
    } else {
      setHeight(`${contentRef.current.scrollHeight}px`);
      setTimeout(() => setHeight('0px'), 10);
    }
  }, [isOpen]);

  return (
    <div className={cn("border border-gray-700 rounded-lg bg-[#1e1e1e] shadow-sm overflow-hidden mb-4", className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex justify-between items-center bg-[#252525] hover:bg-[#2a2a2a] transition-all duration-200"
      >
        <h3 className="text-lg font-semibold text-gray-100">{title}</h3>
        <ChevronDown className={cn("h-5 w-5 text-gray-400 transition-transform duration-300", isOpen && "rotate-180")} />
      </button>
      <div ref={contentRef} style={{ maxHeight: height }} className="transition-all duration-300 ease-in-out overflow-hidden">
        <div className={cn("p-6 border-t border-gray-700 transition-opacity duration-200", isOpen ? "opacity-100" : "opacity-0")}>
          {children}
        </div>
      </div>
    </div>
  );
}
