/** Shared props for the recursive node renderers (breaks the import cycle). */

import type { FormNode, TransitionConfig } from '@mosaic/core';
import type { MosaicClient } from '../client/api';

export interface NodeRendererProps {
  node: FormNode;
  /** resolve visibility from expression (optional - FormRenderer supplies) */
  visible?: (node: FormNode) => boolean;
  disabled?: (node: FormNode) => boolean;
  client?: MosaicClient;
  data?: Record<string, unknown>;
  errors?: Record<string, string>;
  onField?: (binding: string, value: unknown) => void;
  transition?: TransitionConfig;
  mode?: 'create' | 'edit' | 'view';
}

export interface NodeChildrenProps {
  nodes: FormNode[];
  visible?: (node: FormNode) => boolean;
  disabled?: (node: FormNode) => boolean;
  client?: MosaicClient;
  data?: Record<string, unknown>;
  errors?: Record<string, string>;
  onField?: (binding: string, value: unknown) => void;
  transition?: TransitionConfig;
  mode?: 'create' | 'edit' | 'view';
}
