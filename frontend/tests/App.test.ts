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
  userIdHash = 'u-default',
  experimentId = '',
  variationId = '',
): PlayerEvent {
  return {
    ts: new Date(iso).getTime(),
    event,
    userIdHash,
    userCreateTime: new Date(`${joinWeek}T00:00:00Z`).getTime(),
    countryAgg,
    platform,
    joinWeek: new Date(`${joinWeek}T00:00:00Z`).getTime(),
    experimentId,
    variationId,
  }
}

const sampleEvents: PlayerEvent[] = [
  ev('2026-05-01T10:00:00Z', 'screen', 'ENG', 'ios', '2026-04-27', 'p1'),
  ev('2026-05-01T10:05:00Z', 'screen', 'ENG', 'android', '2026-04-27', 'p2'),
  ev('2026-05-01T11:00:00Z', 'screen', 'jp', 'ios', '2026-05-04', 'p3'),
  ev('2026-05-01T11:00:00Z', 'problem_set_started', 'ENG', 'ios', '2026-04-27', 'p1'),
  ev('2026-05-02T10:00:00Z', 'returned_1d', 'ENG', 'ios', '2026-04-27', 'p1'),
  ev('2026-05-02T10:00:00Z', 'sub_buy_success', 'jp', 'ios', '2026-05-04', 'p3'),
]

beforeEach(() => {
  fetchEventsMock.mockReset()
  fetchFileListMock.mockReset()
})

