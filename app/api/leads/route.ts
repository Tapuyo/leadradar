import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const service_id = searchParams.get('service_id');
  const status = searchParams.get('status');
  const source = searchParams.get('source');
  const min_score = searchParams.get('min_score');

  let query = supabase.from('leads').select('*').order('score', { ascending: false });

  if (service_id) query = query.eq('service_id', service_id);
  if (status) query = query.eq('status', status);
  if (source) query = query.eq('source', source);
  if (min_score) query = query.gte('score', parseInt(min_score));

  const { data: leads, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ leads });
}
