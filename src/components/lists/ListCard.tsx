import { memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ChevronRight, Trash2 } from 'lucide-react';
import type { List } from '@/types';

interface ListCardProps {
  list: List;
  onDelete: (id: string) => void;
}

export const ListCard = memo(function ListCard({
  list,
  onDelete,
}: ListCardProps) {
  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const confirmed = window.confirm(`Delete list "${list.name}"?`);
      if (confirmed) onDelete(list.id);
    },
    [list.id, list.name, onDelete],
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
            onClick={handleDelete}
            aria-label={`Delete ${list.name}`}
            className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-retro-muted hover:text-retro-magenta transition-all p-1 -m-1"
          >
            <Trash2 size={16} />
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
          <span>
            <span className="text-retro-cyan mr-1">▸</span>
            open list
          </span>
          <ChevronRight
            size={14}
            className="text-retro-cyan opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all"
          />
        </div>
      </Link>
    </motion.div>
  );
});
