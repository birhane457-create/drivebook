import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { variants, transitions } from '@/lib/animations';

export default function SuccessCheckmark({ size = 64, className, showRing = true }) {
  return (
    <div className={`relative inline-flex items-center justify-center ${className || ''}`} style={{ width: size, height: size }}>
      {showRing && (
        <motion.span
          className="absolute inset-0 rounded-full border-2 border-emerald-500/40"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1.6, opacity: 0 }}
          transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 0.4, ease: 'easeOut' }}
        />
      )}
      <motion.span
        className="flex items-center justify-center rounded-full bg-emerald-500 text-white"
        style={{ width: size, height: size }}
        variants={variants.popIn}
        initial="initial"
        animate="animate"
        transition={transitions.bounce}
      >
        <motion.span
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.15, ease: 'easeOut' }}
        >
          <Check size={size * 0.5} strokeWidth={3} />
        </motion.span>
      </motion.span>
    </div>
  );
}