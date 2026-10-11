/// <reference lib="webworker" />

import RELEASE_SYNC from '@jitl/quickjs-wasmfile-release-sync';
import { newQuickJSWASMModuleFromVariant, shouldInterruptAfterDeadline } from 'quickjs-emscripten-core';
import * as ts from 'typescript';
import type { ComponentAction } from '@mosaic-apps/mosaic-core';
import type { SandboxRequest, SandboxResponse } from './sandbox-types.js';

const MAX_SOURCE_LENGTH = 50_000;
const MAX_ACTIONS = 50;
const quickJSPromise = newQuickJSWASMModuleFromVariant(RELEASE_SYNC);

function transpile(request: SandboxRequest): string {
  const functionSource = `function __mosaicRun(state, api) {\n${request.source}\n}`;
  if (request.language === 'javascript') return functionSource;
  const output = ts.transpileModule(functionSource, {
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.None,
      strict: true,
    },
  });
  const diagnostics = output.diagnostics?.filter((item) => item.category === ts.DiagnosticCategory.Error) ?? [];
  if (diagnostics.length) {
    throw new Error(diagnostics.map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n')).join('\n'));
  }
  return output.outputText;
}

function validateAction(action: unknown): action is ComponentAction {
  if (!action || typeof action !== 'object') return false;
  const value = action as Record<string, unknown>;
  if (value.type === 'message') return typeof value.title === 'string';
  if (value.type === 'navigate') return ['form', 'page', 'url'].includes(String(value.target)) && typeof value.to === 'string';
  if (value.type === 'api') return typeof value.path === 'string';
  if (value.type === 'state.set') {
    const target = value.target as Record<string, unknown> | undefined;
    return Boolean(target && ['application', 'page', 'form', 'component'].includes(String(target.scope)) && typeof target.path === 'string');
  }
  // Sandboxed scripts cannot recursively create scripts.
  return false;
}

function validateResult(request: SandboxRequest, value: unknown): ComponentAction[] | boolean {
  if (request.mode === 'boolean') {
    if (typeof value !== 'boolean') throw new Error('Condition scripts must return true or false');
    return value;
  }
  if (!Array.isArray(value)) throw new Error('Action scripts must return an array of Mosaic actions');
  if (value.length > MAX_ACTIONS) throw new Error(`A script can return at most ${MAX_ACTIONS} actions`);
  if (!value.every(validateAction)) throw new Error('The script returned an invalid or unsupported action');
  return value;
}

function apiSource(): string {
  return `
const __freeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.keys(value).forEach((key) => __freeze(value[key]));
  }
  return value;
};
const api = __freeze({
  message: {
    info: (title, description) => ({ type: 'message', variant: 'info', title, description }),
    success: (title, description) => ({ type: 'message', variant: 'success', title, description }),
    warning: (title, description) => ({ type: 'message', variant: 'warning', title, description }),
    error: (title, description) => ({ type: 'message', variant: 'error', title, description })
  },
  callApi: (options) => ({ type: 'api', ...options }),
  navigate: {
    form: (to, newTab = false) => ({ type: 'navigate', target: 'form', to, newTab }),
    page: (to, newTab = false) => ({ type: 'navigate', target: 'page', to, newTab }),
    url: (to, newTab = false) => ({ type: 'navigate', target: 'url', to, newTab })
  },
  state: { set: (scope, path, value) => ({ type: 'state.set', target: { scope, path }, value }) }
});`;
}

async function execute(request: SandboxRequest): Promise<ComponentAction[] | boolean> {
  if (!request.source.trim()) return request.mode === 'boolean' ? true : [];
  if (request.source.length > MAX_SOURCE_LENGTH) throw new Error(`Script exceeds the ${MAX_SOURCE_LENGTH.toLocaleString()} character limit`);

  const QuickJS = await quickJSPromise;
  const runtime = QuickJS.newRuntime();
  runtime.setMemoryLimit(16 * 1024 * 1024);
  runtime.setMaxStackSize(512 * 1024);
  runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + request.timeoutMs));
  const vm = runtime.newContext();
  try {
    const program = `"use strict";\n${apiSource()}\nconst state = __freeze(${JSON.stringify(request.state)});\n${transpile(request)}\nJSON.stringify(__mosaicRun(state, api));`;
    const result = vm.evalCode(program, 'mosaic-custom-script.js');
    if (result.error) {
      const dumped = vm.dump(result.error) as { message?: string; stack?: string } | string;
      result.error.dispose();
      throw new Error(typeof dumped === 'string' ? dumped : dumped.message ?? dumped.stack ?? 'Script execution failed');
    }
    const serialized = vm.dump(result.value);
    result.value.dispose();
    if (typeof serialized !== 'string') throw new Error('The script must return a JSON serializable value');
    return validateResult(request, JSON.parse(serialized));
  } finally {
    vm.dispose();
    runtime.dispose();
  }
}

self.onmessage = async (event: MessageEvent<SandboxRequest>) => {
  const request = event.data;
  let response: SandboxResponse;
  try {
    response = { id: request.id, ok: true, value: await execute(request) };
  } catch (error) {
    response = { id: request.id, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  self.postMessage(response);
};


