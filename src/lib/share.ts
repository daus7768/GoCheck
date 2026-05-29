import { Share, Platform } from 'react-native';
import type { Bill, Currency } from '../types';
import { CURRENCY_SYMBOLS } from '../types';

export const BILL_SHARE_BASE = 'https://gocheck.app/bill';

export function getBillShareUrl(shareLink: string): string {
  return `${BILL_SHARE_BASE}/${shareLink}`;
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
