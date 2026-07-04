import { motion } from 'framer-motion';
import { variants, transitions } from '@/lib/animations';

export default function AnimatedPage({ children, className, name }) {
  return (
    <motion.div
      className={className}
      variants={variants.page}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={transitions.base}
      data-page={name}
    >
      {children}
    </motion.div>
  );
}