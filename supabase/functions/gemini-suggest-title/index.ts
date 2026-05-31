import { callGemini, checkRateLimit, corsHeaders, extractJson, rateLimitResponse } from '../_shared/gemini.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!checkRateLimit(ip)) return rateLimitResponse();

  try {
    const { description, category } = await req.json() as { description?: string; category?: string };

    if (!description && !category) {
      return new Response(JSON.stringify({ success: false, error: 'Need description or category' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const date = new Date().toLocaleDateString('en-MY', { weekday: 'long', month: 'long', day: 'numeric' });
    const prompt = `You are helping a Malaysian user create a bill title for a group payment app.

Context:
- Description: ${description ?? 'not provided'}
- Category: ${category ?? 'not provided'}
- Date: ${date}

Generate exactly 3 short, natural bill title suggestions.
Each title should be 3-6 words. Friendly and specific.
Return ONLY a JSON array of 3 strings. No markdown. No explanation.

Example output:
["Team Lunch @ Pavilion", "Friday Dinner Gathering", "Q2 Team Outing"]`;

    const raw = await callGemini([{ text: prompt }], {
      temperature: 0.8,
      maxOutputTokens: 300,
      responseMimeType: 'application/json',
    });
    console.log('[gemini-suggest-title] raw:', raw);

    const suggestions = extractJson<string[]>(raw);
    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      throw new Error('Invalid response shape');
    }

    return new Response(JSON.stringify({ success: true, suggestions: suggestions.slice(0, 3) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[gemini-suggest-title]', detail);
    const isQuota = /\b429\b|quota|RESOURCE_EXHAUSTED/i.test(detail);
    return new Response(
      JSON.stringify({
        success: false,
        error: isQuota
          ? 'Gemini quota exceeded — please wait a minute and try again.'
          : 'Could not generate suggestions',
        detail,
      }),
      { status: isQuota ? 429 : 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
