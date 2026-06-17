import type { Filters, GroupBy, HourlyBucket, PlayerEvent } from '../types'

/** ISO date string ("YYYY-MM-DD") in UTC, used as a stable key for join-week. */
export function joinWeekKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Apply the user's filter selections. A null filter means "all values pass". */
export function applyFilters(events: PlayerEvent[], filters: Filters): PlayerEvent[] {
  const { countryAgg, platform, joinWeek } = filters
  if (!countryAgg && !platform && !joinWeek) return events
  return events.filter((e) => {
    if (countryAgg && e.countryAgg !== countryAgg) return false
    if (platform && e.platform !== platform) return false
    if (joinWeek && joinWeekKey(e.joinWeek) !== joinWeek) return false
    return true
  })
}

/** Bucket events by UTC hour, optionally split by a group-by dimension. */
export function bucketByHour(
  events: PlayerEvent[],
  groupBy: GroupBy = null,
): HourlyBucket[] {
  // Keyed by "<group>\x00<hour-ms>" so a single Map handles both grouped and
  // ungrouped aggregation without separate code paths.
  const counts = new Map<string, number>()
  for (const e of events) {
    const hour = floorToHour(e.ts).getTime()
    const group = groupKeyFor(e, groupBy)
    const key = `${group}\x00${hour}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const buckets: HourlyBucket[] = []
  for (const [key, count] of counts) {
    const sep = key.indexOf('\x00')
    const group = key.slice(0, sep)
    const hour = new Date(Number(key.slice(sep + 1)))
    buckets.push(groupBy ? { hour, count, group } : { hour, count })
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
): HourlyBucket[] {
  return bucketByHour(
    events.filter((e) => e.event === 'screen'),
    groupBy,
  )
}

/** Collect the distinct join_week keys present in the data, sorted ascending. */
export function uniqueJoinWeeks(events: PlayerEvent[]): string[] {
  const set = new Set<string>()
  for (const e of events) set.add(joinWeekKey(e.joinWeek))
  return [...set].sort()
}

function groupKeyFor(e: PlayerEvent, groupBy: GroupBy): string {
  if (groupBy === 'countryAgg') return e.countryAgg
  if (groupBy === 'platform') return e.platform
  if (groupBy === 'joinWeek') return joinWeekKey(e.joinWeek)
  return ''
}

function floorToHour(d: Date): Date {
  const out = new Date(d)
  out.setUTCMinutes(0, 0, 0)
  return out
}
