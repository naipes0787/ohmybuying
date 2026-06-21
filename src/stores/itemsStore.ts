import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Item, ListItemWithDetail } from '@/types';

export type ItemFormPayload = Pick<
  Item,
  'title' | 'description' | 'reminder_enabled' | 'reminder_interval_days'
>;

interface ItemsState {
  allItems: Item[];
  listItems: ListItemWithDetail[];
  suggestions: Item[];
  loading: boolean;
  error: string | null;
  currentListId: string | null;

  fetchAllItems: () => Promise<void>;
  fetchSuggestions: (listId: string) => Promise<void>;
  fetchListItems: (listId: string) => Promise<void>;
  createItem: (payload: ItemFormPayload, userId: string) => Promise<Item>;
  updateItem: (itemId: string, payload: ItemFormPayload) => Promise<Item>;
  deleteItem: (itemId: string) => Promise<void>;
  addItemToList: (listId: string, itemId: string) => Promise<void>;
  removeItemFromList: (listId: string, itemId: string) => Promise<void>;
  setListItems: (next: ListItemWithDetail[]) => void;
  reorderListItems: (
    listId: string,
    reordered: ListItemWithDetail[],
  ) => Promise<void>;
}

export const useItemsStore = create<ItemsState>((set, get) => ({
  allItems: [],
  listItems: [],
  suggestions: [],
  loading: false,
  error: null,
  currentListId: null,

  fetchAllItems: async () => {
    // RLS scopes this to items the user authored + items used in any list
    // they can access (own or shared).
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .order('title', { ascending: true });
    if (error) {
      set({ error: error.message });
      return;
    }
    set({ allItems: (data ?? []) as Item[] });
  },

  fetchSuggestions: async (listId) => {
    // Server-side: only items used in same-type accessible lists, excluding
    // those already on this list (see the suggest_items RPC).
    const { data, error } = await supabase.rpc('suggest_items', {
      p_list_id: listId,
    });
    if (error) {
      set({ error: error.message });
      return;
    }
    set({ suggestions: (data ?? []) as Item[] });
  },

  fetchListItems: async (listId) => {
    set({ loading: true, currentListId: listId });
    const { data, error } = await supabase
      .from('list_items')
      .select('*, item:items(*)')
      .eq('list_id', listId)
      .order('position', { ascending: true });
    if (error) {
      set({ error: error.message, loading: false });
      return;
    }
    set({
      listItems: (data ?? []) as ListItemWithDetail[],
      loading: false,
    });
  },

  createItem: async (payload, userId) => {
    const { data, error } = await supabase
      .from('items')
      .insert({
        title: payload.title,
        description: payload.description,
        reminder_enabled: payload.reminder_enabled,
        reminder_interval_days: payload.reminder_enabled
          ? payload.reminder_interval_days
          : null,
        user_id: userId,
      })
      .select()
      .single();
    if (error) throw error;
    const item = data as Item;
    set((state) => ({
      allItems: [...state.allItems, item].sort((a, b) =>
        a.title.localeCompare(b.title),
      ),
    }));
    return item;
  },

  updateItem: async (itemId, payload) => {
    const { data, error } = await supabase
      .from('items')
      .update({
        title: payload.title,
        description: payload.description,
        reminder_enabled: payload.reminder_enabled,
        reminder_interval_days: payload.reminder_enabled
          ? payload.reminder_interval_days
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .select()
      .single();
    if (error) throw error;
    const updated = data as Item;
    set((state) => ({
      allItems: state.allItems
        .map((it) => (it.id === itemId ? updated : it))
        .sort((a, b) => a.title.localeCompare(b.title)),
      listItems: state.listItems.map((li) =>
        li.item_id === itemId ? { ...li, item: updated } : li,
      ),
    }));
    return updated;
  },

  deleteItem: async (itemId) => {
    const previousAll = get().allItems;
    const previousList = get().listItems;
    set((state) => ({
      allItems: state.allItems.filter((it) => it.id !== itemId),
      listItems: state.listItems.filter((li) => li.item_id !== itemId),
    }));
    const { error } = await supabase.from('items').delete().eq('id', itemId);
    if (error) {
      set({ allItems: previousAll, listItems: previousList });
      throw error;
    }
  },

  addItemToList: async (listId, itemId) => {
    const currentMax = get()
      .listItems.reduce((max, li) => Math.max(max, li.position), -1);
    const nextPosition = currentMax + 1;
    const { error } = await supabase
      .from('list_items')
      .insert({ list_id: listId, item_id: itemId, position: nextPosition });
    if (error) throw error;
    // Drop the just-added item from suggestions optimistically; the list
    // itself is refetched for canonical ordering/positions.
    set((state) => ({
      suggestions: state.suggestions.filter((it) => it.id !== itemId),
    }));
    await get().fetchListItems(listId);
  },

  removeItemFromList: async (listId, itemId) => {
    const previous = get().listItems;
    const removedListItem = previous.find((li) => li.item_id === itemId);
    set((state) => ({
      listItems: state.listItems.filter((li) => li.item_id !== itemId),
    }));
    const { error } = await supabase
      .from('list_items')
      .delete()
      .eq('list_id', listId)
      .eq('item_id', itemId);
    if (error) {
      set({ listItems: previous });
      throw error;
    }
    if (removedListItem?.item) {
      set((state) => ({
        suggestions: [removedListItem.item, ...state.suggestions],
      }));
    }
  },

  setListItems: (next) => set({ listItems: next }),

  reorderListItems: async (listId, reordered) => {
    const previous = get().listItems;
    const optimistic = reordered.map((li, index) => ({
      ...li,
      position: index,
    }));
    set({ listItems: optimistic });

    const updates = optimistic.map((li) => ({
      id: li.id,
      list_id: li.list_id,
      item_id: li.item_id,
      position: li.position,
    }));

    const { error } = await supabase
      .from('list_items')
      .upsert(updates, { onConflict: 'id' });
    if (error) {
      set({ listItems: previous });
      await get().fetchListItems(listId);
      throw error;
    }
  },
}));

export const useAllItems = () => useItemsStore((s) => s.allItems);
export const useSuggestions = () => useItemsStore((s) => s.suggestions);
export const useListItemsState = () => useItemsStore((s) => s.listItems);
export const useItemsLoading = () => useItemsStore((s) => s.loading);
