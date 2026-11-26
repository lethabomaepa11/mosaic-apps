import './style.css';
import { mount, unmount } from 'svelte';
import Artifact from './Artifact.svelte';
import { oauthComponentType } from './components.js';

function adaptNode(node) {
  if (node.type === 'oauthSignIn') node.type = oauthComponentType;
  node.children?.forEach(adaptNode);
}

window.mountMosaicArtifact = (target, props) => {
  const definition = structuredClone(props);
  const root = (definition.page ?? definition.form)?.root;
  if (root && oauthComponentType !== 'oauthSignIn') adaptNode(root);
  const artifact = mount(Artifact, { target, props: definition });
  return () => unmount(artifact);
};
