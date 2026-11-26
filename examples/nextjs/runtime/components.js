import { getComponent, registerComponent } from '@mosaic-apps/ui';
import Map from './Map.svelte';
import OAuthSignIn from './OAuthSignIn.svelte';
import EmbeddedForm from './EmbeddedForm.svelte';
import { subform } from './original-components.js';
import './date-controls.js';

registerComponent({ ...subform, component: EmbeddedForm }, { replace: true });

// shortcut: preserve these existing Next.js widgets until the UI package ships both registrations.
if (!getComponent('map')) registerComponent({
  type: 'map', label: 'Map', category: 'Data', icon: 'mapPin', pages: true, component: Map,
  defaults: { provider: 'openstreetmap', title: 'Location map', latitude: -26.2041, longitude: 28.0473 },
  inspector: [
    { key: 'provider', label: 'Provider', kind: 'select', options: [{ value: 'openstreetmap', label: 'OpenStreetMap' }, { value: 'mapbox', label: 'Mapbox' }] },
    { key: 'title', label: 'Accessible title', kind: 'string' },
    { key: 'latitude', label: 'Latitude', kind: 'number' }, { key: 'longitude', label: 'Longitude', kind: 'number' },
    { key: 'mapboxToken', label: 'Public Mapbox token', kind: 'string' },
  ],
});
export const oauthComponentType = getComponent('oauthSignIn') ? 'oauthSignIn' : 'mosaic.oauth-sign-in';
if (!getComponent('mosaic.oauth-sign-in')) registerComponent({
  type: 'mosaic.oauth-sign-in', label: 'OAuth sign-in', category: 'Navigation', icon: 'keyRound', pages: true, component: OAuthSignIn,
  defaults: { provider: 'all', next: '/' },
  inspector: [
    { key: 'provider', label: 'Provider', kind: 'select', options: [{ value: 'all', label: 'All configured providers' }, { value: 'google', label: 'Google' }, { value: 'github', label: 'GitHub' }] },
    { key: 'next', label: 'After sign-in', kind: 'string' },
  ],
});

// Register project components here to use them in Studio and published artifacts.
