import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/**
 * On web, registers a `keydown` listener that calls `onClose()` when
 * the Escape key is pressed while `enabled` is true. No-op on native —
 * RN Modal already handles Android back via `onRequestClose`.
 *
 * `onClose` is captured in a ref so consumers can pass inline arrow
 * functions without causing the listener to re-attach on every render.
 * The listener only (de)registers when `enabled` changes.
 */
export function useWebEscape(enabled: boolean, onClose: () => void): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [enabled]);
}
