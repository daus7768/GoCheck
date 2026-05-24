import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export const haptic = {
  impact(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
    if (Platform.OS !== 'web') Haptics.impactAsync(style);
  },
  notification(type: Haptics.NotificationFeedbackType) {
    if (Platform.OS !== 'web') Haptics.notificationAsync(type);
  },
  selection() {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
  },
};

export { ImpactFeedbackStyle, NotificationFeedbackType } from 'expo-haptics';
