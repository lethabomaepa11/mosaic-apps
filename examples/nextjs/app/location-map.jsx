import { mapSource } from '../lib/map.js';

export default function LocationMap({ title = 'Location map', ...props }) {
  const source = mapSource(props);
  if (source?.kind === 'frame') return <iframe className="location-map" title={title} src={source.url} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />;
  if (source?.kind === 'image') return <img className="location-map" alt={title} src={source.url} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />;
  return <p>Choose a map provider and enter valid coordinates. Mapbox also requires a public token.</p>;
}
