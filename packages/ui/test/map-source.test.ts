import assert from 'node:assert/strict';
import test from 'node:test';
import { mapSource } from '../src/lib/map-source.js';

test('maps use the selected provider and require a public token for Mapbox', () => {
  const location = { latitude: -26.2041, longitude: 28.0473 };
  const osm = mapSource(location)!;
  assert.equal(osm.kind, 'embed');
  assert.equal(new URL(osm.url).searchParams.get('marker'), '-26.2041,28.0473');
  assert.equal(mapSource({ ...location, provider: 'mapbox', mapboxToken: 'sk.secret' }), undefined);
  const mapbox = mapSource({ ...location, provider: 'mapbox', mapboxToken: 'pk.public' })!;
  assert.equal(mapbox.kind, 'image');
  assert.equal(new URL(mapbox.url).hostname, 'api.mapbox.com');
  assert.equal(mapSource({ ...location, latitude: Number.NaN }), undefined);
});
