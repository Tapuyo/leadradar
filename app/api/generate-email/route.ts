import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateEmailBody } from '@/lib/generateEmail';

export async function POST(req: NextRequest) {
  const { lead, service } = await req.json();
  if (!lead || !service) return Response.json({ error: 'lead and service required' }, { status: 400 });

  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  let senderEmail = process.env.GMAIL_SENDER ?? '';
  if (session) {
    const { data: tokenRow } = await supabase
      .from('oauth_tokens')
      .select('email')
      .eq('user_id', session.user.id)
      .eq('provider', 'gmail')
      .single();
    if (tokenRow?.email) senderEmail = tokenRow.email;
  }

  const email = await generateEmailBody(lead, service, senderEmail);
  return Response.json({ email });
}
