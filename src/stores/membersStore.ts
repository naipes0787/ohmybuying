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

  addMemberByEmail: async (listId, email) => {
    const trimmed = email.trim();
    if (!trimmed) throw new Error('Email is required');

    // Atomic server-side RPC: ownership check + email lookup + insert all
    // happen with auth.uid() context, so the client never learns whether an
    // email exists outside the success path.
    const { data: status, error } = await supabase.rpc(
      'add_list_member_by_email',
      { p_list_id: listId, p_email: trimmed },
    );
    if (error) throw error;
    switch (status as string) {
      case 'ok':
        break;
      case 'no_such_user':
        throw new Error(
          `No user found with email "${email}". They need to sign up first.`,
        );
      case 'cannot_add_self':
        throw new Error('You are already the owner of this list.');
      case 'not_owner':
        throw new Error('Only the list owner can add members.');
      case 'unauthenticated':
        throw new Error('You need to sign in again.');
      default:
        throw new Error('Failed to add member.');
    }

    // Refetch the full member list — simplest way to get the new row with
    // its joined profile shape. The list is small (handful of members) so
    // this is cheap.
    const { data: rows, error: rowError } = await supabase
      .from('list_members')
      .select('*, profile:profiles!list_members_user_id_fkey(id, email)')
      .eq('list_id', listId)
      .order('created_at', { ascending: true });
    if (rowError) throw rowError;
    const refreshed = (rows ?? []) as ListMemberWithProfile[];
    set((state) => ({
      byListId: { ...state.byListId, [listId]: refreshed },
    }));
    const member = refreshed.find(
      (m) => m.profile?.email?.toLowerCase() === trimmed.toLowerCase(),
    );
    if (!member) {
      throw new Error('Member added but profile not visible yet.');
    }
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
