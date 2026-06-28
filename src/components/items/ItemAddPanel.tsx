import { useCallback, useMemo, useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useItemsStore, type ItemFormPayload } from '@/stores/itemsStore';
import { useUserId } from '@/stores/authStore';
import { ItemForm } from './ItemForm';
import type { Item, ListItemWithDetail } from '@/types';

interface ItemAddPanelProps {
  listId: string;
  /**
   * Scoped suggestions for this list: items already used in same-type lists,
   * excluding ones on this list (computed server-side by the suggest_items RPC).
   */
  suggestions: Item[];
  listItems: ListItemWithDetail[];
}

type Mode = 'search' | 'create';

export function ItemAddPanel({
  listId,
  suggestions,
  listItems,
}: ItemAddPanelProps) {
  const userId = useUserId();
  const createItem = useItemsStore((s) => s.createItem);
  const addItemToList = useItemsStore((s) => s.addItemToList);

  const [mode, setMode] = useState<Mode>('search');
  const [query, setQuery] = useState('');
  const [formPayload, setFormPayload] = useState<ItemFormPayload | null>(null);
  const [formValid, setFormValid] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleFormChange = useCallback(
    (next: ItemFormPayload, valid: boolean) => {
      setFormPayload(next);
      setFormValid(valid);
    },
    [],
  );

  const usedItemIds = useMemo(
    () => new Set(listItems.map((li) => li.item_id)),
    [listItems],
  );

  const matchesQuery = useCallback(
    (item: Item, q: string) =>
      item.title.toLowerCase().includes(q) ||
      (item.description?.toLowerCase().includes(q) ?? false),
    [],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    // The RPC already excludes items on this list and off-type items; the
    // usedItemIds guard only covers the brief optimistic window after an add.
    // All matches are rendered — the list itself scrolls (max-h-64 below).
    const candidates = suggestions.filter((it) => !usedItemIds.has(it.id));
    if (!q) return candidates;
    return candidates.filter((it) => matchesQuery(it, q));
  }, [suggestions, usedItemIds, query, matchesQuery]);

  const handleAddExisting = useCallback(
    (itemId: string) => {
      setError(null);
      startTransition(() => {
        void (async () => {
          try {
            await addItemToList(listId, itemId);
            setQuery('');
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add item');
          }
        })();
      });
    },
    [addItemToList, listId],
  );

  const handleCreate = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!userId || !formPayload || !formValid) return;
      setError(null);
      startTransition(() => {
        void (async () => {
          try {
            const item = await createItem(formPayload, userId);
            await addItemToList(listId, item.id);
            // Reset form by remounting via key bump.
            setFormKey((k) => k + 1);
            setFormPayload(null);
            setFormValid(false);
            setMode('search');
          } catch (err) {
            setError(
              err instanceof Error ? err.message : 'Failed to create item',
            );
          }
        })();
      });
    },
    [userId, formPayload, formValid, createItem, addItemToList, listId],
  );

  return (
    <section className="panel border-glow-cyan p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={14} className="text-retro-cyan" />
        <h3 className="label-terminal">Add item</h3>
        <div className="ml-auto flex border border-retro-border">
          <ModeButton active={mode === 'search'} onClick={() => setMode('search')}>
            Pick
          </ModeButton>
          <ModeButton active={mode === 'create'} onClick={() => setMode('create')}>
            Create
          </ModeButton>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {mode === 'search' ? (
          <motion.div
            key="search"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col gap-3"
          >
            <div className="relative">
              <Search
                size={14}
                className="absolute left-0 top-2.5 text-retro-muted pointer-events-none"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="// search suggestions"
                className="input-terminal pl-6"
              />
            </div>

            {filtered.length > 0 ? (
              <ul className="flex flex-col gap-1 max-h-64 overflow-y-auto">
                {filtered.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleAddExisting(item.id)}
                      className="w-full text-left px-3 py-2 border border-transparent hover:border-retro-cyan hover:bg-retro-cyan/5 transition-colors group disabled:opacity-50"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-display text-sm text-retro-text truncate group-hover:text-retro-cyan">
                            {item.title}
                          </div>
                          {item.description ? (
                            <div className="font-mono text-[11px] text-retro-muted truncate">
                              {item.description}
                            </div>
                          ) : null}
                        </div>
                        <Plus
                          size={14}
                          className="text-retro-cyan opacity-50 group-hover:opacity-100 shrink-0"
                        />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="font-mono text-xs text-retro-muted">
                {suggestions.length === 0
                  ? '// no suggestions for this list type yet — switch to "Create" to add one'
                  : query
                    ? `// no matches for "${query}" — switch to "Create" to add it`
                    : '// no more suggestions — switch to "Create" to add a new item'}
              </p>
            )}
          </motion.div>
        ) : (
          <motion.form
            key="create"
            onSubmit={handleCreate}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col gap-3"
          >
            <ItemForm
              key={formKey}
              onChange={handleFormChange}
              autoFocusTitle
            />
            <div className="flex justify-end">
              <Button
                type="submit"
                size="sm"
                disabled={!formValid}
                loading={isPending}
                iconLeft={<Plus size={14} />}
              >
                Create & add
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {error ? (
        <div className="mt-3 font-mono text-xs text-retro-magenta border-l-2 border-retro-magenta pl-3 py-1">
          ! {error}
        </div>
      ) : null}
    </section>
  );
}

interface ModeButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function ModeButton({ active, onClick, children }: ModeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`font-mono text-[10px] uppercase tracking-[0.2em] px-3 py-1.5 transition-all ${
        active
          ? 'bg-retro-cyan text-retro-bg'
          : 'text-retro-muted hover:text-retro-cyan'
      }`}
    >
      {children}
    </button>
  );
}
