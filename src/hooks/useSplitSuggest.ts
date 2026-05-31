import { useState } from 'react';
import { supabase } from '../lib/supabase';
import type { BillCategory, Currency, LineItem } from '../types';

interface SplitSuggestion {
  recommended: string;
  reason: string;
  alternatives: string[];
}

interface SuggestArgs {
  title: string;
  description: string;
  category: BillCategory;
  totalAmount: number;
  currency: Currency;
  participantCount: number;
  lineItems: LineItem[];
}

export function useSplitSuggest() {
  const [suggestion, setSuggestion] = useState<SplitSuggestion | null>(null);
  const [loading, setLoading] = useState(false);

  async function suggest(args: SuggestArgs) {
    setLoading(true);
    setSuggestion(null);
    try {
      const { data, error } = await supabase.functions.invoke('gemini-suggest-split', {
        body: {
          title: args.title,
          description: args.description,
          category: args.category,
          totalAmount: args.totalAmount,
          currency: args.currency,
          participantCount: args.participantCount,
          lineItems: args.lineItems,
        },
      });
      if (error || !data?.success) throw new Error(data?.error ?? 'Failed');
      setSuggestion(data.data as SplitSuggestion);
    } catch (err) {
      console.error('[useSplitSuggest]', err);
    } finally {
      setLoading(false);
    }
  }

  function clear() { setSuggestion(null); }

  return { suggestion, loading, suggest, clear };
}