describe('App', () => {
  it('renders the title and explainer on initial mount', () => {
    fetchFileListMock.mockReturnValue(new Promise(() => {}))
    const wrapper = mount(App)
    expect(wrapper.text()).toContain('User Insights')
    // First sentence of the explainer paragraph (copied from AGENTS.md).
    expect(wrapper.get('[data-testid="explainer"]').text()).toContain(
      'demo',
    )
  })

  it('lists available files in the source dropdown and loads the first one', async () => {
    fetchFileListMock.mockResolvedValue(['events-a.parquet', 'events-b.parquet'])
    fetchEventsMock.mockResolvedValue(sampleEvents)

    const wrapper = mount(App)
    await flushPromises()

    expect(fetchEventsMock).toHaveBeenCalledWith('events-a.parquet', expect.any(Function))
    const source = wrapper.get('[data-testid="source-select"]')
    expect(source.findAll('option').map((o) => o.text())).toEqual(['events-a', 'events-b'])
  })

  it('applies a countryAgg filter and narrows the metrics-table player count', async () => {
    fetchFileListMock.mockResolvedValue(['events-a.parquet'])
    fetchEventsMock.mockResolvedValue(sampleEvents)

    const wrapper = mount(App)
    await flushPromises()

    // Unfiltered: 3 distinct players (p1, p2, p3).
    const nCellBefore = wrapper.get('[data-testid="metrics-table"] tr.row-n td').text()
    expect(nCellBefore).toBe('3')

    await wrapper.get('[data-testid="filter-country-agg"]').setValue('jp')
    await flushPromises()

    // After filtering to jp: only p3 remains.
    const nCellAfter = wrapper.get('[data-testid="metrics-table"] tr.row-n td').text()
    expect(nCellAfter).toBe('1')
  })

  it('applies a platform filter', async () => {
    fetchFileListMock.mockResolvedValue(['events-a.parquet'])
    fetchEventsMock.mockResolvedValue(sampleEvents)

    const wrapper = mount(App)
    await flushPromises()

    await wrapper.get('[data-testid="filter-platform"]').setValue('android')
    await flushPromises()

    // p2 is the only android player.
    const nCell = wrapper.get('[data-testid="metrics-table"] tr.row-n td').text()
    expect(nCell).toBe('1')
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

  it('exposes experiment_ids as options in the group-by dropdown', async () => {
    const eventsWithExperiments: PlayerEvent[] = [
      ...sampleEvents,
      ev(
        '2026-05-01T09:00:00Z',
        'experiment_viewed',
        'ENG',
        'ios',
        '2026-04-27',
        'p1',
        'sub_sku_annual_only',
        'on',
      ),
      ev(
        '2026-05-01T09:00:00Z',
        'experiment_viewed',
        'ENG',
        'android',
        '2026-04-27',
        'p2',
        'sub_sku_annual_only',
        'off',
      ),
      ev(
        '2026-05-01T09:00:00Z',
        'experiment_viewed',
        'jp',
        'ios',
        '2026-05-04',
        'p3',
        'tutorial',
        'on',
      ),
    ]
    fetchFileListMock.mockResolvedValue(['events-a.parquet'])
    fetchEventsMock.mockResolvedValue(eventsWithExperiments)

    const wrapper = mount(App)
    await flushPromises()

    const groupBy = wrapper.get('[data-testid="group-by"]')
    const values = groupBy.findAll('option').map((o) => o.attributes('value'))
    expect(values).toContain('experiment:sub_sku_annual_only')
    expect(values).toContain('experiment:tutorial')
  })

  it('selecting an experiment groups players by their variation_id', async () => {
    const eventsWithExperiments: PlayerEvent[] = [
      // p1 (ENG, ios) is assigned to "on" for sub_sku_annual_only and has returned_1d
      ev(
        '2026-05-01T09:00:00Z',
        'experiment_viewed',
        'ENG',
        'ios',
        '2026-04-27',
        'p1',
        'sub_sku_annual_only',
        'on',
      ),
      ev('2026-05-02T10:00:00Z', 'returned_1d', 'ENG', 'ios', '2026-04-27', 'p1'),
      // p2 (ENG, android) is assigned to "off", no retention events
      ev(
        '2026-05-01T09:00:00Z',
        'experiment_viewed',
        'ENG',
        'android',
        '2026-04-27',
        'p2',
        'sub_sku_annual_only',
        'off',
      ),
      // p3 (jp) is on a different experiment → excluded entirely when grouping by sub_sku_annual_only
      ev(
        '2026-05-01T09:00:00Z',
        'experiment_viewed',
        'jp',
        'ios',
        '2026-05-04',
        'p3',
        'tutorial',
        'on',
      ),
      // p4 only saw "control" → excluded as a dummy variation
      ev(
        '2026-05-01T09:00:00Z',
        'experiment_viewed',
        'ENG',
        'ios',
        '2026-04-27',
        'p4',
        'sub_sku_annual_only',
        'control',
      ),
    ]
    fetchFileListMock.mockResolvedValue(['events-a.parquet'])
    fetchEventsMock.mockResolvedValue(eventsWithExperiments)

    const wrapper = mount(App)
    await flushPromises()

    await wrapper
      .get('[data-testid="group-by"]')
      .setValue('experiment:sub_sku_annual_only')
    await flushPromises()

    const headers = wrapper.findAll('[data-testid="metrics-table"] thead th').map((th) =>
      th.text(),
    )
    // Empty row-label header, one column per variation (off, on, sorted),
    // and the chi-square p-value column at the end (TASK-510).
    expect(headers).toEqual(['', 'off', 'on', 'p‑value'])
  })

  it('renders chi-square p-values when in experiment mode with ≥2 variations', async () => {
    // Build a population with a strong difference between variations so p < 0.001.
    const events: PlayerEvent[] = []
    for (let i = 0; i < 100; i++) {
      const id = `on-${i}`
      // Each "on" player saw the experiment as 'on' and returned on day 1.
      events.push(
        ev('2026-05-01T09:00:00Z', 'experiment_viewed', 'ENG', 'ios', '2026-04-27', id, 'expA', 'on'),
        ev('2026-05-02T10:00:00Z', 'returned_1d', 'ENG', 'ios', '2026-04-27', id),
      )
    }
    for (let i = 0; i < 100; i++) {
      const id = `off-${i}`
      // Each "off" player saw the experiment as 'off' and did NOT return.
      events.push(
        ev('2026-05-01T09:00:00Z', 'experiment_viewed', 'ENG', 'ios', '2026-04-27', id, 'expA', 'off'),
        ev('2026-05-01T10:00:00Z', 'screen', 'ENG', 'ios', '2026-04-27', id),
      )
    }
    fetchFileListMock.mockResolvedValue(['events-a.parquet'])
    fetchEventsMock.mockResolvedValue(events)

    const wrapper = mount(App)
    await flushPromises()
    await wrapper.get('[data-testid="group-by"]').setValue('experiment:expA')
    await flushPromises()

    const headers = wrapper
      .findAll('[data-testid="metrics-table"] thead th')
      .map((th) => th.text())
    expect(headers).toContain('p‑value') // non-breaking hyphen
    // returned_1d row should show a significant p-value (we engineered a huge gap).
    expect(wrapper.get('[data-testid="metrics-table"]').text()).toContain('<0.001')
  })

  it('does not show a p-value column in non-experiment group-by modes', async () => {
    fetchFileListMock.mockResolvedValue(['events-a.parquet'])
    fetchEventsMock.mockResolvedValue(sampleEvents)

    const wrapper = mount(App)
    await flushPromises()
    await wrapper.get('[data-testid="group-by"]').setValue('countryAgg')
    await flushPromises()

    expect(wrapper.find('[data-testid="pvalue-header"]').exists()).toBe(false)
  })

  it('renders the retention metrics table with per-player counts and rates', async () => {
    fetchFileListMock.mockResolvedValue(['events-a.parquet'])
    fetchEventsMock.mockResolvedValue(sampleEvents)

    const wrapper = mount(App)
    await flushPromises()

    const table = wrapper.get('[data-testid="metrics-table"]')
    expect(table.text()).toContain('n (players)')
    expect(table.text()).toContain('returned_1d')
    expect(table.text()).toContain('returned_2d')
    expect(table.text()).toContain('returned_3d')
    expect(table.text()).toContain('sub_buy_success')

    // sampleEvents has 3 distinct players (p1, p2, p3); p1 has returned_1d
    // (33.3%), p3 has sub_buy_success (33.3%).
    expect(table.text()).toContain('3') // n (players)
    expect(table.text()).toContain('33.3%')
  })

  it('breaks the metrics table out by group when group-by is set', async () => {
    fetchFileListMock.mockResolvedValue(['events-a.parquet'])
    fetchEventsMock.mockResolvedValue(sampleEvents)

    const wrapper = mount(App)
    await flushPromises()

    await wrapper.get('[data-testid="group-by"]').setValue('countryAgg')
    await flushPromises()

    const table = wrapper.get('[data-testid="metrics-table"]')
    // sample has 2 ENG players (p1, p2) and 1 jp player (p3).
    expect(table.findAll('thead th').map((th) => th.text())).toEqual(['', 'ENG', 'jp'])
  })

  it('shows an error when the data directory contains no parquet files', async () => {
    fetchFileListMock.mockResolvedValue([])

    const wrapper = mount(App)
    await flushPromises()

    expect(wrapper.text()).toContain('No event-log files')
    expect(fetchEventsMock).not.toHaveBeenCalled()
  })
})
