import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const mq =
        typeof window !== 'undefined'
          ? window.matchMedia('(prefers-reduced-motion: reduce)')
          : null;
      const update = () => setReduceMotion(mq?.matches ?? false);
      update();
      mq?.addEventListener('change', update);
      return () => mq?.removeEventListener('change', update);
    }

    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(enabled);
      })
      .catch(() => {});

    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion
    );
    return () => {
      mounted = false;
      sub?.remove();
    };
  }, []);

  return reduceMotion;
}
