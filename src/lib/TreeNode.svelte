<script lang="ts">
  import type { OverviewNode } from './types'

  export let node: OverviewNode
  export let onZoom: (idx: number) => void
  export let isRoot = false
  export let fileSrc: string | undefined = undefined
  export let fileMimeType: string | undefined = undefined

  // The image/media to show inside the card
  $: previewSrc = fileSrc ?? node.thumbnailSrc
</script>

<div class="flex flex-col items-center min-w-0">
  <!-- Card -->
  <button
    class="relative rounded-2xl overflow-hidden border-2 transition-all w-52 focus:outline-none
      {isRoot
        ? 'border-blue-500 shadow-lg cursor-default'
        : 'border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-md cursor-pointer'}"
    style="aspect-ratio: 4/3"
    on:click={() => !isRoot && onZoom(node.manifestIdx)}
    disabled={isRoot}
  >
    <!-- Media fill -->
    {#if previewSrc}
      {#if (fileSrc && fileMimeType?.startsWith('video/')) || (!fileSrc && node.mimeType?.startsWith('video/'))}
        <video src={previewSrc} class="absolute inset-0 w-full h-full object-cover" muted playsinline></video>
      {:else}
        <img src={previewSrc} alt="" class="absolute inset-0 w-full h-full object-cover" />
      {/if}
    {:else}
      <!-- Placeholder -->
      <div class="absolute inset-0 bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
        {#if node.mimeType?.startsWith('video/')}
          <svg class="w-10 h-10 text-gray-300 dark:text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
            <path d="M4 4m0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M8 4l0 16"/><path d="M16 4l0 16"/><path d="M4 8l4 0"/><path d="M4 12l16 0"/><path d="M4 16l4 0"/><path d="M16 8l4 0"/><path d="M16 16l4 0"/>
          </svg>
        {:else if node.mimeType?.startsWith('audio/')}
          <svg class="w-10 h-10 text-gray-300 dark:text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
            <path d="M3 17a3 3 0 1 0 6 0a3 3 0 0 0-6 0"/><path d="M6 17v-13l12-2v13"/><path d="M15 15a3 3 0 1 0 6 0a3 3 0 0 0-6 0"/>
          </svg>
        {:else}
          <svg class="w-10 h-10 text-gray-300 dark:text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
            <path d="M15 8h.01"/><path d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6z"/><path d="M3 16l5-5c.928-.893 2.072-.893 3 0l5 5"/><path d="M14 14l1-1c.928-.893 2.072-.893 3 0l3 3"/>
          </svg>
        {/if}
      </div>
    {/if}

    <!-- Top-left badge: C2PA icon + date -->
    {#if node.date}
      <div class="absolute top-2 left-2 flex items-center gap-1 bg-white/90 dark:bg-gray-900/85 backdrop-blur-sm rounded-lg px-2 py-1 shadow-sm">
        <!-- C2PA "cr" mark -->
        <svg class="w-3.5 h-3.5 flex-shrink-0 text-gray-700 dark:text-gray-300" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
          <path d="M9 1.5A7.5 7.5 0 1 0 16.5 9 7.508 7.508 0 0 0 9 1.5zm0 13.5A6 6 0 1 1 15 9 6.007 6.007 0 0 1 9 15zM7.875 6.375A2.628 2.628 0 0 0 5.25 9a2.628 2.628 0 0 0 2.625 2.625.75.75 0 0 1 0 1.5A4.13 4.13 0 0 1 3.75 9a4.13 4.13 0 0 1 4.125-4.125.75.75 0 0 1 0 1.5zm5.25 0a.75.75 0 0 1-.75.75A2.628 2.628 0 0 0 9.75 9a2.628 2.628 0 0 0 2.625 2.625.75.75 0 0 1 0 1.5A4.13 4.13 0 0 1 8.25 9a4.13 4.13 0 0 1 4.125-4.125.75.75 0 0 1 .75.75z"/>
        </svg>
        <span class="text-xs font-medium text-gray-700 dark:text-gray-300 leading-none">{node.date}</span>
      </div>
    {/if}

    <!-- Hover overlay for non-root -->
    {#if !isRoot}
      <div class="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors pointer-events-none rounded-2xl"></div>
    {/if}
  </button>

  <!-- Label below card -->
  <div class="mt-2 text-center max-w-[13rem] px-1">
    <p class="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
      {isRoot ? 'This File' : (node.claimGenerator ?? 'Unknown')}
    </p>
    {#if node.inceptions.length > 0 || node.transformations.length > 0}
      <div class="flex flex-wrap justify-center gap-0.5 mt-1">
        {#each node.inceptions.slice(0, 1) as s}
          <span class="text-xs px-1.5 py-0.5 rounded font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">{s}</span>
        {/each}
        {#each node.transformations.slice(0, 1) as s}
          <span class="text-xs px-1.5 py-0.5 rounded font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">{s}</span>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Subtree -->
  {#if node.children.length > 0}
    <!-- Stem -->
    <div class="h-8 w-0.5 bg-gray-200 dark:bg-gray-700 flex-shrink-0 mt-2"></div>

    <!-- Children row -->
    <div class="relative flex flex-row">
      {#if node.children.length > 1}
        <div
          class="absolute top-0 h-0.5 bg-gray-200 dark:bg-gray-700"
          style="left: calc(100% / {2 * node.children.length}); right: calc(100% / {2 * node.children.length})"
        ></div>
      {/if}

      {#each node.children as child}
        <div class="flex flex-col items-center px-3">
          <div class="h-8 w-0.5 bg-gray-200 dark:bg-gray-700 flex-shrink-0"></div>
          <svelte:self node={child} {onZoom} isRoot={false} />
        </div>
      {/each}
    </div>
  {/if}
</div>
