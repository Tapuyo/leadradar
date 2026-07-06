import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('user_id', session.user.id)
    .single();

  if (!company) return Response.json({ error: 'Company not found' }, { status: 404 });

  const { searchParams } = req.nextUrl;
  const service_id = searchParams.get('service_id');

  let query = supabase
    .from('sent_emails')
    .select('*')
    .eq('company_id', company.id)
    .order('sent_at', { ascending: false });

  if (service_id) query = query.eq('service_id', service_id);

  const { data: sent_emails, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ sent_emails });
}

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

  const body = await req.json();
  const { lead_id, service_id, lead_name, lead_email, subject, body: emailBody } = body;

  if (!emailBody || !lead_name) {
    return Response.json({ error: 'lead_name and body are required' }, { status: 400 });
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await admin
    .from('sent_emails')
    .insert({
      company_id: company.id,
      lead_id: lead_id ?? null,
      service_id: service_id ?? null,
      lead_name,
      lead_email: lead_email ?? null,
      subject: subject ?? null,
      body: emailBody,
    })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ sent_email: data });
}
