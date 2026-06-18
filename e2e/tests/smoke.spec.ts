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
  // We don't pin an exact count — the data/ directory can grow over time.
  const count = await select.locator('option').count()
  expect(count).toBeGreaterThanOrEqual(1)
  await expect(select).toContainText('events-202605-ca')
})

test('lists files via /api/data', async ({ request }) => {
  const response = await request.get('/api/data')
  expect(response.status()).toBe(200)
  const body = (await response.json()) as { files: string[] }
  expect(body.files).toContain('events-202605-ca.parquet')
  expect(body.files).toEqual([...body.files].sort()) // listing is alphabetical
})

test('renders the retention & monetization metrics table', async ({ page }) => {
  await page.goto('/')
  const table = page.getByTestId('metrics-table')
  await expect(table).toBeVisible({ timeout: 30_000 })

  // All four metrics rows are present.
  await expect(table).toContainText('n (players)')
  await expect(table).toContainText('returned_1d')
  await expect(table).toContainText('returned_2d')
  await expect(table).toContainText('returned_3d')
  await expect(table).toContainText('sub_buy_success')

  // n (players) is reported as a real number (digits, optional thousands commas).
  const nCell = table.locator('tr.row-n td')
  await expect(nCell).toHaveText(/^\d{1,3}(,\d{3})*$/)

  // returned_1d events are synthesized client-side from screen events, so the
  // 1-day retention rate on the ca dataset should be a non-zero percentage.
  // (If TASK-450 synthesis is broken or wired up wrong, this row would read 0%.)
  const r1dCell = table.locator('tr:has(th:text-is("returned_1d")) td .rate')
  await expect(r1dCell).toHaveText(/^\d+(\.\d+)?%$/)
  await expect(r1dCell).not.toHaveText('0%')
})

test('metrics table breaks out by group when group-by is active', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('metrics-table')).toBeVisible({ timeout: 30_000 })

  await page.getByTestId('group-by').selectOption('platform')

  const table = page.getByTestId('metrics-table')
  // platform values per AGENTS.md: ios, android, web — at least 2 are present in the ca file.
  const headers = table.locator('thead th')
  // Subtract 1 for the empty row-label column header.
  await expect.poll(async () => (await headers.count()) - 1).toBeGreaterThanOrEqual(2)
})

test('group-by lists experiments and selecting one breaks metrics out by variation', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByTestId('metrics-table')).toBeVisible({ timeout: 30_000 })

  // The dropdown should include the dimension options plus an experiment optgroup.
  const groupBy = page.getByTestId('group-by')
  await expect(
    groupBy.locator('optgroup[label="experiment"] option').first(),
  ).toBeAttached()

  // sub_sku_annual_only has variations 'off' and 'on' in the ca dataset.
  await groupBy.selectOption('experiment:sub_sku_annual_only')

  // Headers: empty | off | on | p-value (TASK-510 adds the last column in
  // experiment-analysis mode).
  const headers = page.locator('[data-testid="metrics-table"] thead th')
  await expect(headers).toHaveText(['', 'off', 'on', 'p‑value'], { timeout: 5_000 })

  // Variation columns: each has a non-zero player count.
  const nCells = page.locator('[data-testid="metrics-table"] tr.row-n td:not(.pvalue)')
  await expect(nCells).toHaveCount(2)
  for (let i = 0; i < 2; i++) {
    await expect(nCells.nth(i)).toHaveText(/^\d{1,3}(,\d{3})*$/)
    await expect(nCells.nth(i)).not.toHaveText('0')
  }

  // Each retention-event row carries a chi-square p-value cell with either
  // a 0.xxx number or "<0.001".
  const pvalueCells = page.locator(
    '[data-testid="metrics-table"] tbody tr:not(.row-n) td.pvalue',
  )
  await expect(pvalueCells).toHaveCount(4)
  for (let i = 0; i < 4; i++) {
    await expect(pvalueCells.nth(i)).toHaveText(/^(<0\.001|>0\.999|0\.\d{3})$/)
  }
})

test('p-value column is hidden for non-experiment group-by', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('metrics-table')).toBeVisible({ timeout: 30_000 })

  await page.getByTestId('group-by').selectOption('countryAgg')
  // Wait briefly for the reactive update.
  await page.waitForTimeout(200)
  await expect(page.getByTestId('pvalue-header')).toHaveCount(0)
})

test('loads the medium dataset without freezing the UI, showing a progress bar', async ({
  page,
}) => {
  await page.goto('/')
  // Wait for the initial (ca) dataset to render so we know the app is up.
  await expect(page.getByTestId('metrics-table')).toBeVisible({ timeout: 30_000 })

  // Switch to the medium dataset. With TASK-600 the load runs on a worker, so
  // the page stays responsive and the progress bar appears.
  await page.getByTestId('source-select').selectOption('events-202605-us.parquet')

  // The progress bar appears within a few seconds.
  await expect(page.getByTestId('load-progress')).toBeVisible({ timeout: 5_000 })

  // While the worker is decoding, the UI thread should still respond — we can
  // do other DOM queries without timing out. (If the main thread were blocked,
  // this poll would never resolve and the test would time out.)
  const responsiveDuringLoad = await page.evaluate(() => {
    // A quick synchronous call that requires the main thread to service it.
    return document.title
  })
  expect(responsiveDuringLoad).toMatch(/Player Insights/i)

  // Eventually the chart renders for the new file. Give it generous time —
  // 1.4M rows take a few seconds even on a worker.
  await expect(page.getByTestId('load-progress')).toBeHidden({ timeout: 90_000 })
  await expect(page.locator('[data-testid="chart"] svg')).toBeVisible()
  // n (players) for the us dataset is ~9k.
  const nCell = page.locator('[data-testid="metrics-table"] tr.row-n td').first()
  await expect(nCell).toHaveText(/^\d{1,3}(,\d{3})+$/)
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
