import type { ActionContext } from './runner.js';
export const ACTION_CONFIRMATION_CONTEXT = 'mosaic:action-confirmation';
export type MosaicConfirm = NonNullable<ActionContext['confirm']>;
