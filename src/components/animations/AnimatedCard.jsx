import { motion } from 'framer-motion';
import { transitions, SPRING } from '@/lib/animations';

export default function AnimatedCard({ children, className, lift = true, onClick }) {
  return (
    <motion.div
      className={className}
      whileHover={lift ? { y: -4, boxShadow: '0 12px 32px -8px rgba(0,0,0,0.18)' } : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      transition={transitions.spring}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
}