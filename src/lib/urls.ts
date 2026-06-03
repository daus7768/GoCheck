import { Platform } from 'react-native';
import Constants from 'expo-constants';

function getBaseUrl(): string {
  const envBase = process.env.EXPO_PUBLIC_WEB_BASE_URL;
  if (envBase) return envBase.replace(/\/+$/, '');

  const configured = Constants.expoConfig?.extra?.shareBaseUrl as string | undefined;
  if (configured) return configured.replace(/\/+$/, '');

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'https://go-check.vercel.app';
}

export function participantUrl(token: string): string {
  return `${getBaseUrl()}/p/${token}`;
}
