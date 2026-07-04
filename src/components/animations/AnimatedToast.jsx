import { motion, AnimatePresence } from 'framer-motion';
import { variants, transitions } from '@/lib/animations';

// Animated toast body — wrap inside an AnimatePresence list.
export default function AnimatedToast({ children, kind = 'info', className = '' }) {
  const accent = {
    info: 'border-l-primary',
    success: 'border-l-emerald-500',
    warning: 'border-l-amber-500',
    error: 'border-l-destructive',
  }[kind];

  return (
    <motion.div
      className={`rounded-lg border border-l-4 ${accent} bg-card p-3 shadow-lg ${className}`}
      layout
      variants={variants.toast}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={transitions.spring}
    >
      {children}
    </motion.div>
  );
}