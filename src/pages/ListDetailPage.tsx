import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Share2, Users } from 'lucide-react';
import type { DropResult } from '@hello-pangea/dnd';

import { AppHeader } from '@/components/layout/AppHeader';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { PageTransition } from '@/components/ui/PageTransition';
import { Button } from '@/components/ui/Button';
import { ItemList } from '@/components/items/ItemList';
import { ItemAddPanel } from '@/components/items/ItemAddPanel';
import { ItemEditModal } from '@/components/items/ItemEditModal';
import { ListShareModal } from '@/components/lists/ListShareModal';
import { ListEditModal } from '@/components/lists/ListEditModal';
import { useMembers, useMembersStore } from '@/stores/membersStore';

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
  const suggestions = useItemsStore((s) => s.suggestions);
  const listItems = useItemsStore((s) => s.listItems);
  const fetchSuggestions = useItemsStore((s) => s.fetchSuggestions);
  const setListItems = useItemsStore((s) => s.setListItems);
  const reorderListItems = useItemsStore((s) => s.reorderListItems);
  const removeItemFromList = useItemsStore((s) => s.removeItemFromList);

  const fetchMembers = useMembersStore((s) => s.fetchMembers);
  const members = useMembers(listId);

  const [list, setList] = useState<List | null>(listFromStore ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const editingItem = useMemo(
    () =>
      editingItemId
        ? (listItems.find((li) => li.item_id === editingItemId)?.item ?? null)
        : null,
    [editingItemId, listItems],
  );

  useEffect(() => {
    if (!listId || !userId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchListAndItems(listId),
      fetchSuggestions(listId),
      fetchMembers(listId),
    ])
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
  }, [listId, userId, fetchSuggestions, fetchMembers, setListItems]);

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

  const handleEdit = useCallback((itemId: string) => {
    setEditingItemId(itemId);
  }, []);
  const handleCloseEdit = useCallback(() => {
    setEditingItemId(null);
  }, []);

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
            <div className="flex items-start justify-between gap-3">
              <h1 className="font-display text-3xl sm:text-4xl text-retro-text mb-2 break-words min-w-0">
                {list.name}
              </h1>
              <div className="flex items-center gap-2 shrink-0">
                {list.user_id === userId ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditOpen(true)}
                    iconLeft={<Pencil size={14} />}
                  >
                    Edit
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShareOpen(true)}
                  iconLeft={<Share2 size={14} />}
                >
                  Share
                </Button>
              </div>
            </div>
            {list.description ? (
              <p className="font-mono text-sm text-retro-muted whitespace-pre-wrap">
                {list.description}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[10px] uppercase tracking-[0.3em] text-retro-cyan">
              <span>
                <span className="text-glow-cyan">▸</span> {itemCountLabel}
              </span>
              {list.user_id !== userId ? (
                <span className="text-retro-magenta">
                  <span className="text-glow-magenta">◆</span> shared with you
                </span>
              ) : members.length > 0 ? (
                <span className="text-retro-green inline-flex items-center gap-1">
                  <Users size={11} />
                  {members.length === 1
                    ? '1 member'
                    : `${members.length} members`}
                </span>
              ) : null}
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
              onEdit={handleEdit}
            />
          )}

          <ItemAddPanel
            listId={listId}
            suggestions={suggestions}
            listItems={listItems}
          />
        </div>
      </PageTransition>

      {list ? (
        <ListShareModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          list={list}
        />
      ) : null}

      {list ? (
        <ListEditModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          list={list}
          onUpdated={(updated) => {
            setList(updated);
            document.title = `ohMyBuying — ${updated.name}`;
            // Type may have changed — refresh the scoped suggestions.
            void fetchSuggestions(updated.id);
          }}
        />
      ) : null}

      <ItemEditModal
        open={editingItem !== null}
        onClose={handleCloseEdit}
        item={editingItem}
      />
    </>
  );
}

function reorderArray<T>(arr: T[], from: number, to: number): T[] {
  const next = arr.slice();
  const [removed] = next.splice(from, 1);
  next.splice(to, 0, removed);
  return next;
}
