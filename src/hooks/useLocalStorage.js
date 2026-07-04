import { useState, useCallback } from 'react';

/** Persists state to localStorage — survives page reloads. */
export function useLocalStorage(key, initialValue) {
  const [stored, setStored] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback((value) => {
    try {
      const next = value instanceof Function ? value(stored) : value;
      setStored(next);
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // localStorage may be unavailable (private mode) — fail silently
    }
  }, [key, stored]);

  return [stored, setValue];
}