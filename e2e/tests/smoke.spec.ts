import { test, expect } from '@playwright/test'

test('serves the hello-world UI at /', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Player Insights/i)
  await expect(page.getByRole('heading', { name: 'Player Insights' })).toBeVisible()
  await expect(page.getByText('Hello, world.')).toBeVisible()
})

test('exposes a /healthz endpoint that returns 200 OK', async ({ request }) => {
  const response = await request.get('/healthz')
  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual({ status: 'ok' })
})
