<script>
  import { dateInputValue, datetimePayload } from '../lib/dates.js';

  let { value, oninput, label, min, max, required, disabled, error, helpText } = $props();
  let invalid = $state(false);

  function update(event) {
    const input = event.currentTarget;
    const next = input.value ? datetimePayload(input.value, value) : '';
    invalid = next === undefined;
    input.setCustomValidity(invalid ? 'Choose a valid local date and time.' : '');
    oninput?.(next ?? '');
  }
</script>

<label class="m-field">
  {#if label}<span class="m-field__label">{label}</span>{/if}
  <input class="m-input" type="datetime-local" aria-label={label ?? 'Choose date and time'}
    aria-invalid={invalid || Boolean(error)} {required} {disabled} oninput={update}
    value={dateInputValue(value, 'datetime-local')}
    min={dateInputValue(min, 'datetime-local') || undefined}
    max={dateInputValue(max, 'datetime-local') || undefined} />
  {#if invalid}<span class="m-field__error">Choose a valid local date and time.</span>
  {:else if error}<span class="m-field__error">{error}</span>
  {:else if helpText}<span class="m-field__help">{helpText}</span>{/if}
</label>
