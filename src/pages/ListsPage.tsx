import { useCallback, useEffect, useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/Button';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { PageTransition } from '@/components/ui/PageTransition';
import { ListGrid } from '@/components/lists/ListGrid';
import { ListCreateModal } from '@/components/lists/ListCreateModal';
import { EmptyLists } from '@/components/lists/EmptyLists';
import { RemindersBanner } from '@/components/reminders/RemindersBanner';
import {
  useLists,
  useListsLoading,
  useListsStore,
} from '@/stores/listsStore';
import { useUserId } from '@/stores/authStore';

export default function ListsPage() {
  const userId = useUserId();
  const lists = useLists();
  const loading = useListsLoading();
  const fetchLists = useListsStore((s) => s.fetchLists);
  const deleteList = useListsStore((s) => s.deleteList);
  const leaveList = useListsStore((s) => s.leaveList);

  const [createOpen, setCreateOpen] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    document.title = 'ohMyBuying — Your lists';
  }, []);

  useEffect(() => {
    if (userId) fetchLists(userId);
  }, [userId, fetchLists]);

  const handleDelete = useCallback(
    (id: string) => {
      startTransition(() => {
        deleteList(id).catch((err) => {
          console.error('Failed to delete list', err);
        });
      });
    },
    [deleteList],
  );

  const handleLeave = useCallback(
    (id: string) => {
      if (!userId) return;
      startTransition(() => {
        leaveList(id, userId).catch((err) => {
          console.error('Failed to leave list', err);
        });
      });
    },
    [leaveList, userId],
  );

  const openCreate = useCallback(() => setCreateOpen(true), []);
  const closeCreate = useCallback(() => setCreateOpen(false), []);

  return (
    <>
      <AppHeader />
      <PageTransition className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex items-end justify-between gap-4 mb-8">
          <div>
            <p className="label-terminal mb-1">/ home / lists</p>
            <h1 className="font-display text-3xl sm:text-4xl text-retro-text">
              Your <span className="text-retro-cyan text-glow-cyan">lists</span>
            </h1>
          </div>
          <Button onClick={openCreate} iconLeft={<Plus size={14} />}>
            New list
          </Button>
        </div>

        {loading && lists.length === 0 ? (
          <LoadingScreen message="LOADING LISTS" />
        ) : lists.length === 0 ? (
          <EmptyLists onCreate={openCreate} />
        ) : (
          <>
            <RemindersBanner />
            <ListGrid
              lists={lists}
              currentUserId={userId}
              onDelete={handleDelete}
              onLeave={handleLeave}
            />
          </>
        )}
      </PageTransition>

      <ListCreateModal open={createOpen} onClose={closeCreate} />
    </>
  );
}
