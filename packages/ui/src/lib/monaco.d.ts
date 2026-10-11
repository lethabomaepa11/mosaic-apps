declare module 'monaco-editor/editor/editor.main' {
  export * from 'monaco-editor/editor/editor.api';
  export * as typescript from 'monaco-editor/languages/features/typescript/register';
  export * as json from 'monaco-editor/languages/features/json/register';
}
