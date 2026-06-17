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
