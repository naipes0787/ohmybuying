import { useCallback, useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

type Mode = 'signin' | 'signup' | 'forgot';

export function AuthForm() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const clearMessages = useCallback(() => {
    setError(null);
    setInfo(null);
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError(null);
      setInfo(null);
      startTransition(() => {
        void (async () => {
          if (mode === 'signin') {
            const { error } = await supabase.auth.signInWithPassword({
              email,
              password,
            });
            if (error) setError(error.message);
          } else if (mode === 'forgot') {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
              redirectTo: `${window.location.origin}/reset-password`,
            });
            if (error) {
              setError(error.message);
            } else {
              setInfo(
                'If an account exists for that email, a reset link is on its way.',
              );
            }
          } else {
            const { data, error } = await supabase.auth.signUp({
              email,
              password,
            });
            if (error) {
              setError(error.message);
            } else if (data.session === null) {
              setInfo(
                'Check your email to confirm your account before signing in.',
              );
            }
          }
        })();
      });
    },
    [mode, email, password],
  );

  const selectMode = useCallback(
    (next: Mode) => {
      setMode(next);
      clearMessages();
    },
    [clearMessages],
  );

  const toggle = useCallback(() => {
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
    clearMessages();
  }, [clearMessages]);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex border-b border-retro-border">
        <ModeTab
          active={mode === 'signin' || mode === 'forgot'}
          onClick={() => selectMode('signin')}
        >
          Sign in
        </ModeTab>
        <ModeTab active={mode === 'signup'} onClick={() => selectMode('signup')}>
          Create account
        </ModeTab>
      </div>

      <div className="flex flex-col gap-4">
        <div className="relative">
          <Mail
            size={14}
            className="absolute left-0 top-[2.05rem] text-retro-muted pointer-events-none"
          />
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="pl-6"
            placeholder="user@domain.io"
          />
        </div>
        {mode === 'forgot' ? null : (
          <div className="relative">
            <Lock
              size={14}
              className="absolute left-0 top-[2.05rem] text-retro-muted pointer-events-none"
            />
            <Input
              label="Password"
              type="password"
              autoComplete={
                mode === 'signin' ? 'current-password' : 'new-password'
              }
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-6"
              placeholder="••••••••"
              hint={mode === 'signup' ? 'Minimum 6 characters' : undefined}
            />
          </div>
        )}

        {mode === 'signin' ? (
          <button
            type="button"
            onClick={() => selectMode('forgot')}
            className="self-end font-mono text-xs text-retro-muted hover:text-retro-cyan transition-colors"
          >
            Forgot password?
          </button>
        ) : null}
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
        {info ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="font-mono text-xs text-retro-green border-l-2 border-retro-green pl-3 py-1"
          >
            {info}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <Button
        type="submit"
        loading={isPending}
        iconRight={<ArrowRight size={14} />}
        className="w-full"
      >
        {mode === 'signin'
          ? 'Enter'
          : mode === 'forgot'
            ? 'Send reset link'
            : 'Initialize account'}
      </Button>

      {mode === 'forgot' ? (
        <button
          type="button"
          onClick={() => selectMode('signin')}
          className="font-mono text-xs text-retro-muted hover:text-retro-cyan transition-colors text-center"
        >
          ← Back to sign in
        </button>
      ) : (
        <button
          type="button"
          onClick={toggle}
          className="font-mono text-xs text-retro-muted hover:text-retro-cyan transition-colors text-center"
        >
          {mode === 'signin'
            ? 'No account yet? Create one →'
            : 'Already have an account? Sign in →'}
        </button>
      )}
    </form>
  );
}

interface ModeTabProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function ModeTab({ active, onClick, children }: ModeTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 font-display uppercase tracking-[0.2em] text-xs py-2 transition-all border-b-2 -mb-px ${
        active
          ? 'border-retro-cyan text-retro-cyan text-glow-cyan'
          : 'border-transparent text-retro-muted hover:text-retro-text'
      }`}
    >
      {children}
    </button>
  );
}
