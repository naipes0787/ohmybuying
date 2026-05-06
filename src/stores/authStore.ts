import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  initialize: () => Promise<() => void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  loading: true,

  initialize: async () => {
    const { data } = await supabase.auth.getSession();
    set({
      session: data.session,
      user: data.session?.user ?? null,
      loading: false,
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        set({ session, user: session?.user ?? null });
      },
    );

    return () => listener.subscription.unsubscribe();
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null });
  },
}));

export const useSession = () => useAuthStore((s) => s.session);
export const useUser = () => useAuthStore((s) => s.user);
export const useUserId = () => useAuthStore((s) => s.user?.id ?? null);
export const useAuthLoading = () => useAuthStore((s) => s.loading);
export const useSignOut = () => useAuthStore((s) => s.signOut);
