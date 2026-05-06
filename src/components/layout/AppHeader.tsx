import { Link } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { useSignOut, useUser } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';

export function AppHeader() {
  const user = useUser();
  const signOut = useSignOut();

  return (
    <header className="sticky top-0 z-40 border-b border-retro-border bg-retro-bg/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-3">
          <Logo size="md" />
        </Link>
        {user ? (
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline font-mono text-xs text-retro-muted truncate max-w-[14rem]">
              {user.email}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              iconLeft={<LogOut size={14} />}
            >
              Sign out
            </Button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
