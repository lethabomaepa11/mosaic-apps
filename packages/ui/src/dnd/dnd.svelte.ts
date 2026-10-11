/**
 * Drag & drop engine (part 1): types, module store, hit testing.
 * Pointer-based; zones register insertion containers; index from child midpoints.
 */

export interface DragPayload {
  kind: 'palette' | 'node';
  type?: string;
  data?: unknown;
  sourceId?: string;
}

export interface DropTarget {
  zoneId: string;
  index: number;
}

export interface DragState {
  active: boolean;
  payload: DragPayload | null;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  target: DropTarget | null;
  ghost: { label: string } | null;
}

export interface ZoneSpec {
  id: string;
  /** element containing droppable children (defaults to the zone element itself) */
  container?: HTMLElement | (() => HTMLElement | null);
  canAccept?: (payload: DragPayload) => boolean;
  /** called with insertion index on drop */
  onDrop: (index: number, payload: DragPayload) => void;
  /** live preview callback while hovering */
  onHover?: (index: number | null) => void;
}

export interface RegisteredZone extends ZoneSpec {
  el: HTMLElement;
  getContainer: () => HTMLElement | null;
}

export const dragState = $state<DragState>({
  active: false,
  payload: null,
  x: 0,
  y: 0,
  offsetX: 0,
  offsetY: 0,
  target: null,
  ghost: null,
});

let zones: RegisteredZone[] = [];
let draggingEl: HTMLElement | null = null;
let listenersBound = false;

export function computeIndex(el: HTMLElement, x: number, y: number): number {
  const children = Array.from(el.children) as HTMLElement[];
  const droppable = children.filter((c) => c.dataset?.mosaicDnd !== 'ignore');
  if (!droppable.length) return 0;
  const horizontal = el.dataset?.mosaicDnd === 'row';
  for (let i = 0; i < droppable.length; i++) {
    const r = droppable[i]!.getBoundingClientRect();
    const mid = horizontal ? r.left + r.width / 2 : r.top + r.height / 2;
    const pos = horizontal ? x : y;
    if (pos < mid) return i;
  }
  return droppable.length;
}

export function hitTest(x: number, y: number): { zone: RegisteredZone; index: number } | null {
  for (let i = zones.length - 1; i >= 0; i--) {
    const zone = zones[i]!;
    if (zone.canAccept && dragState.payload && !zone.canAccept(dragState.payload)) continue;
    const el = zone.getContainer() ?? zone.el;
    if (!el || !el.isConnected) continue;
    const rect = el.getBoundingClientRect();
    const pad = 32;
    if (x >= rect.left - pad && x <= rect.right + pad && y >= rect.top - pad && y <= rect.bottom + pad) {
      return { zone, index: computeIndex(el, x, y) };
    }
  }
  return null;
}

export function cleanup(): void {
  dragState.active = false;
  dragState.payload = null;
  dragState.target = null;
  dragState.ghost = null;
  if (draggingEl) {
    draggingEl.style.opacity = '';
    draggingEl = null;
  }
  document.removeEventListener('pointermove', onPointerMove);
  document.removeEventListener('pointerup', onPointerUp);
  document.removeEventListener('pointercancel', cleanup);
  document.body.style.cursor = '';
  listenersBound = false;
}

function onPointerMove(e: PointerEvent): void {
  if (!dragState.active) return;
  dragState.x = e.clientX;
  dragState.y = e.clientY;
  const hit = hitTest(e.clientX, e.clientY);
  if (hit) {
    if (dragState.target?.zoneId !== hit.zone.id || dragState.target?.index !== hit.index) {
      dragState.target = { zoneId: hit.zone.id, index: hit.index };
      hit.zone.onHover?.(hit.index);
    }
  } else if (dragState.target) {
    dragState.target = null;
  }
}

function onPointerUp(e: PointerEvent): void {
  if (!dragState.active) return;
  const payload = dragState.payload;
  const hit = hitTest(e.clientX, e.clientY);
  if (hit && payload) {
    try {
      hit.zone.onDrop(hit.index, payload);
    } catch (err) {
      console.error('[mosaic-dnd] drop handler failed:', err);
    }
  }
  cleanup();
}

function beginDrag(e: PointerEvent, payload: DragPayload, sourceEl: HTMLElement | null, label: string): void {
  e.preventDefault();
  const rect = sourceEl?.getBoundingClientRect();
  dragState.offsetX = rect ? e.clientX - rect.left : 0;
  dragState.offsetY = rect ? e.clientY - rect.top : 0;
  dragState.active = true;
  dragState.payload = payload;
  dragState.x = e.clientX;
  dragState.y = e.clientY;
  dragState.ghost = { label };
  draggingEl = sourceEl;
  if (sourceEl) sourceEl.style.opacity = '0.35';
  document.body.style.cursor = 'grabbing';
  if (!listenersBound) {
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', cleanup);
    listenersBound = true;
  }
}

export interface DraggableOpts {
  payload: DragPayload;
  label?: string;
  disabled?: boolean;
}

/** Svelte action: makes an element draggable via pointer events. */
export function draggable(el: HTMLElement, opts: DraggableOpts) {
  let current = opts;
  const onDown = (e: PointerEvent) => {
    if (current.disabled || e.button !== 0) return;
    // don't hijack clicks on interactive children
    const t = e.target as HTMLElement | null;
    if (t && t.closest('input, textarea, select, button, a, [data-mosaic-nodrag]')) return;
    beginDrag(e, current.payload, el, current.label ?? (current.payload.type ?? 'component'));
  };
  el.addEventListener('pointerdown', onDown);
  el.style.touchAction = 'none';
  el.style.cursor = 'grab';
  return {
    update(next: DraggableOpts) {
      current = next;
    },
    destroy() {
      el.removeEventListener('pointerdown', onDown);
    },
  };
}

/** Svelte action: registers a drop zone. */
export function dropzone(el: HTMLElement, spec: ZoneSpec) {
  const zone: RegisteredZone = {
    ...spec,
    el,
    getContainer: () => {
      if (typeof spec.container === 'function') return spec.container();
      if (spec.container instanceof HTMLElement) return spec.container;
      return el;
    },
  };
  zones.push(zone);
  return {
    update(next: ZoneSpec) {
      Object.assign(zone, next, { el, getContainer: () => {
        if (typeof next.container === 'function') return next.container();
        if (next.container instanceof HTMLElement) return next.container;
        return el;
      } });
    },
    destroy() {
      zones = zones.filter((z) => z !== zone);
    },
  };
}

/** Clear all zones (page teardown). */
export function resetDnd(): void {
  zones = [];
  cleanup();
}

/** Is this zone the current drop target? */
export function isTargetZone(zoneId: string): boolean {
  return dragState.active && dragState.target?.zoneId === zoneId;
}

/** Drop indicator position for a zone: index or null. */
export function targetIndexFor(zoneId: string): number | null {
  if (!dragState.active) return null;
  return dragState.target?.zoneId === zoneId ? dragState.target.index : null;
}
