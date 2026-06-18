import type { Filters, GroupBy, HourlyBucket, PlayerEvent } from '../types'
import { experimentIdFromGroupBy } from './experiment'

const HOUR_MS = 3_600_000

// Memoized formatter for join-week keys. There are at most ~5 distinct values
// per month-long file, so the cache pays for itself many times over (called
// per event in applyFilters and aggregation paths).
const joinWeekKeyCache = new Map<number, string>()

/** ISO date string ("YYYY-MM-DD") in UTC for a join-week timestamp in ms. */
export function joinWeekKey(ms: number): string {
  let s = joinWeekKeyCache.get(ms)
  if (s !== undefined) return s
  s = new Date(ms).toISOString().slice(0, 10)
  joinWeekKeyCache.set(ms, s)
  return s
}

/**
 * Apply the user's filter selections. A null filter means "all values pass".
 *
 * When `variationAssignments` is provided (TASK-500 experiment mode), events
 * for players not in the map are also dropped — these are players who never
 * saw the experiment or only saw the `control` dummy variation.
 */
export function applyFilters(
  events: PlayerEvent[],
  filters: Filters,
  variationAssignments?: Map<string, string> | null,
): PlayerEvent[] {
  const { countryAgg, platform, joinWeek } = filters
  const hasFilter = countryAgg || platform || joinWeek
  if (!hasFilter && !variationAssignments) return events
  return events.filter((e) => {
    if (variationAssignments && !variationAssignments.has(e.userIdHash)) return false
    if (countryAgg && e.countryAgg !== countryAgg) return false
    if (platform && e.platform !== platform) return false
    if (joinWeek && joinWeekKey(e.joinWeek) !== joinWeek) return false
    return true
  })
}

/**
 * Bucket events by UTC hour, optionally split by a group-by dimension.
 *
 * Hot path: uses a nested Map<group, Map<hourMs, count>> so each event does
 * two cheap Map lookups instead of building a temporary composite string key.
 *
 * When the group-by is an experiment, `variationAssignments` is required to
 * resolve each player's variation_id.
 */
export function bucketByHour(
  events: PlayerEvent[],
  groupBy: GroupBy = null,
  variationAssignments?: Map<string, string> | null,
): HourlyBucket[] {
  const isGrouping = groupBy !== null
  const counts = new Map<string, Map<number, number>>()
  for (let i = 0; i < events.length; i++) {
    const e = events[i]
    const hourMs = Math.floor(e.ts / HOUR_MS) * HOUR_MS
    const g = groupKeyFor(e, groupBy, variationAssignments)
    let inner = counts.get(g)
    if (!inner) {
      inner = new Map<number, number>()
      counts.set(g, inner)
    }
    inner.set(hourMs, (inner.get(hourMs) ?? 0) + 1)
  }

  const buckets: HourlyBucket[] = []
  for (const [g, inner] of counts) {
    for (const [hourMs, count] of inner) {
      buckets.push(
        isGrouping
          ? { hour: new Date(hourMs), count, group: g }
          : { hour: new Date(hourMs), count },
      )
    }
  }
  return buckets.sort((a, b) => {
    const t = a.hour.getTime() - b.hour.getTime()
    if (t !== 0) return t
    return (a.group ?? '').localeCompare(b.group ?? '')
  })
}

/** Filter for `event === 'screen'`, then bucket by hour (with optional grouping). */
export function screenEventsByHour(
  events: PlayerEvent[],
  groupBy: GroupBy = null,
  variationAssignments?: Map<string, string> | null,
): HourlyBucket[] {
  return bucketByHour(
    events.filter((e) => e.event === 'screen'),
    groupBy,
    variationAssignments,
  )
}

/** Collect the distinct join_week keys present in the data, sorted ascending. */
export function uniqueJoinWeeks(events: PlayerEvent[]): string[] {
  const set = new Set<string>()
  for (let i = 0; i < events.length; i++) set.add(joinWeekKey(events[i].joinWeek))
  return [...set].sort()
}

function groupKeyFor(
  e: PlayerEvent,
  groupBy: GroupBy,
  variationAssignments?: Map<string, string> | null,
): string {
  if (groupBy === 'countryAgg') return e.countryAgg
  if (groupBy === 'platform') return e.platform
  if (groupBy === 'joinWeek') return joinWeekKey(e.joinWeek)
  if (experimentIdFromGroupBy(groupBy)) {
    return variationAssignments?.get(e.userIdHash) ?? ''
  }
  return ''
}
