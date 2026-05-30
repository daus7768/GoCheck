import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const secret = req.headers.get('x-internal-secret');
  if (!secret || secret !== Deno.env.get('INTERNAL_SECRET')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { participant_id, bill_id } = await req.json() as {
    participant_id: string;
    bill_id: string;
  };

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: participant, error: pErr } = await supabase
    .from('participants')
    .select('name, amount')
    .eq('id', participant_id)
    .single();

  if (pErr || !participant) {
    return new Response(JSON.stringify({ error: 'Participant not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: bill, error: bErr } = await supabase
    .from('bills')
    .select('title, organizer_id, currency')
    .eq('id', bill_id)
    .single();

  if (bErr || !bill) {
    return new Response(JSON.stringify({ error: 'Bill not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('expo_push_token')
    .eq('id', bill.organizer_id)
    .single();

  if (!profile?.expo_push_token) {
    return new Response(JSON.stringify({ skipped: 'no push token' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const pushResponse = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      to: profile.expo_push_token,
      title: 'Payment received',
      body: `${participant.name} just paid ${bill.currency} ${participant.amount} for "${bill.title}"`,
      data: { bill_id, participant_id },
    }),
  });

  const result = await pushResponse.json();
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
