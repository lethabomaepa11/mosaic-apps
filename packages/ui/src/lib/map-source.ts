export function mapSource(options: { provider?: string; latitude?: number; longitude?: number; mapboxToken?: string }) {
  const { provider, latitude, longitude, mapboxToken } = options;
  if (typeof latitude !== 'number' || !Number.isFinite(latitude) || Math.abs(latitude) > 85
    || typeof longitude !== 'number' || !Number.isFinite(longitude) || Math.abs(longitude) > 180) return undefined;
  if (provider === 'mapbox') {
    if (!mapboxToken || !/^pk\.[a-zA-Z0-9_.-]+$/.test(mapboxToken)) return undefined;
    const url = new URL(`https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-s+2954a3(${longitude},${latitude})/${longitude},${latitude},13/720x360`);
    url.searchParams.set('access_token', mapboxToken);
    return { kind: 'image' as const, url: url.href };
  }
  if (provider && provider !== 'openstreetmap') return undefined;
  const url = new URL('https://www.openstreetmap.org/export/embed.html');
  url.searchParams.set('bbox', [Math.max(-180, longitude - 0.025), Math.max(-85.051, latitude - 0.018),
    Math.min(180, longitude + 0.025), Math.min(85.051, latitude + 0.018)].join(','));
  url.searchParams.set('layer', 'mapnik');
  url.searchParams.set('marker', `${latitude},${longitude}`);
  return { kind: 'embed' as const, url: url.href };
}
