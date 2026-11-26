import { getComponent } from '@mosaic-apps/ui';
import DateControl from './DateControl.svelte';
import DateTimeControl from './DateTimeControl.svelte';
import { datePicker } from './original-components.js';

const timePicker = getComponent('timePicker');
// shortcut: update the definitions directly until the registry accepts replacement of camel-case built-in IDs.
datePicker.component = DateControl;
timePicker.component = DateTimeControl;
