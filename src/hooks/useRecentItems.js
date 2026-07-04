import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';

const MAX_RECENT = 15;

/**
 * useRecentItems — tracks recently visited pages/items in localStorage.
 * Returns [items, addItem, clearItems].
 *
 * @param {string} key - localStorage key (default 'wms:recent-items')
 */
export function useRecentItems(key = 'wms:recent-items') {
  const [items, setItems] = useLocalStorage(key, []);

  const addItem = useCallback((item) => {
    setItems(prev => {
      const filtered = prev.filter(i => i.path !== item.path);
      return [{ ...item, visited_at: Date.now() }, ...filtered].slice(0, MAX_RECENT);
    });
  }, [setItems]);

  const removeItem = useCallback((path) => {
    setItems(prev => prev.filter(i => i.path !== path));
  }, [setItems]);

  const clearItems = useCallback(() => setItems([]), [setItems]);

  return { items, addItem, removeItem, clearItems };
}

export default useRecentItems;