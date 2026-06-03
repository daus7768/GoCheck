import { Share, Platform } from 'react-native';
import Constants from 'expo-constants';
import type { Bill, Currency } from '../types';
import { CURRENCY_SYMBOLS } from '../types';

/**
 * Single source of truth for the canonical base URL used by every share
 * surface (bill /share/{code}, participant /p/{token}, OG image URLs).
 * Priority: env var → app.json expoConfig.extra → hardcoded production default.
 *
 * Exported so callers that need the bare origin (e.g., OG image URL) can avoid
 * `window.location.origin`, which on Vercel preview deployments would poison
 * the link-preview cache with the preview host.
 */
export function getCanonicalBase(): string {
  const envBase = process.env.EXPO_PUBLIC_WEB_BASE_URL;
  if (envBase) return envBase.replace(/\/+$/, '');

  const configured = Constants.expoConfig?.extra?.shareBaseUrl as string | undefined;
  if (configured) return configured.replace(/\/+$/, '');

  return 'https://go-check.vercel.app';
}

export function getBillShareUrl(shareLink: string): string {
  return `${getCanonicalBase()}/share/${shareLink}`;
}

export function formatBillAmount(amount: number, currency: Currency): string {
  const sym = CURRENCY_SYMBOLS[currency] ?? currency;
  const formatted =
    amount >= 1000
      ? amount.toLocaleString(undefined, { maximumFractionDigits: 0 })
      : amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `${sym}${formatted}`;
}

export async function shareBillLink(
  bill: Pick<Bill, 'title' | 'shareLink'>
): Promise<boolean> {
  const url = getBillShareUrl(bill.shareLink);
  const message = `Pay your share for "${bill.title}": ${url}`;

  if (Platform.OS === 'web') {
    const nav = typeof globalThis !== 'undefined' ? globalThis.navigator : undefined;
    if (nav?.share) {
      await nav.share({ title: bill.title, text: message, url });
      return true;
    }
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(url);
      return true;
    }
    return false;
  }

  const result = await Share.share(
    Platform.OS === 'ios'
      ? { message, url }
      : { message, title: bill.title }
  );
  return result.action !== Share.dismissedAction;
}
