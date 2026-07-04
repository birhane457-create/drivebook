import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';

/**
 * useFavorites — bookmark/favorite pages persisted in localStorage.
 * Returns { favorites, toggleFavorite, isFavorite, clearFavorites }.
 *
 * @param {string} key - localStorage key (default 'wms:favorites')
 */
export function useFavorites(key = 'wms:favorites') {
  const [favorites, setFavorites] = useLocalStorage(key, []);

  const toggleFavorite = useCallback((item) => {
    setFavorites(prev => {
      const exists = prev.some(f => f.path === item.path);
      if (exists) return prev.filter(f => f.path !== item.path);
      return [...prev, { ...item, added_at: Date.now() }];
    });
  }, [setFavorites]);

  const isFavorite = useCallback((path) => {
    return favorites.some(f => f.path === path);
  }, [favorites]);

  const removeFavorite = useCallback((path) => {
    setFavorites(prev => prev.filter(f => f.path !== path));
  }, [setFavorites]);

  const clearFavorites = useCallback(() => setFavorites([]), [setFavorites]);

  return { favorites, toggleFavorite, isFavorite, removeFavorite, clearFavorites };
}

export default useFavorites;