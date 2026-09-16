import React from 'react';
import { cn } from '../../utils/cn';
import { Loader2 } from 'lucide-react';

const variants = {
  // Acción principal: amarillo Métrica con texto oscuro en ambos temas.
  primary: 'bg-brand text-brand-fg shadow-xs ring-1 ring-inset ring-black/5 hover:bg-brand-hover',
  secondary: 'border border-line-strong bg-surface text-fg shadow-xs hover:border-fg/25 hover:bg-surface-2',
  outline: 'border border-line-strong bg-surface text-fg shadow-xs hover:border-fg/25 hover:bg-surface-2',
  ghost: 'text-fg-muted hover:bg-fg/[0.06] hover:text-fg',
  danger: 'bg-red-600 text-white shadow-xs hover:bg-red-700',
};

const sizes = {
  sm: 'h-8 gap-1.5 px-3 text-[13px]',
  md: 'h-10 gap-2 px-4 text-sm',
  lg: 'h-11 gap-2 px-5 text-[15px]',
};

export const Button = React.forwardRef(({ className, variant = 'primary', size = 'md', isLoading, children, ...props }, ref) => {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex select-none items-center justify-center whitespace-nowrap rounded-xl font-semibold transition-[background-color,border-color,color,transform] duration-150 ease-out active:translate-y-px disabled:pointer-events-none disabled:opacity-50',
        variants[variant] || variants.primary,
        sizes[size] || sizes.md,
        className
      )}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
});

Button.displayName = 'Button';
