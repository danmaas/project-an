<script setup lang="ts">
import { computed } from 'vue'
import type { Filters, GroupBy } from '../types'
import { COUNTRY_CLASSES } from '../data/country'
import { PLATFORMS } from '../types'

const props = defineProps<{
  filters: Filters
  groupBy: GroupBy
  availableJoinWeeks: readonly string[]
  availableExperimentIds: readonly string[]
}>()

const emit = defineEmits<{
  'update:filters': [filters: Filters]
  'update:groupBy': [groupBy: GroupBy]
}>()

function update<K extends keyof Filters>(key: K, value: Filters[K]): void {
  emit('update:filters', { ...props.filters, [key]: value })
}

// A dimension is "locked" by the current group-by: showing it broken-down
// already, so the filter dropdown would be redundant.
const isGrouped = computed(() => ({
  countryAgg: props.groupBy === 'countryAgg',
  platform: props.groupBy === 'platform',
  joinWeek: props.groupBy === 'joinWeek',
}))
</script>

<template>
  <h2 class="section-label" data-testid="filter-panel-label">Filter Players</h2>
  <div class="filter-panel">
    <label class="control">
      <span class="control-label">country</span>
      <select
        :value="filters.countryAgg ?? ''"
        :disabled="isGrouped.countryAgg"
        data-testid="filter-country-agg"
        @change="update('countryAgg', ($event.target as HTMLSelectElement).value || null)"
      >
        <option value="">all</option>
        <option v-for="c in COUNTRY_CLASSES" :key="c" :value="c">{{ c }}</option>
      </select>
    </label>

    <label class="control">
      <span class="control-label">platform</span>
      <select
        :value="filters.platform ?? ''"
        :disabled="isGrouped.platform"
        data-testid="filter-platform"
        @change="update('platform', ($event.target as HTMLSelectElement).value || null)"
      >
        <option value="">all</option>
        <option v-for="p in PLATFORMS" :key="p" :value="p">{{ p }}</option>
      </select>
    </label>

    <label class="control">
      <span class="control-label">join_week</span>
      <select
        :value="filters.joinWeek ?? ''"
        :disabled="isGrouped.joinWeek"
        data-testid="filter-join-week"
        @change="update('joinWeek', ($event.target as HTMLSelectElement).value || null)"
      >
        <option value="">all</option>
        <option v-for="w in availableJoinWeeks" :key="w" :value="w">{{ w }}</option>
      </select>
    </label>

    <label class="control control-groupby">
      <span class="control-label">group&nbsp;by</span>
      <select
        :value="groupBy ?? ''"
        data-testid="group-by"
        @change="
          emit(
            'update:groupBy',
            (($event.target as HTMLSelectElement).value as GroupBy) || null,
          )
        "
      >
        <option value="">none</option>
        <option value="countryAgg">country</option>
        <option value="platform">platform</option>
        <option value="joinWeek">join_week</option>
        <optgroup v-if="availableExperimentIds.length > 0" label="experiment">
          <option
            v-for="exp in availableExperimentIds"
            :key="exp"
            :value="`experiment:${exp}`"
          >
            {{ exp }}
          </option>
        </optgroup>
      </select>
    </label>
  </div>
</template>

<style scoped>
.section-label {
  font-family: var(--font-serif);
  font-weight: 400;
  font-size: 1.1rem;
  color: var(--ink-muted);
  margin: 1.5rem 0 0.4rem;
}

.filter-panel {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.5rem 1.25rem;
  margin: 0 0 1.5rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--rule);
  font-family: var(--font-serif);
}

.control {
  display: inline-flex;
  align-items: baseline;
  gap: 0.4rem;
  font-size: 0.95rem;
  color: var(--ink-muted);
}

.control-label {
  font-style: italic;
}

.control-groupby {
  margin-left: auto;
}

.control select {
  font-family: var(--font-serif);
  font-size: 0.95rem;
  color: var(--ink);
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--rule);
  padding: 0.1rem 0.25rem 0.15rem;
  cursor: pointer;
}

.control select:focus {
  outline: none;
  border-bottom-color: var(--ink);
}

.control select:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
