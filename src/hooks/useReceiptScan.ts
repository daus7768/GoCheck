import { useState } from 'react';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../lib/supabase';
import type { GeminiScanResult } from '../types';

export type ScanState = 'idle' | 'converting' | 'scanning' | 'review' | 'error';

/**
 * Universal image-to-base64 reader. Handles every URI flavour we've seen from
 * expo-image-picker / expo-camera across platforms:
 *   - data:        (web / pasted)
 *   - file://      (iOS, Android)
 *   - content://   (Android system picker — copied to cache first)
 *   - blob:        (web)
 *   - http(s)://   (remote)
 */
async function readImageAsBase64(uri: string): Promise<{ base64: string; mimeType: string }> {
  console.log('[useReceiptScan] readImageAsBase64 uri:', uri.slice(0, 80));

  // 1. Already a data URL — split it.
  if (uri.startsWith('data:')) {
    const commaIdx = uri.indexOf(',');
    const header = commaIdx > -1 ? uri.slice(0, commaIdx) : '';
    const b64 = commaIdx > -1 ? uri.slice(commaIdx + 1) : '';
    return {
      base64: b64,
      mimeType: header.match(/data:([^;]+)/)?.[1] ?? 'image/jpeg',
    };
  }

  // 2. Native (iOS / Android) — use FileSystem. Copy content:// to cache first.
  if (Platform.OS !== 'web') {
    let localUri = uri;
    if (uri.startsWith('content://')) {
      const filename = `receipt_${Date.now()}.jpg`;
      const dest = `${FileSystem.cacheDirectory ?? ''}${filename}`;
      await FileSystem.copyAsync({ from: uri, to: dest });
      localUri = dest;
      console.log('[useReceiptScan] copied content:// to cache:', localUri);
    }
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const ext = localUri.split('?')[0]?.split('.').pop()?.toLowerCase();
    const mimeType =
      ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    return { base64, mimeType };
  }

  // 3. Web (blob:, http:, file:) — fetch + FileReader.
  const response = await fetch(uri);
  if (!response.ok) throw new Error(`Failed to fetch image (${response.status})`);
  const blob = await response.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
  const commaIdx = dataUrl.indexOf(',');
  const b64 = commaIdx > -1 ? dataUrl.slice(commaIdx + 1) : '';
  return {
    base64: b64,
    mimeType: blob.type || 'image/jpeg',
  };
}

export function useReceiptScan() {
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [scanResult, setScanResult] = useState<GeminiScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  async function scanReceipt(uri: string): Promise<GeminiScanResult | null> {
    setScanState('converting');
    setScanResult(null);
    setScanError(null);

    try {
      console.log('[useReceiptScan] starting scan');

      let base64: string;
      let mimeType: string;
      try {
        const out = await readImageAsBase64(uri);
        base64 = out.base64;
        mimeType = out.mimeType;
      } catch (readErr) {
        console.error('[useReceiptScan] read failed:', readErr);
        throw new Error('Could not read image file. Please try a different photo.');
      }

      // Strip data URI prefix if anything snuck through.
      const cleanBase64 = base64.includes(',') ? (base64.split(',')[1] ?? '') : base64;

      if (!cleanBase64 || cleanBase64.length === 0) {
        throw new Error('Image file is empty. Please try a different photo.');
      }
      console.log('[useReceiptScan] base64 length:', cleanBase64.length, 'mime:', mimeType);

      // Gemini accepts JPG/PNG/WEBP only — coerce HEIC and friends to jpeg.
      const allowed = ['image/jpeg', 'image/png', 'image/webp'];
      const finalMime = allowed.includes(mimeType) ? mimeType : 'image/jpeg';

      setScanState('scanning');

      // Verify session is present so the gateway accepts the JWT.
      const { data: { session } } = await supabase.auth.getSession();
      console.log('[useReceiptScan] session present:', !!session, 'user:', session?.user.id ?? 'anon');

      console.log('[useReceiptScan] invoking gemini-scan-receipt...');
      const { data, error } = await supabase.functions.invoke('gemini-scan-receipt', {
        body: { imageBase64: cleanBase64, mimeType: finalMime },
      });

      console.log('[useReceiptScan] edge function response:', { data, error });

      // supabase-js wraps non-2xx as `FunctionsHttpError` with the generic
      // "Edge Function returned a non-2xx status code" message. The real body
      // is on `error.context` (the Response). Read it so the user sees why.
      if (error) {
        let realMessage = error.message;
        const ctx = (error as { context?: Response }).context;
        if (ctx && typeof ctx.json === 'function') {
          try {
            const body = await ctx.json();
            console.log('[useReceiptScan] edge function error body:', body);
            realMessage =
              body?.error ?? body?.detail ?? body?.message ?? error.message;
            if (ctx.status === 429) {
              realMessage = 'Too many scans — please wait a minute and try again.';
            }
          } catch (readErr) {
            console.warn('[useReceiptScan] could not read error body:', readErr);
          }
        }
        throw new Error(realMessage);
      }

      if (!data?.success) {
        throw new Error(data?.error ?? 'Scan failed');
      }

      setScanResult(data.data as GeminiScanResult);
      setScanState('review');
      return data.data as GeminiScanResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Scan failed';
      console.error('[useReceiptScan] FAILED:', message);
      setScanError(message);
      setScanState('error');
      return null;
    }
  }

  function resetScan() {
    setScanState('idle');
    setScanResult(null);
    setScanError(null);
  }

  return { scanState, scanResult, scanError, scanReceipt, resetScan };
}
