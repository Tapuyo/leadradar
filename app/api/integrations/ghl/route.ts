import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { testGhlConnection } from '@/lib/ghl';

async function getCompanyId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from('companies')
    .select('id')
    .eq('user_id', userId)
    .single();
  return data?.id ?? null;
}

// GET — fetch current GHL integration config (without exposing the full key)
export async function GET() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const companyId = await getCompanyId(supabase, session.user.id);
  if (!companyId) return Response.json({ error: 'Company not found' }, { status: 404 });

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await admin
    .from('integrations')
    .select('config, created_at')
    .eq('company_id', companyId)
    .eq('provider', 'ghl')
    .single();

  if (!data) return Response.json({ connected: false });

  // Mask the API key — only expose last 4 chars
  const key: string = data.config?.api_key ?? '';
  return Response.json({
    connected: !!key,
    api_key_hint: key ? `••••••••${key.slice(-4)}` : null,
    created_at: data.created_at,
  });
}

// POST — save GHL API key (and optionally test it)
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const companyId = await getCompanyId(supabase, session.user.id);
  if (!companyId) return Response.json({ error: 'Company not found' }, { status: 404 });

  const { api_key, test } = await req.json();
  if (!api_key?.trim()) return Response.json({ error: 'API key is required' }, { status: 400 });

  // Optionally test the key before saving
  if (test) {
    const result = await testGhlConnection(api_key.trim());
    if (!result.ok) {
      return Response.json({ error: `Connection failed: ${result.error}` }, { status: 400 });
    }
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await admin
    .from('integrations')
    .upsert(
      { company_id: companyId, provider: 'ghl', config: { api_key: api_key.trim() } },
      { onConflict: 'company_id,provider' }
    );

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}

// DELETE — disconnect GHL
export async function DELETE() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const companyId = await getCompanyId(supabase, session.user.id);
  if (!companyId) return Response.json({ error: 'Company not found' }, { status: 404 });

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  await admin
    .from('integrations')
    .delete()
    .eq('company_id', companyId)
    .eq('provider', 'ghl');

  return Response.json({ ok: true });
}
