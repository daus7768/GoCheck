import { callGemini, checkRateLimit, corsHeaders, rateLimitResponse } from '../_shared/gemini.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!checkRateLimit(ip)) return rateLimitResponse();

  try {
    const {
      title, description, category, totalAmount, currency,
      participantCount, dueDate, splitType, taxSst, taxService,
      perPersonAmount, organizerName,
    } = await req.json() as {
      title?: string; description?: string; category?: string;
      totalAmount?: number; currency?: string; participantCount?: number;
      dueDate?: string; splitType?: string; taxSst?: boolean; taxService?: boolean;
      perPersonAmount?: string; organizerName?: string;
    };

    const prompt = `Write a 2-sentence professional invoice summary for a Malaysian bill-splitting app.

Bill details:
- Title: ${title ?? 'Untitled'}
- Description: ${description ?? ''}
- Category: ${category ?? 'other'}
- Total: ${currency ?? 'MYR'} ${totalAmount ?? 0}
- Participants: ${participantCount ?? 0}
- Per person: ${currency ?? 'MYR'} ${perPersonAmount ?? 0}
- Split type: ${splitType ?? 'equal'}
- SST applied: ${taxSst ? 'yes (6%)' : 'no'}
- Service charge: ${taxService ? 'yes' : 'no'}
- Due date: ${dueDate ?? ''}
- Organizer: ${organizerName ?? ''}

Rules:
- First sentence: describe what the bill is for and the total
- Second sentence: state per-person amount and due date
- Friendly but professional tone
- Malaysian context — use natural English
- Maximum 40 words total
- No bullet points. Plain text only. Two sentences exactly.`;

    const summary = await callGemini([{ text: prompt }], { temperature: 0.5, maxOutputTokens: 400 });

    return new Response(JSON.stringify({ success: true, summary: summary.trim() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[gemini-invoice-summary]', detail);
    const isQuota = /\b429\b|quota|RESOURCE_EXHAUSTED/i.test(detail);
    return new Response(
      JSON.stringify({
        success: false,
        error: isQuota
          ? 'Gemini quota exceeded — please wait a minute and try again.'
          : 'Summary unavailable',
        detail,
      }),
      { status: isQuota ? 429 : 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
