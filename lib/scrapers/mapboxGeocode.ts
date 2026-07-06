export async function geocodeAddress(address: string) {
  const encoded = encodeURIComponent(address);
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json` +
    `?access_token=${process.env.MAPBOX_SECRET_TOKEN}&country=US&limit=1`;

  const res = await fetch(url);
  if (!res.ok) return { full_address: address, longitude: null, latitude: null };
  const data = await res.json();
  const feature = data.features?.[0];
  return {
    full_address: feature?.place_name ?? address,
    longitude: feature?.center?.[0] ?? null,
    latitude: feature?.center?.[1] ?? null,
  };
}
