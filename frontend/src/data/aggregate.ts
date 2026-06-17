import type { PlayerEvent, HourlyBucket } from '../types'

/** Bucket events by the hour (UTC) they occurred in, sorted chronologically. */
export function bucketByHour(events: PlayerEvent[]): HourlyBucket[] {
  const counts = new Map<number, number>()
  for (const e of events) {
    const hour = floorToHour(e.ts).getTime()
    counts.set(hour, (counts.get(hour) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort(([a], [b]) => a - b)
    .map(([hour, count]) => ({ hour: new Date(hour), count }))
}

/** Filter for `event === 'screen'`, then bucket by hour. */
export function screenEventsByHour(events: PlayerEvent[]): HourlyBucket[] {
  return bucketByHour(events.filter((e) => e.event === 'screen'))
}

function floorToHour(d: Date): Date {
  const out = new Date(d)
  out.setUTCMinutes(0, 0, 0)
  return out
}
