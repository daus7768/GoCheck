import { callGemini, checkRateLimit, corsHeaders, extractJson, rateLimitResponse } from '../_shared/gemini.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Issue 5: check API key early and fail clearly
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
  if (!geminiApiKey) {
    console.error('GEMINI_API_KEY secret is not set in Supabase');
    return new Response(
      JSON.stringify({ success: false, error: 'Scan service not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!checkRateLimit(ip)) return rateLimitResponse();

  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_BYTES = 4_000_000;

  try {
    const { imageBase64, mimeType } = await req.json() as { imageBase64: string; mimeType: string };

    if (!imageBase64 || !mimeType) {
      return new Response(JSON.stringify({ success: false, error: 'Missing imageBase64 or mimeType' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!ALLOWED_TYPES.includes(mimeType)) {
      return new Response(JSON.stringify({ success: false, error: 'Use JPG, PNG, or WEBP' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Issue 1: strip data URI prefix if present (e.g. "data:image/jpeg;base64,...")
    const rawBase64: string = imageBase64.includes(',')
      ? (imageBase64.split(',')[1] ?? '')
      : imageBase64;

    if (!rawBase64) {
      return new Response(JSON.stringify({ success: false, error: 'Empty image payload' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const byteLength = Math.ceil((rawBase64.length * 3) / 4);
    if (byteLength > MAX_BYTES) {
      return new Response(JSON.stringify({ success: false, error: 'Image too large (max 4MB)' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const prompt = `You are a receipt scanner for GoCheck, a Malaysian bill-splitting app.
Analyse this receipt image and return ONLY a valid JSON object.
No markdown fences, no explanation, no text outside the JSON.

Return exactly this shape:
{
  "title": "merchant name",
  "description": "table number or occasion if visible, else null",
  "total_amount": 0.00,
  "currency": "MYR",
  "subtotal": 0.00,
  "tax_sst": false,
  "tax_sst_amount": 0.00,
  "tax_service": false,
  "tax_service_rate": 10,
  "tax_service_amount": 0.00,
  "line_items": [
    { "name": "item name", "quantity": 1, "unit_price": 0.00, "subtotal": 0.00 }
  ],
  "payment_method": "cash",
  "date": "YYYY-MM-DD",
  "confidence": 0.95
}

Rules:
- currency is MYR unless the receipt clearly states otherwise
- tax_sst is true if you see SST, GST, Government Tax, or a 6% tax line
- tax_service is true if you see Service Charge, SC, or a % service line
- total_amount is the FINAL amount paid (Grand Total, Jumlah, Amaun Dibayar)
- subtotal is before any tax or service charge
- list every single line item on the receipt
- payment_method: one of cash, card, duitnow, ewallet, bank_transfer
- date format YYYY-MM-DD; use today if not visible
- confidence: 0.0 to 1.0, your overall read accuracy for this receipt
- For unreadable strings use null; for unreadable numbers use 0.00
- Malaysian food item names are in Bahasa Melayu — read them as-is`;

    // Issue 3: log raw Gemini response before parsing
    const rawText = await callGemini(
      [{ inline_data: { mime_type: mimeType, data: rawBase64 } }, { text: prompt }],
      { temperature: 0.1, maxOutputTokens: 2000, responseMimeType: 'application/json' }
    );
    console.log('Gemini raw response:', rawText);

    let parsed;
    try {
      parsed = extractJson(rawText);
    } catch (parseErr) {
      console.error('JSON parse failed. Raw text was:', rawText);
      throw new Error('Gemini response was not valid JSON');
    }

    return new Response(JSON.stringify({ success: true, data: parsed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[gemini-scan-receipt]', detail);

    // Pass through quota errors so the UI can show a useful message.
    const isQuota = /\b429\b|quota|RESOURCE_EXHAUSTED/i.test(detail);
    return new Response(
      JSON.stringify({
        success: false,
        error: isQuota
          ? 'Gemini quota exceeded — please wait a minute and try again.'
          : 'Could not read receipt. Fill in manually.',
        detail,
      }),
      { status: isQuota ? 429 : 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
