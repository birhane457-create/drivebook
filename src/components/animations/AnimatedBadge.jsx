import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { transitions } from '@/lib/animations';

export default function AnimatedBadge({ children, variant = 'default', className, count }) {
  return (
    <motion.div
      className="inline-flex"
      key={count}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={transitions.bounce}
      whileHover={{ scale: 1.08 }}
    >
      <Badge variant={variant} className={className}>
        {count !== undefined ? count : children}
      </Badge>
    </motion.div>
  );
}