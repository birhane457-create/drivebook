import Link from 'next/link';
import { cn } from '@/lib/utils';

interface FeaturedNavItemProps {
  label: string;
  href: string;
  icon: string;
  benefit: string;
  onClick?: () => void;
  className?: string;
}

/**
 * FeaturedNavItem Component
 * 
 * Displays navigation items with special visual treatment:
 * - Icon/emoji prefix
 * - Bold title
 * - Benefit statement in muted color
 * - Subtle hover effects
 * 
 * Used for differentiators like AI Receptionist, Custom Domain, Multi-Instructor
 */
export default function FeaturedNavItem({
  label,
  href,
  icon,
  benefit,
  onClick,
  className,
}: FeaturedNavItemProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'group flex items-start gap-3 px-4 py-3 rounded-lg',
        'hover:bg-violet-50 dark:hover:bg-violet-950/30',
        'transition-all duration-200',
        'border border-transparent hover:border-violet-200 dark:hover:border-violet-800',
        'no-underline',
        className
      )}
    >
      {/* Icon */}
      <span className="text-2xl flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
        {icon}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Title */}
        <div className="font-bold text-foreground text-sm mb-0.5 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
          {label}
        </div>
        
        {/* Benefit */}
        <div className="text-xs text-muted-foreground leading-snug">
          {benefit}
        </div>
      </div>
    </Link>
  );
}

/**
 * FeaturedNavItemCompact - For mobile or compact layouts
 */
export function FeaturedNavItemCompact({
  label,
  href,
  icon,
  benefit,
  onClick,
  className,
}: FeaturedNavItemProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'group flex items-center gap-2.5 px-3 py-2.5 rounded-lg',
        'hover:bg-violet-50 dark:hover:bg-violet-950/30',
        'transition-colors',
        'no-underline',
        className
      )}
    >
      {/* Icon */}
      <span className="text-xl flex-shrink-0">
        {icon}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Title */}
        <div className="font-semibold text-foreground text-sm group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
          {label}
        </div>
        
        {/* Benefit - single line with ellipsis */}
        <div className="text-xs text-muted-foreground truncate">
          {benefit}
        </div>
      </div>
    </Link>
  );
}
