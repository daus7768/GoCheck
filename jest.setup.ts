// Override NODE_ENV back to 'test' so React loads its development build
// (babel-preset-expo sets it to 'production' when caller is metro)
process.env.NODE_ENV = 'test';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// AccessibilityInfo.isReduceMotionEnabled() is not mocked by the RN preset;
// patch it so hooks that call it don't crash in tests.
import { AccessibilityInfo } from 'react-native';
jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
