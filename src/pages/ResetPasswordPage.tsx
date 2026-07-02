import { useCallback, useEffect, useState, useTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [validLink, setValidLink] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    document.title = 'ohMyBuying — Reset password';
  }, []);

  // Supabase (detectSessionInUrl) establishes a recovery session from the
  // link. Wait for it, and confirm the visitor actually arrived via a link.
  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) {
        setValidLink(true);
        setReady(true);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!active) return;
        if (event === 'PASSWORD_RECOVERY' || session) {
          setValidLink(true);
          setReady(true);
        }
      },
    );

    // If no session has appeared shortly after mount, the link is missing or
    // expired — stop showing the loading state.
    const timer = window.setTimeout(() => {
      if (active) setReady(true);
    }, 2500);

    return () => {
      active = false;
      window.clearTimeout(timer);
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError(null);

      if (password !== confirm) {
        setError('Passwords do not match.');
        return;
      }

      startTransition(() => {
        void (async () => {
          const { error } = await supabase.auth.updateUser({ password });
          if (error) {
            setError(error.message);
            return;
          }
          setDone(true);
          window.setTimeout(() => navigate('/', { replace: true }), 1500);
        })();
      });
    },
    [password, confirm, navigate],
  );

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
            // set a new access key
          </p>
        </div>

        <div className="panel border-glow-cyan p-6 sm:p-8 scanlines">
          <div className="mb-5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-retro-muted">
            <span className="inline-block w-2 h-2 rounded-full bg-retro-green animate-glow-pulse" />
            recovery channel
          </div>

          {!ready ? (
            <p className="font-mono text-xs text-retro-muted">
              Verifying recovery link…
            </p>
          ) : !validLink ? (
            <div className="flex flex-col gap-4">
              <p className="font-mono text-xs text-retro-magenta border-l-2 border-retro-magenta pl-3 py-1">
                ! This reset link is invalid or has expired.
              </p>
              <Button
                variant="outline"
                onClick={() => navigate('/login', { replace: true })}
                className="w-full"
              >
                Back to sign in
              </Button>
            </div>
          ) : done ? (
            <p className="font-mono text-xs text-retro-green border-l-2 border-retro-green pl-3 py-1">
              Password updated. Redirecting…
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-4">
                <div className="relative">
                  <Lock
                    size={14}
                    className="absolute left-0 top-[2.05rem] text-retro-muted pointer-events-none"
                  />
                  <Input
                    label="New password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-6"
                    placeholder="••••••••"
                    hint="Minimum 6 characters"
                  />
                </div>
                <div className="relative">
                  <Lock
                    size={14}
                    className="absolute left-0 top-[2.05rem] text-retro-muted pointer-events-none"
                  />
                  <Input
                    label="Confirm password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="pl-6"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <AnimatePresence>
                {error ? (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="font-mono text-xs text-retro-magenta border-l-2 border-retro-magenta pl-3 py-1"
                  >
                    ! {error}
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <Button
                type="submit"
                loading={isPending}
                iconRight={<ArrowRight size={14} />}
                className="w-full"
              >
                Update password
              </Button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-retro-muted">
          v0.1 · 2099-01-01 · transmission ok
        </p>
      </div>
    </main>
  );
}
