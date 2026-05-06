import { memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ChevronRight, LogOut, Trash2, Users } from 'lucide-react';
import type { List } from '@/types';

interface ListCardProps {
  list: List;
  currentUserId: string | null;
  onDelete: (id: string) => void;
  onLeave: (id: string) => void;
}

export const ListCard = memo(function ListCard({
  list,
  currentUserId,
  onDelete,
  onLeave,
}: ListCardProps) {
  const isOwner = list.user_id === currentUserId;

  const handleAction = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isOwner) {
        if (window.confirm(`Delete list "${list.name}"?`)) onDelete(list.id);
      } else {
        if (window.confirm(`Leave list "${list.name}"?`)) onLeave(list.id);
      }
    },
    [isOwner, list.id, list.name, onDelete, onLeave],
  );

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 16 },
        show: { opacity: 1, y: 0 },
      }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <Link
        to={`/lists/${list.id}`}
        className="group block panel p-4 sm:p-5 transition-all hover:border-retro-cyan hover:shadow-glow-cyan focus:border-retro-cyan focus:shadow-glow-cyan focus:outline-none"
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="font-display text-lg sm:text-xl text-retro-text group-hover:text-retro-cyan transition-colors truncate">
            {list.name}
          </h3>
          <button
            onClick={handleAction}
            aria-label={
              isOwner ? `Delete ${list.name}` : `Leave ${list.name}`
            }
            className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-retro-muted hover:text-retro-magenta transition-all p-1 -m-1"
          >
            {isOwner ? <Trash2 size={16} /> : <LogOut size={16} />}
          </button>
        </div>

        {list.description ? (
          <p className="font-mono text-xs text-retro-muted line-clamp-2 mb-4">
            {list.description}
          </p>
        ) : (
          <p className="font-mono text-xs text-retro-muted/60 italic mb-4">
            // no notes
          </p>
        )}

        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-retro-muted">
          {isOwner ? (
            <span>
              <span className="text-retro-cyan mr-1">▸</span>
              open list
            </span>
          ) : (
            <span className="text-retro-magenta inline-flex items-center gap-1.5">
              <Users size={11} />
              shared
            </span>
          )}
          <ChevronRight
            size={14}
            className="text-retro-cyan opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all"
          />
        </div>
      </Link>
    </motion.div>
  );
});
