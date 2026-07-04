import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({ size = 24, className, label }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-10 ${className || ''}`}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      >
        <Loader2 size={size} className="text-primary" />
      </motion.div>
      {label && (
        <motion.p
          className="text-sm text-muted-foreground"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          {label}
        </motion.p>
      )}
    </div>
  );
}

// Skeleton pulse block
export function Skeleton({ className = '' }) {
  return (
    <motion.div
      className={`rounded-md bg-muted ${className}`}
      animate={{ opacity: [0.5, 0.85, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

// Shimmer skeleton
export function ShimmerSkeleton({ className = '' }) {
  return (
    <div className={`relative overflow-hidden rounded-md bg-muted ${className}`}>
      <motion.div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)' }}
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}