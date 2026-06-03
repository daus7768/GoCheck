import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * On web, registers a `keydown` listener that calls `onClose()` when
 * the Escape key is pressed while `enabled` is true. No-op on native
 * (RN Modal already handles Android back via `onRequestClose`).
 */
export function useWebEscape(enabled: boolean, onClose: () => void): void {
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [enabled, onClose]);
}
