<script lang="ts">
  import AuthScreen from '#lib/AuthScreen.svelte';
  let { data } = $props();
</script>

<AuthScreen {data} />
