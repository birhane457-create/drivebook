import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { ROUTE_ACCESS } from '@/lib/route-access';
import { cn } from '@/lib/utils';

/**
 * Breadcrumbs — auto-generates breadcrumb trail from the current route path.
 * Supports custom overrides via the `items` prop.
 *
 * @param {Array} items - optional override: [{ label, path }] — replaces auto generation
 * @param {Array} extra - optional trailing items appended after auto crumbs
 */
export default function Breadcrumbs({ items, extra = [], className }) {
  const location = useLocation();
  const path = location.pathname;

  // Build crumbs from path segments
  const autoCrumbs = [];
  const segments = path.split('/').filter(Boolean);

  if (segments.length === 0) {
    autoCrumbs.push({ label: 'Home', path: '/' });
  } else {
    autoCrumbs.push({ label: 'Home', path: '/' });
    let current = '';
    segments.forEach((seg, idx) => {
      current += '/' + seg;
      const routeConfig = ROUTE_ACCESS[current];
      const label = routeConfig?.label || seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ');
      autoCrumbs.push({ label, path: current, isLast: idx === segments.length - 1 });
    });
  }

  const crumbs = items || [...autoCrumbs, ...extra];

  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center gap-1 text-sm text-muted-foreground", className)}>
      {crumbs.map((crumb, idx) => {
        const isLast = idx === crumbs.length - 1;
        return (
          <span key={crumb.path || idx} className="flex items-center gap-1">
            {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />}
            {idx === 0 && <Home className="w-3.5 h-3.5 mr-0.5" />}
            {isLast || !crumb.path ? (
              <span className={cn("font-medium", isLast ? "text-foreground" : "")}>{crumb.label}</span>
            ) : (
              <Link to={crumb.path} className="hover:text-foreground transition-colors">{crumb.label}</Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}