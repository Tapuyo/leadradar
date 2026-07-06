import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('user_id', session.user.id)
    .single();

  if (!company) return Response.json({ error: 'Company not found' }, { status: 404 });

  const { data: services, error } = await supabase
    .from('services')
    .select('*')
    .eq('company_id', company.id)
    .order('created_at', { ascending: true });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ services });
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
  const { data: service, error } = await supabase
    .from('services')
    .insert({ ...body, company_id: company.id })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ service }, { status: 201 });
}
