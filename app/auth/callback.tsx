import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '../../src/theme/tokens';

export default function AuthCallback() {
  // AuthGuard in _layout.tsx detects the session from the URL hash
  // (detectSessionInUrl: true on web) and redirects to /(tabs) automatically.
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
