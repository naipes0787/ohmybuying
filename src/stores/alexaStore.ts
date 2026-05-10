import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

interface AlexaLinkRow {
  alexa_user_id: string;
  created_at: string;
}

interface AlexaState {
  link: AlexaLinkRow | null;
  pendingCode: string | null;
  pendingExpiresAt: string | null;
  loading: boolean;
  error: string | null;

  fetchLink: () => Promise<void>;
  issueCode: () => Promise<void>;
  unlink: () => Promise<void>;
}

export const useAlexaStore = create<AlexaState>((set) => ({
  link: null,
  pendingCode: null,
  pendingExpiresAt: null,
  loading: false,
  error: null,

  fetchLink: async () => {
    set({ loading: true, error: null });
    const { data, error } = await supabase
      .from('alexa_links')
      .select('alexa_user_id, created_at')
      .maybeSingle();
    if (error) {
      set({ error: error.message, loading: false });
      return;
    }
    set({ link: (data as AlexaLinkRow | null) ?? null, loading: false });
  },

  issueCode: async () => {
    set({ loading: true, error: null, pendingCode: null });
    const { data, error } = await supabase.rpc('issue_alexa_link_code');
    if (error) {
      set({ error: error.message, loading: false });
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    set({
      pendingCode: row?.code ?? null,
      pendingExpiresAt: row?.expires_at ?? null,
      loading: false,
    });
  },

  unlink: async () => {
    const { error } = await supabase.from('alexa_links').delete().neq('alexa_user_id', '');
    if (error) {
      set({ error: error.message });
      return;
    }
    set({ link: null, pendingCode: null, pendingExpiresAt: null });
  },
}));
