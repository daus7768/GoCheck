import { useState } from 'react';
import { supabase } from '../lib/supabase';
import type { BillCategory } from '../types';

export function useTitleSuggest() {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function suggest(description: string, category: BillCategory) {
    if (!description && !category) return;
    setLoading(true);
    setSuggestions([]);
    try {
      const { data, error } = await supabase.functions.invoke('gemini-suggest-title', {
        body: { description, category },
      });
      if (error || !data?.success) throw new Error(data?.error ?? 'Failed');
      setSuggestions((data.suggestions as string[]).slice(0, 3));
    } catch (err) {
      console.error('[useTitleSuggest]', err);
    } finally {
      setLoading(false);
    }
  }

  function clear() { setSuggestions([]); }

  return { suggestions, loading, suggest, clear };
}
