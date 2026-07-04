import { motion } from 'framer-motion';
import { variants, transitions } from '@/lib/animations';

// Wraps table body rows so they stagger in on mount.
export default function AnimatedTableRows({ children, className }) {
  return (
    <motion.tbody
      className={className}
      variants={variants.stagger}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {children}
    </motion.tbody>
  );
}

// A single animated row.
export function AnimatedTableRow({ children, className, onClick, ...props }) {
  return (
    <motion.tr
      className={className}
      variants={variants.listItem}
      transition={transitions.base}
      whileHover={onClick ? { backgroundColor: 'rgba(0,0,0,0.02)' } : undefined}
      onClick={onClick}
      {...props}
    >
      {children}
    </motion.tr>
  );
}