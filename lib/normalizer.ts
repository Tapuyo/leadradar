import { RawLead } from '@/types';

export function normalizeRawLead(raw: RawLead): RawLead {
  return {
    name: raw.name?.trim() || 'Unknown',
    address: raw.address?.trim() || null,
    latitude: raw.latitude ?? null,
    longitude: raw.longitude ?? null,
    phone: raw.phone?.trim() || null,
    email: raw.email?.trim().toLowerCase() || null,
    description: raw.description ? raw.description.trim().slice(0, 500) : null,
    source: raw.source,
    source_url: raw.source_url?.trim() || null,
  };
}
