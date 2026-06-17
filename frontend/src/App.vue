<script setup lang="ts">
const title = 'Player Insights'
const subtitle = 'Hello, world.'
const lede =
  'A small demo for exploring behavioral trends among players of a mobile puzzle game.'
</script>

<template>
  <article class="page">
    <header>
      <h1>{{ title }}</h1>
      <p class="subtitle">{{ subtitle }}</p>
    </header>
    <p class="lede">{{ lede }}</p>
  </article>
</template>

<style scoped>
.page {
  max-width: 36rem;
  margin: 6rem auto 4rem;
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

.lede {
  font-family: var(--font-serif);
  font-size: 1.05rem;
  line-height: 1.6;
  color: var(--ink);
  margin: 0;
}
</style>
