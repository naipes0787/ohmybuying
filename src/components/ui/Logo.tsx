interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
}

const SIZE: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'text-base',
  md: 'text-xl',
  lg: 'text-3xl',
};

export function Logo({ size = 'md' }: LogoProps) {
  return (
    <div className={`font-display font-bold tracking-tight ${SIZE[size]}`}>
      <span className="text-retro-cyan text-glow-cyan">oh</span>
      <span className="text-retro-text">My</span>
      <span className="text-retro-magenta text-glow-magenta">Buying</span>
    </div>
  );
}
