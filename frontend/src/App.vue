<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { fetchEvents, fetchFileList } from './data/parquet'
import { applyFilters, screenEventsByHour, uniqueJoinWeeks } from './data/aggregate'
import {
  computeVariationAssignments,
  experimentIdFromGroupBy,
  uniqueExperimentIds,
} from './data/experiment'
import { chiSquareForMetric, computeRetentionMetrics } from './data/metrics'
import type { ChiSquareResult } from './data/chisquare'
import { RETENTION_EVENTS, type RetentionEvent } from './types'
import { synthesizeRetentionEvents } from './data/synthesize'
import { EMPTY_FILTERS, type Filters, type GroupBy, type PlayerEvent } from './types'
// Note: RETENTION_EVENTS / RetentionEvent / ChiSquareResult imported above
// near the metrics imports to keep related code together.
import FilterPanel from './components/FilterPanel.vue'
import MetricsTable from './components/MetricsTable.vue'
import TimeSeriesChart from './components/TimeSeriesChart.vue'

const title = 'Player Insights'
const subtitle = 'Hourly screen-event traffic'

const files = ref<string[]>([])
const selectedFile = ref('')
const events = ref<PlayerEvent[]>([])
const status = ref<'loading' | 'ready' | 'error'>('loading')
const errorMessage = ref('')

const filters = ref<Filters>({ ...EMPTY_FILTERS })
const groupBy = ref<GroupBy>(null)

const availableJoinWeeks = computed(() => uniqueJoinWeeks(events.value))
const availableExperimentIds = computed(() => uniqueExperimentIds(events.value))

// Experiment-analysis mode: when group-by is `experiment:<id>`, compute each
// player's first non-control variation_id for that experiment. Used both as a
// player-level filter and as the chart/metrics group key.
const variationAssignments = computed(() => {
  const id = experimentIdFromGroupBy(groupBy.value)
  return id ? computeVariationAssignments(events.value, id) : null
})

const filteredEvents = computed(() =>
  applyFilters(events.value, filters.value, variationAssignments.value),
)
const screenBuckets = computed(() =>
  screenEventsByHour(filteredEvents.value, groupBy.value, variationAssignments.value),
)
const totalEvents = computed(() => screenBuckets.value.reduce((sum, b) => sum + b.count, 0))
// Retention metrics are computed over the unfiltered events, applying the
// filter at the player level inside computeRetentionMetrics. This is more
// efficient than re-filtering events for every metric.
const retentionMetrics = computed(() =>
  computeRetentionMetrics(
    events.value,
    filters.value,
    groupBy.value,
    variationAssignments.value,
  ),
)

// Chi-square test of independence is only meaningful in experiment-analysis
// mode (TASK-510), and only when there are ≥2 variations to compare.
const chiSquareResults = computed<Record<RetentionEvent, ChiSquareResult | null> | null>(
  () => {
    if (!variationAssignments.value) return null
    if (retentionMetrics.value.length < 2) return null
    const out = {} as Record<RetentionEvent, ChiSquareResult | null>
    for (const ev of RETENTION_EVENTS) {
      out[ev] = chiSquareForMetric(retentionMetrics.value, ev)
    }
    return out
  },
)

function formatFilename(name: string): string {
  return name.replace(/\.parquet$/i, '')
}

onMounted(async () => {
  try {
    files.value = await fetchFileList()
    if (files.value.length === 0) {
      status.value = 'error'
      errorMessage.value = 'No event-log files were found in the data directory.'
      return
    }
    selectedFile.value = files.value[0]
  } catch (err) {
    status.value = 'error'
    errorMessage.value = err instanceof Error ? err.message : String(err)
  }
})

watch(selectedFile, async (filename) => {
  if (!filename) return
  status.value = 'loading'
  errorMessage.value = ''
  // Reset filter/group-by when switching files; available join-weeks change.
  filters.value = { ...EMPTY_FILTERS }
  groupBy.value = null
  try {
    const raw = await fetchEvents(filename)
    // `returned_Nd` events are not present in the raw log — synthesize them
    // from `screen` events in the appropriate windows after account creation.
    events.value = synthesizeRetentionEvents(raw)
    status.value = 'ready'
  } catch (err) {
    status.value = 'error'
    errorMessage.value = err instanceof Error ? err.message : String(err)
  }
})
</script>

<template>
  <article class="page">
    <header>
      <h1>{{ title }}</h1>
      <div class="header-row">
        <p class="subtitle">{{ subtitle }}</p>
        <label class="source-control">
          <span>source</span>
          <select
            v-model="selectedFile"
            :disabled="files.length === 0"
            data-testid="source-select"
          >
            <option v-for="f in files" :key="f" :value="f">{{ formatFilename(f) }}</option>
          </select>
        </label>
      </div>
    </header>

    <FilterPanel
      v-if="status === 'ready'"
      :filters="filters"
      :group-by="groupBy"
      :available-join-weeks="availableJoinWeeks"
      :available-experiment-ids="availableExperimentIds"
      @update:filters="filters = $event"
      @update:group-by="groupBy = $event"
    />

    <section class="chart-wrap" aria-live="polite">
      <p v-if="status === 'loading'" class="status">Loading event log…</p>
      <p v-else-if="status === 'error'" class="status status-error">
        Failed to load data: {{ errorMessage }}
      </p>
      <template v-else>
        <TimeSeriesChart :data="screenBuckets" y-label="screen events / hour" />
        <p class="caption">
          {{ totalEvents.toLocaleString() }} screen events,
          {{ screenBuckets.length }} hourly buckets.
        </p>
        <MetricsTable :metrics="retentionMetrics" :chi-square="chiSquareResults" />
      </template>
    </section>
  </article>
</template>

<style scoped>
.page {
  max-width: 56rem;
  margin: 4rem auto;
  padding: 0 1.5rem;
}

header {
  border-bottom: 1px solid var(--rule);
  padding-bottom: 1.25rem;
  margin-bottom: 1.5rem;
}

h1 {
  font-family: var(--font-serif);
  font-weight: 400;
  font-size: 2.25rem;
  line-height: 1.15;
  letter-spacing: -0.01em;
  margin: 0 0 0.5rem;
  color: var(--ink);
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
  flex-wrap: wrap;
}

.subtitle {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 1.1rem;
  color: var(--ink-muted);
  margin: 0;
}

.source-control {
  display: inline-flex;
  align-items: baseline;
  gap: 0.5rem;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 0.95rem;
  color: var(--ink-muted);
}

.source-control select {
  font-family: var(--font-serif);
  font-style: normal;
  font-size: 0.95rem;
  background: transparent;
  color: var(--ink);
  border: none;
  border-bottom: 1px solid var(--rule);
  padding: 0.1rem 0.25rem 0.15rem;
  cursor: pointer;
}

.source-control select:focus {
  outline: none;
  border-bottom-color: var(--ink);
}

.source-control select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.chart-wrap {
  min-height: 360px;
}

.status {
  font-family: var(--font-serif);
  font-style: italic;
  color: var(--ink-muted);
  margin: 1rem 0;
}

.status-error {
  color: #993333;
}

.caption {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 0.95rem;
  color: var(--ink-muted);
  margin: 0.75rem 0 0;
  text-align: right;
}
</style>
