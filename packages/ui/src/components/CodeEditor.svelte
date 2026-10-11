<script lang="ts">
  import { onMount } from 'svelte';
  import EditorWorker from 'monaco-editor/editor/editor.worker?worker';
  import TypeScriptWorker from 'monaco-editor/languages/features/typescript/ts.worker?worker';
  import JsonWorker from 'monaco-editor/languages/features/json/json.worker?worker';

  interface Props {
    value: string;
    language?: 'javascript' | 'typescript' | 'json' | 'sql' | 'plaintext';
    height?: number;
    label?: string;
    readOnly?: boolean;
    onchange?: (value: string) => void;
  }

  let { value, language = 'typescript', height = 280, label = 'Code', readOnly = false, onchange }: Props = $props();
  let host: HTMLDivElement;
  let editor = $state.raw<import('monaco-editor').editor.IStandaloneCodeEditor>();
  let monacoApi = $state.raw<typeof import('monaco-editor/editor/editor.api')>();
  let loadError = $state('');

  const declarations = `
type StateScope = 'application' | 'page' | 'form' | 'component';
type MosaicAction =
  | { type: 'message'; variant?: 'info' | 'success' | 'warning' | 'error'; title: string; description?: string }
  | { type: 'navigate'; target: 'form' | 'page' | 'url'; to: string; newTab?: boolean }
  | { type: 'api'; method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; path: string; body?: unknown; result?: { scope: StateScope; path: string } }
  | { type: 'state.set'; target: { scope: StateScope; path: string }; value: unknown };
declare const state: Readonly<{
  application: Record<string, unknown>;
  page: Record<string, unknown>;
  form: Record<string, unknown>;
  component: Record<string, unknown>;
  data: Record<string, unknown>;
}>;
declare const api: Readonly<{
  message: { info(title: string, description?: string): MosaicAction; success(title: string, description?: string): MosaicAction; warning(title: string, description?: string): MosaicAction; error(title: string, description?: string): MosaicAction };
  callApi(options: { method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; path: string; body?: unknown; result?: { scope: StateScope; path: string } }): MosaicAction;
  navigate: { form(to: string, newTab?: boolean): MosaicAction; page(to: string, newTab?: boolean): MosaicAction; url(to: string, newTab?: boolean): MosaicAction };
  state: { set(scope: StateScope, path: string, value: unknown): MosaicAction };
}>;`;

  onMount(() => {
    let disposed = false;
    let subscription: { dispose(): void } | undefined;
    let model: import('monaco-editor').editor.ITextModel | undefined;
    const libraries: { dispose(): void }[] = [];
    void (async () => {
      // Use one complete entry so Monaco's commands, suggestions, and singleton
      // services are registered together in both Vite development and production.
      const monaco = await import('monaco-editor/editor/editor.main');
      const monacoTypeScript = monaco.typescript;
      const monacoJson = monaco.json;
      if (disposed) return;
      (globalThis as typeof globalThis & { MonacoEnvironment?: unknown }).MonacoEnvironment = {
        getWorker: (_moduleId: string, workerLabel: string) => workerLabel === 'json' ? new JsonWorker() : workerLabel === 'typescript' || workerLabel === 'javascript' ? new TypeScriptWorker() : new EditorWorker(),
      };
      for (const defaults of [monacoTypeScript.typescriptDefaults, monacoTypeScript.javascriptDefaults]) {
        defaults.setCompilerOptions({ target: monacoTypeScript.ScriptTarget.ES2020, allowNonTsExtensions: true, strict: true, allowJs: true, checkJs: true });
        defaults.setDiagnosticsOptions({ noSemanticValidation: false, noSyntaxValidation: true });
        libraries.push(defaults.addExtraLib(declarations, `mosaic://runtime-api-${crypto.randomUUID()}.d.ts`));
      }
      monacoApi = monaco;
      monacoJson.jsonDefaults.setDiagnosticsOptions({ validate: true, allowComments: false, trailingCommas: 'error' });
      const extension = { typescript: 'ts', javascript: 'js', json: 'json', sql: 'sql', plaintext: 'txt' }[language];
      model = monaco.editor.createModel(value, language, monaco.Uri.parse(`mosaic://editor/${crypto.randomUUID()}.${extension}`));
      const instance = monaco.editor.create(host, {
        model,
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 13,
        lineHeight: 20,
        padding: { top: 10, bottom: 10 },
        scrollBeyondLastLine: false,
        tabSize: 2,
        wordWrap: 'on',
        ariaLabel: label,
        readOnly,
        theme: document.documentElement.dataset.theme === 'dark' ? 'vs-dark' : 'vs',
      });
      editor = instance;
      subscription = instance.onDidChangeModelContent(() => onchange?.(instance.getValue()));
    })().catch((error) => { if (!disposed) loadError = error instanceof Error ? error.message : 'Could not load the code editor'; });
    return () => {
      disposed = true;
      subscription?.dispose();
      editor?.dispose();
      model?.dispose();
      libraries.forEach((library) => library.dispose());
      editor = undefined;
    };
  });

  $effect(() => {
    if (editor && editor.getValue() !== value) editor.setValue(value);
  });
  $effect(() => {
    const model = editor?.getModel();
    if (model && monacoApi && model.getLanguageId() !== language) monacoApi.editor.setModelLanguage(model, language);
  });
  $effect(() => { editor?.updateOptions({ readOnly }); });
</script>

<div class="code-editor" style={`height:${height}px`} bind:this={host}></div>
{#if loadError}<p class="m-field__error" role="alert">{loadError}</p>{/if}

<style>
  .code-editor { width:100%; min-height:160px; overflow:hidden; border:1px solid var(--m-border); border-radius:var(--m-radius); background:#fff; }
  .code-editor:focus-within { border-color:var(--m-primary); box-shadow:0 0 0 3px color-mix(in srgb,var(--m-primary) 15%,transparent); }
</style>
