import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: service, error } = await supabase
    .from('services')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !service) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json({ service });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();

  // Attempt update with email_journey; if the column doesn't exist yet fall back without it
  let { data: service, error } = await supabase
    .from('services')
    .update(body)
    .eq('id', id)
    .select()
    .single();

  if (error?.message?.includes('email_journey')) {
    const { email_journey: _dropped, ...bodyWithout } = body;
    const fallback = await supabase
      .from('services')
      .update(bodyWithout)
      .eq('id', id)
      .select()
      .single();
    service = fallback.data;
    error = fallback.error;
  }

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ service });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // Delete all leads for this service first
  const { error: leadsError } = await supabase.from('leads').delete().eq('service_id', id);
  if (leadsError) return Response.json({ error: leadsError.message }, { status: 500 });

  const { error } = await supabase.from('services').delete().eq('id', id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
