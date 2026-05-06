interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({
  message = 'INITIALIZING OHMYBUYING',
}: LoadingScreenProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="font-mono text-retro-cyan text-sm uppercase tracking-[0.3em] animate-flicker">
        <span className="text-glow-cyan">{'>'}</span> {message}
        <span className="ml-1 animate-glow-pulse">▮</span>
      </div>
    </div>
  );
}
