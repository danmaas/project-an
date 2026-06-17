import { describe, it, expect } from 'vitest'
import { bucketByHour, screenEventsByHour } from '../src/data/aggregate'
import type { PlayerEvent } from '../src/types'

const e = (iso: string, event = 'screen'): PlayerEvent => ({
  ts: new Date(iso),
  event,
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

  it('returns an empty list when no screen events are present', () => {
    expect(
      screenEventsByHour([
        e('2026-05-01T10:00:00Z', 'pve_game_started'),
        e('2026-05-01T11:00:00Z', 'lesson_started'),
      ]),
    ).toEqual([])
  })
})
