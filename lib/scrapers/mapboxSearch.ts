import { RawLead } from '@/types';

export async function searchBusinesses(
  keyword: string,
  city: string,
  state: string
): Promise<RawLead[]> {
  const query = state ? `${keyword} in ${city}, ${state}` : `${keyword} in ${city}`;
  const url = new URL('https://api.mapbox.com/search/searchbox/v1/forward');
  url.searchParams.set('q', query);
  url.searchParams.set('access_token', process.env.MAPBOX_SECRET_TOKEN!);
  url.searchParams.set('limit', '25');
  url.searchParams.set('types', 'poi');
  url.searchParams.set('country', 'US');

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Mapbox search failed: ${res.status}`);
  const data = await res.json();

  return (data.features ?? []).map((f: Record<string, unknown>) => {
    const props = f.properties as Record<string, unknown>;
    const geometry = f.geometry as { coordinates?: number[] };
    const metadata = props?.metadata as Record<string, unknown> | undefined;
    const poiCategory = props?.poi_category as string[] | undefined;
    return {
      name: (props?.name as string) ?? 'Unknown',
      address: (props?.full_address as string) ?? null,
      latitude: geometry?.coordinates?.[1] ?? null,
      longitude: geometry?.coordinates?.[0] ?? null,
      phone: (metadata?.phone as string) ?? null,
      email: null,
      description: poiCategory?.join(', ') ?? null,
      source: 'mapbox' as const,
      source_url: null,
    };
  });
}
