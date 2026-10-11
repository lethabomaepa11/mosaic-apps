<script lang="ts">
  interface Props {
    name: string;
    color?: string;
    size?: 'md' | 'lg';
  }

  let { name, color, size = 'md' }: Props = $props();

  const initials = $derived(name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?');
  const hue = $derived([...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 360);
  const bg = $derived(color ?? `hsl(${hue} 65% 55%)`);
</script>

<span class="m-avatar" class:m-avatar--lg={size === 'lg'} style="background:{bg}" title={name}>{initials}</span>
