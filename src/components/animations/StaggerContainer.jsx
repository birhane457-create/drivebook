import { motion } from 'framer-motion';
import { variants } from '@/lib/animations';

// Stagger children in on mount.
export default function StaggerContainer({ children, className, delay = 0.02, stagger = 0.04 }) {
  return (
    <motion.div
      className={className}
      variants={{
        initial: {},
        animate: { transition: { staggerChildren: stagger, delayChildren: delay } },
        exit: { transition: { staggerChildren: 0.02 } },
      }}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {children}
    </motion.div>
  );
}

// Fade+rise item used inside a StaggerContainer.
export function StaggerItem({ children, className }) {
  return (
    <motion.div className={className} variants={variants.listItem}>
      {children}
    </motion.div>
  );
}