import { useEffect, useState, useMemo } from 'react';
import { View, Pressable, StyleSheet, LayoutChangeEvent } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { typography, fontSize, spacing, radius, animation } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/ThemeContext';
import { useReminderStore } from '../../src/store/reminderStore';
import { useBillStore } from '../../src/store/billStore';
import { buildQueueItems } from '../../src/lib/queueUtils';
import { useProfileStore } from '../../src/store/profileStore';
import { QueuePane } from '../../src/components/reminders/QueuePane';
import { SentPane } from '../../src/components/reminders/SentPane';
import { SettingsPane } from '../../src/components/reminders/SettingsPane';
import { AppText } from '../../src/components/AppText';

type Tab = 'queue' | 'sent' | 'settings';
const TABS: { value: Tab; label: string }[] = [
  { value: 'queue', label: 'Queue' },
  { value: 'sent', label: 'Sent' },
  { value: 'settings', label: 'Settings' },
];

export default function RemindersScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>('queue');
  const organizerId = useProfileStore(s => s.session?.user.id) ?? '';
  const { sent, settings, loadReminders, loadSettings } = useReminderStore();
  const { bills } = useBillStore();

  const { colors } = useTheme();

  const segWidth = useSharedValue(0);
  const pillX = useSharedValue(0);
  const tabIndex = TABS.findIndex((t) => t.value === activeTab);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = (e.nativeEvent.layout.width - 8) / TABS.length;
    segWidth.value = w;
    pillX.value = tabIndex * w + 4;
  };

  useEffect(() => {
    if (segWidth.value > 0) {
      pillX.value = withSpring(tabIndex * segWidth.value + 4, animation.springSnappy);
    }
  }, [tabIndex]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
    width: segWidth.value,
  }));

  useEffect(() => {
    loadReminders();
    loadSettings();
  }, []);

  const { items: queueItems } = useMemo(
    () => buildQueueItems(bills, sent, settings, organizerId),
    [bills, sent, settings, organizerId]
  );
  const badgeCount = queueItems.length;

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing[4] }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="arrow-left" size={22} color={colors.textPrimary} />
        </Pressable>
        <AppText style={[styles.title, { color: colors.textPrimary }]}>Reminders</AppText>
        <View style={styles.headerRight} />
      </View>

      {/* Segmented tabs */}
      <View style={[styles.tabBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={[styles.tabContainer, { backgroundColor: colors.gray100 }]} onLayout={onLayout}>
          <Animated.View style={[styles.tabPill, { backgroundColor: colors.surface }, pillStyle]} />
          {TABS.map((tab) => {
            const isActive = tab.value === activeTab;
            return (
              <Pressable
                key={tab.value}
                style={styles.tabSegment}
                onPress={() => setActiveTab(tab.value)}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
              >
                <AppText style={[
                  styles.tabLabel,
                  { color: isActive ? colors.textPrimary : colors.textSecondary },
                  isActive && styles.tabLabelActive,
                ]}>
                  {tab.value === 'queue' && badgeCount > 0
                    ? `Queue (${badgeCount})`
                    : tab.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Pane */}
      <View style={[styles.pane, { borderTopColor: colors.border }]}>
        {activeTab === 'queue' && <QueuePane organizerId={organizerId} />}
        {activeTab === 'sent' && <SentPane />}
        {activeTab === 'settings' && <SettingsPane organizerId={organizerId} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Transparent so the global background from RootLayout shows
  // through; the opaque header below + per-card surfaces handle legibility.
  container: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: typography.sansBold,
    fontSize: fontSize.lg,
  },
  headerRight: { width: 36 },
  tabBar: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
    borderBottomWidth: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    padding: 4,
    position: 'relative',
    height: 44,
  },
  tabPill: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    borderRadius: radius.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  tabSegment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  tabLabel: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.sm,
  },
  tabLabelActive: {
    fontFamily: typography.sansSemiBold,
  },
  pane: { flex: 1 },
});
