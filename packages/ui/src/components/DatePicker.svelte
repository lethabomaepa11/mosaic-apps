<script lang="ts">
  import { DatePicker as BitsDatePicker } from 'bits-ui';
  import { parseDate, parseDateTime, type DateValue } from '@internationalized/date';
  import { CalendarDays, ChevronLeft, ChevronRight } from '@lucide/svelte';
  import ShadcnInput from '../shadcn/input/Input.svelte';
  interface Props {
    label?: string;
    /** ISO date 'YYYY-MM-DD' or datetime string */
    value?: string;
    oninput?: (value: string) => void;
    withTime?: boolean;
    min?: string;
    max?: string;
    required?: boolean;
    disabled?: boolean;
    error?: string | null;
    helpText?: string;
  }

  let { label, value = $bindable(''), oninput, withTime = false, min, max, required, disabled, error, helpText }: Props = $props();

  const calendarValue = $derived.by(() => {
    if (!value) return undefined;
    try { return withTime ? parseDateTime(value) : parseDate(value.slice(0, 10)); }
    catch { return undefined; }
  });
  const minimum = $derived.by(() => {
    if (!min) return undefined;
    try { return withTime ? parseDateTime(min) : parseDate(min.slice(0, 10)); }
    catch { return undefined; }
  });
  const maximum = $derived.by(() => {
    if (!max) return undefined;
    try { return withTime ? parseDateTime(max) : parseDate(max.slice(0, 10)); }
    catch { return undefined; }
  });

  function onCalendarChange(next: DateValue | undefined) {
    if (!next) return;
    const date = `${next.year}-${String(next.month).padStart(2, '0')}-${String(next.day).padStart(2, '0')}`;
    if (withTime && 'hour' in next) {
      const datetime = `${date}T${String(next.hour).padStart(2, '0')}:${String(next.minute).padStart(2, '0')}`;
      value = datetime;
    } else {
      value = date;
    }
    oninput?.(value);
  }

  function onInput(e: Event & { currentTarget: EventTarget & HTMLInputElement }) {
    value = e.currentTarget.value;
    oninput?.(value);
  }
</script>

<div class="m-field">
  {#if label}<span class="m-field__label">{label}{#if required}<span class="m-field__req" aria-hidden="true">*</span>{/if}</span>{/if}
  {#if withTime}
    <ShadcnInput class={`m-input${error ? ' m-input--invalid' : ''}`} type="datetime-local" ariaLabel={label ?? 'Choose date and time'} aria-invalid={!!error} {required} {min} {max} {disabled} value={value ?? ''} oninput={onInput} />
  {:else}
    <BitsDatePicker.Root value={calendarValue} onValueChange={onCalendarChange} minValue={minimum} maxValue={maximum} {disabled} {required} weekdayFormat="short" fixedWeeks>
      <BitsDatePicker.Input class={`m-input m-date-picker${error ? ' m-input--invalid' : ''}`} aria-label={label ?? 'Choose date'}>
        {#snippet children({ segments })}
          {#each segments as { part, value: segmentValue }, i (part + i)}
            <BitsDatePicker.Segment {part} class="m-date-picker__segment">{segmentValue}</BitsDatePicker.Segment>
          {/each}
          <BitsDatePicker.Trigger class="m-date-picker__trigger" aria-label="Open calendar"><CalendarDays size={16} /></BitsDatePicker.Trigger>
        {/snippet}
      </BitsDatePicker.Input>
      <BitsDatePicker.Content class="m-date-picker__content" sideOffset={4}>
        <BitsDatePicker.Calendar>
          {#snippet children({ months, weekdays })}
            <BitsDatePicker.Header class="m-date-picker__header">
              <BitsDatePicker.PrevButton class="m-btn m-btn--ghost m-btn--sm" aria-label="Previous month"><ChevronLeft size={16} /></BitsDatePicker.PrevButton>
              <BitsDatePicker.Heading class="m-date-picker__heading" />
              <BitsDatePicker.NextButton class="m-btn m-btn--ghost m-btn--sm" aria-label="Next month"><ChevronRight size={16} /></BitsDatePicker.NextButton>
            </BitsDatePicker.Header>
            {#each months as month (month.value)}
              <BitsDatePicker.Grid class="m-date-picker__grid">
                <BitsDatePicker.GridHead><BitsDatePicker.GridRow>
                  {#each weekdays as weekday (weekday)}<BitsDatePicker.HeadCell class="m-date-picker__weekday">{weekday}</BitsDatePicker.HeadCell>{/each}
                </BitsDatePicker.GridRow></BitsDatePicker.GridHead>
                <BitsDatePicker.GridBody>
                  {#each month.weeks as week (week)}
                    <BitsDatePicker.GridRow>
                      {#each week as date (date)}
                        <BitsDatePicker.Cell {date} month={month.value}>
                          <BitsDatePicker.Day class="m-date-picker__day">{date.day}</BitsDatePicker.Day>
                        </BitsDatePicker.Cell>
                      {/each}
                    </BitsDatePicker.GridRow>
                  {/each}
                </BitsDatePicker.GridBody>
              </BitsDatePicker.Grid>
            {/each}
          {/snippet}
        </BitsDatePicker.Calendar>
      </BitsDatePicker.Content>
    </BitsDatePicker.Root>
  {/if}
  {#if error}<span class="m-field__error">{error}</span>{:else if helpText}<span class="m-field__help">{helpText}</span>{/if}
</div>

<style>
  :global(.m-date-picker) { display:flex; align-items:center; gap:2px; }
  :global(.m-date-picker__segment) { border-radius:4px; padding:2px; }
  :global(.m-date-picker__trigger) { display:grid; place-items:center; margin-left:auto; padding:4px; border:0; border-radius:4px; color:var(--m-fg-muted); background:transparent; cursor:pointer; }
  :global(.m-date-picker__trigger:hover) { background:var(--m-surface-2); color:var(--m-fg); }
  :global(.m-date-picker__content) { z-index:60; padding:12px; border:1px solid var(--m-border); border-radius:var(--m-radius); background:var(--m-surface); box-shadow:var(--m-shadow-lg); }
  :global(.m-date-picker__header) { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
  :global(.m-date-picker__heading) { font-size:13px; font-weight:600; }
  :global(.m-date-picker__grid) { border-collapse:collapse; }
  :global(.m-date-picker__weekday) { width:34px; height:30px; color:var(--m-fg-muted); font-size:11px; text-align:center; }
  :global(.m-date-picker__day) { display:grid; place-items:center; width:32px; height:32px; border:0; border-radius:6px; background:transparent; color:var(--m-fg); cursor:pointer; }
  :global(.m-date-picker__day:hover), :global(.m-date-picker__day[data-focused]) { background:var(--m-surface-2); }
  :global(.m-date-picker__day[data-selected]) { background:var(--m-primary); color:white; }
  :global(.m-date-picker__day[data-disabled]), :global(.m-date-picker__day[data-outside-month]) { opacity:.35; pointer-events:none; }
</style>
