<script lang="ts">
  interface Props {
    code: string;
    language?: string;
  }

  let { code, language = 'ts' }: Props = $props();
</script>

<pre class="m-code"><code>{code}</code></pre>
