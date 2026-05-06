import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { ListMemberWithProfile } from '@/types';

interface MembersState {
  byListId: Record<string, ListMemberWithProfile[]>;
  loading: boolean;
  error: string | null;

  fetchMembers: (listId: string) => Promise<void>;
  addMemberByEmail: (
    listId: string,
    email: string,
    addedBy: string,
  ) => Promise<ListMemberWithProfile>;
  removeMember: (listId: string, userId: string) => Promise<void>;
}

export const useMembersStore = create<MembersState>((set, get) => ({
  byListId: {},
  loading: false,
  error: null,

  fetchMembers: async (listId) => {
    set({ loading: true, error: null });
    const { data, error } = await supabase
      .from('list_members')
      .select('*, profile:profiles!list_members_user_id_fkey(id, email)')
      .eq('list_id', listId)
      .order('created_at', { ascending: true });
    if (error) {
      set({ error: error.message, loading: false });
      return;
    }
    set((state) => ({
      byListId: {
        ...state.byListId,
        [listId]: (data ?? []) as ListMemberWithProfile[],
      },
      loading: false,
    }));
  },

  addMemberByEmail: async (listId, email, addedBy) => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) throw new Error('Email is required');

    const { data: lookupData, error: lookupError } = await supabase.rpc(
      'lookup_user_by_email',
      { p_email: trimmed },
    );
    if (lookupError) throw lookupError;
    const targetUserId = lookupData as string | null;
    if (!targetUserId) {
      throw new Error(
        `No user found with email "${email}". They need to sign up first.`,
      );
    }

    const existing = get().byListId[listId] ?? [];
    if (existing.some((m) => m.user_id === targetUserId)) {
      throw new Error('That user is already a member of this list.');
    }

    const { error: insertError } = await supabase
      .from('list_members')
      .insert({ list_id: listId, user_id: targetUserId, added_by: addedBy });
    if (insertError) {
      if (insertError.code === '23505') {
        throw new Error('That user is already a member of this list.');
      }
      throw insertError;
    }

    // Refetch to get the joined profile shape consistently.
    const { data: row, error: rowError } = await supabase
      .from('list_members')
      .select('*, profile:profiles!list_members_user_id_fkey(id, email)')
      .eq('list_id', listId)
      .eq('user_id', targetUserId)
      .single();
    if (rowError) throw rowError;
    const member = row as ListMemberWithProfile;
    set((state) => ({
      byListId: {
        ...state.byListId,
        [listId]: [...(state.byListId[listId] ?? []), member],
      },
    }));
    return member;
  },

  removeMember: async (listId, userId) => {
    const previous = get().byListId[listId] ?? [];
    set((state) => ({
      byListId: {
        ...state.byListId,
        [listId]: previous.filter((m) => m.user_id !== userId),
      },
    }));
    const { error } = await supabase
      .from('list_members')
      .delete()
      .eq('list_id', listId)
      .eq('user_id', userId);
    if (error) {
      set((state) => ({
        byListId: { ...state.byListId, [listId]: previous },
      }));
      throw error;
    }
  },
}));

export const useMembers = (listId: string | undefined) =>
  useMembersStore((s) => (listId ? (s.byListId[listId] ?? []) : []));
export const useMembersLoading = () => useMembersStore((s) => s.loading);
