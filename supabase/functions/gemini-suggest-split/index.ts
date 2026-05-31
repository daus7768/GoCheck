import { callGemini, checkRateLimit, corsHeaders, extractJson, rateLimitResponse } from '../_shared/gemini.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!checkRateLimit(ip)) return rateLimitResponse();

  try {
    const { title, description, category, totalAmount, currency, participantCount, lineItems } =
      await req.json() as {
        title?: string; description?: string; category?: string;
        totalAmount?: number; currency?: string; participantCount?: number;
        lineItems?: Array<{ description: string; quantity: number; unitPrice: number }>;
      };

    const prompt = `You are an assistant helping a group decide how to split a shared bill.

Bill context:
- Title: ${title ?? 'Untitled'}
- Description: ${description ?? 'No description'}
- Category: ${category ?? 'Other'}
- Total: ${currency ?? 'MYR'} ${totalAmount ?? 0}
- Participants: ${participantCount ?? 2}
- Line items: ${lineItems?.length ? JSON.stringify(lineItems) : 'not specified'}

Recommend the best split method. Return ONLY this JSON:
{
  "recommended": "equal",
  "reason": "one sentence explaining why, in plain English, max 15 words",
  "alternatives": ["percent", "custom"]
}

recommended must be one of: equal, custom, percent, shares`;

    const raw = await callGemini([{ text: prompt }], {
      temperature: 0.3,
      maxOutputTokens: 300,
      responseMimeType: 'application/json',
    });
    console.log('[gemini-suggest-split] raw:', raw);

    const parsed = extractJson<{ recommended: string; reason: string; alternatives: string[] }>(raw);

    return new Response(JSON.stringify({ success: true, data: parsed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[gemini-suggest-split]', detail);
    const isQuota = /\b429\b|quota|RESOURCE_EXHAUSTED/i.test(detail);
    return new Response(
      JSON.stringify({
        success: false,
        error: isQuota
          ? 'Gemini quota exceeded — please wait a minute and try again.'
          : 'Could not generate suggestion',
        detail,
      }),
      { status: isQuota ? 429 : 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
