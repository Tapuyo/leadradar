import { RawLead } from '@/types';
import { SupabaseClient } from '@supabase/supabase-js';

export async function deduplicateLeads(
  incoming: RawLead[],
  serviceId: string,
  supabase: SupabaseClient
): Promise<RawLead[]> {
  const { data: existing } = await supabase
    .from('leads')
    .select('name, address')
    .eq('service_id', serviceId);

  if (!existing || existing.length === 0) return incoming;

  const existingKeys = new Set(
    existing.map((l: { name: string; address: string | null }) =>
      `${l.name?.toLowerCase().trim()}|${l.address?.toLowerCase().trim() ?? ''}`
    )
  );

  return incoming.filter(lead => {
    const key = `${lead.name?.toLowerCase().trim()}|${lead.address?.toLowerCase().trim() ?? ''}`;
    return !existingKeys.has(key);
  });
}
