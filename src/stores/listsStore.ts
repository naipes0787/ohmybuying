import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { List } from '@/types';

interface ListsState {
  lists: List[];
  loading: boolean;
  error: string | null;
  fetchLists: (userId: string) => Promise<void>;
  createList: (
    payload: Pick<List, 'name' | 'description'>,
    userId: string,
  ) => Promise<List>;
  updateList: (
    listId: string,
    payload: Partial<Pick<List, 'name' | 'description'>>,
  ) => Promise<void>;
  deleteList: (listId: string) => Promise<void>;
  leaveList: (listId: string, userId: string) => Promise<void>;
  getList: (listId: string) => List | undefined;
}

export const useListsStore = create<ListsState>((set, get) => ({
  lists: [],
  loading: false,
  error: null,

  fetchLists: async (_userId) => {
    // RLS scopes this to lists the user owns OR is a member of.
    set({ loading: true, error: null });
    const { data, error } = await supabase
      .from('lists')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      set({ error: error.message, loading: false });
      return;
    }
    set({ lists: (data ?? []) as List[], loading: false });
  },

  createList: async (payload, userId) => {
    const { data, error } = await supabase
      .from('lists')
      .insert({ ...payload, user_id: userId })
      .select()
      .single();
    if (error) throw error;
    const list = data as List;
    set((state) => ({ lists: [list, ...state.lists] }));
    return list;
  },

  updateList: async (listId, payload) => {
    const { data, error } = await supabase
      .from('lists')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', listId)
      .select()
      .single();
    if (error) throw error;
    const updated = data as List;
    set((state) => ({
      lists: state.lists.map((l) => (l.id === listId ? updated : l)),
    }));
  },

  deleteList: async (listId) => {
    const previous = get().lists;
    set((state) => ({ lists: state.lists.filter((l) => l.id !== listId) }));
    const { error } = await supabase.from('lists').delete().eq('id', listId);
    if (error) {
      set({ lists: previous });
      throw error;
    }
  },

  leaveList: async (listId, userId) => {
    const previous = get().lists;
    set((state) => ({ lists: state.lists.filter((l) => l.id !== listId) }));
    const { error } = await supabase
      .from('list_members')
      .delete()
      .eq('list_id', listId)
      .eq('user_id', userId);
    if (error) {
      set({ lists: previous });
      throw error;
    }
  },

  getList: (listId) => get().lists.find((l) => l.id === listId),
}));

export const useLists = () => useListsStore((s) => s.lists);
export const useListsLoading = () => useListsStore((s) => s.loading);
export const useListsError = () => useListsStore((s) => s.error);
