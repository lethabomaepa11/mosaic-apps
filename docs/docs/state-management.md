---
sidebar_position: 10
---

# Runtime state management

Mosaic state belongs to a runtime instance. The UI package does not keep
user-specific data in a module singleton.

```ts
import { createMosaicState } from '@mosaic-apps/mosaic-ui';

const state = createMosaicState({
  application: { userId: 'u_123' },
  page: { activeTab: 'overview' },
  form: { status: 'draft' },
});

state.form.set('status', 'submitted');
state.form.setPath('customer.address.city', 'Cape Town');
const snapshot = state.serialize();
state.form.subscribe((next, revision) => {
  console.log(revision, next.status);
});
state.restore(snapshot);
```

## Scope and lifecycle

- `application` is shared for the lifetime of the state object.
- `page` belongs to one page instance.
- `form` belongs to one form instance.
- `component` belongs to one rendered component instance.
- `forkPage()` shares application state and creates new page/form scopes.
- `forkForm()` shares application/page state and creates a new form scope.
- `forkComponent()` shares application/page/form state and creates a new
  component scope.
- `PageRenderer` and `FormRenderer` accept a `state` prop. Without one, they
  create an instance. Nested FormRenderer instances inherit application/page
  scopes and fork form state.

Each StateStore clones inputs and outputs so consumers cannot mutate the
internal snapshot accidentally. `set`, `update`, `reset`, and `restore` notify
subscribers with a monotonically increasing revision. Values must be
serializable. State is currently in-memory; persistence adapters, cross-tab
coordination, server synchronization, and undo integration are not implemented.

## Component actions

Every component can define an ordered `actions` array in Studio. The runtime
supports five serializable action types:

- `message`: show an info, success, warning, or error notification;
- `api`: call a relative route on the configured Mosaic API and optionally put
  the result in a state scope;
- `navigate`: open a selected form, page, relative URL, or HTTPS URL;
- `state.set`: write a serializable value to a nested state path.
- `script`: run JavaScript or TypeScript logic and return more declarative
  Mosaic actions.

Strings can read scoped values with templates such as
`/entities/customer/{{form.customerId}}`. An exact template keeps the original
value type. Each component records `running`, `succeeded`, `failed`, or
`cancelled` status in its component scope. Starting the same action again
cancels its previous API request. Optional `when` conditions use the safe
expression interpreter.

API actions cannot call an absolute external URL. This keeps bearer credentials
on the configured API origin. Use a server endpoint as an audited integration
boundary for third-party services.

## Custom code

Studio includes an offline Monaco editor for script actions. It provides
autocomplete for the read only `state` snapshot and the `api` action helpers.
A script returns an array of actions, for example:

```ts
const total = Number(state.form.total ?? 0);
return [
  api.state.set('form', 'discount', total * 0.1),
  api.message.success('Discount calculated'),
];
```

Published scripts run in a dedicated browser worker inside QuickJS WebAssembly.
The sandbox has no DOM, cookies, browser storage, or host network APIs. It has a
16 MiB memory limit, 512 KiB stack limit, a 500 ms default CPU deadline, a 2
second maximum deadline, a 50,000 character source limit, and a 50 action output
limit. TypeScript is transpiled in the worker. Returned values are parsed and
validated before the regular action runner can call the configured same-origin
API, navigate, show a message, or update state. Scripts cannot create scripts.

`visibleIf` and `disabledIf` default to the restricted expression interpreter.
Their Studio control can optionally switch to JavaScript or TypeScript; those
conditions use the same worker and must return a boolean. A condition error is
reported to the user and falls back to visible/enabled behavior.
