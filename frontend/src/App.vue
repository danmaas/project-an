<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import { fetchEvents, fetchFileList, type LoadProgress } from './data/parquet'
import { applyFilters, screenEventsByHour, uniqueJoinWeeks } from './data/aggregate'
import {
  computeVariationAssignments,
  experimentIdFromGroupBy,
  uniqueExperimentIds,
} from './data/experiment'
import { chiSquareForMetric, computeRetentionMetrics } from './data/metrics'
import type { ChiSquareResult } from './data/chisquare'
import {
  EMPTY_FILTERS,
  RETENTION_EVENTS,
  type Filters,
  type GroupBy,
  type PlayerEvent,
  type RetentionEvent,
} from './types'
import FilterPanel from './components/FilterPanel.vue'
import MetricsTable from './components/MetricsTable.vue'
import ProgressBar from './components/ProgressBar.vue'
import TimeSeriesChart from './components/TimeSeriesChart.vue'

const title = 'User Insights'
const explainer = 'This is a demo of data analysis & visualization, making use of data from one of my side projects, a mobile puzzle game (https://badukpop.com). As a game developer, it is vital to understand the drivers of user behavior. What aspects of the app, and of user demographics, correlate with important business outcomes, like user retention and monetization?'
+ '\n\n' +
'This demo loads anonymized event logs recorded by the game server. The raw data consists of millions of events, including each time a user navigated in the game UI, started a puzzle, or entered a purchase flow. The "source" dropdown selects a dataset to load ("events-202605-full" is the largest and most useful one; ~60MB download. If download is too slow, try the smaller "events-202605-us"). The "Filter Players" panel allows viewing a subset of the data by demographics (e.g. country and device platform).'
+ '\n\n' +
'The "Metrics" panel displays the key business metrics for the selected users. "returned_Nd" is the fraction of players who kept using the app after N days, and "sub_buy_success" represents players who activated a paid subscription. Naturally, higher is better for these metrics.'
+ '\n\n' +
'This tool can analyze the impact of A/B test experiments. For example, use the "group by" control to select "experiment / sub_sku_annual_only". This experiment bucketed users into two groups, where the "off" group could choose either a monthly or annual subscription, while the "on" group was only offered an annual subscription. The tool calculates the statistical significance of differences in business metrics by test cohort. You should be able to see that the "on" group was significantly more or less likely to purchase a paid subscription, with directionally different outcomes in different countries.'
+ '\n\n' +
'Implementation notes: Data is streamed to the browser in Parquet format, and all analysis is performed client-side. Futher details in the code repo at https://github.com/danmaas/project-an'

const files = ref<string[]>([])
const selectedFile = ref('')
// shallowRef intentionally: the events array can be millions of rows long.
// We never mutate individual rows reactively, so deep-proxying every event
// would be wasted work (and a memory disaster on the larger datasets).
const events = shallowRef<PlayerEvent[]>([])
const status = ref<'loading' | 'ready' | 'error'>('loading')
const progress = ref<LoadProgress | null>(null)
const errorMessage = ref('')

const filters = ref<Filters>({ ...EMPTY_FILTERS })
const groupBy = ref<GroupBy>(null)

const availableJoinWeeks = computed(() => uniqueJoinWeeks(events.value))
const availableExperimentIds = computed(() => uniqueExperimentIds(events.value))

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
const retentionMetrics = computed(() =>
  computeRetentionMetrics(
    events.value,
    filters.value,
    groupBy.value,
    variationAssignments.value,
  ),
)

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

// Parse the explainer string into paragraphs (\n\n-separated) and within each
// paragraph split out https?:// URLs as separate "link" segments so the
// template can render them as real <a> tags. URL matching stops at whitespace
// or a closing paren so trailing punctuation like "(https://...)." doesn't
// get swallowed into the href.
interface ExplainerSegment {
  type: 'text' | 'link'
  text: string
  href?: string
}
const URL_RE = /\bhttps?:\/\/[^\s)]+/g
const explainerParagraphs = computed<ExplainerSegment[][]>(() => {
  return explainer.split(/\n\n+/).map((para) => {
    const segs: ExplainerSegment[] = []
    let i = 0
    for (const m of para.matchAll(URL_RE)) {
      if (m.index! > i) segs.push({ type: 'text', text: para.slice(i, m.index) })
      segs.push({ type: 'link', text: m[0], href: m[0] })
      i = m.index! + m[0].length
    }
    if (i < para.length) segs.push({ type: 'text', text: para.slice(i) })
    return segs
  })
})

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
  progress.value = { phase: 'starting', percent: 0 }
  errorMessage.value = ''
  filters.value = { ...EMPTY_FILTERS }
  groupBy.value = null
  try {
    events.value = await fetchEvents(filename, (p) => {
      progress.value = p
    })
    progress.value = null
    status.value = 'ready'
  } catch (err) {
    progress.value = null
    status.value = 'error'
    errorMessage.value = err instanceof Error ? err.message : String(err)
  }
})
</script>

<template>
  <article class="page">
    <header>
      <h1>{{ title }}</h1>
      <div class="explainer" data-testid="explainer">
        <p v-for="(para, i) in explainerParagraphs" :key="i">
          <template v-for="(seg, j) in para" :key="j">
            <a
              v-if="seg.type === 'link'"
              :href="seg.href"
              target="_blank"
              rel="noopener noreferrer"
              >{{ seg.text }}</a
            >
            <template v-else>{{ seg.text }}</template>
          </template>
        </p>
      </div>
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
      <ProgressBar
        v-if="status === 'loading' && progress"
        data-testid="load-progress"
        :percent="progress.percent"
        :label="progress.phase"
      />
      <p v-else-if="status === 'error'" class="status status-error">
        Failed to load data: {{ errorMessage }}
      </p>
      <template v-else-if="status === 'ready'">
        <TimeSeriesChart :data="screenBuckets" title="Player activity" y-label="activity" />
        <MetricsTable :metrics="retentionMetrics" :chi-square="chiSquareResults" />
      </template>
    </section>
  </article>
</template>

<style scoped>
.page {
  /* Responsive: fluid up to a large cap; comfortable padding on small screens. */
  max-width: 96rem;
  margin: 3rem auto;
  padding: 0 clamp(1rem, 4vw, 3rem);
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
  margin: 0;
  color: var(--ink);
}

.title-row {
  /* legacy class kept for any callers; not used in current template */
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
  flex-wrap: wrap;
}

/* Explainer prose. Expands with the page width like the rest of the layout. */
.explainer {
  font-family: var(--font-serif);
  font-size: 1.05rem;
  line-height: 1.55;
  color: var(--ink);
  margin: 1rem 0 0;
}

.explainer p {
  margin: 0 0 0.9rem;
}

.explainer p:last-child {
  margin-bottom: 0;
}

.explainer a {
  color: var(--ink);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
}

.explainer a:hover {
  text-decoration-thickness: 2px;
}

.source-control {
  display: inline-flex;
  align-items: baseline;
  gap: 0.5rem;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 0.95rem;
  color: var(--ink-muted);
  margin-top: 1.25rem;
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

</style>
