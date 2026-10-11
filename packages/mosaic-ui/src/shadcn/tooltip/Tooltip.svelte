<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Tooltip as BitsTooltip } from 'bits-ui';
  import { cn } from '../../lib/cn';

  interface Props {
    content: string;
    side?: 'top' | 'right' | 'bottom' | 'left';
    align?: 'start' | 'center' | 'end';
    delayDuration?: number;
    class?: string;
    children?: Snippet;
  }

  let { content, side = 'top', align = 'center', delayDuration = 500, class: className, children }: Props = $props();
</script>

<BitsTooltip.Provider {delayDuration}>
  <BitsTooltip.Root>
    <BitsTooltip.Trigger>{@render children?.()}</BitsTooltip.Trigger>
    <BitsTooltip.Content {side} {align} sideOffset={5}>
      <div class={cn('z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95', className)}>
        {content}
      </div>
    </BitsTooltip.Content>
  </BitsTooltip.Root>
</BitsTooltip.Provider>
