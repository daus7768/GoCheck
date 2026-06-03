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
  // Newline before the URL helps WhatsApp / iMessage detect it as a link
  // and render the preview card cleanly instead of running it into the sentence.
  const message = `Hi! Here's your share for "${bill.title}" — tap to view and pay:\n${url}`;

  if (Platform.OS === 'web') {
    const nav = typeof globalThis !== 'undefined' ? globalThis.navigator : undefined;
    if (nav?.share) {
      // Pass only `text` — the message already contains the URL. Passing both
      // `text` and `url` causes WhatsApp / share targets to concatenate them
      // and the link appears twice.
      await nav.share({ title: bill.title, text: message });
      return true;
    }
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(url);
      return true;
    }
    return false;
  }

  // Same reasoning for iOS Share.share: { message, url } produces a duplicated
  // link. The message already embeds the URL.
  const result = await Share.share({ message, title: bill.title });
  return result.action !== Share.dismissedAction;
}
