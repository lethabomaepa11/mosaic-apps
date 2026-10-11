<script lang="ts">
  interface Series {
    name: string;
    color?: string;
    data: { label: string; value: number }[];
  }

  interface Props {
    type?: 'bar' | 'line' | 'pie' | 'donut';
    series: Series[];
    height?: number;
    showLegend?: boolean;
  }

  let { type = 'bar', series, height = 200, showLegend = true }: Props = $props();

  const PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];
  const W = 560;

  function seriesColor(s: Series, i: number): string {
    return s.color ?? PALETTE[i % PALETTE.length]!;
  }

  const totals = $derived(series.map((s) => s.data.reduce((a, p) => a + p.value, 0)));
  const grandTotal = $derived(totals.reduce((a, b) => a + b, 0) || 1);

  // bar/line geometry
  const bars = $derived.by(() => {
    if (type !== 'bar' && type !== 'line') return [];
    const labels = series[0]?.data.map((d) => d.label) ?? [];
    const maxVal = Math.max(1, ...series.flatMap((s) => s.data.map((d) => d.value)));
    const groupW = W / Math.max(labels.length, 1);
    const barW = Math.max(6, (groupW - 14) / series.length);
    return series.flatMap((s, si) =>
      s.data.map((d, di) => ({
        x: di * groupW + 8 + si * barW,
        y: height - (d.value / maxVal) * (height - 24) - 16,
        w: barW - 3,
        h: (d.value / maxVal) * (height - 24),
        color: seriesColor(s, si),
        label: d.label,
        value: d.value,
      })),
    );
  });

  const linePoints = $derived.by(() => {
    if (type !== 'line') return [];
    const labels = series[0]?.data.map((d) => d.label) ?? [];
    const maxVal = Math.max(1, ...series.flatMap((s) => s.data.map((d) => d.value)));
    const stepX = labels.length > 1 ? (W - 20) / (labels.length - 1) : 0;
    return series.map((s, si) => ({
      color: seriesColor(s, si),
      points: s.data.map((d, di) => ({ x: 10 + di * stepX, y: height - (d.value / maxVal) * (height - 24) - 12 })),
    }));
  });

  // pie/donut geometry
  const pieSlices = $derived.by(() => {
    if (type !== 'pie' && type !== 'donut') return [];
    const out: { cx: number; cy: number; r: number; r2: number; a0: number; a1: number; color: string; label: string; value: number }[] = [];
    const cx = W / 2;
    const cy = height / 2;
    const r = Math.min(W, height) / 2 - 14;
    const r2 = type === 'donut' ? r * 0.58 : 0;
    let angle = -Math.PI / 2;
    series.forEach((s, si) => {
      s.data.forEach((d) => {
        const frac = d.value / grandTotal;
        const a1 = angle + frac * Math.PI * 2;
        out.push({
          cx, cy, r, r2, a0: angle, a1,
          color: seriesColor(s, si),
          label: `${d.label} (${Math.round(frac * 100)}%)`,
          value: d.value,
        });
        angle = a1;
      });
    });
    return out;
  });
</script>

<figure class="m-chart" style="margin:0">
  <svg viewBox="0 0 {W} {height}" width="100%" {height} role="img">
    {#if type === 'bar' || type === 'line'}
      <line x1="0" y1={height - 12} x2={W} y2={height - 12} stroke="var(--m-border)" />
      {#each bars as b (b.x + b.y)}
        {#if type === 'bar'}
          <rect x={b.x} y={b.y} width={b.w} height={Math.max(b.h, 1)} rx="3" fill={b.color}>
            <title>{b.label}: {b.value}</title>
          </rect>
        {/if}
      {/each}
      {#if type === 'line'}
        {#each linePoints as lp (lp.color)}
          <polyline points={lp.points.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={lp.color} stroke-width="2.5" />
          {#each lp.points as p (p.x)}
            <circle cx={p.x} cy={p.y} r="3.5" fill={lp.color} />
          {/each}
        {/each}
      {/if}
    {:else}
      {#each pieSlices as slice (slice.label)}
        {#if slice.r2 > 0}
          <path
            d="M {slice.cx + slice.r2 * Math.cos(slice.a0)} {slice.cy + slice.r2 * Math.sin(slice.a0)}
               A {slice.r2} {slice.r2} 0 0 1 {slice.cx + slice.r2 * Math.cos(slice.a1)} {slice.cy + slice.r2 * Math.sin(slice.a1)}
               L {slice.cx + slice.r * Math.cos(slice.a1)} {slice.cy + slice.r * Math.sin(slice.a1)}
               A {slice.r} {slice.r} 0 0 0 {slice.cx + slice.r * Math.cos(slice.a0)} {slice.cy + slice.r * Math.sin(slice.a0)} Z"
            fill={slice.color}><title>{slice.label}: {slice.value}</title></path>
        {:else}
          <path
            d="M {slice.cx} {slice.cy}
               L {slice.cx + slice.r * Math.cos(slice.a0)} {slice.cy + slice.r * Math.sin(slice.a0)}
               A {slice.r} {slice.r} 0 0 1 {slice.cx + slice.r * Math.cos(slice.a1)} {slice.cy + slice.r * Math.sin(slice.a1)} Z"
            fill={slice.color}><title>{slice.label}: {slice.value}</title></path>
        {/if}
      {/each}
    {/if}
  </svg>
  {#if showLegend}
    <figcaption class="m-chart__legend">
      {#each series as s, i (s.name)}
        <span><span class="m-chart__swatch" style="background:{seriesColor(s, i)}"></span>{s.name}</span>
      {/each}
    </figcaption>
  {/if}
</figure>
