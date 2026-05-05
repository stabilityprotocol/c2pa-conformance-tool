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

  function zoomIn(manifestIdx: number) {
    if (manifestIdx !== currentFocusIdx) {
      focusHistory = [...focusHistory, manifestIdx]
    }
  }

  function navigateTo(historyIdx: number) {
    focusHistory = focusHistory.slice(0, historyIdx + 1)
  }

  // ── Tree building ─────────────────────────────────────────────────────

  function parseUrn(url: string): string {
    const i = url.indexOf('urn:c2pa:')
    if (i < 0) return url
    const tail = url.slice(i)
    const slash = tail.indexOf('/')
    return slash >= 0 ? tail.slice(0, slash) : tail
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
      const url = ((v.activeManifest as Record<string, unknown> | undefined)?.url as string | undefined)
      if (!url) continue
      const childIdx = idx.get(parseUrn(url))
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
    <nav class="flex items-center gap-1 mb-6 flex-wrap text-sm" aria-label="Provenance path">
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

  <!-- Tree -->
  <div class="w-full overflow-x-auto pb-4">
    <TreeNode
      node={tree}
      onZoom={zoomIn}
      isRoot={true}
      fileSrc={currentFocusIdx === 0 ? fileSrc : undefined}
      fileMimeType={currentFocusIdx === 0 ? file?.type : undefined}
    />
  </div>

  <!-- Signal loading hint -->
  {#if !signals}
    <p class="mt-4 text-center text-xs text-gray-400 dark:text-gray-600">Loading signal data…</p>
  {/if}
{:else}
  <p class="text-center py-12 text-gray-400 dark:text-gray-600 text-sm">No manifest data</p>
{/if}
