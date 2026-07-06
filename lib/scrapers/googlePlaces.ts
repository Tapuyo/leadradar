import { RawLead } from '@/types';

interface PlaceResult {
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  nationalPhoneNumber?: string;
  websiteUri?: string;
  primaryTypeDisplayName?: { text?: string };
  editorialSummary?: { text?: string };
}

export async function searchBusinessesGoogle(
  keyword: string,
  city: string,
  state: string
): Promise<RawLead[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_MAPS_API_KEY is not set in .env.local');

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': [
        'places.displayName',
        'places.formattedAddress',
        'places.location',
        'places.nationalPhoneNumber',
        'places.websiteUri',
        'places.primaryTypeDisplayName',
        'places.editorialSummary',
      ].join(','),
    },
    body: JSON.stringify({
      textQuery: state ? `${keyword} in ${city}, ${state}` : `${keyword} in ${city}`,
      maxResultCount: 20,
      languageCode: 'en',
    }),
  });

  if (!res.ok) throw new Error(`Google Places API failed: ${res.status}`);
  const data = await res.json() as { places?: PlaceResult[] };

  return (data.places ?? []).map((place) => ({
    name: place.displayName?.text ?? 'Unknown',
    address: place.formattedAddress ?? null,
    latitude: place.location?.latitude ?? null,
    longitude: place.location?.longitude ?? null,
    phone: place.nationalPhoneNumber ?? null,
    email: null,
    description:
      place.editorialSummary?.text ??
      place.primaryTypeDisplayName?.text ??
      null,
    source: 'google' as const,
    source_url: place.websiteUri ?? null,
  }));
}
