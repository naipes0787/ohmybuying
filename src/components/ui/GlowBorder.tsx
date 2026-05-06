import type { HTMLAttributes, ReactNode } from 'react';

type GlowColor = 'cyan' | 'green' | 'magenta';

interface GlowBorderProps extends HTMLAttributes<HTMLDivElement> {
  color?: GlowColor;
  children: ReactNode;
}

const COLOR_CLASS: Record<GlowColor, string> = {
  cyan: 'border-glow-cyan',
  green: 'border-glow-green',
  magenta: 'border-glow-magenta',
};

export function GlowBorder({
  color = 'cyan',
  className = '',
  children,
  ...rest
}: GlowBorderProps) {
  return (
    <div className={`${COLOR_CLASS[color]} ${className}`} {...rest}>
      {children}
    </div>
  );
}
