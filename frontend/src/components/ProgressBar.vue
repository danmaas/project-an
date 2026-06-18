<script setup lang="ts">
defineProps<{
  percent: number
  label?: string
}>()
</script>

<template>
  <div class="progress" role="progressbar" :aria-valuenow="percent" aria-valuemin="0" aria-valuemax="100">
    <p v-if="label" class="progress-label">{{ label }}…</p>
    <div class="progress-track">
      <div class="progress-fill" :style="{ width: `${percent}%` }"></div>
    </div>
    <p class="progress-percent">{{ percent }}%</p>
  </div>
</template>

<style scoped>
.progress {
  margin: 2rem 0;
  font-family: var(--font-serif);
}

.progress-label {
  margin: 0 0 0.5rem;
  font-style: italic;
  color: var(--ink-muted);
  font-size: 1rem;
}

.progress-track {
  width: 100%;
  height: 3px;
  background: var(--rule);
  position: relative;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--ink);
  transition: width 200ms linear;
}

.progress-percent {
  margin: 0.4rem 0 0;
  font-size: 0.85rem;
  font-style: italic;
  color: var(--ink-muted);
  text-align: right;
  font-variant-numeric: tabular-nums;
}
</style>
