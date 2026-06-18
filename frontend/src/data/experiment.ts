import type { GroupBy, PlayerEvent } from '../types'

const EXPERIMENT_PREFIX = 'experiment:'

/**
 * If `groupBy` selects an experiment (the `experiment:<id>` arm), return the
 * experiment id; otherwise null. Centralizes the prefix-encoding so the rest
 * of the code doesn't sprinkle string surgery.
 */
export function experimentIdFromGroupBy(groupBy: GroupBy): string | null {
  if (typeof groupBy !== 'string') return null
  return groupBy.startsWith(EXPERIMENT_PREFIX)
    ? groupBy.slice(EXPERIMENT_PREFIX.length)
    : null
}

/** Encode an experiment id as the GroupBy value used in the dropdown. */
export function experimentGroupByValue(id: string): GroupBy {
  return `${EXPERIMENT_PREFIX}${id}`
}

/**
 * For the given experiment, return a `user_id_hash → variation_id` map: the
 * variation each player was *first* exposed to, by ts, ignoring `control`
 * (which the spec treats as a dummy bucket). Players never exposed to this
 * experiment — or only exposed to control — are absent from the map.
 */
export function computeVariationAssignments(
  events: PlayerEvent[],
  experimentId: string,
): Map<string, string> {
  // Track the earliest non-control variation per player.
  const earliest = new Map<string, { variationId: string; ts: number }>()
  for (let i = 0; i < events.length; i++) {
    const e = events[i]
    if (e.event !== 'experiment_viewed') continue
    if (e.experimentId !== experimentId) continue
    if (!e.variationId || e.variationId === 'control') continue
    const cur = earliest.get(e.userIdHash)
    if (!cur || e.ts < cur.ts) {
      earliest.set(e.userIdHash, { variationId: e.variationId, ts: e.ts })
    }
  }
  // Strip metadata.
  const out = new Map<string, string>()
  for (const [k, v] of earliest) out.set(k, v.variationId)
  return out
}

/** Distinct, non-empty `experiment_id` values appearing in the event log. */
export function uniqueExperimentIds(events: PlayerEvent[]): string[] {
  const set = new Set<string>()
  for (const e of events) {
    if (e.event !== 'experiment_viewed') continue
    if (e.experimentId) set.add(e.experimentId)
  }
  return [...set].sort()
}
