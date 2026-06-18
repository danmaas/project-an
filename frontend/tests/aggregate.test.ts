import { describe, it, expect } from 'vitest'
import {
  applyFilters,
  bucketByHour,
  joinWeekKey,
  screenEventsByHour,
  uniqueJoinWeeks,
} from '../src/data/aggregate'
import type { PlayerEvent } from '../src/types'

const e = (
  iso: string,
  event = 'screen',
  countryAgg = 'ENG',
  platform = 'ios',
  joinWeek = '2026-04-27',
): PlayerEvent => ({
  ts: new Date(iso).getTime(),
  event,
  userIdHash: 'u0',
  userCreateTime: new Date(`${joinWeek}T00:00:00Z`).getTime(),
  countryAgg,
  platform,
  joinWeek: new Date(`${joinWeek}T00:00:00Z`).getTime(),
  experimentId: '',
  variationId: '',
})

describe('bucketByHour', () => {
  it('returns an empty list for no events', () => {
    expect(bucketByHour([])).toEqual([])
  })

  it('groups events into the hour they fall in regardless of minute', () => {
    const result = bucketByHour([
      e('2026-05-01T10:05:00Z'),
      e('2026-05-01T10:55:00Z'),
      e('2026-05-01T11:00:00Z'),
    ])
    expect(result).toEqual([
      { hour: new Date('2026-05-01T10:00:00Z'), count: 2 },
      { hour: new Date('2026-05-01T11:00:00Z'), count: 1 },
    ])
  })

  it('sorts buckets chronologically even when inputs arrive out of order', () => {
    const result = bucketByHour([e('2026-05-02T03:00:00Z'), e('2026-05-01T10:00:00Z')])
    expect(result.map((b) => b.hour.toISOString())).toEqual([
      '2026-05-01T10:00:00.000Z',
      '2026-05-02T03:00:00.000Z',
    ])
  })

  it('does not coalesce hours across day boundaries', () => {
    const result = bucketByHour([e('2026-05-01T23:30:00Z'), e('2026-05-02T00:30:00Z')])
    expect(result).toEqual([
      { hour: new Date('2026-05-01T23:00:00Z'), count: 1 },
      { hour: new Date('2026-05-02T00:00:00Z'), count: 1 },
    ])
  })

  it('produces a row per (hour, group) when grouping by countryAgg', () => {
    const result = bucketByHour(
      [
        e('2026-05-01T10:00:00Z', 'screen', 'ENG'),
        e('2026-05-01T10:30:00Z', 'screen', 'ENG'),
        e('2026-05-01T10:00:00Z', 'screen', 'jp'),
        e('2026-05-01T11:00:00Z', 'screen', 'jp'),
      ],
      'countryAgg',
    )
    expect(result).toEqual([
      { hour: new Date('2026-05-01T10:00:00Z'), count: 2, group: 'ENG' },
      { hour: new Date('2026-05-01T10:00:00Z'), count: 1, group: 'jp' },
      { hour: new Date('2026-05-01T11:00:00Z'), count: 1, group: 'jp' },
    ])
  })

  it('groups by platform', () => {
    const result = bucketByHour(
      [
        e('2026-05-01T10:00:00Z', 'screen', 'ENG', 'ios'),
        e('2026-05-01T10:00:00Z', 'screen', 'ENG', 'android'),
        e('2026-05-01T10:00:00Z', 'screen', 'ENG', 'ios'),
      ],
      'platform',
    )
    expect(result.map((b) => [b.group, b.count])).toEqual([
      ['android', 1],
      ['ios', 2],
    ])
  })

  it('groups by join_week using YYYY-MM-DD keys', () => {
    const result = bucketByHour(
      [
        e('2026-05-01T10:00:00Z', 'screen', 'ENG', 'ios', '2026-04-27'),
        e('2026-05-01T10:00:00Z', 'screen', 'ENG', 'ios', '2026-05-04'),
      ],
      'joinWeek',
    )
    expect(result.map((b) => b.group)).toEqual(['2026-04-27', '2026-05-04'])
  })
})

describe('screenEventsByHour', () => {
  it('drops events whose name is not "screen" before bucketing', () => {
    const result = screenEventsByHour([
      e('2026-05-01T10:00:00Z', 'screen'),
      e('2026-05-01T10:00:00Z', 'problem_set_started'),
      e('2026-05-01T10:00:00Z', 'screen'),
      e('2026-05-01T10:00:00Z', 'experiment_viewed'),
    ])
    expect(result).toEqual([{ hour: new Date('2026-05-01T10:00:00Z'), count: 2 }])
  })

  it('passes group-by through to bucketByHour', () => {
    const result = screenEventsByHour(
      [
        e('2026-05-01T10:00:00Z', 'screen', 'ENG'),
        e('2026-05-01T10:00:00Z', 'screen', 'jp'),
        e('2026-05-01T10:00:00Z', 'lesson_started', 'ENG'),
      ],
      'countryAgg',
    )
    expect(result.map((b) => [b.group, b.count])).toEqual([
      ['ENG', 1],
      ['jp', 1],
    ])
  })
})

