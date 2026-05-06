import { useCallback, useEffect, useState, useTransition } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Plus, X } from 'lucide-react';
import { useDueReminders, useRemindersStore } from '@/stores/remindersStore';
import { useItemsStore } from '@/stores/itemsStore';
import { useLists } from '@/stores/listsStore';
import type { DueReminder, List } from '@/types';

export function RemindersBanner() {
  const due = useDueReminders();
  const fetchDue = useRemindersStore((s) => s.fetchDue);
  const dismiss = useRemindersStore((s) => s.dismiss);
  const lists = useLists();

  useEffect(() => {
    fetchDue();
  }, [fetchDue]);

  if (due.length === 0) return null;

  return (
    <section
      aria-label="Items due to restock"
      className="panel border-glow-magenta p-4 sm:p-5 mb-8"
    >
      <header className="flex items-center gap-2 mb-4">
        <Bell size={14} className="text-retro-magenta animate-glow-pulse" />
        <h2 className="label-terminal text-retro-magenta">Time to restock</h2>
        <span className="ml-2 font-mono text-[11px] text-retro-muted">
          // {due.length === 1 ? '1 item' : `${due.length} items`} past their reminder window
        </span>
      </header>

      <ul className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {due.map((reminder) => (
            <motion.li
              key={reminder.id}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.18 }}
            >
              <RemindersBannerRow
                reminder={reminder}
                lists={lists}
                onDismiss={() => dismiss(reminder.id)}
              />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </section>
  );
}

interface RowProps {
  reminder: DueReminder;
  lists: List[];
  onDismiss: () => void;
}

function RemindersBannerRow({ reminder, lists, onDismiss }: RowProps) {
  const addItemToList = useItemsStore((s) => s.addItemToList);
  const dismiss = useRemindersStore((s) => s.dismiss);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleAdd = useCallback(
    (listId: string) => {
      setError(null);
      startTransition(() => {
        void (async () => {
          try {
            await addItemToList(listId, reminder.id);
            dismiss(reminder.id);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add');
          }
        })();
      });
    },
    [addItemToList, dismiss, reminder.id],
  );

  return (
    <div className="flex flex-col gap-2 px-3 py-2 border border-retro-border bg-retro-surface">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-sm text-retro-text truncate">
              {reminder.title}
            </span>
            <span className="font-mono text-[10px] text-retro-muted">
              {reminder.days_since}d / {reminder.reminder_interval_days}d
            </span>
          </div>
          {reminder.description ? (
            <p className="font-mono text-[11px] text-retro-muted truncate">
              {reminder.description}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {lists.length === 0 ? (
            <span className="font-mono text-[10px] text-retro-muted">
              // create a list first
            </span>
          ) : lists.length === 1 ? (
            <button
              type="button"
              onClick={() => handleAdd(lists[0].id)}
              disabled={isPending}
              className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.2em] px-2 py-1 border border-retro-cyan text-retro-cyan hover:bg-retro-cyan hover:text-retro-bg transition-all disabled:opacity-50"
            >
              <Plus size={10} /> add
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setPicking((v) => !v)}
              disabled={isPending}
              className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.2em] px-2 py-1 border border-retro-cyan text-retro-cyan hover:bg-retro-cyan hover:text-retro-bg transition-all disabled:opacity-50"
            >
              <Plus size={10} /> add to list
            </button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss reminder"
            className="text-retro-muted hover:text-retro-magenta transition-colors p-1 -m-1"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {picking && lists.length > 1 ? (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {lists.map((list) => (
            <button
              key={list.id}
              type="button"
              onClick={() => handleAdd(list.id)}
              disabled={isPending}
              className="font-mono text-[10px] px-2 py-1 border border-retro-border hover:border-retro-cyan hover:text-retro-cyan transition-colors disabled:opacity-50"
            >
              {list.name}
            </button>
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="font-mono text-[11px] text-retro-magenta">! {error}</div>
      ) : null}
    </div>
  );
}
