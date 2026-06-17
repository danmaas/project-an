import type {
  Filters,
  GroupBy,
  PlayerEvent,
  RetentionEvent,
  RetentionMetrics,
} from '../types'
import { RETENTION_EVENTS } from '../types'
import { joinWeekKey } from './aggregate'

interface PlayerAttrs {
  countryAgg: string
  platform: string
  joinWeek: Date
}

/**
 * Compute per-player retention & monetization counts.
 *
 * Each rate is reported independently: a player who accomplished both
 * `returned_1d` and `sub_buy_success` counts toward both numerators (and is
 * counted once in the denominator).
 *
 * When `groupBy` is set, results are split by that dimension; otherwise a
 * single aggregate row (with no `group` label) is returned.
 */
export function computeRetentionMetrics(
  events: PlayerEvent[],
  filters: Filters,
  groupBy: GroupBy = null,
): RetentionMetrics[] {
  // Per-player attributes are constant across all of a player's events (per
  // schema). Snapshot them once so subsequent filtering / grouping is O(P)
  // rather than O(events).
  const playerAttrs = new Map<string, PlayerAttrs>()
  for (const e of events) {
    if (!e.userIdHash) continue
    if (!playerAttrs.has(e.userIdHash)) {
      playerAttrs.set(e.userIdHash, {
        countryAgg: e.countryAgg,
        platform: e.platform,
        joinWeek: e.joinWeek,
      })
    }
  }

  // Set of player ids that survive the filter.
  const matched = new Set<string>()
  for (const [id, attrs] of playerAttrs) {
    if (filters.countryAgg && attrs.countryAgg !== filters.countryAgg) continue
    if (filters.platform && attrs.platform !== filters.platform) continue
    if (filters.joinWeek && joinWeekKey(attrs.joinWeek) !== filters.joinWeek) continue
    matched.add(id)
  }

  // group label -> set of player ids that fall into that group
  const groups = new Map<string, Set<string>>()
  for (const id of matched) {
    const attrs = playerAttrs.get(id)!
    const key = groupKeyForPlayer(attrs, groupBy)
    let bucket = groups.get(key)
    if (!bucket) {
      bucket = new Set()
      groups.set(key, bucket)
    }
    bucket.add(id)
  }

  // player id -> set of retention events accomplished (one pass over events).
  const accomplishments = new Map<string, Set<RetentionEvent>>()
  const targetEvents = new Set<string>(RETENTION_EVENTS)
  for (const e of events) {
    if (!targetEvents.has(e.event)) continue
    if (!matched.has(e.userIdHash)) continue
    let set = accomplishments.get(e.userIdHash)
    if (!set) {
      set = new Set()
      accomplishments.set(e.userIdHash, set)
    }
    set.add(e.event as RetentionEvent)
  }

  // Sort groups: explicit groups alphabetically; aggregate row has key '' and
  // is the only entry when groupBy is null.
  const sortedGroupKeys = [...groups.keys()].sort()

  return sortedGroupKeys.map((key) => {
    const counts: Record<RetentionEvent, number> = {
      returned_1d: 0,
      returned_2d: 0,
      returned_3d: 0,
      sub_buy_success: 0,
    }
    for (const id of groups.get(key)!) {
      const accomp = accomplishments.get(id)
      if (!accomp) continue
      for (const ev of RETENTION_EVENTS) {
        if (accomp.has(ev)) counts[ev]++
      }
    }
    return {
      group: groupBy ? key : undefined,
      totalPlayers: groups.get(key)!.size,
      counts,
    }
  })
}

function groupKeyForPlayer(attrs: PlayerAttrs, groupBy: GroupBy): string {
  if (groupBy === 'countryAgg') return attrs.countryAgg
  if (groupBy === 'platform') return attrs.platform
  if (groupBy === 'joinWeek') return joinWeekKey(attrs.joinWeek)
  return ''
}
