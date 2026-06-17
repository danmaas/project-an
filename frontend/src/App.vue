<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { fetchEvents } from './data/parquet'
import { screenEventsByHour } from './data/aggregate'
import type { HourlyBucket } from './types'
import TimeSeriesChart from './components/TimeSeriesChart.vue'

const title = 'Player Insights'
const subtitle = 'Hourly screen-event traffic'

const data = ref<HourlyBucket[]>([])
const totalEvents = ref(0)
const status = ref<'loading' | 'ready' | 'error'>('loading')
const errorMessage = ref('')

onMounted(async () => {
  try {
    const events = await fetchEvents('events-202605-ca.parquet')
    data.value = screenEventsByHour(events)
    totalEvents.value = data.value.reduce((sum, b) => sum + b.count, 0)
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
      <p class="subtitle">{{ subtitle }}</p>
    </header>
    <section class="chart-wrap" aria-live="polite">
      <p v-if="status === 'loading'" class="status">Loading event log…</p>
      <p v-else-if="status === 'error'" class="status status-error">
        Failed to load data: {{ errorMessage }}
      </p>
      <template v-else>
        <TimeSeriesChart :data="data" y-label="screen events / hour" />
        <p class="caption">
          {{ totalEvents.toLocaleString() }} screen events,
          {{ data.length }} hourly buckets.
        </p>
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
  margin: 0 0 0.25rem;
  color: var(--ink);
}

.subtitle {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 1.1rem;
  color: var(--ink-muted);
  margin: 0;
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
