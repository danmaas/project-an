import { describe, it, expect } from 'vitest'
import { chiSquareForMetric, computeRetentionMetrics } from '../src/data/metrics'
import { EMPTY_FILTERS, type PlayerEvent, type RetentionMetrics } from '../src/types'

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
        experimentId: '',
        variationId: '',
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

  it('breaks results out by variation_id in experiment mode', () => {
    const events = build([
      { id: 'p1', events: ['screen', 'returned_1d', 'sub_buy_success'] },
      { id: 'p2', events: ['screen', 'returned_1d'] },
      { id: 'p3', events: ['screen', 'sub_buy_success'] },
      { id: 'p4', events: ['screen'] }, // not in the assignment map → excluded
    ])
    const assignments = new Map([
      ['p1', 'on'],
      ['p2', 'on'],
      ['p3', 'off'],
    ])
    const result = computeRetentionMetrics(events, EMPTY_FILTERS, 'experiment:foo', assignments)
    expect(result.map((r) => [r.group, r.totalPlayers])).toEqual([
      ['off', 1],
      ['on', 2],
    ])
    const on = result.find((r) => r.group === 'on')!
    expect(on.counts.returned_1d).toBe(2)
    expect(on.counts.sub_buy_success).toBe(1)
    const off = result.find((r) => r.group === 'off')!
    expect(off.counts.returned_1d).toBe(0)
    expect(off.counts.sub_buy_success).toBe(1)
  })

  it('combines experiment filter with countryAgg filter', () => {
    const events = build([
      { id: 'p1', countryAgg: 'ENG', events: ['screen', 'returned_1d'] },
      { id: 'p2', countryAgg: 'jp', events: ['screen', 'returned_1d'] },
      { id: 'p3', countryAgg: 'ENG', events: ['screen'] },
    ])
    const assignments = new Map([
      ['p1', 'on'],
      ['p2', 'on'],
      ['p3', 'on'],
    ])
    const result = computeRetentionMetrics(
      events,
      { ...EMPTY_FILTERS, countryAgg: 'ENG' },
      'experiment:foo',
      assignments,
    )
    expect(result).toHaveLength(1)
    expect(result[0].totalPlayers).toBe(2) // p1 + p3 (ENG and assigned)
    expect(result[0].counts.returned_1d).toBe(1)
  })

  it('counts a player once even when they have many screen events (chi-square placeholder above)', () => {
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

describe('chiSquareForMetric', () => {
  const make = (
    group: string,
    totalPlayers: number,
    returned_1d: number,
  ): RetentionMetrics => ({
    group,
    totalPlayers,
    counts: {
      returned_1d,
      returned_2d: 0,
      returned_3d: 0,
      sub_buy_success: 0,
    },
  })

  it('returns null when there are fewer than 2 groups', () => {
    expect(chiSquareForMetric([make('all', 100, 20)], 'returned_1d')).toBeNull()
    expect(chiSquareForMetric([], 'returned_1d')).toBeNull()
  })

  it('returns null when every group is empty', () => {
    expect(
      chiSquareForMetric([make('a', 0, 0), make('b', 0, 0)], 'returned_1d'),
    ).toBeNull()
  })

  it('gives p ≈ 1 when both variations have the same accomplishment rate', () => {
    const r = chiSquareForMetric(
      [make('off', 100, 20), make('on', 100, 20)],
      'returned_1d',
    )
    expect(r).not.toBeNull()
    expect(r!.df).toBe(1)
    expect(r!.chi2).toBeCloseTo(0, 6)
    expect(r!.p).toBeCloseTo(1, 6)
  })

  it('gives a very small p when variations differ drastically', () => {
    const r = chiSquareForMetric(
      [make('off', 100, 5), make('on', 100, 95)],
      'returned_1d',
    )
    expect(r).not.toBeNull()
    expect(r!.df).toBe(1)
    expect(r!.p).toBeLessThan(0.001)
  })

  it('df scales with number of groups − 1', () => {
    const r = chiSquareForMetric(
      [
        make('a', 100, 10),
        make('b', 100, 20),
        make('c', 100, 30),
      ],
      'returned_1d',
    )
    expect(r!.df).toBe(2)
  })

  it('handles unequal group sizes correctly', () => {
    // 100 vs 1000 players; "on" has noticeably higher rate.
    const r = chiSquareForMetric(
      [make('off', 100, 10), make('on', 1000, 200)],
      'returned_1d',
    )
    expect(r).not.toBeNull()
    expect(r!.chi2).toBeGreaterThan(0)
    expect(r!.p).toBeGreaterThan(0)
    expect(r!.p).toBeLessThan(1)
  })
})
