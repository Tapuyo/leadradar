import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: company } = await supabase
    .from('companies').select('id').eq('user_id', session.user.id).single();
  if (!company) return Response.json({ error: 'Company not found' }, { status: 404 });

  const service_id = req.nextUrl.searchParams.get('service_id');
  let query = supabase.from('email_templates').select('*').eq('company_id', company.id).order('created_at');
  if (service_id) query = query.eq('service_id', service_id);

  const { data: templates, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ templates });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: company } = await supabase
    .from('companies').select('id').eq('user_id', session.user.id).single();
  if (!company) return Response.json({ error: 'Company not found' }, { status: 404 });

  const { service_id, name, subject, body, html_body, design } = await req.json();
  if (!service_id || !name || !subject || !body) {
    return Response.json({ error: 'service_id, name, subject and body are required' }, { status: 400 });
  }

  const { data: template, error } = await supabase
    .from('email_templates')
    .insert({ service_id, company_id: company.id, name, subject, body, html_body: html_body ?? null, design: design ?? null })
    .select().single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ template }, { status: 201 });
}
