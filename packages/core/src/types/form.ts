/** Form JSON - stored verbatim in postgres (mosaic_forms.schema / mosaic_pages.schema). */

/**
 * A node in the form/page component tree. Deliberately generic: the UI package
 * owns the component registry (type -> renderer + props + inspector), which keeps
 * custom components possible without touching core.
 */
export interface FormNode {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  children?: FormNode[];
  meta?: {
    name?: string;
    hidden?: boolean;
    locked?: boolean;
    /** designer-only notes */
    note?: string;
  };
}

export interface BindingExpr {
  /** expression evaluated against form data + ctx, e.g. `order.total * 0.1` */
  expr: string;
}

export type FormDataSource =
  | { kind: 'none' }
  | { kind: 'entity'; entity: string; recordId?: string; where?: Record<string, unknown> }
  | { kind: 'static'; data: Record<string, unknown> }
  | { kind: 'endpoint'; url: string; method?: 'GET' | 'POST'; body?: unknown; recordPath?: string };

export interface FormSettings {
  /** Default runtime behavior; a caller can explicitly override it. */
  mode?: 'create' | 'edit' | 'view';
  layout?: 'vertical' | 'horizontal' | 'inline';
  /** grid columns at form level (1..4) */
  columns?: number;
  submitLabel?: string;
  resetLabel?: string;
  successMessage?: string;
  errorMessage?: string;
  showReset?: boolean;
  confirmBeforeSubmit?: boolean;
  confirmMessage?: string;
  redirectAfterSubmit?: string;
  /** hide system fields (createdAt...) when rendered against an entity */
  hideSystemFields?: boolean;
  transition?: import('./platform.js').TransitionConfig;
  seo?: FormSeoSettings;
}

export interface FormSeoSettings {
  title?: string;
  description?: string;
  canonicalUrl?: string;
  robots?: 'index,follow' | 'noindex,nofollow' | 'noindex,follow' | 'index,nofollow';
  socialTitle?: string;
  socialDescription?: string;
  socialImage?: string;
}

export interface FormDef {
  id: string;
  slug: string;
  name: string;
  description?: string;
  /** Workspace folder path used by the Studio explorer (for example `sales/quotes`). */
  folder?: string;
  /** bound entity (drives data + submit target) */
  entity?: string;
  version: number;
  published: boolean;
  root: FormNode;
  dataSource?: FormDataSource;
  settings?: FormSettings;
  createdAt?: string;
  updatedAt?: string;
}

export function newFormDefinition(partial: Partial<FormDef> & { id: string; slug: string; name: string }): FormDef {
  return {
    version: 1,
    published: false,
    root: { id: `${partial.id}_root`, type: 'form', children: [] },
    dataSource: { kind: 'none' },
    settings: { layout: 'vertical', columns: 1, submitLabel: 'Submit', showReset: false },
    ...partial,
  } as FormDef;
}
