import { useEffect, useRef } from 'react';

/**
 * useKeyboardShortcuts — register global keyboard shortcuts.
 *
 * @param {Object} shortcuts - map of combo → handler
 *   Combo format: "mod+k" (mod = cmd/ctrl), "shift+n", "g d" (sequence),
 *   "escape", "enter", or any single key.
 * @param {Object} options
 *   - enabled: boolean (default true)
 *   - preventDefault: boolean (default true)
 *   - ignoreInputs: skip when typing in input/textarea/select (default false for mod combos, true otherwise)
 *
 * @example
 * useKeyboardShortcuts({
 *   'mod+k': () => setPaletteOpen(true),
 *   'n': () => handleNew(),
 *   'shift+/': () => setShowHelp(true),
 * });
 */
export function useKeyboardShortcuts(shortcuts, options = {}) {
  const { enabled = true, preventDefault = true, ignoreInputs = true } = options;
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    if (!enabled) return;

    const handler = (e) => {
      const target = e.target;
      const isInput = target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target?.isContentEditable;
      const usesMod = e.metaKey || e.ctrlKey;

      // Build combo string
      let combo = '';
      if (e.metaKey) combo += 'mod+';
      if (e.ctrlKey) combo += 'mod+';
      if (e.shiftKey) combo += 'shift+';
      if (e.altKey) combo += 'alt+';
      combo += e.key.toLowerCase();

      const callbacks = shortcutsRef.current;
      // Try full combo first
      if (callbacks[combo]) {
        if (ignoreInputs && isInput && !usesMod) return;
        if (preventDefault) e.preventDefault();
        callbacks[combo](e);
        return;
      }
      // Try single key (no modifiers)
      if (!usesMod && !e.shiftKey && !e.altKey && callbacks[e.key.toLowerCase()]) {
        if (ignoreInputs && isInput) return;
        if (preventDefault) e.preventDefault();
        callbacks[e.key.toLowerCase()](e);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, preventDefault, ignoreInputs]);
}

export default useKeyboardShortcuts;