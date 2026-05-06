import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { DueReminder } from '@/types';

interface RemindersState {
  due: DueReminder[];
  loading: boolean;
  error: string | null;
  fetchDue: () => Promise<void>;
  dismiss: (itemId: string) => void;
}

export const useRemindersStore = create<RemindersState>((set) => ({
  due: [],
  loading: false,
  error: null,

  fetchDue: async () => {
    set({ loading: true, error: null });
    const { data, error } = await supabase.rpc('due_reminders');
    if (error) {
      set({ error: error.message, loading: false });
      return;
    }
    set({ due: (data ?? []) as DueReminder[], loading: false });
  },

  // Local-only dismissal: removes from the banner for this session. Real
  // "snooze" behaviour would need a server-side dismissed_at column.
  dismiss: (itemId) =>
    set((state) => ({ due: state.due.filter((r) => r.id !== itemId) })),
}));

export const useDueReminders = () => useRemindersStore((s) => s.due);
