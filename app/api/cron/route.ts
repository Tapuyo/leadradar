import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { scanService } from '@/lib/scanRunner';
import { Service } from '@/types';

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { get: () => undefined, set: () => {}, remove: () => {} } }
  );

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const { data: services } = await supabase
    .from('services')
    .select('*')
    .eq('scan_enabled', true)
    .eq('scan_time', timeStr);

  if (!services || services.length === 0) {
    return Response.json({ ok: true, scanned: 0 });
  }

  const results = await Promise.allSettled(
    (services as Service[]).map(s => scanService(s, supabase as ReturnType<typeof createServerClient>))
  );

  const scanned = results.filter(r => r.status === 'fulfilled').length;
  return Response.json({ ok: true, scanned });
}
