/**
 * @mosaic/ui - enterprise Svelte 5 kit: 57 component types, drag & drop engine,
 * JSON FormRenderer/PageRenderer, entity-driven forms, API client, toasts.
 */

import './styles/theme.css';
import './styles/fields.css';
import './styles/components.css';
import './styles/overlays.css';
import './styles/misc.css';

// renderers
export { default as FormRenderer } from './render/FormRenderer.svelte';
export { default as EntityForm } from './render/EntityForm.svelte';
export { default as PageRenderer } from './render/PageRenderer.svelte';
export { default as NodeRenderer } from './render/NodeRenderer.svelte';
export { default as NodeChildren } from './render/NodeChildren.svelte';

// registry
export {
  COMPONENTS,
  getComponent,
  isContainerType,
  isFieldType,
  createNode,
  paletteCategories,
  TOTAL_COMPONENT_TYPES,
} from './registry/index.js';
export { CATEGORIES, FIELD_PROPS, type ComponentDef, type ComponentCategory, type PropDesc, type PropKind } from './registry/types.js';

// dnd engine
export { dragState, draggable, dropzone, resetDnd, isTargetZone, targetIndexFor, hitTest, computeIndex } from './dnd/dnd.svelte.js';
export type { DragPayload, DragState, DropTarget, ZoneSpec } from './dnd/dnd.svelte.js';

// client + toasts
export { MosaicClient, createClient, ApiError, type ClientOptions, type MigrationStatement } from './client/api.js';
export { toast } from './stores/toast.svelte.js';
export type { Toast, ToastVariant } from './stores/toast.svelte.js';

// components
export { default as TextField } from './components/TextField.svelte';
export { default as TextArea } from './components/TextArea.svelte';
export { default as NumberField } from './components/NumberField.svelte';
export { default as SelectField } from './components/SelectField.svelte';
export { default as MultiSelect } from './components/MultiSelect.svelte';
export { default as ChoiceGroup } from './components/ChoiceGroup.svelte';
export { default as Switch } from './components/Switch.svelte';
export { default as Slider } from './components/Slider.svelte';
export { default as DatePicker } from './components/DatePicker.svelte';
export { default as ColorPicker } from './components/ColorPicker.svelte';
export { default as RateInput } from './components/RateInput.svelte';
export { default as RefSelect } from './components/RefSelect.svelte';
export { default as JsonEditor } from './components/JsonEditor.svelte';
export { default as FileUpload } from './components/FileUpload.svelte';
export { default as SearchField } from './components/SearchField.svelte';
export { default as DataTable } from './components/DataTable.svelte';
export { default as EntityTable } from './components/EntityTable.svelte';
export { default as Pagination } from './components/Pagination.svelte';
export { default as Toolbar } from './components/Toolbar.svelte';
export { default as FilterBar } from './components/FilterBar.svelte';
export { default as Card } from './components/Card.svelte';
export { default as Panel } from './components/Panel.svelte';
export { default as Tabs } from './components/Tabs.svelte';
export { default as Accordion } from './components/Accordion.svelte';
export { default as Modal } from './components/Modal.svelte';
export { default as Drawer } from './components/Drawer.svelte';
export { default as Grid } from './components/Grid.svelte';
export { default as Stepper } from './components/Stepper.svelte';
export { default as EmptyState } from './components/EmptyState.svelte';
export { default as SplitPane } from './components/SplitPane.svelte';
export { default as Heading } from './components/Heading.svelte';
export { default as Divider } from './components/Divider.svelte';
export { default as StatCard } from './components/StatCard.svelte';
export { default as Timeline } from './components/Timeline.svelte';
export { default as Avatar } from './components/Avatar.svelte';
export { default as DescriptionList } from './components/DescriptionList.svelte';
export { default as CodeBlock } from './components/CodeBlock.svelte';
export { default as JsonView } from './components/JsonView.svelte';
export { default as TreeView, type TreeNode } from './components/TreeView.svelte';
export { default as Breadcrumbs } from './components/Breadcrumbs.svelte';
export { default as Alert } from './components/Alert.svelte';
export { default as Badge } from './components/Badge.svelte';
export { default as Progress } from './components/Progress.svelte';
export { default as Spinner } from './components/Spinner.svelte';
export { default as Skeleton } from './components/Skeleton.svelte';
export { default as Tooltip } from './components/Tooltip.svelte';
export { default as Toaster } from './components/Toaster.svelte';
export { default as Button } from './components/Button.svelte';
export { default as Menu } from './components/Menu.svelte';
export { default as Chart } from './components/Chart.svelte';
export { default as PanelCard } from './components/Card.svelte';
