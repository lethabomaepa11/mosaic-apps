import type { ComponentAction, ScriptLanguage } from '@mosaic-apps/core';

export interface ScriptStateSnapshot {
  application: Record<string, unknown>;
  page: Record<string, unknown>;
  form: Record<string, unknown>;
  component: Record<string, unknown>;
  data: Record<string, unknown>;
}

export interface SandboxRequest {
  id: string;
  mode: 'actions' | 'boolean';
  language: ScriptLanguage;
  source: string;
  state: ScriptStateSnapshot;
  timeoutMs: number;
}

export type SandboxResponse =
  | { id: string; phase: 'executing' }
  | { id: string; ok: true; value: ComponentAction[] | boolean }
  | { id: string; ok: false; error: string };


