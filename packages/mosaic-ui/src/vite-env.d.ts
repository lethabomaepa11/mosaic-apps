declare module '*.css' {
  const content: string;
  export default content;
}

declare module '*.svelte' {
  import type { Component } from 'svelte';
  const component: Component;
  export default component;
  export type TreeNode = {
    id: string;
    type: string;
    props?: Record<string, unknown>;
    children?: TreeNode[];
    meta?: Record<string, unknown>;
  };
}