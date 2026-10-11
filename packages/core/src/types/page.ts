import type { FormNode, FormSeoSettings } from './form.js';

/** Page JSON - a composed layout of components (tables, forms, charts, ...). */

export interface PageMenuConfig {
  show?: boolean;
  order?: number;
  group?: string;
  icon?: string;
}

export interface PageSettings {
  title?: string;
  requiresAuth?: boolean;
  layout?: 'default' | 'bare';
  menu?: PageMenuConfig;
  description?: string;
  transition?: import('./platform.js').TransitionConfig;
  seo?: FormSeoSettings;
}

export interface PageDef {
  id: string;
  slug: string;
  /** app route, e.g. `/dashboard` or `/orders/:id` */
  route: string;
  name: string;
  description?: string;
  /** Workspace folder path used by the Studio explorer (for example `sales/quotes`). */
  folder?: string;
  version: number;
  published: boolean;
  root: FormNode;
  settings?: PageSettings;
  createdAt?: string;
  updatedAt?: string;
}

export function newPageDefinition(partial: Partial<PageDef> & { id: string; slug: string; name: string }): PageDef {
  return {
    route: `/${partial.slug}`,
    version: 1,
    published: false,
    root: { id: `${partial.id}_root`, type: 'page', children: [] },
    settings: { layout: 'default' },
    ...partial,
  } as PageDef;
}
