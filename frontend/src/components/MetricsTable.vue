<script setup lang="ts">
import { computed } from 'vue'
import type { RetentionEvent, RetentionMetrics } from '../types'
import { RETENTION_EVENTS } from '../types'

const props = defineProps<{
  metrics: RetentionMetrics[]
}>()

const isGrouped = computed(() => props.metrics.some((m) => m.group !== undefined))

function columnLabel(m: RetentionMetrics): string {
  return m.group ?? 'all'
}

function formatRate(num: number, denom: number): string {
  if (denom === 0) return '—'
  const pct = (num / denom) * 100
  // Hide trailing decimal noise for clean small numbers (e.g. "0%" not "0.0%").
  return pct === 0 ? '0%' : `${pct.toFixed(1)}%`
}

function formatCount(n: number): string {
  return n.toLocaleString()
}

const metricKeys = RETENTION_EVENTS as readonly RetentionEvent[]
</script>

<template>
  <figure class="metrics" data-testid="metrics-table">
    <table>
      <thead>
        <tr>
          <th scope="col" class="row-label-col"></th>
          <th
            v-for="m in metrics"
            :key="columnLabel(m)"
            scope="col"
            class="metric-col"
          >
            {{ columnLabel(m) }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr class="row-n">
          <th scope="row">n (players)</th>
          <td v-for="m in metrics" :key="columnLabel(m)">
            {{ formatCount(m.totalPlayers) }}
          </td>
        </tr>
        <tr v-for="key in metricKeys" :key="key">
          <th scope="row">{{ key }}</th>
          <td v-for="m in metrics" :key="columnLabel(m)">
            <span class="rate">{{ formatRate(m.counts[key], m.totalPlayers) }}</span>
            <span class="count">({{ formatCount(m.counts[key]) }})</span>
          </td>
        </tr>
      </tbody>
    </table>
    <figcaption v-if="isGrouped">
      Retention & monetization rates by {{ metrics.length }} groups.
    </figcaption>
  </figure>
</template>

<style scoped>
.metrics {
  margin: 2rem 0 0;
  font-family: var(--font-serif);
}

table {
  border-collapse: collapse;
  width: 100%;
  font-size: 0.95rem;
  color: var(--ink);
}

thead th {
  font-weight: 400;
  font-style: italic;
  color: var(--ink-muted);
  text-align: right;
  padding: 0.35rem 0.75rem 0.5rem;
  border-bottom: 1px solid var(--rule);
}

thead th.row-label-col {
  text-align: left;
}

tbody th {
  font-weight: 400;
  font-style: italic;
  color: var(--ink-muted);
  text-align: left;
  padding: 0.35rem 0.75rem;
  white-space: nowrap;
}

tbody td {
  text-align: right;
  padding: 0.35rem 0.75rem;
  font-variant-numeric: tabular-nums;
}

.row-n th,
.row-n td {
  border-bottom: 1px solid var(--rule);
  padding-bottom: 0.55rem;
}

.row-n + tr th,
.row-n + tr td {
  padding-top: 0.55rem;
}

.rate {
  display: inline-block;
  min-width: 3.5em;
}

.count {
  color: var(--ink-muted);
  margin-left: 0.4rem;
  font-size: 0.85em;
}

figcaption {
  font-style: italic;
  color: var(--ink-muted);
  font-size: 0.9rem;
  margin-top: 0.5rem;
  text-align: right;
}
</style>
