<script lang="ts">
  import { onDestroy } from 'svelte'
  import TreeNode from './TreeNode.svelte'
  import type { OverviewNode, ConformanceReport, CrJsonManifestEntry } from './types'
  import type { SignalsRubricResult } from './rubrics/types'
  import { getClaimInfo, getSignatureInfo } from './crjson'
  import { evaluateReportSignals } from './summarySignals'

  export let report: ConformanceReport
  export let file: File | null = null

  // Object URL for the opened file — revoked when file changes or component is destroyed
  let fileSrc: string | undefined
  $: {
    if (fileSrc) URL.revokeObjectURL(fileSrc)
    fileSrc = file ? URL.createObjectURL(file) : undefined
  }
  onDestroy(() => { if (fileSrc) URL.revokeObjectURL(fileSrc) })

  let signals: SignalsRubricResult | null = null
  let focusHistory: number[] = [0]

  // Reload signals and reset focus whenever report changes
  $: {
    const current = report
    signals = null
    focusHistory = [0]
    evaluateReportSignals(current).then(result => {
      if (report === current) signals = result
    })
  }

  $: currentFocusIdx = focusHistory[focusHistory.length - 1]

  $: labelIndex = (() => {
    const m = new Map<string, number>()
    report.manifests?.forEach((mf, i) => {
      if (typeof mf.label === 'string') m.set(mf.label, i)
    })
    return m
  })()

  $: tree = buildTree(currentFocusIdx, report, signals, labelIndex)

  $: breadcrumbs = focusHistory.map((idx, i) => ({
    idx,
    name: i === 0 ? 'This File' : (nodeName(idx) ?? `Manifest ${idx}`),
  }))

  function nodeName(idx: number): string | undefined {
    const m = report.manifests?.[idx]
    if (!m) return undefined
    const ci = getClaimInfo(m)
    return ci.claim_generator_info?.[0]?.name ?? ci.claim_generator
  }

  function focusManifest(manifestIdx: number) {
    if (manifestIdx !== currentFocusIdx) {
      focusHistory = [...focusHistory, manifestIdx]
    }
  }

  function navigateTo(historyIdx: number) {
    focusHistory = focusHistory.slice(0, historyIdx + 1)
  }

  // ── Pan / zoom ────────────────────────────────────────────────────────

  const MIN_ZOOM = 0.2
  const MAX_ZOOM = 3

  let canvasEl: HTMLDivElement
  let containerWidth = 0

  let panX = 24
  let panY = 40
  let zoom = 1

  let isDragging = false
  let hasDragged = false
  let _dragStartX = 0
  let _dragStartY = 0
  let _dragStartPanX = 0
  let _dragStartPanY = 0

  // Center on navigation (focus change) or a new file load (report changes).
  // Intentionally NOT on `signals` arrival so mid-session pan state survives.
  $: if (currentFocusIdx !== undefined && report && containerWidth > 0) resetView()

  function resetView() {
    panX = Math.max(24, (containerWidth - 208) / 2)
    panY = 40
    zoom = 1
  }

  function onMouseDown(e: MouseEvent) {
    if (e.button !== 0) return
    isDragging = true
    hasDragged = false
    _dragStartX = e.clientX
    _dragStartY = e.clientY
    _dragStartPanX = panX
    _dragStartPanY = panY
  }

  function onMouseMove(e: MouseEvent) {
    if (!isDragging) return
    const dx = e.clientX - _dragStartX
    const dy = e.clientY - _dragStartY
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) hasDragged = true
    panX = _dragStartPanX + dx
    panY = _dragStartPanY + dy
  }

  function onMouseUp() {
    isDragging = false
  }

  function onWheel(e: WheelEvent) {
    if (!canvasEl) return
    const rect = canvasEl.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    // Normalise: trackpads report tiny deltas, mice report large ones.
    const delta = e.deltaY !== 0 ? e.deltaY : -e.deltaX
    const factor = 1 - Math.sign(delta) * Math.min(Math.abs(delta) * 0.002, 0.15)
    applyZoom(zoom * factor, cx, cy)
  }

  function applyZoom(newZoom: number, cx: number, cy: number) {
    newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newZoom))
    panX = cx - (cx - panX) * (newZoom / zoom)
    panY = cy - (cy - panY) * (newZoom / zoom)
    zoom = newZoom
  }

  function stepZoom(direction: 1 | -1) {
    if (!canvasEl) return
    const rect = canvasEl.getBoundingClientRect()
    applyZoom(zoom * (1 + direction * 0.2), rect.width / 2, rect.height / 2)
  }

  // Touch support via an action so we can register non-passive touchmove.
  let _lastTouchDist = 0

  function touchAction(node: HTMLDivElement) {
    function onTouchStart(e: TouchEvent) {
      if (e.touches.length === 1) {
        isDragging = true
        hasDragged = false
        _dragStartX = e.touches[0].clientX
        _dragStartY = e.touches[0].clientY
        _dragStartPanX = panX
        _dragStartPanY = panY
        _lastTouchDist = 0
      } else if (e.touches.length === 2) {
        isDragging = false
        _lastTouchDist = Math.hypot(
          e.touches[1].clientX - e.touches[0].clientX,
          e.touches[1].clientY - e.touches[0].clientY,
        )
      }
    }

    function onTouchMove(e: TouchEvent) {
      e.preventDefault()
      if (e.touches.length === 1 && isDragging) {
        const dx = e.touches[0].clientX - _dragStartX
        const dy = e.touches[0].clientY - _dragStartY
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) hasDragged = true
        panX = _dragStartPanX + dx
        panY = _dragStartPanY + dy
      } else if (e.touches.length === 2 && _lastTouchDist > 0) {
        const dist = Math.hypot(
          e.touches[1].clientX - e.touches[0].clientX,
          e.touches[1].clientY - e.touches[0].clientY,
        )
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2
        const rect = node.getBoundingClientRect()
        applyZoom(zoom * (dist / _lastTouchDist), midX - rect.left, midY - rect.top)
        _lastTouchDist = dist
      }
    }

    function onTouchEnd(e: TouchEvent) {
      if (e.touches.length < 2) _lastTouchDist = 0
      if (e.touches.length === 0) isDragging = false
    }

    node.addEventListener('touchstart', onTouchStart, { passive: true })
    node.addEventListener('touchmove', onTouchMove, { passive: false })
    node.addEventListener('touchend', onTouchEnd, { passive: true })

    return {
      destroy() {
        node.removeEventListener('touchstart', onTouchStart)
        node.removeEventListener('touchmove', onTouchMove)
        node.removeEventListener('touchend', onTouchEnd)
      },
    }
  }

  // Prevent manifest focus from firing when the user was actually dragging.
  function handleNodeFocus(manifestIdx: number) {
    if (hasDragged) { hasDragged = false; return }
    focusManifest(manifestIdx)
  }

  // ── Tree building ─────────────────────────────────────────────────────

  // Extract the manifest label from a JUMBF URL.
  // Handles both new-style (urn:c2pa:UUID) and old-style (self#jumbf=/c2pa/<label>) formats.
  function parseManifestLabel(url: string): string {
    const prefix = '/c2pa/'
    const i = url.indexOf(prefix)
    if (i >= 0) {
      const after = url.slice(i + prefix.length)
      const slash = after.indexOf('/')
      return slash >= 0 ? after.slice(0, slash) : after
    }
    const urnIdx = url.indexOf('urn:c2pa:')
    if (urnIdx >= 0) {
      const tail = url.slice(urnIdx)
      const slash = tail.indexOf('/')
      return slash >= 0 ? tail.slice(0, slash) : tail
    }
    return url
  }

  function manifestFormat(m: CrJsonManifestEntry): string | undefined {
    const claim = ((m['claim.v2'] ?? m.claim) ?? {}) as Record<string, unknown>
    if (typeof claim['dc:format'] === 'string') return claim['dc:format'] as string
    for (const [key, value] of Object.entries((m.assertions ?? {}) as Record<string, unknown>)) {
      if (!key.startsWith('c2pa.thumbnail') || !value || typeof value !== 'object') continue
      const fmt = (value as Record<string, unknown>).format
      if (typeof fmt === 'string') return fmt
    }
    return undefined
  }

  function thumbnailSrc(m: CrJsonManifestEntry): string | undefined {
    for (const [key, value] of Object.entries((m.assertions ?? {}) as Record<string, unknown>)) {
      if (!key.startsWith('c2pa.thumbnail') || !value || typeof value !== 'object') continue
      const v = value as Record<string, unknown>
      if (typeof v.data !== 'string' || !v.data) continue
      const fmt = typeof v.format === 'string' ? v.format : 'image/jpeg'
      const raw = v.data
      const b64 = raw.startsWith("b64'") && raw.endsWith("'") ? raw.slice(4, -1) : raw
      return `data:${fmt};base64,${b64}`
    }
    return undefined
  }

  function crJsonEdges(
    m: CrJsonManifestEntry,
    idx: Map<string, number>
  ): { childIdx: number; relationship?: string }[] {
    const out: { childIdx: number; relationship?: string }[] = []
    for (const [key, raw] of Object.entries((m.assertions ?? {}) as Record<string, unknown>)) {
      if (!key.startsWith('c2pa.ingredient') || !raw || typeof raw !== 'object') continue
      const v = raw as Record<string, unknown>
      const manifestRef = (v.c2pa_manifest ?? v.activeManifest) as Record<string, unknown> | undefined
      const url = manifestRef?.url as string | undefined
      if (!url) continue
      const childIdx = idx.get(parseManifestLabel(url))
      if (childIdx != null) out.push({ childIdx, relationship: v.relationship as string | undefined })
    }
    return out
  }

  function buildTree(
    rootIdx: number,
    r: ConformanceReport,
    s: SignalsRubricResult | null,
    idx: Map<string, number>,
    visited: Set<number> = new Set()
  ): OverviewNode | null {
    if (visited.has(rootIdx)) return null
    visited.add(rootIdx)

    const manifest = r.manifests?.[rootIdx]
    if (!manifest) return null

    const sigData = s?.manifests[rootIdx]
    const claimInfo = getClaimInfo(manifest)

    const edges = sigData
      ? sigData.ingredients.map(e => ({ childIdx: e.index, relationship: e.relationship }))
      : crJsonEdges(manifest, idx)

    const children: OverviewNode[] = []
    for (const edge of edges) {
      const child = buildTree(edge.childIdx, r, s, idx, new Set(visited))
      if (child) {
        child.relationship = edge.relationship
        children.push(child)
      }
    }

    const sigInfo = getSignatureInfo(manifest)
    const rawDate = sigInfo?.time
    const date = rawDate ? new Date(rawDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : undefined

    return {
      manifestIdx: rootIdx,
      claimGenerator: claimInfo.claim_generator_info?.[0]?.name ?? claimInfo.claim_generator,
      mimeType: sigData?.mimeType ?? manifestFormat(manifest) ?? null,
      thumbnailSrc: thumbnailSrc(manifest),
      date,
      ingredientCount: children.length,
      inceptions: sigData?.localInceptions.map(h => h.reportText) ?? [],
      transformations: sigData?.localTransformations.map(h => h.reportText) ?? [],
      relationship: undefined,
      children,
    }
  }
</script>

{#if tree}
  <!-- Breadcrumbs -->
  {#if breadcrumbs.length > 1}
    <nav class="flex items-center gap-1 mb-4 flex-wrap text-sm" aria-label="Provenance path">
      {#each breadcrumbs as crumb, i}
        {#if i < breadcrumbs.length - 1}
          <button
            class="text-orange-600 dark:text-orange-400 hover:underline font-medium"
            on:click={() => navigateTo(i)}
          >{crumb.name}</button>
          <span class="text-gray-300 dark:text-gray-600 select-none">/</span>
        {:else}
          <span class="text-gray-700 dark:text-gray-300 font-medium">{crumb.name}</span>
        {/if}
      {/each}
    </nav>
  {/if}

  <!-- Pan/zoom canvas -->
  <div
    bind:this={canvasEl}
    bind:clientWidth={containerWidth}
    use:touchAction
    class="relative w-full overflow-hidden rounded-2xl"
    style="height: 520px; cursor: {isDragging ? 'grabbing' : 'grab'}; background-color: var(--canvas-bg, #f8f9fb);"
    role="application"
    aria-label="Provenance tree — drag to pan, scroll to zoom"
    on:mousedown={onMouseDown}
    on:mousemove={onMouseMove}
    on:mouseup={onMouseUp}
    on:mouseleave={onMouseUp}
    on:wheel|preventDefault={onWheel}
  >
    <!-- Dot-grid texture -->
    <svg
      class="absolute inset-0 w-full h-full pointer-events-none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <pattern id="dot-grid" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill="currentColor" class="text-gray-300 dark:text-gray-600" opacity="0.6" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#dot-grid)" />
    </svg>

    <!-- Dark-mode canvas background (Tailwind can't target CSS variables easily) -->
    <div class="absolute inset-0 bg-gray-50 dark:bg-gray-900/60 pointer-events-none rounded-2xl"></div>

    <!-- Tree content (panned and scaled) -->
    <div
      style="position: absolute; top: 0; left: 0;
             transform: translate({panX}px, {panY}px) scale({zoom});
             transform-origin: 0 0;
             will-change: transform;
             pointer-events: {isDragging ? 'none' : 'auto'};"
    >
      <TreeNode
        node={tree}
        onZoom={handleNodeFocus}
        isRoot={true}
        fileSrc={currentFocusIdx === 0 ? fileSrc : undefined}
        fileMimeType={currentFocusIdx === 0 ? file?.type : undefined}
        fileName={currentFocusIdx === 0 ? file?.name : undefined}
      />
    </div>

    <!-- Zoom controls -->
    <div class="absolute bottom-3 right-3 flex flex-col gap-1 z-10 select-none">
      <button
        on:click|stopPropagation={() => stepZoom(1)}
        class="w-8 h-8 rounded-lg bg-white/90 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center shadow-sm backdrop-blur-sm transition-colors text-xl font-light leading-none"
        title="Zoom in (scroll up)"
      >+</button>
      <button
        on:click|stopPropagation={resetView}
        class="w-8 h-8 rounded-lg bg-white/90 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center shadow-sm backdrop-blur-sm transition-colors"
        title="Reset view"
      >
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
          <path d="M3 3v5h5"/>
        </svg>
      </button>
      <button
        on:click|stopPropagation={() => stepZoom(-1)}
        class="w-8 h-8 rounded-lg bg-white/90 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center shadow-sm backdrop-blur-sm transition-colors text-xl font-light leading-none"
        title="Zoom out (scroll down)"
      >−</button>
    </div>

    <!-- Signal loading hint (floating bottom-left) -->
    {#if !signals}
      <p class="absolute bottom-3 left-3 text-xs text-gray-400 dark:text-gray-600 pointer-events-none">Loading signal data…</p>
    {/if}
  </div>
{:else}
  <p class="text-center py-12 text-gray-400 dark:text-gray-600 text-sm">No manifest data</p>
{/if}
