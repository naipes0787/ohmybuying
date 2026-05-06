import { motion } from 'framer-motion';
import { ListCard } from './ListCard';
import type { List } from '@/types';

interface ListGridProps {
  lists: List[];
  currentUserId: string | null;
  onDelete: (id: string) => void;
  onLeave: (id: string) => void;
}

const containerVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
};

export function ListGrid({
  lists,
  currentUserId,
  onDelete,
  onLeave,
}: ListGridProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      {lists.map((list) => (
        <ListCard
          key={list.id}
          list={list}
          currentUserId={currentUserId}
          onDelete={onDelete}
          onLeave={onLeave}
        />
      ))}
    </motion.div>
  );
}
