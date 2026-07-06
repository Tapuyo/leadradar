import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/resend';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('user_id', session.user.id)
    .single();

  if (!company) return Response.json({ error: 'Company not found' }, { status: 404 });

  const { lead_id, service_id, lead_name, lead_email, subject, body, html_body, test_send } = await req.json();

  if (!body) return Response.json({ error: 'Email body is required' }, { status: 400 });

  const from = process.env.GMAIL_SENDER!;
  // test_send=true: send to the provided lead_email directly (no override)
  const to = test_send ? lead_email : (process.env.GMAIL_TEST_RECIPIENT ?? lead_email);

  if (!to) return Response.json({ error: 'No recipient address available' }, { status: 400 });

  try {
    await sendEmail({ from, to, subject: subject ?? `Reaching out from ${from}`, body, htmlBody: html_body ?? null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to send email';
    return Response.json({ error: message }, { status: 500 });
  }

  // Only record in sent_emails for real sends (not test sends)
  if (!test_send) {
    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    await admin.from('sent_emails').insert({
      company_id: company.id,
      lead_id: lead_id ?? null,
      service_id: service_id ?? null,
      lead_name: lead_name ?? 'Unknown',
      lead_email: to,
      subject: subject ?? null,
      body,
    });
  }

  return Response.json({ ok: true });
}
