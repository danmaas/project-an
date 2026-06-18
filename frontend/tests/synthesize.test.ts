import { describe, it, expect } from 'vitest'
import { synthesizeRetentionEvents } from '../src/data/synthesize'
import type { PlayerEvent } from '../src/types'

const DAY_MS = 86_400_000

// Player created at 2026-05-01T00:00:00Z (a Monday-ish anchor).
const CREATE_ISO = '2026-05-01T00:00:00Z'
const CREATE_MS = new Date(CREATE_ISO).getTime()

interface EventSpec {
  event: string
  /** Either an ISO string or an offset (ms) from the player's create_time. */
  at: string | number
}

function build(userIdHash: string, specs: EventSpec[]): PlayerEvent[] {
  return specs.map(({ event, at }) => {
    const ts = typeof at === 'number' ? new Date(CREATE_MS + at) : new Date(at)
    return {
      ts,
      event,
      userIdHash,
      userCreateTime: new Date(CREATE_ISO),
      countryAgg: 'ENG',
      platform: 'ios',
      joinWeek: new Date('2026-04-27T00:00:00Z'),
      experimentId: '',
      variationId: '',
    }
  })
}

function syntheticOf(player: string, events: PlayerEvent[]): string[] {
  return events
    .filter((e) => e.userIdHash === player && /^returned_\d+d$/.test(e.event))
    .map((e) => e.event)
    .sort()
}

describe('synthesizeRetentionEvents', () => {
  it('returns the input unchanged when nobody has any screen events', () => {
    const input = build('p1', [
      { event: 'problem_set_started', at: 1 * DAY_MS + 60_000 },
      { event: 'lesson_started', at: 2 * DAY_MS + 60_000 },
    ])
    const result = synthesizeRetentionEvents(input)
    expect(result).toHaveLength(input.length)
    expect(syntheticOf('p1', result)).toEqual([])
  })

  it('emits returned_Nd for each N whose window contains a screen event', () => {
    // Place screen events squarely inside the day-1 and day-3 windows; leave
    // day-2, day-5, day-7 empty.
    const input = build('p1', [
      { event: 'screen', at: 1 * DAY_MS + 60_000 }, // 1d
      { event: 'screen', at: 3 * DAY_MS + 12 * 3600_000 }, // 3d
    ])
    const result = synthesizeRetentionEvents(input)
    expect(syntheticOf('p1', result)).toEqual(['returned_1d', 'returned_3d'])
  })

  it('treats the window as half-open: ts == createTime + N days qualifies for N, not N-1', () => {
    // Exactly at the day-2 boundary.
    const input = build('p1', [{ event: 'screen', at: 2 * DAY_MS }])
    const result = synthesizeRetentionEvents(input)
    expect(syntheticOf('p1', result)).toEqual(['returned_2d'])
  })

  it('does not double-emit when a player has many screen events inside one window', () => {
    const input = build('p1', [
      { event: 'screen', at: 1 * DAY_MS + 60_000 },
      { event: 'screen', at: 1 * DAY_MS + 7 * 3600_000 },
      { event: 'screen', at: 1 * DAY_MS + 18 * 3600_000 },
    ])
    const result = synthesizeRetentionEvents(input)
    expect(syntheticOf('p1', result)).toEqual(['returned_1d'])
  })

  it('does not emit returned_4d / returned_6d (not in the spec set)', () => {
    const input = build('p1', [
      { event: 'screen', at: 4 * DAY_MS + 60_000 },
      { event: 'screen', at: 6 * DAY_MS + 60_000 },
    ])
    const result = synthesizeRetentionEvents(input)
    expect(syntheticOf('p1', result)).toEqual([])
  })

  it('emits all five Ns when each window has a screen event', () => {
    const input = build('p1', [
      { event: 'screen', at: 1 * DAY_MS + 60_000 },
      { event: 'screen', at: 2 * DAY_MS + 60_000 },
      { event: 'screen', at: 3 * DAY_MS + 60_000 },
      { event: 'screen', at: 5 * DAY_MS + 60_000 },
      { event: 'screen', at: 7 * DAY_MS + 60_000 },
    ])
    const result = synthesizeRetentionEvents(input)
    expect(syntheticOf('p1', result)).toEqual([
      'returned_1d',
      'returned_2d',
      'returned_3d',
      'returned_5d',
      'returned_7d',
    ])
  })

  it('ignores non-screen events inside the windows', () => {
    const input = build('p1', [
      { event: 'lesson_started', at: 1 * DAY_MS + 60_000 },
      { event: 'pve_game_started', at: 2 * DAY_MS + 60_000 },
    ])
    const result = synthesizeRetentionEvents(input)
    expect(syntheticOf('p1', result)).toEqual([])
  })

  it('synthesizes independently per player', () => {
    const a = build('pA', [{ event: 'screen', at: 1 * DAY_MS + 60_000 }])
    const b = build('pB', [{ event: 'screen', at: 5 * DAY_MS + 60_000 }])
    const result = synthesizeRetentionEvents([...a, ...b])
    expect(syntheticOf('pA', result)).toEqual(['returned_1d'])
    expect(syntheticOf('pB', result)).toEqual(['returned_5d'])
  })

  it('inherits the player attributes (country/platform/join_week/userCreateTime)', () => {
    const input = build('p1', [{ event: 'screen', at: 2 * DAY_MS + 60_000 }])
    // Tweak attributes to a non-default set so we can verify they propagate.
    input[0].countryAgg = 'jp'
    input[0].platform = 'android'
    input[0].joinWeek = new Date('2026-05-04T00:00:00Z')
    const result = synthesizeRetentionEvents(input)
    const synth = result.find((e) => e.event === 'returned_2d')!
    expect(synth.userIdHash).toBe('p1')
    expect(synth.countryAgg).toBe('jp')
    expect(synth.platform).toBe('android')
    expect(synth.joinWeek.toISOString()).toBe('2026-05-04T00:00:00.000Z')
    expect(synth.userCreateTime.toISOString()).toBe(CREATE_ISO.replace('Z', '.000Z'))
  })

  it('uses the ts of the first qualifying screen event for the synthetic event', () => {
    const input = build('p1', [
      { event: 'screen', at: 3 * DAY_MS + 9 * 3600_000 }, // first
      { event: 'screen', at: 3 * DAY_MS + 14 * 3600_000 },
    ])
    const result = synthesizeRetentionEvents(input)
    const synth = result.find((e) => e.event === 'returned_3d')!
    expect(synth.ts.getTime()).toBe(CREATE_MS + 3 * DAY_MS + 9 * 3600_000)
  })

  it('returns a new array without mutating the input', () => {
    const input = build('p1', [{ event: 'screen', at: 1 * DAY_MS + 60_000 }])
    const before = input.length
    const result = synthesizeRetentionEvents(input)
    expect(input).toHaveLength(before)
    expect(result).not.toBe(input)
  })
})
