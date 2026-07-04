import { motion, AnimatePresence } from 'framer-motion';
import { variants, transitions } from '@/lib/animations';

const DIRECTION_VARIANTS = {
  right: variants.drawerRight,
  left: variants.drawerLeft,
  bottom: variants.drawerBottom,
};

export default function AnimatedDrawer({
  open,
  onClose,
  side = 'right',
  children,
  className = '',
  overlayClassName = '',
}) {
  const drawerVariant = DIRECTION_VARIANTS[side] || variants.drawerRight;
  const isVertical = side === 'bottom';
  const sideClass = {
    right: 'right-0 top-0 bottom-0',
    left: 'left-0 top-0 bottom-0',
    bottom: 'left-0 right-0 bottom-0',
  }[side];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className={`fixed inset-0 z-40 bg-black/40 ${overlayClassName}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transitions.fast}
            onClick={onClose}
          />
          <motion.div
            className={`fixed z-50 bg-background border-border shadow-2xl ${
              isVertical ? 'max-h-[80vh] w-full rounded-t-2xl' : 'w-full sm:w-[420px]'
            } ${sideClass} ${className}`}
            variants={drawerVariant}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={transitions.base}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}