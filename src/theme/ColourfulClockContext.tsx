import React, { createContext, useContext, useEffect } from 'react';
import {
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  SharedValue,
  cancelAnimation,
} from 'react-native-reanimated';
import { useReduceMotion } from '../hooks/useReduceMotion';

const ColourfulClockContext = createContext<SharedValue<number> | null>(null);

export function ColourfulClockProvider({ children }: { children: React.ReactNode }) {
  const clock = useSharedValue(0);
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(clock);
      clock.value = 0;
      return;
    }
    clock.value = withRepeat(
      withTiming(1, { duration: 4200, easing: Easing.linear }),
      -1,
      false
    );
    return () => cancelAnimation(clock);
  }, [reduceMotion]);

  return (
    <ColourfulClockContext.Provider value={clock}>
      {children}
    </ColourfulClockContext.Provider>
  );
}

export function useColourClock(): SharedValue<number> {
  const clock = useContext(ColourfulClockContext);
  if (!clock) throw new Error('useColourClock must be used within ColourfulClockProvider');
  return clock;
}
