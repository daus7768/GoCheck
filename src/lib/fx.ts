import type { Currency } from '../types';

// open.er-api.com — free, no API key, CORS-enabled (works on web + native),
// returns every rate for a base currency in one call. Covers all of
// SUPPORTED_CURRENCIES (MYR, USD, SGD, GBP, EUR, AUD).
const ENDPOINT = 'https://open.er-api.com/v6/latest';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour — FX moves slowly enough for bill splitting
const TIMEOUT_MS = 6000;

type CacheEntry = { rates: Record<string, number>; ts: number };
// Keyed by base currency; one fetch yields every target rate for that base.
const cache = new Map<string, CacheEntry>();

/** Raised when a live rate cannot be fetched. Callers fall back to relabelling. */
export class FxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FxError';
  }
}

async function fetchRates(from: Currency): Promise<Record<string, number>> {
  const hit = cache.get(from);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.rates;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${ENDPOINT}/${from}`, { signal: controller.signal });
    if (!res.ok) throw new FxError(`Rate request failed (${res.status})`);

    const data = (await res.json()) as { result?: string; rates?: Record<string, number> };
    if (data.result !== 'success' || !data.rates) {
      throw new FxError('Rate response was not successful');
    }

    cache.set(from, { rates: data.rates, ts: Date.now() });
    return data.rates;
  } catch (err) {
    if (err instanceof FxError) throw err;
    throw new FxError(err instanceof Error ? err.message : 'Network error');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Exchange rate to turn 1 unit of `from` into `to`.
 * Returns 1 when from === to. Caches the whole rate table per base for an hour.
 * Throws {@link FxError} on network / timeout / malformed-response.
 */
export async function fetchRate(from: Currency, to: Currency): Promise<number> {
  if (from === to) return 1;

  const rates = await fetchRates(from);
  const rate = rates[to];
  if (typeof rate !== 'number' || !isFinite(rate) || rate <= 0) {
    throw new FxError(`No rate available for ${from} → ${to}`);
  }
  return rate;
}

/** Convert a monetary amount by a rate, rounded to 2 decimals. */
export function convertAmount(amount: number, rate: number): number {
  return Math.round(amount * rate * 100) / 100;
}
