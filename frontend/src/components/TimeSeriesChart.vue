<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import * as Plot from '@observablehq/plot'
import type { HourlyBucket } from '../types'

const props = defineProps<{
  data: HourlyBucket[]
  yLabel?: string
}>()

const container = ref<HTMLDivElement>()

function render(): void {
  if (!container.value) return
  container.value.replaceChildren()

  const hasGroups = props.data.some((d) => d.group !== undefined)
  const lineOptions: Plot.LineYOptions = hasGroups
    ? { x: 'hour', y: 'count', stroke: 'group', strokeWidth: 1 }
    : { x: 'hour', y: 'count', stroke: '#111111', strokeWidth: 1 }

  const chart = Plot.plot({
    marks: [Plot.ruleY([0], { stroke: '#cccccc' }), Plot.lineY(props.data, lineOptions)],
    x: { type: 'time', label: null, ticks: 6 },
    y: { label: props.yLabel ?? null, grid: true, nice: true, tickFormat: '~s' },
    color: hasGroups ? { legend: true, label: null } : undefined,
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
</script>

<template>
  <div ref="container" class="chart" data-testid="chart"></div>
</template>

<style scoped>
.chart {
  width: 100%;
}
</style>
