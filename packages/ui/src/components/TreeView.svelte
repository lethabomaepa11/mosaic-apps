<script lang="ts">
  export interface TreeNode {
    id: string;
    label: string;
    children?: TreeNode[];
  }

  interface Props {
    nodes: TreeNode[];
    onSelect?: (node: TreeNode) => void;
  }

  let { nodes, onSelect }: Props = $props();
</script>

<ul class="m-tree">
  {#each nodes as node (node.id)}
    <li>
      <button class="m-menu__item" style="padding:2px 6px;border-radius:4px" onclick={() => onSelect?.(node)}>{node.label}</button>
      {#if node.children?.length}
        <ul>
          {#each node.children as child (child.id)}
            <li><button class="m-menu__item" style="padding:2px 6px;border-radius:4px" onclick={() => onSelect?.(child)}>{child.label}</button></li>
          {/each}
        </ul>
      {/if}
    </li>
  {/each}
</ul>
