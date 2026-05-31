// Shared Gemini utility for all GoCheck edge functions.
// GEMINI_API_KEY must be set as a Supabase secret — never hardcode it.

const GEMINI_BASE =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

export async function callGemini(
  parts: GeminiPart[],
  options?: {
    temperature?: number;
    maxOutputTokens?: number;
    /** Set to 'application/json' to force the model to emit valid JSON only. */
    responseMimeType?: 'application/json' | 'text/plain';
  }
): Promise<string> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const generationConfig: Record<string, unknown> = {
    temperature: options?.temperature ?? 0.2,
    maxOutputTokens: options?.maxOutputTokens ?? 1000,
    // Disable Gemini 2.5's hidden "thinking" budget — otherwise low maxOutputTokens
    // gets consumed by reasoning and the model returns nothing.
    thinkingConfig: { thinkingBudget: 0 },
  };
  if (options?.responseMimeType) {
    generationConfig.responseMimeType = options.responseMimeType;
  }

  const res = await fetch(`${GEMINI_BASE}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('[Gemini] API error:', res.status, errText);
    throw new Error(`Gemini API returned ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const candidate = data?.candidates?.[0];
  const text: string = candidate?.content?.parts?.[0]?.text ?? '';
  const finishReason = candidate?.finishReason;
  if (!text) {
    console.error('[Gemini] empty text. finishReason:', finishReason, 'full:', JSON.stringify(data).slice(0, 500));
    throw new Error(`Gemini returned empty response (finishReason=${finishReason ?? 'unknown'})`);
  }
  return text.replace(/```json|```/g, '').trim();
}

/**
 * Extracts the first JSON object or array from a model's free-form response.
 * Survives stray prose, code fences that the stripper missed, leading lists,
 * and trailing apologies. Throws if no valid JSON can be located.
 */
export function extractJson<T = unknown>(raw: string): T {
  const trimmed = raw.trim();

  // Try direct parse first (the happy path).
  try {
    return JSON.parse(trimmed) as T;
  } catch { /* fall through */ }

  // Find the widest balanced JSON object/array by scanning braces/brackets.
  const candidates: { open: string; close: string }[] = [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
  ];
  for (const { open, close } of candidates) {
    const start = trimmed.indexOf(open);
    const end = trimmed.lastIndexOf(close);
    if (start !== -1 && end > start) {
      const slice = trimmed.slice(start, end + 1);
      try {
        return JSON.parse(slice) as T;
      } catch { /* try next */ }
    }
  }

  throw new Error(`extractJson: no valid JSON in: ${trimmed.slice(0, 200)}`);
}

// ─── In-memory rate limiter (per IP, 10 req/min) ─────────────────────────────

const counts = new Map<string, { count: number; reset: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = counts.get(ip);
  if (!entry || now > entry.reset) {
    counts.set(ip, { count: 1, reset: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_PER_WINDOW) return false;
  entry.count++;
  return true;
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function rateLimitResponse(): Response {
  return new Response(
    JSON.stringify({ success: false, error: 'Too many requests. Please wait a moment.' }),
    { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
