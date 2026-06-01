import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { callGemini, checkRateLimit, corsHeaders, extractJson, rateLimitResponse } from '../_shared/gemini.ts';

interface ScanRequest {
  token: string;
  imageBase64: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
}

interface GeminiExtraction {
  amount: number | null;
  currency: string | null;
  reference: string | null;
  bank: string | null;
  date: string | null;
  confidence: number;
}

interface PersistedExtraction extends GeminiExtraction {
  matchesExpected: boolean;
}

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const MAX_BYTES = 4_000_000;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function extToMime(mime: string): 'jpg' | 'png' | 'webp' {
  return mime === 'image/jpeg' ? 'jpg' : mime === 'image/png' ? 'png' : 'webp';
}

function buildSummary(e: PersistedExtraction, expected: number): string {
  if (e.confidence < 0.7 || e.amount == null) {
    return 'Could not read amount confidently — please review manually';
  }
  const amountStr = `RM ${e.amount.toFixed(2)}`;
  const fromBank = e.bank ? ` from ${e.bank}` : '';
  const refStr = e.reference ? `, ref ${e.reference}` : '';
  if (e.matchesExpected) {
    return `Receipt${fromBank}, ${amountStr}${refStr} — matches expected ✓`;
  }
  return `Receipt${fromBank} shows ${amountStr} — expected RM ${expected.toFixed(2)}`;
}

const PROMPT = `You are analysing a Malaysian bank transfer or e-wallet payment receipt
screenshot. Extract the payment details and return ONLY a JSON object.
No markdown fences, no explanation, no text outside the JSON.

Return exactly this shape:
{
  "amount": 0.00,
  "currency": "MYR",
  "reference": "transaction reference / receipt number, or null",
  "bank": "bank or e-wallet name (e.g. Maybank, Touch 'n Go, GrabPay, Boost, DuitNow), or null",
  "date": "YYYY-MM-DD",
  "confidence": 0.0
}

Rules:
- amount is the AMOUNT TRANSFERRED to the recipient, not the sender's
  balance. Look for "Amount", "Jumlah", "Transfer Amount".
- currency defaults to MYR unless the receipt clearly shows otherwise.
- reference is the transaction ID, receipt number, or DuitNow reference.
  If multiple candidates, prefer the one labelled "Reference" or "Ref".
- bank is the sending bank or e-wallet provider name as shown.
- date is the transfer date in YYYY-MM-DD; use today if not visible.
- confidence is your overall read accuracy (0.0 to 1.0).
  Lower it if the image is blurry, partial, or doesn't look like a
  payment receipt at all.
- For unreadable strings use null. For unreadable amount use 0.`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Gemini key check
  if (!Deno.env.get('GEMINI_API_KEY')) {
    return jsonResponse({ success: false, error: 'Scan service not configured' }, 500);
  }

  // Rate limit (per IP, 30/min via shared helper)
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!checkRateLimit(ip)) return rateLimitResponse();

  // Parse + validate
  let body: ScanRequest;
  try {
    body = await req.json() as ScanRequest;
  } catch {
    return jsonResponse({ success: false, error: 'Invalid request body' }, 400);
  }
  if (!body?.token || !isUuid(body.token)) {
    return jsonResponse({ success: false, error: 'Invalid token' }, 400);
  }
  if (!body.imageBase64 || !body.mimeType) {
    return jsonResponse({ success: false, error: 'Missing imageBase64 or mimeType' }, 400);
  }
  if (!ALLOWED_MIMES.includes(body.mimeType)) {
    return jsonResponse({ success: false, error: 'Use JPG, PNG, or WebP' }, 400);
  }

  // Strip data-URI prefix if present
  const rawBase64 = body.imageBase64.includes(',')
    ? (body.imageBase64.split(',')[1] ?? '')
    : body.imageBase64;
  if (!rawBase64) {
    return jsonResponse({ success: false, error: 'Empty image payload' }, 400);
  }
  const byteLength = Math.ceil((rawBase64.length * 3) / 4);
  if (byteLength > MAX_BYTES) {
    return jsonResponse({ success: false, error: 'Image too large (max 4 MB)' }, 400);
  }

  // Service-role client for DB + Storage
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Look up participant
  const { data: participant, error: pErr } = await supabase
    .from('participants')
    .select('id, bill_id, amount')
    .eq('access_token', body.token)
    .single();
  if (pErr || !participant) {
    return jsonResponse({ success: false, error: 'Invalid token' }, 404);
  }
  const participantId: string = participant.id;
  const expectedAmount: number = Number(participant.amount);

  // Call Gemini
  let rawText: string;
  try {
    rawText = await callGemini(
      [{ inline_data: { mime_type: body.mimeType, data: rawBase64 } }, { text: PROMPT }],
      { temperature: 0.1, maxOutputTokens: 800, responseMimeType: 'application/json' },
    );
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[scan-payment-proof] gemini call failed:', detail);
    const isQuota = /\b429\b|quota|RESOURCE_EXHAUSTED/i.test(detail);
    return jsonResponse({
      success: false,
      error: isQuota
        ? 'AI scan unavailable, you can still confirm without proof'
        : 'Could not read receipt, you can still confirm without proof',
    });
  }

  let extracted: GeminiExtraction;
  try {
    extracted = extractJson<GeminiExtraction>(rawText);
  } catch (err) {
    console.error('[scan-payment-proof] JSON parse failed. Raw:', rawText);
    return jsonResponse({
      success: false,
      error: 'Could not read receipt, you can still confirm without proof',
    });
  }

  const matchesExpected =
    typeof extracted.amount === 'number' &&
    extracted.confidence >= 0.7 &&
    Math.abs(extracted.amount - expectedAmount) <= 0.1;
  const persisted: PersistedExtraction = { ...extracted, matchesExpected };
  const summary = buildSummary(persisted, expectedAmount);

  // Upload to Storage (overwrite via upsert)
  const ext = extToMime(body.mimeType);
  const proofPath = `${participantId}/proof.${ext}`;
  const bytes = Uint8Array.from(atob(rawBase64), c => c.charCodeAt(0));

  const { error: upErr } = await supabase.storage
    .from('payment-proofs')
    .upload(proofPath, bytes, { contentType: body.mimeType, upsert: true });
  if (upErr) {
    console.error('[scan-payment-proof] storage upload failed:', upErr.message);
    return jsonResponse({ success: false, error: 'Upload failed, try again' });
  }

  // Persist to participant row
  const { error: dbErr } = await supabase
    .from('participants')
    .update({
      proof_url: proofPath,
      proof_extracted: persisted,
      proof_summary: summary,
    })
    .eq('id', participantId);
  if (dbErr) {
    console.error('[scan-payment-proof] DB update failed:', dbErr.message);
    return jsonResponse({ success: false, error: 'Could not save proof' });
  }

  return jsonResponse({
    success: true,
    summary,
    extracted: persisted,
    proofUrl: proofPath,
  });
});
