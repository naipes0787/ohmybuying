import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthForm } from '@/components/auth/AuthForm';
import { Logo } from '@/components/ui/Logo';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useAuthLoading, useSession } from '@/stores/authStore';

export default function AuthPage() {
  const session = useSession();
  const loading = useAuthLoading();

  useEffect(() => {
    document.title = 'ohMyBuying — Sign in';
  }, []);

  if (loading) return <LoadingScreen message="AUTHENTICATING" />;
  if (session) return <Navigate to="/" replace />;

  return (
    <main className="relative min-h-dvh flex items-center justify-center px-4 py-10">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-24 w-96 h-96 rounded-full bg-retro-cyan/10 blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[28rem] h-[28rem] rounded-full bg-retro-magenta/10 blur-[140px]" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <Logo size="lg" />
          <p className="mt-3 font-mono text-xs uppercase tracking-[0.4em] text-retro-muted">
            // shopping lists from the future
          </p>
        </div>

        <div className="panel border-glow-cyan p-6 sm:p-8 scanlines">
          <div className="mb-5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-retro-muted">
            <span className="inline-block w-2 h-2 rounded-full bg-retro-green animate-glow-pulse" />
            secure channel established
          </div>
          <AuthForm />
        </div>

        <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-retro-muted">
          v0.1 · 2099-01-01 · transmission ok
        </p>
      </div>
    </main>
  );
}
