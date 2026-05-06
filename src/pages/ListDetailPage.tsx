import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { DropResult } from '@hello-pangea/dnd';

import { AppHeader } from '@/components/layout/AppHeader';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { PageTransition } from '@/components/ui/PageTransition';
import { ItemList } from '@/components/items/ItemList';
import { ItemAddPanel } from '@/components/items/ItemAddPanel';

import { useUserId } from '@/stores/authStore';
import { useListsStore } from '@/stores/listsStore';
import { useItemsStore } from '@/stores/itemsStore';
import type { List } from '@/types';
import { fetchListAndItems } from '@/lib/queryHelpers';

export default function ListDetailPage() {
  const { listId } = useParams<{ listId: string }>();
  const userId = useUserId();

  const listFromStore = useListsStore((s) =>
    listId ? s.lists.find((l) => l.id === listId) : undefined,
  );
  const allItems = useItemsStore((s) => s.allItems);
  const listItems = useItemsStore((s) => s.listItems);
  const fetchAllItems = useItemsStore((s) => s.fetchAllItems);
  const setListItems = useItemsStore((s) => s.setListItems);
  const reorderListItems = useItemsStore((s) => s.reorderListItems);
  const removeItemFromList = useItemsStore((s) => s.removeItemFromList);

  const [list, setList] = useState<List | null>(listFromStore ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!listId || !userId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([fetchListAndItems(listId), fetchAllItems(userId)])
      .then(([listResult]) => {
        if (cancelled) return;
        setList(listResult.list);
        setListItems(listResult.listItems);
        document.title = `ohMyBuying — ${listResult.list.name}`;
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load list');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [listId, userId, fetchAllItems, setListItems]);

  const handleReorder = useCallback(
    (result: DropResult) => {
      if (!listId || !result.destination) return;
      if (result.destination.index === result.source.index) return;
      const next = reorderArray(
        listItems,
        result.source.index,
        result.destination.index,
      );
      startTransition(() => {
        reorderListItems(listId, next).catch((err) => {
          console.error('Failed to reorder items', err);
        });
      });
    },
    [listId, listItems, reorderListItems],
  );

  const handleRemove = useCallback(
    (itemId: string) => {
      if (!listId) return;
      startTransition(() => {
        removeItemFromList(listId, itemId).catch((err) => {
          console.error('Failed to remove item', err);
        });
      });
    },
    [listId, removeItemFromList],
  );

  const itemCountLabel = useMemo(() => {
    const n = listItems.length;
    return n === 1 ? '1 item' : `${n} items`;
  }, [listItems.length]);

  if (!listId) return <Navigate to="/" replace />;
  if (loading && !list) return <LoadingScreen message="LOADING LIST" />;

  return (
    <>
      <AppHeader />
      <PageTransition className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-retro-muted hover:text-retro-cyan transition-colors mb-6"
        >
          <ArrowLeft size={12} />
          back to lists
        </Link>

        {error ? (
          <div className="panel border-glow-magenta p-4 mb-6 font-mono text-sm text-retro-magenta">
            ! {error}
          </div>
        ) : null}

        {list ? (
          <header className="mb-8">
            <p className="label-terminal mb-1">/ list</p>
            <h1 className="font-display text-3xl sm:text-4xl text-retro-text mb-2 break-words">
              {list.name}
            </h1>
            {list.description ? (
              <p className="font-mono text-sm text-retro-muted whitespace-pre-wrap">
                {list.description}
              </p>
            ) : null}
            <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.3em] text-retro-cyan">
              <span className="text-glow-cyan">▸</span> {itemCountLabel}
            </div>
          </header>
        ) : null}

        <div className="flex flex-col gap-6">
          {listItems.length === 0 ? (
            <div className="panel p-8 text-center">
              <p className="font-mono text-sm text-retro-muted">
                // no items yet — add one below to get started
              </p>
            </div>
          ) : (
            <ItemList
              items={listItems}
              onReorder={handleReorder}
              onRemove={handleRemove}
            />
          )}

          <ItemAddPanel
            listId={listId}
            allItems={allItems}
            listItems={listItems}
          />
        </div>
      </PageTransition>
    </>
  );
}

function reorderArray<T>(arr: T[], from: number, to: number): T[] {
  const next = arr.slice();
  const [removed] = next.splice(from, 1);
  next.splice(to, 0, removed);
  return next;
}
