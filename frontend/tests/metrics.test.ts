import { describe, it, expect } from 'vitest'
import { computeRetentionMetrics } from '../src/data/metrics'
import { EMPTY_FILTERS, type PlayerEvent } from '../src/types'

let nextId = 0
function userId(): string {
  return `u${++nextId}`
}

interface PlayerSpec {
  id?: string
  countryAgg?: string
  platform?: string
  joinWeek?: string
  events: string[]
}

/** Build a flat PlayerEvent array from a list of player specs. */
function build(players: PlayerSpec[]): PlayerEvent[] {
  const out: PlayerEvent[] = []
  for (const p of players) {
    const id = p.id ?? userId()
    const countryAgg = p.countryAgg ?? 'ENG'
    const platform = p.platform ?? 'ios'
    const joinWeek = new Date(`${p.joinWeek ?? '2026-04-27'}T00:00:00Z`)
    for (const ev of p.events) {
      out.push({
        ts: new Date('2026-05-01T10:00:00Z'),
        event: ev,
        userIdHash: id,
        userCreateTime: joinWeek,
        countryAgg,
        platform,
        joinWeek,
      })
    }
  }
  return out
}

describe('computeRetentionMetrics', () => {
  it('returns an empty array when no players pass the filter', () => {
    const events = build([{ countryAgg: 'ENG', events: ['screen', 'returned_1d'] }])
    const result = computeRetentionMetrics(
      events,
      { ...EMPTY_FILTERS, countryAgg: 'jp' },
      null,
    )
    expect(result).toEqual([])
  })

  it('counts each retention event independently per player', () => {
    const events = build([
      { events: ['screen', 'returned_1d', 'returned_2d', 'sub_buy_success'] },
      { events: ['screen', 'returned_1d'] },
      { events: ['screen', 'returned_3d'] },
      { events: ['screen'] }, // accomplished nothing
    ])
    const [m] = computeRetentionMetrics(events, EMPTY_FILTERS, null)
    expect(m.totalPlayers).toBe(4)
    expect(m.counts.returned_1d).toBe(2)
    expect(m.counts.returned_2d).toBe(1)
    expect(m.counts.returned_3d).toBe(1)
    expect(m.counts.sub_buy_success).toBe(1)
    expect(m.group).toBeUndefined()
  })

  it('counts a player once even if the same event is recorded multiple times', () => {
    const id = userId()
    const events = build([
      {
        id,
        events: ['screen', 'returned_1d', 'returned_1d', 'returned_1d'],
      },
    ])
    const [m] = computeRetentionMetrics(events, EMPTY_FILTERS, null)
    expect(m.totalPlayers).toBe(1)
    expect(m.counts.returned_1d).toBe(1)
  })

  it('counts non-retention events as zero', () => {
    const events = build([
      { events: ['screen', 'problem_set_started', 'lesson_started'] },
    ])
    const [m] = computeRetentionMetrics(events, EMPTY_FILTERS, null)
    expect(m.counts.returned_1d).toBe(0)
    expect(m.counts.sub_buy_success).toBe(0)
  })

  it('respects the countryAgg filter at the player level', () => {
    const events = build([
      { countryAgg: 'ENG', events: ['screen', 'returned_1d'] },
      { countryAgg: 'ENG', events: ['screen'] },
      { countryAgg: 'jp', events: ['screen', 'returned_1d', 'sub_buy_success'] },
    ])
    const [m] = computeRetentionMetrics(
      events,
      { ...EMPTY_FILTERS, countryAgg: 'jp' },
      null,
    )
    expect(m.totalPlayers).toBe(1)
    expect(m.counts.returned_1d).toBe(1)
    expect(m.counts.sub_buy_success).toBe(1)
  })

  it('respects the platform filter', () => {
    const events = build([
      { platform: 'ios', events: ['screen', 'returned_1d'] },
      { platform: 'android', events: ['screen', 'returned_1d', 'returned_2d'] },
    ])
    const [m] = computeRetentionMetrics(
      events,
      { ...EMPTY_FILTERS, platform: 'android' },
      null,
    )
    expect(m.totalPlayers).toBe(1)
    expect(m.counts.returned_1d).toBe(1)
    expect(m.counts.returned_2d).toBe(1)
  })

  it('respects the join_week filter', () => {
    const events = build([
      { joinWeek: '2026-04-27', events: ['screen', 'returned_1d'] },
      { joinWeek: '2026-05-04', events: ['screen', 'returned_2d'] },
    ])
    const [m] = computeRetentionMetrics(
      events,
      { ...EMPTY_FILTERS, joinWeek: '2026-05-04' },
      null,
    )
    expect(m.totalPlayers).toBe(1)
    expect(m.counts.returned_2d).toBe(1)
    expect(m.counts.returned_1d).toBe(0)
  })

  it('breaks results out by countryAgg when grouped', () => {
    const events = build([
      { countryAgg: 'ENG', events: ['screen', 'returned_1d'] },
      { countryAgg: 'ENG', events: ['screen', 'returned_1d', 'sub_buy_success'] },
      { countryAgg: 'jp', events: ['screen', 'returned_2d'] },
    ])
    const result = computeRetentionMetrics(events, EMPTY_FILTERS, 'countryAgg')
    expect(result.map((r) => r.group)).toEqual(['ENG', 'jp'])

    const eng = result.find((r) => r.group === 'ENG')!
    expect(eng.totalPlayers).toBe(2)
    expect(eng.counts.returned_1d).toBe(2)
    expect(eng.counts.sub_buy_success).toBe(1)

    const jp = result.find((r) => r.group === 'jp')!
    expect(jp.totalPlayers).toBe(1)
    expect(jp.counts.returned_2d).toBe(1)
    expect(jp.counts.returned_1d).toBe(0)
  })

  it('breaks results out by platform when grouped', () => {
    const events = build([
      { platform: 'ios', events: ['screen', 'returned_1d'] },
      { platform: 'ios', events: ['screen', 'returned_1d'] },
      { platform: 'web', events: ['screen'] },
    ])
    const result = computeRetentionMetrics(events, EMPTY_FILTERS, 'platform')
    expect(result.map((r) => [r.group, r.totalPlayers, r.counts.returned_1d])).toEqual([
      ['ios', 2, 2],
      ['web', 1, 0],
    ])
  })

  it('combines filtering and grouping', () => {
    const events = build([
      { countryAgg: 'ENG', platform: 'ios', events: ['screen', 'returned_1d'] },
      { countryAgg: 'ENG', platform: 'android', events: ['screen'] },
      { countryAgg: 'jp', platform: 'ios', events: ['screen', 'returned_1d'] },
    ])
    // Filter to ENG, group by platform.
    const result = computeRetentionMetrics(
      events,
      { ...EMPTY_FILTERS, countryAgg: 'ENG' },
      'platform',
    )
    expect(result).toEqual([
      {
        group: 'android',
        totalPlayers: 1,
        counts: { returned_1d: 0, returned_2d: 0, returned_3d: 0, sub_buy_success: 0 },
      },
      {
        group: 'ios',
        totalPlayers: 1,
        counts: { returned_1d: 1, returned_2d: 0, returned_3d: 0, sub_buy_success: 0 },
      },
    ])
  })

  it('counts a player once even when they have many screen events', () => {
    // Realistic case: a single player generates hundreds of screen events
    // but is still one player in the denominator.
    const id = userId()
    const events = build([
      {
        id,
        events: [...Array(50).fill('screen'), 'returned_1d'],
      },
    ])
    const [m] = computeRetentionMetrics(events, EMPTY_FILTERS, null)
    expect(m.totalPlayers).toBe(1)
    expect(m.counts.returned_1d).toBe(1)
  })
})
