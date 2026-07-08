import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { fetchGmailInboxReplies } from '@/lib/gmail';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Grab Gmail refresh token
  const { data: tokenRow } = await admin
    .from('oauth_tokens')
    .select('refresh_token')
    .eq('user_id', session.user.id)
    .single();

  if (!tokenRow?.refresh_token) {
    return Response.json({ error: 'Gmail not connected', needs_auth: true }, { status: 403 });
  }

  // Get the user's company
  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('user_id', session.user.id)
    .single();

  if (!company) return Response.json({ error: 'Company not found' }, { status: 404 });

  // Collect unique lead emails from sent_emails (filtered by service if provided)
  const service_id = req.nextUrl.searchParams.get('service_id');

  let q = supabase
    .from('sent_emails')
    .select('lead_email')
    .eq('company_id', company.id)
    .not('lead_email', 'is', null);

  if (service_id) q = q.eq('service_id', service_id);

  const { data: sent } = await q;
  const leadEmails = [
    ...new Set((sent ?? []).map(r => r.lead_email).filter(Boolean) as string[]),
  ];

  try {
    const received = await fetchGmailInboxReplies(tokenRow.refresh_token, leadEmails);
    return Response.json({ received });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (msg.toLowerCase().includes('insufficient') || msg.toLowerCase().includes('scope')) {
      return Response.json(
        { error: 'Gmail needs re-authorization to read inbox. Reconnect Gmail in Settings.', needs_reauth: true },
        { status: 403 }
      );
    }
    return Response.json({ error: msg }, { status: 500 });
  }
}
