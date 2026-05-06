import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Item, ListItemWithDetail } from '@/types';

interface ItemsState {
  allItems: Item[];
  listItems: ListItemWithDetail[];
  loading: boolean;
  error: string | null;
  currentListId: string | null;

  fetchAllItems: (userId: string) => Promise<void>;
  fetchListItems: (listId: string) => Promise<void>;
  createItem: (
    payload: Pick<Item, 'title' | 'description'>,
    userId: string,
  ) => Promise<Item>;
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
  loading: false,
  error: null,
  currentListId: null,

  fetchAllItems: async (userId) => {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('user_id', userId)
      .order('title', { ascending: true });
    if (error) {
      set({ error: error.message });
      return;
    }
    set({ allItems: (data ?? []) as Item[] });
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
      .insert({ ...payload, user_id: userId })
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

  addItemToList: async (listId, itemId) => {
    const currentMax = get()
      .listItems.reduce((max, li) => Math.max(max, li.position), -1);
    const nextPosition = currentMax + 1;
    const { error } = await supabase
      .from('list_items')
      .insert({ list_id: listId, item_id: itemId, position: nextPosition });
    if (error) throw error;
    await get().fetchListItems(listId);
  },

  removeItemFromList: async (listId, itemId) => {
    const previous = get().listItems;
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
export const useListItemsState = () => useItemsStore((s) => s.listItems);
export const useItemsLoading = () => useItemsStore((s) => s.loading);
