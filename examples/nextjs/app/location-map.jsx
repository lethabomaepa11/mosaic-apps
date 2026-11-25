export default function LocationMap({ provider = 'openstreetmap', title = 'Location map', latitude, longitude, mapboxToken }) {
  const valid = Number.isFinite(latitude) && Math.abs(latitude) <= 85 && Number.isFinite(longitude) && Math.abs(longitude) <= 180;
  if (valid && provider === 'openstreetmap') {
    const url = new URL('https://www.openstreetmap.org/export/embed.html');
    url.searchParams.set('bbox', [Math.max(-180, longitude - 0.025), Math.max(-85.051, latitude - 0.018),
      Math.min(180, longitude + 0.025), Math.min(85.051, latitude + 0.018)].join(','));
    url.searchParams.set('layer', 'mapnik');
    url.searchParams.set('marker', `${latitude},${longitude}`);
    return <iframe className="location-map" title={title} src={url.href} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />;
  }
  if (valid && provider === 'mapbox' && typeof mapboxToken === 'string' && /^pk\.[a-zA-Z0-9_.-]+$/.test(mapboxToken)) {
    const url = new URL(`https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-s+2954a3(${longitude},${latitude})/${longitude},${latitude},13/720x360`);
    url.searchParams.set('access_token', mapboxToken);
    return <img className="location-map" alt={title} src={url.href} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />;
  }
  return <p>Choose a map provider and enter valid coordinates. Mapbox also requires a public token.</p>;
}