describe('applyFilters', () => {
  const sample = [
    e('2026-05-01T10:00:00Z', 'screen', 'ENG', 'ios', '2026-04-27'),
    e('2026-05-01T10:00:00Z', 'screen', 'jp', 'android', '2026-05-04'),
    e('2026-05-01T10:00:00Z', 'screen', 'EUR', 'web', '2026-04-27'),
  ]

  it('returns the input unchanged when no filter is set', () => {
    const result = applyFilters(sample, {
      countryAgg: null,
      platform: null,
      joinWeek: null,
    })
    expect(result).toBe(sample)
  })

  it('narrows by countryAgg', () => {
    const result = applyFilters(sample, {
      countryAgg: 'jp',
      platform: null,
      joinWeek: null,
    })
    expect(result).toHaveLength(1)
    expect(result[0].countryAgg).toBe('jp')
  })

  it('narrows by platform', () => {
    const result = applyFilters(sample, {
      countryAgg: null,
      platform: 'web',
      joinWeek: null,
    })
    expect(result).toHaveLength(1)
    expect(result[0].platform).toBe('web')
  })

  it('narrows by join_week', () => {
    const result = applyFilters(sample, {
      countryAgg: null,
      platform: null,
      joinWeek: '2026-04-27',
    })
    expect(result).toHaveLength(2)
  })

  it('combines multiple filters with AND semantics', () => {
    const result = applyFilters(sample, {
      countryAgg: 'ENG',
      platform: 'ios',
      joinWeek: '2026-04-27',
    })
    expect(result).toHaveLength(1)
    expect(result[0].countryAgg).toBe('ENG')
    expect(result[0].platform).toBe('ios')
  })
})

describe('experiment-mode grouping', () => {
  // Events tagged with explicit userIdHash so we can build a variation map.
  const eu = (
    iso: string,
    event: string,
    userIdHash: string,
  ): PlayerEvent => ({
    ts: new Date(iso).getTime(),
    event,
    userIdHash,
    userCreateTime: new Date('2026-04-27T00:00:00Z').getTime(),
    countryAgg: 'ENG',
    platform: 'ios',
    joinWeek: new Date('2026-04-27T00:00:00Z').getTime(),
    experimentId: '',
    variationId: '',
  })

  it('applyFilters drops events for players absent from the variation map', () => {
    const events = [
      eu('2026-05-01T10:00:00Z', 'screen', 'p1'),
      eu('2026-05-01T10:00:00Z', 'screen', 'p2'),
      eu('2026-05-01T10:00:00Z', 'screen', 'p3'),
    ]
    const assignments = new Map([
      ['p1', 'on'],
      ['p3', 'off'],
    ])
    const result = applyFilters(
      events,
      { countryAgg: null, platform: null, joinWeek: null },
      assignments,
    )
    expect(result.map((e) => e.userIdHash)).toEqual(['p1', 'p3'])
  })

  it('bucketByHour uses variation_id as the group key in experiment mode', () => {
    const events = [
      eu('2026-05-01T10:00:00Z', 'screen', 'p1'),
      eu('2026-05-01T10:30:00Z', 'screen', 'p2'),
      eu('2026-05-01T10:00:00Z', 'screen', 'p3'),
    ]
    const assignments = new Map([
      ['p1', 'on'],
      ['p2', 'on'],
      ['p3', 'off'],
    ])
    const result = bucketByHour(events, 'experiment:foo', assignments)
    expect(result).toEqual([
      { hour: new Date('2026-05-01T10:00:00Z'), count: 1, group: 'off' },
      { hour: new Date('2026-05-01T10:00:00Z'), count: 2, group: 'on' },
    ])
  })
})

describe('uniqueJoinWeeks', () => {
  it('returns sorted unique YYYY-MM-DD keys', () => {
    const result = uniqueJoinWeeks([
      e('2026-05-01T10:00:00Z', 'screen', 'ENG', 'ios', '2026-05-04'),
      e('2026-05-01T10:00:00Z', 'screen', 'ENG', 'ios', '2026-04-27'),
      e('2026-05-01T10:00:00Z', 'screen', 'ENG', 'ios', '2026-04-27'),
    ])
    expect(result).toEqual(['2026-04-27', '2026-05-04'])
  })
})

describe('joinWeekKey', () => {
  it('formats as YYYY-MM-DD in UTC', () => {
    expect(joinWeekKey(new Date('2026-04-27T00:00:00Z'))).toBe('2026-04-27')
  })
})
