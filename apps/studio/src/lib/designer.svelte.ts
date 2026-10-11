/** Designer store: form/page tree editing with undo/redo. */

import {
  ensureRoot,
  duplicateNode,
  insertNode,
  moveNode,
  removeNode,
  updateNode,
  walk,
  type FormDef,
  type FormNode,
  type PageDef,
} from '@mosaic-apps/core';
import { createNode as createRegistryNode } from '$ui';

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

class DesignerStore {
  form = $state<FormDef | null>(null);
  page = $state<PageDef | null>(null);
  selectedId = $state<string | null>(null);
  past = $state<string[]>([]);
  future = $state<string[]>([]);
  bindingOptions = $state<string[]>([]);
  entityOptionsByName = $state<Record<string, string[]>>({});
  formOptions = $state<{ value: string; label: string }[]>([]);
  artifactOptions = $state<{ value: string; label: string; kind: 'form' | 'page' }[]>([]);
  private savedSnapshot = '';
  private externalDirty = $state(false);

  get isDirty(): boolean {
    return this.current ? this.externalDirty || JSON.stringify(this.current) !== this.savedSnapshot : false;
  }

  get kind(): 'form' | 'page' | null {
    return this.form ? 'form' : this.page ? 'page' : null;
  }

  get root(): FormNode | null {
    if (this.form) return this.form.root;
    if (this.page) return this.page.root;
    return null;
  }

  private get current(): FormDef | PageDef | null {
    return this.form ?? this.page;
  }

  private set current(v: FormDef | PageDef | null) {
    if (this.form && v) this.form = v as FormDef;
    else if (this.page && v) this.page = v as PageDef;
  }

  loadForm(form: FormDef): void {
    this.page = null;
    this.form = clone(form);
    ensureRoot(this.form.root);
    this.past = [];
    this.future = [];
    this.selectedId = null;
    this.savedSnapshot = JSON.stringify(this.form);
    this.externalDirty = false;
  }

  loadPage(page: PageDef): void {
    this.form = null;
    this.page = clone(page);
    ensureRoot(this.page.root);
    this.past = [];
    this.future = [];
    this.selectedId = null;
    this.savedSnapshot = JSON.stringify(this.page);
    this.externalDirty = false;
  }

  private snapshot(): void {
    const cur = this.current;
    if (!cur) return;
    this.past.push(JSON.stringify(cur));
    if (this.past.length > 60) this.past.shift();
    this.future = [];
  }

  undo(): void {
    const cur = this.current;
    if (!cur || !this.past.length) return;
    this.future.push(JSON.stringify(cur));
    this.current = JSON.parse(this.past.pop()!);
  }

  redo(): void {
    const cur = this.current;
    if (!cur || !this.future.length) return;
    this.past.push(JSON.stringify(cur));
    this.current = JSON.parse(this.future.pop()!);
  }

  select(id: string | null): void {
    this.selectedId = id;
  }

  deleteSelection(): void {
    if (!this.root || !this.selectedId || this.selectedId === this.root.id) return;
    this.remove(this.selectedId);
  }

  duplicateSelection(): void {
    if (!this.root || !this.selectedId || this.selectedId === this.root.id) return;
    this.duplicate(this.selectedId);
  }

  addAt(parentId: string, index: number, type: string): void {
    const cur = this.current;
    if (!cur || !this.root) return;
    this.snapshot();
    const node = createRegistryNode(type);
    if (!insertNode(this.root, parentId, node, index)) {
      this.past.pop();
      return;
    }
    this.selectedId = node.id;
  }

  move(id: string, parentId: string, index: number): void {
    if (!this.root) return;
    this.snapshot();
    moveNode(this.root, id, parentId, index);
  }

  remove(id: string): void {
    if (!this.root) return;
    this.snapshot();
    removeNode(this.root, id);
    if (this.selectedId === id) this.selectedId = null;
  }

  duplicate(id: string): void {
    if (!this.root) return;
    this.snapshot();
    duplicateNode(this.root, id);
  }

  updateProps(id: string, props: Record<string, unknown>): void {
    if (!this.root) return;
    this.snapshot();
    updateNode(this.root, id, { props });
  }

  updateFormSettings(settings: FormDef['settings']): void {
    if (!this.form) return;
    this.snapshot();
    this.form.settings = { ...this.form.settings, ...settings };
  }

  markSaved(): void {
    if (this.current) this.savedSnapshot = JSON.stringify(this.current);
    this.externalDirty = false;
  }

  markChanged(): void {
    this.externalDirty = true;
  }

  replaceRoot(root: FormNode): void {
    const cur = this.current;
    if (!cur) return;
    this.snapshot();
    ensureRoot(root);
    cur.root = root;
  }

  /** Serialized JSON for the JSON tab / save payloads. */
  toJson(): string {
    return JSON.stringify(this.current, null, 2);
  }

  countNodes(): number {
    if (!this.root) return 0;
    let n = 0;
    walk(this.root, () => {
      n++;
    });
    return n;
  }
}

export const designer = new DesignerStore();

