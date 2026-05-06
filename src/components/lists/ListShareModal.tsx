import { useCallback, useEffect, useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, UserPlus, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useUserId, useUser } from '@/stores/authStore';
import { useMembers, useMembersStore } from '@/stores/membersStore';
import type { List } from '@/types';

interface ListShareModalProps {
  open: boolean;
  onClose: () => void;
  list: List;
}

export function ListShareModal({ open, onClose, list }: ListShareModalProps) {
  const currentUserId = useUserId();
  const currentUser = useUser();
  const isOwner = currentUserId === list.user_id;
  const members = useMembers(list.id);
  const fetchMembers = useMembersStore((s) => s.fetchMembers);
  const addMemberByEmail = useMembersStore((s) => s.addMemberByEmail);
  const removeMember = useMembersStore((s) => s.removeMember);

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      fetchMembers(list.id);
      setEmail('');
      setError(null);
    }
  }, [open, list.id, fetchMembers]);

  const handleAdd = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!currentUserId) return;
      setError(null);
      startTransition(() => {
        void (async () => {
          try {
            await addMemberByEmail(list.id, email, currentUserId);
            setEmail('');
          } catch (err) {
            setError(
              err instanceof Error ? err.message : 'Failed to add member',
            );
          }
        })();
      });
    },
    [list.id, email, currentUserId, addMemberByEmail],
  );

  const handleRemove = useCallback(
    (userId: string) => {
      setError(null);
      startTransition(() => {
        void (async () => {
          try {
            await removeMember(list.id, userId);
          } catch (err) {
            setError(
              err instanceof Error ? err.message : 'Failed to remove member',
            );
          }
        })();
      });
    },
    [list.id, removeMember],
  );

  return (
    <Modal open={open} onClose={onClose} title={`Share "${list.name}"`}>
      <div className="flex flex-col gap-5">
        <div>
          <p className="label-terminal mb-3">Members</p>
          <ul className="flex flex-col gap-1.5">
            <li className="flex items-center justify-between gap-3 px-3 py-2 border border-retro-border bg-retro-surface">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-block w-2 h-2 rounded-full bg-retro-cyan animate-glow-pulse shrink-0" />
                <span className="font-mono text-sm text-retro-text truncate">
                  {currentUser?.id === list.user_id
                    ? `${currentUser.email} (you)`
                    : 'Owner'}
                </span>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-retro-cyan">
                Owner
              </span>
            </li>

            <AnimatePresence initial={false}>
              {members.map((member) => (
                <motion.li
                  key={member.user_id}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex items-center justify-between gap-3 px-3 py-2 border border-retro-border bg-retro-surface"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-block w-2 h-2 rounded-full bg-retro-green shrink-0" />
                    <span className="font-mono text-sm text-retro-text truncate">
                      {member.profile?.email ?? member.user_id}
                      {member.user_id === currentUserId ? ' (you)' : ''}
                    </span>
                  </div>
                  {isOwner ? (
                    <button
                      type="button"
                      onClick={() => handleRemove(member.user_id)}
                      disabled={isPending}
                      aria-label={`Remove ${member.profile?.email ?? 'member'}`}
                      className="text-retro-muted hover:text-retro-magenta transition-colors p-1 -m-1 disabled:opacity-50"
                    >
                      <X size={14} />
                    </button>
                  ) : (
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-retro-muted">
                      Member
                    </span>
                  )}
                </motion.li>
              ))}
            </AnimatePresence>

            {members.length === 0 ? (
              <li className="font-mono text-xs text-retro-muted pl-3 py-2">
                // no other members yet
              </li>
            ) : null}
          </ul>
        </div>

        {isOwner ? (
          <form onSubmit={handleAdd} className="flex flex-col gap-3">
            <p className="label-terminal">Add member</p>
            <div className="relative">
              <Mail
                size={14}
                className="absolute left-0 top-2.5 text-retro-muted pointer-events-none"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="partner@domain.io"
                required
                className="input-terminal pl-6"
              />
            </div>
            <p className="font-mono text-[11px] text-retro-muted">
              // they need an account first — sharing is by email lookup
            </p>
            <div className="flex justify-end">
              <Button
                type="submit"
                size="sm"
                loading={isPending}
                disabled={!email.trim()}
                iconLeft={<UserPlus size={14} />}
              >
                Add
              </Button>
            </div>
          </form>
        ) : (
          <p className="font-mono text-xs text-retro-muted">
            // only the owner can manage members
          </p>
        )}

        {error ? (
          <div className="font-mono text-xs text-retro-magenta border-l-2 border-retro-magenta pl-3 py-1">
            ! {error}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
