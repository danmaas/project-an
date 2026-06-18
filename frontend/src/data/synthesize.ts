import type { PlayerEvent } from '../types'

const DAY_MS = 86_400_000
const RETENTION_DAYS: ReadonlySet<number> = new Set([1, 2, 3, 5, 7])

/**
 * Synthesize `returned_Nd` retention events from the raw event log.
 *
 * For each player, a `returned_Nd` event is emitted iff that player has at
 * least one `screen` event whose timestamp falls in the half-open window
 *     [user_create_time + N days, user_create_time + (N+1) days)
 * The synthetic event borrows its timestamp (and country / platform /
 * join_week / user_create_time) from the first qualifying screen event
 * encountered in input order.
 *
 * Returns a new array; the input is not mutated.
 */
export function synthesizeRetentionEvents(events: PlayerEvent[]): PlayerEvent[] {
  const emitted = new Map<string, Set<number>>()
  const synthetic: PlayerEvent[] = []

  for (const e of events) {
    if (e.event !== 'screen') continue
    if (!e.userIdHash) continue

    const offsetMs = e.ts.getTime() - e.userCreateTime.getTime()
    if (offsetMs < 0) continue
    const n = Math.floor(offsetMs / DAY_MS)
    if (!RETENTION_DAYS.has(n)) continue

    let already = emitted.get(e.userIdHash)
    if (!already) {
      already = new Set()
      emitted.set(e.userIdHash, already)
    }
    if (already.has(n)) continue
    already.add(n)

    synthetic.push({
      ts: e.ts,
      event: `returned_${n}d`,
      userIdHash: e.userIdHash,
      userCreateTime: e.userCreateTime,
      countryAgg: e.countryAgg,
      platform: e.platform,
      joinWeek: e.joinWeek,
    })
  }

  return events.concat(synthetic)
}
