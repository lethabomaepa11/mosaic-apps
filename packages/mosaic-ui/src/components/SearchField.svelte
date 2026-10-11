<script lang="ts">
  interface Props {
    value?: string;
    oninput?: (value: string) => void;
    onSearch?: (value: string) => void;
    placeholder?: string;
    debounceMs?: number;
  }

  let { value = $bindable(''), oninput, onSearch, placeholder = 'Search…', debounceMs = 300 }: Props = $props();

  let timer: ReturnType<typeof setTimeout> | undefined;

  function onInput(e: Event & { currentTarget: EventTarget & HTMLInputElement }) {
    value = e.currentTarget.value;
    oninput?.(value);
    clearTimeout(timer);
    timer = setTimeout(() => onSearch?.(value), debounceMs);
  }
</script>

<div class="m-search">
  <span class="m-search__icon">⌕</span>
  <input class="m-input" type="search" {placeholder} {value} oninput={onInput} aria-label={placeholder} />
</div>
