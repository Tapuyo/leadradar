import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { scanService, ScanLogger } from '@/lib/scanRunner';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { service_id } = await req.json();
  if (!service_id) return Response.json({ error: 'service_id required' }, { status: 400 });

  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('user_id', session.user.id)
    .single();

  if (!company) return Response.json({ error: 'Company not found' }, { status: 404 });

  const { data: service, error: svcError } = await supabase
    .from('services')
    .select('*')
    .eq('id', service_id)
    .eq('company_id', company.id)
    .single();

  if (svcError || !service) return Response.json({ error: 'Service not found' }, { status: 404 });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const log: ScanLogger = (message, level = 'info') => {
        send({ type: 'log', message, level });
      };

      try {
        const leads = await scanService(service, undefined, log);
        send({ type: 'complete', leads, count: leads.length });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Scan failed';
        send({ type: 'error', message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
