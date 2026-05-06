import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'danger' | 'ghost' | 'outline';
type Size = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-retro-cyan text-retro-bg hover:shadow-glow-cyan border border-retro-cyan',
  danger:
    'bg-retro-magenta text-retro-bg hover:shadow-glow-magenta border border-retro-magenta',
  ghost:
    'bg-transparent text-retro-text border border-transparent hover:border-retro-border hover:bg-retro-surface',
  outline:
    'bg-transparent text-retro-cyan border border-retro-cyan hover:bg-retro-cyan/10 hover:shadow-glow-cyan',
};

const SIZES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    iconLeft,
    iconRight,
    className = '',
    disabled,
    children,
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading;
  return (
    <button
      ref={ref}
      disabled={isDisabled}
      className={`inline-flex items-center justify-center gap-2 font-display font-medium uppercase tracking-[0.18em] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed select-none ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {loading ? <span className="animate-flicker">▮</span> : iconLeft}
      <span>{children}</span>
      {iconRight}
    </button>
  );
});
