<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as Plot from '@observablehq/plot'
import type { HourlyBucket } from '../types'

const props = defineProps<{
  data: HourlyBucket[]
  /** Optional title rendered above the chart. */
  title?: string
  yLabel?: string
}>()

const container = ref<HTMLDivElement>()

interface LegendEntry {
  group: string
  color: string
  visible: boolean
}
const legendItems = ref<LegendEntry[]>([])

// Distinct group keys in the data, sorted alphabetically for stable colors.
const allGroups = computed(() => {
  const set = new Set<string>()
  for (const b of props.data) if (b.group !== undefined) set.add(b.group)
  return [...set].sort()
})

// Visibility state for clickable legend (Grafana-style focus). Resets to
// "all visible" whenever the set of available groups changes (e.g. the user
// picked a different group-by dimension).
const visibleGroups = ref<Set<string>>(new Set())
watch(
  allGroups,
  (groups) => {
    visibleGroups.value = new Set(groups)
  },
  { immediate: true },
)

function toggleGroup(g: string): void {
  // Click semantics:
  //  - Click a label → hide everything else, focus on this one.
  //  - Click that label again (only one visible, equal to this) → restore all.
  //  - Click a *different* label → switch focus to that one.
  const onlyThis = visibleGroups.value.size === 1 && visibleGroups.value.has(g)
  visibleGroups.value = onlyThis ? new Set(allGroups.value) : new Set([g])
}

function render(): void {
  if (!container.value) return
  container.value.replaceChildren()

  const grouped = allGroups.value.length > 0
  const filtered =
    grouped && visibleGroups.value.size < allGroups.value.length
      ? props.data.filter((b) => !b.group || visibleGroups.value.has(b.group))
      : props.data

  const lineOptions: Plot.LineYOptions = grouped
    ? { x: 'hour', y: 'count', stroke: 'group', strokeWidth: 1 }
    : { x: 'hour', y: 'count', stroke: '#111111', strokeWidth: 1 }

  const chart = Plot.plot({
    marks: [Plot.ruleY([0], { stroke: '#cccccc' }), Plot.lineY(filtered, lineOptions)],
    x: { type: 'time', label: null, ticks: 6 },
    y: { label: props.yLabel ?? null, grid: true, nice: true, tickFormat: '~s' },
    // Explicit domain keeps colors stable even when we filter to a subset.
    // Plot's built-in legend is disabled; we render our own clickable one below.
    color: grouped ? { domain: allGroups.value } : undefined,
    style: {
      background: 'transparent',
      color: '#111111',
      fontFamily: 'Charter, "Iowan Old Style", Palatino, Georgia, serif',
      fontSize: '12px',
    },
    width: container.value.clientWidth || 720,
    height: 360,
    marginLeft: 56,
    marginBottom: 36,
  })
  container.value.append(chart)

  if (grouped) {
    // Read back the resolved color scale so our legend uses the same colors
    // Plot picked for the strokes.
    const scale = chart.scale('color') as { domain?: string[]; range?: string[] } | null
    const domain = scale?.domain ?? allGroups.value
    const range = scale?.range ?? []
    legendItems.value = domain.map((g, i) => ({
      group: g,
      color: range[i % Math.max(range.length, 1)] ?? '#111',
      visible: visibleGroups.value.has(g),
    }))
  } else {
    legendItems.value = []
  }
}

let resizeObserver: ResizeObserver | undefined

onMounted(() => {
  render()
  if (typeof ResizeObserver !== 'undefined' && container.value) {
    resizeObserver = new ResizeObserver(() => render())
    resizeObserver.observe(container.value)
  }
})

onBeforeUnmount(() => resizeObserver?.disconnect())

watch(() => props.data, render)
watch(visibleGroups, render, { deep: true })
</script>

<template>
  <div class="chart-block">
    <h2 v-if="title" class="chart-title" data-testid="chart-title">{{ title }}</h2>
    <div ref="container" class="chart" data-testid="chart"></div>
    <div v-if="legendItems.length > 0" class="legend" data-testid="legend">
      <button
        v-for="item in legendItems"
        :key="item.group"
        type="button"
        class="legend-item"
        :class="{ inactive: !item.visible }"
        :aria-pressed="item.visible"
        @click="toggleGroup(item.group)"
      >
        <span class="swatch" :style="{ background: item.color }" aria-hidden="true"></span>
        <span class="label">{{ item.group }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.chart-block {
  width: 100%;
}

.chart-title {
  font-family: var(--font-serif);
  font-weight: 400;
  font-size: 1.1rem;
  color: var(--ink-muted);
  margin: 1.5rem 0 0.5rem;
}

.chart {
  width: 100%;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1.25rem;
  margin: 0.75rem 0 0 56px; /* align left edge with chart's plotting area */
  font-family: var(--font-serif);
}

.legend-item {
  display: inline-flex;
  align-items: baseline;
  gap: 0.45rem;
  padding: 0.1rem 0;
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.9rem;
  color: var(--ink);
  transition: opacity 100ms;
}

.legend-item:hover {
  opacity: 0.7;
}

.legend-item:focus-visible {
  outline: 1px dotted var(--ink);
  outline-offset: 2px;
}

.legend-item.inactive {
  opacity: 0.35;
}

.legend-item .swatch {
  display: inline-block;
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 1px;
  transform: translateY(1px);
}

.legend-item .label {
  font-style: italic;
}

.legend-item.inactive .label {
  text-decoration: line-through;
}
</style>
