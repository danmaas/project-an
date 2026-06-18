import { describe, it, expect } from 'vitest'
import {
  computeVariationAssignments,
  experimentGroupByValue,
  experimentIdFromGroupBy,
  uniqueExperimentIds,
} from '../src/data/experiment'
import type { PlayerEvent } from '../src/types'

function makeEvent(opts: Partial<PlayerEvent> & { event: string; userIdHash: string }): PlayerEvent {
  return {
    ts: new Date('2026-05-01T10:00:00Z').getTime(),
    event: opts.event,
    userIdHash: opts.userIdHash,
    userCreateTime: new Date('2026-04-27T00:00:00Z').getTime(),
    countryAgg: 'ENG',
    platform: 'ios',
    joinWeek: new Date('2026-04-27T00:00:00Z').getTime(),
    experimentId: '',
    variationId: '',
    ...opts,
  }
}

const view = (
  userIdHash: string,
  experimentId: string,
  variationId: string,
  iso = '2026-05-01T10:00:00Z',
): PlayerEvent =>
  makeEvent({
    event: 'experiment_viewed',
    userIdHash,
    experimentId,
    variationId,
    ts: new Date(iso).getTime(),
  })

describe('experimentIdFromGroupBy', () => {
  it('extracts the id from an experiment groupBy value', () => {
    expect(experimentIdFromGroupBy('experiment:sub_sku_annual_only')).toBe(
      'sub_sku_annual_only',
    )
  })

  it('returns null for non-experiment groupBy values', () => {
    expect(experimentIdFromGroupBy(null)).toBeNull()
    expect(experimentIdFromGroupBy('countryAgg')).toBeNull()
    expect(experimentIdFromGroupBy('platform')).toBeNull()
    expect(experimentIdFromGroupBy('joinWeek')).toBeNull()
  })

  it('round-trips via experimentGroupByValue', () => {
    expect(experimentIdFromGroupBy(experimentGroupByValue('foo'))).toBe('foo')
  })
})

describe('computeVariationAssignments', () => {
  it('returns an empty map when nobody has viewed the experiment', () => {
    const result = computeVariationAssignments(
      [view('p1', 'other_exp', 'on'), view('p2', 'other_exp', 'off')],
      'target',
    )
    expect(result.size).toBe(0)
  })

  it('records the first non-control variation per player', () => {
    const result = computeVariationAssignments(
      [
        view('p1', 'target', 'on', '2026-05-01T10:00:00Z'),
        view('p2', 'target', 'off', '2026-05-01T11:00:00Z'),
      ],
      'target',
    )
    expect(result.get('p1')).toBe('on')
    expect(result.get('p2')).toBe('off')
  })

  it('treats the assignment as sticky to the earliest variation by ts', () => {
    // Insert later event first to confirm sort by ts, not by input order.
    const result = computeVariationAssignments(
      [
        view('p1', 'target', 'off', '2026-05-02T10:00:00Z'),
        view('p1', 'target', 'on', '2026-05-01T10:00:00Z'),
      ],
      'target',
    )
    expect(result.get('p1')).toBe('on')
  })

  it('ignores variation_id "control" as a dummy bucket', () => {
    const result = computeVariationAssignments(
      [
        view('p1', 'target', 'control', '2026-05-01T09:00:00Z'),
        view('p1', 'target', 'on', '2026-05-01T10:00:00Z'),
      ],
      'target',
    )
    expect(result.get('p1')).toBe('on')
  })

  it('excludes a player who only saw control', () => {
    const result = computeVariationAssignments(
      [view('p1', 'target', 'control')],
      'target',
    )
    expect(result.has('p1')).toBe(false)
  })

  it('only considers events for the given experiment_id', () => {
    const result = computeVariationAssignments(
      [view('p1', 'other', 'on'), view('p1', 'target', 'off')],
      'target',
    )
    expect(result.get('p1')).toBe('off')
  })

  it('ignores non-experiment_viewed events even with experiment_id set', () => {
    const result = computeVariationAssignments(
      [
        makeEvent({
          event: 'screen',
          userIdHash: 'p1',
          experimentId: 'target',
          variationId: 'on',
        }),
      ],
      'target',
    )
    expect(result.has('p1')).toBe(false)
  })

  it('skips events with empty variation_id', () => {
    const result = computeVariationAssignments([view('p1', 'target', '')], 'target')
    expect(result.has('p1')).toBe(false)
  })
})

describe('uniqueExperimentIds', () => {
  it('lists distinct experiment_ids alphabetically, ignoring empties', () => {
    const result = uniqueExperimentIds([
      view('p1', 'beta', 'on'),
      view('p2', 'alpha', 'on'),
      view('p3', 'alpha', 'off'),
      view('p4', '', 'on'),
    ])
    expect(result).toEqual(['alpha', 'beta'])
  })

  it('ignores experiment_id values on non-experiment_viewed events', () => {
    const result = uniqueExperimentIds([
      makeEvent({
        event: 'screen',
        userIdHash: 'p1',
        experimentId: 'should_not_appear',
      }),
    ])
    expect(result).toEqual([])
  })
})
