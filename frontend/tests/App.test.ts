import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import App from '../src/App.vue'

// hyparquet does real network I/O via fetch — stub the data layer so we can
// drive App.vue's onMounted/watch flow without standing up a backend.
vi.mock('../src/data/parquet', () => ({
  fetchFileList: vi.fn(),
  fetchEvents: vi.fn(),
}))

import { fetchEvents, fetchFileList } from '../src/data/parquet'
const fetchEventsMock = fetchEvents as ReturnType<typeof vi.fn>
const fetchFileListMock = fetchFileList as ReturnType<typeof vi.fn>

const sampleEvents = [
  { ts: new Date('2026-05-01T10:00:00Z'), event: 'screen' },
  { ts: new Date('2026-05-01T10:05:00Z'), event: 'screen' },
  { ts: new Date('2026-05-01T11:00:00Z'), event: 'screen' },
  { ts: new Date('2026-05-01T11:00:00Z'), event: 'problem_set_started' },
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

  it('shows a loading status while data is being fetched', () => {
    fetchFileListMock.mockReturnValue(new Promise(() => {}))
    const wrapper = mount(App)
    expect(wrapper.text()).toContain('Loading')
  })

  it('lists available files in the source dropdown and loads the first one', async () => {
    fetchFileListMock.mockResolvedValue(['events-a.parquet', 'events-b.parquet'])
    fetchEventsMock.mockResolvedValue(sampleEvents)

    const wrapper = mount(App)
    await flushPromises()

    const options = wrapper.findAll('option').map((o) => o.text())
    expect(options).toEqual(['events-a', 'events-b'])
    expect(fetchEventsMock).toHaveBeenCalledTimes(1)
    expect(fetchEventsMock).toHaveBeenCalledWith('events-a.parquet')
  })

  it('reloads data when a different file is selected', async () => {
    fetchFileListMock.mockResolvedValue(['events-a.parquet', 'events-b.parquet'])
    fetchEventsMock.mockResolvedValue(sampleEvents)

    const wrapper = mount(App)
    await flushPromises()
    fetchEventsMock.mockClear()

    await wrapper.find('select').setValue('events-b.parquet')
    await flushPromises()

    expect(fetchEventsMock).toHaveBeenCalledWith('events-b.parquet')
  })

  it('renders a caption summarizing the data once loaded', async () => {
    fetchFileListMock.mockResolvedValue(['events-a.parquet'])
    fetchEventsMock.mockResolvedValue(sampleEvents)

    const wrapper = mount(App)
    await flushPromises()

    expect(wrapper.text()).toContain('3 screen events')
    expect(wrapper.text()).toContain('2 hourly buckets')
  })

  it('surfaces a friendly error when the file list fails', async () => {
    fetchFileListMock.mockRejectedValue(new Error('boom'))

    const wrapper = mount(App)
    await flushPromises()

    expect(wrapper.text()).toContain('Failed to load data')
    expect(wrapper.text()).toContain('boom')
  })

  it('surfaces a friendly error when the event log fetch fails', async () => {
    fetchFileListMock.mockResolvedValue(['events-a.parquet'])
    fetchEventsMock.mockRejectedValue(new Error('decode failed'))

    const wrapper = mount(App)
    await flushPromises()

    expect(wrapper.text()).toContain('Failed to load data')
    expect(wrapper.text()).toContain('decode failed')
  })

  it('shows an error when the data directory contains no parquet files', async () => {
    fetchFileListMock.mockResolvedValue([])

    const wrapper = mount(App)
    await flushPromises()

    expect(wrapper.text()).toContain('No event-log files')
    expect(fetchEventsMock).not.toHaveBeenCalled()
  })
})
