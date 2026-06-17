import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import App from '../src/App.vue'

// hyparquet does real network I/O via fetch — stub it out so we can drive
// App.vue's onMounted flow without standing up a backend.
vi.mock('../src/data/parquet', () => ({
  fetchEvents: vi.fn(),
}))

import { fetchEvents } from '../src/data/parquet'
const fetchEventsMock = fetchEvents as ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchEventsMock.mockReset()
})

describe('App', () => {
  it('renders the title and subtitle on initial mount', () => {
    fetchEventsMock.mockReturnValue(new Promise(() => {})) // never resolves
    const wrapper = mount(App)
    expect(wrapper.text()).toContain('Player Insights')
    expect(wrapper.text()).toContain('Hourly screen-event traffic')
  })

  it('shows a loading status while data is being fetched', () => {
    fetchEventsMock.mockReturnValue(new Promise(() => {}))
    const wrapper = mount(App)
    expect(wrapper.text()).toContain('Loading')
  })

  it('renders a caption summarizing the data once loaded', async () => {
    fetchEventsMock.mockResolvedValue([
      { ts: new Date('2026-05-01T10:00:00Z'), event: 'screen' },
      { ts: new Date('2026-05-01T10:05:00Z'), event: 'screen' },
      { ts: new Date('2026-05-01T11:00:00Z'), event: 'screen' },
      { ts: new Date('2026-05-01T11:00:00Z'), event: 'problem_set_started' },
    ])
    const wrapper = mount(App)
    await flushPromises()
    expect(wrapper.text()).toContain('3 screen events')
    expect(wrapper.text()).toContain('2 hourly buckets')
  })

  it('surfaces a friendly error message when the fetch fails', async () => {
    fetchEventsMock.mockRejectedValue(new Error('boom'))
    const wrapper = mount(App)
    await flushPromises()
    expect(wrapper.text()).toContain('Failed to load data')
    expect(wrapper.text()).toContain('boom')
  })
})
