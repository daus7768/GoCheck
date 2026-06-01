import { Platform } from 'react-native';

function getBaseUrl(): string {
  const raw = process.env.EXPO_PUBLIC_WEB_BASE_URL;
  if (raw) return raw.replace(/\/+$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'http://localhost:8081';
}

export function participantUrl(token: string): string {
  return `${getBaseUrl()}/p/${token}`;
}
