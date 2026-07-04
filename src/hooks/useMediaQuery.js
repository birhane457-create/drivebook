import { useState, useEffect } from 'react';
import { breakpoints } from '@/theme/tokens';

/** Returns true when the viewport matches the given breakpoint or wider. */
export function useMediaQuery(breakpoint = 'lg') {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${breakpoints[breakpoint] || breakpoint}px)`);
    const onChange = () => setMatches(query.matches);
    query.addEventListener('change', onChange);
    setMatches(query.matches);
    return () => query.removeEventListener('change', onChange);
  }, [breakpoint]);
  return matches;
}

/** Convenience: returns true below the md breakpoint (768px). */
export function useIsTablet() {
  return !useMediaQuery('md');
}