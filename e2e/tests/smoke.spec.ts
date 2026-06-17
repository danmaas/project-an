import { test, expect } from '@playwright/test'

test('renders the time-series chart for screen events', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Player Insights/i)
  await expect(page.getByRole('heading', { name: 'Player Insights' })).toBeVisible()

  // Chart loads asynchronously: the parquet is fetched, decoded, aggregated,
  // then rendered as an SVG. Once that completes the loading state is gone.
  const chart = page.locator('[data-testid="chart"] svg')
  await expect(chart).toBeVisible({ timeout: 30_000 })

  // Sanity-check the caption that summarizes the loaded dataset. The text
  // "screen events" appears in the Y-axis label too, so we scope to .caption.
  const caption = page.locator('.caption')
  await expect(caption).toContainText(/\d{1,3}(,\d{3})+ screen events/)
  await expect(caption).toContainText(/\d+ hourly buckets/)
})

test('filter narrows the dataset and updates the caption', async ({ page }) => {
  await page.goto('/')
  const caption = page.locator('.caption')
  await expect(caption).toContainText(/screen events/, { timeout: 30_000 })

  const unfiltered = (await caption.textContent()) ?? ''

  // The ca-only dataset has both ENG and Other countries — pick jp which is
  // present in much smaller volume (or zero) — but at minimum the caption
  // text should change once a filter is applied.
  await page.getByTestId('filter-platform').selectOption('ios')
  await expect(caption).not.toHaveText(unfiltered, { timeout: 5_000 })
  await expect(caption).toContainText(/screen events/)
})

test('group-by renders a multi-series chart with a legend', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-testid="chart"] svg')).toBeVisible({ timeout: 30_000 })

  await page.getByTestId('group-by').selectOption('platform')

  // Once grouped, Plot adds a swatch legend with one entry per platform.
  // The legend renders as a separate svg under the chart container.
  const swatches = page.locator('[data-testid="chart"] .plot-swatch, [data-testid="chart"] [class*="swatch"]')
  await expect(swatches.first()).toBeVisible({ timeout: 5_000 })

  // The country filter remains enabled; the platform filter becomes disabled
  // because we're already breaking out by platform.
  await expect(page.getByTestId('filter-platform')).toBeDisabled()
  await expect(page.getByTestId('filter-country-agg')).toBeEnabled()
})

test('lists available event logs in the source dropdown', async ({ page }) => {
  await page.goto('/')
  const select = page.getByTestId('source-select')
  await expect(select).toBeVisible()
  await expect(select.locator('option')).toHaveCount(2)
  await expect(select).toContainText('events-202605-ca')
  await expect(select).toContainText('events-202605-full')
})

test('lists files via /api/data', async ({ request }) => {
  const response = await request.get('/api/data')
  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual({
    files: ['events-202605-ca.parquet', 'events-202605-full.parquet'],
  })
})

test('exposes a /healthz endpoint that returns 200 OK', async ({ request }) => {
  const response = await request.get('/healthz')
  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual({ status: 'ok' })
})

test('serves the parquet file as a blob from /api/data/', async ({ request }) => {
  const response = await request.get('/api/data/events-202605-ca.parquet')
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toContain('parquet')
  const body = await response.body()
  // Parquet files start (and end) with the magic ASCII bytes "PAR1".
  expect(body.subarray(0, 4).toString()).toBe('PAR1')
})

test('rejects unknown data files with 404', async ({ request }) => {
  const response = await request.get('/api/data/does-not-exist.parquet')
  expect(response.status()).toBe(404)
})
