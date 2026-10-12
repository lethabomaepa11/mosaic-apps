export type StateScope = 'application' | 'page' | 'form' | 'component';

export interface StateTarget {
  scope: StateScope;
  path: string;
}

interface ActionBase {
  id?: string;
  /** Optional safe Mosaic expression evaluated before the action runs. */
  when?: string;
}

export type ScriptLanguage = 'javascript' | 'typescript';

/**
 * Custom logic runs in Mosaic's isolated browser sandbox. It receives a
 * read-only state snapshot and returns declarative actions for the runner.
 */
export interface ScriptAction extends ActionBase {
  type: 'script';
  language?: ScriptLanguage;
  source: string;
  /** CPU deadline. The runtime clamps this to its supported range. */
  timeoutMs?: number;
}

export interface ScriptCondition {
  kind: 'script';
  language?: ScriptLanguage;
  source: string;
  timeoutMs?: number;
}

export interface MessageAction extends ActionBase {
  type: 'message';
  variant?: 'info' | 'success' | 'warning' | 'error';
  title: string;
  description?: string;
}

export interface NavigateAction extends ActionBase {
  type: 'navigate';
  target: 'form' | 'page' | 'url';
  to: string;
  newTab?: boolean;
  /** Values for named custom page route parameters, with scoped templates. */
  params?: Record<string, unknown>;
}

export interface ApiAction extends ActionBase {
  type: 'api';
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  result?: StateTarget;
}

export interface SetStateAction extends ActionBase {
  type: 'state.set';
  target: StateTarget;
  value: unknown;
}

export interface ConfirmAction extends ActionBase {
  type: 'confirm';
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export interface TableRowAction {
  id: string;
  label: string;
  icon?: string;
  when?: string;
  actions: ComponentAction[];
}

export type ComponentAction = MessageAction | NavigateAction | ApiAction | SetStateAction | ScriptAction | ConfirmAction;

export interface ActionExecutionState {
  status: 'idle' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  startedAt?: string;
  finishedAt?: string;
  error?: string;
}
