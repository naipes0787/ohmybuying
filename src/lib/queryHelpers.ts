import { supabase } from './supabase';
import type { List, ListItemWithDetail } from '@/types';

export async function fetchListAndItems(
  listId: string,
): Promise<{ list: List; listItems: ListItemWithDetail[] }> {
  const [listResult, itemsResult] = await Promise.all([
    supabase.from('lists').select('*').eq('id', listId).single(),
    supabase
      .from('list_items')
      .select('*, item:items(*)')
      .eq('list_id', listId)
      .order('position', { ascending: true }),
  ]);

  if (listResult.error) throw listResult.error;
  if (itemsResult.error) throw itemsResult.error;

  return {
    list: listResult.data as List,
    listItems: (itemsResult.data ?? []) as ListItemWithDetail[],
  };
}
