import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import App from '../src/App.vue'
import type { PlayerEvent } from '../src/types'

vi.mock('../src/data/parquet', () => ({
  fetchFileList: vi.fn(),
  fetchEvents: vi.fn(),
}))

import { fetchEvents, fetchFileList } from '../src/data/parquet'
const fetchEventsMock = fetchEvents as ReturnType<typeof vi.fn>
const fetchFileListMock = fetchFileList as ReturnType<typeof vi.fn>

function ev(
  iso: string,
  event = 'screen',
  countryAgg = 'ENG',
  platform = 'ios',
  joinWeek = '2026-04-27',
): PlayerEvent {
  return {
    ts: new Date(iso),
    event,
    countryAgg,
    platform,
    joinWeek: new Date(`${joinWeek}T00:00:00Z`),
  }
}

const sampleEvents: PlayerEvent[] = [
  ev('2026-05-01T10:00:00Z', 'screen', 'ENG', 'ios', '2026-04-27'),
  ev('2026-05-01T10:05:00Z', 'screen', 'ENG', 'android', '2026-04-27'),
  ev('2026-05-01T11:00:00Z', 'screen', 'jp', 'ios', '2026-05-04'),
  ev('2026-05-01T11:00:00Z', 'problem_set_started', 'ENG', 'ios', '2026-04-27'),
]

beforeEach(() => {
  fetchEventsMock.mockReset()
  fetchFileListMock.mockReset()
})

describe('App', () => {
  it('renders the title and subtitle on initial mount', () => {
    fetchFileListMock.mockReturnValue(new Promise(() => {}))
    const wrapper = mount(App)
    expect(wrapper.text()).toContain('Player Insights')
    expect(wrapper.text()).toContain('Hourly screen-event traffic')
  })

  it('lists available files in the source dropdown and loads the first one', async () => {
    fetchFileListMock.mockResolvedValue(['events-a.parquet', 'events-b.parquet'])
    fetchEventsMock.mockResolvedValue(sampleEvents)

    const wrapper = mount(App)
    await flushPromises()

    expect(fetchEventsMock).toHaveBeenCalledWith('events-a.parquet')
    const source = wrapper.get('[data-testid="source-select"]')
    expect(source.findAll('option').map((o) => o.text())).toEqual(['events-a', 'events-b'])
  })

  it('renders the caption with the unfiltered total once loaded', async () => {
    fetchFileListMock.mockResolvedValue(['events-a.parquet'])
    fetchEventsMock.mockResolvedValue(sampleEvents)

    const wrapper = mount(App)
    await flushPromises()

    // 3 screen events in 2 hourly buckets
    expect(wrapper.text()).toContain('3 screen events')
    expect(wrapper.text()).toContain('2 hourly buckets')
  })

  it('applies a countryAgg filter and updates the caption', async () => {
    fetchFileListMock.mockResolvedValue(['events-a.parquet'])
    fetchEventsMock.mockResolvedValue(sampleEvents)

    const wrapper = mount(App)
    await flushPromises()

    await wrapper.get('[data-testid="filter-country-agg"]').setValue('jp')
    await flushPromises()

    // Only 1 jp screen event remains
    expect(wrapper.text()).toContain('1 screen events')
    expect(wrapper.text()).toContain('1 hourly buckets')
  })

  it('applies a platform filter', async () => {
    fetchFileListMock.mockResolvedValue(['events-a.parquet'])
    fetchEventsMock.mockResolvedValue(sampleEvents)

    const wrapper = mount(App)
    await flushPromises()

    await wrapper.get('[data-testid="filter-platform"]').setValue('android')
    await flushPromises()

    // Only 1 android screen event
    expect(wrapper.text()).toContain('1 screen events')
  })

  it('lists the join-weeks present in the loaded data', async () => {
    fetchFileListMock.mockResolvedValue(['events-a.parquet'])
    fetchEventsMock.mockResolvedValue(sampleEvents)

    const wrapper = mount(App)
    await flushPromises()

    const weekSelect = wrapper.get('[data-testid="filter-join-week"]')
    const values = weekSelect.findAll('option').map((o) => o.attributes('value'))
    expect(values).toEqual(['', '2026-04-27', '2026-05-04'])
  })

  it('disables the countryAgg filter when grouping by countryAgg', async () => {
    fetchFileListMock.mockResolvedValue(['events-a.parquet'])
    fetchEventsMock.mockResolvedValue(sampleEvents)

    const wrapper = mount(App)
    await flushPromises()

    await wrapper.get('[data-testid="group-by"]').setValue('countryAgg')
    await flushPromises()

    expect(
      (wrapper.get('[data-testid="filter-country-agg"]').element as HTMLSelectElement)
        .disabled,
    ).toBe(true)
  })

  it('resets filters and group-by when switching to a different file', async () => {
    fetchFileListMock.mockResolvedValue(['events-a.parquet', 'events-b.parquet'])
    fetchEventsMock.mockResolvedValue(sampleEvents)

    const wrapper = mount(App)
    await flushPromises()

    await wrapper.get('[data-testid="filter-country-agg"]').setValue('jp')
    await wrapper.get('[data-testid="group-by"]').setValue('platform')
    await flushPromises()

    await wrapper.get('[data-testid="source-select"]').setValue('events-b.parquet')
    await flushPromises()

    const country = wrapper.get(
      '[data-testid="filter-country-agg"]',
    ).element as HTMLSelectElement
    const groupBy = wrapper.get('[data-testid="group-by"]').element as HTMLSelectElement
    expect(country.value).toBe('')
    expect(groupBy.value).toBe('')
  })

  it('surfaces a friendly error when the file list fails', async () => {
    fetchFileListMock.mockRejectedValue(new Error('boom'))

    const wrapper = mount(App)
    await flushPromises()

    expect(wrapper.text()).toContain('Failed to load data')
    expect(wrapper.text()).toContain('boom')
  })

  it('shows an error when the data directory contains no parquet files', async () => {
    fetchFileListMock.mockResolvedValue([])

    const wrapper = mount(App)
    await flushPromises()

    expect(wrapper.text()).toContain('No event-log files')
    expect(fetchEventsMock).not.toHaveBeenCalled()
  })
})
