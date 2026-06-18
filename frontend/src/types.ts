// Subset of the event-log schema we currently care about.
// The full schema includes user_id_hash, screen_name, experiment_id,
// variation_id — we'll wire those in for later tasks.
// Timestamps are ms since epoch (number, not Date). For a multi-million-row
// event log this saves enormous amounts of memory vs Date objects and
// eliminates per-event Date allocation in hot aggregation paths. Dates are
// reconstructed only when needed (e.g. at the chart's data boundary).
export interface PlayerEvent {
  ts: number
  event: string
  /** Stable player identifier — the `user_id_hash` column in the Parquet. */
  userIdHash: string
  /** When the player's account was created (UTC, ms since epoch). */
  userCreateTime: number
  /**
   * Aggregated country class (see `data/country.ts`) — e.g. `ENG`, `kr`, `EUR`,
   * `Other`. Deliberately NOT named `country` so it can't be confused with the
   * raw 2-letter ISO code in the source Parquet column of the same name.
   */
  countryAgg: string
  platform: string
  /** UTC ms since epoch; quantized to the nearest week (constant per player). */
  joinWeek: number
  /** Populated only when `event === 'experiment_viewed'`; '' otherwise. */
  experimentId: string
  /** Populated only when `event === 'experiment_viewed'`; '' otherwise. */
  variationId: string
}

export interface HourlyBucket {
  hour: Date
  count: number
  /** Set when the data is grouped by a dimension; undefined otherwise. */
  group?: string
}

export interface Filters {
  countryAgg: string | null
  platform: string | null
  joinWeek: string | null
}

// Group-by selector value:
//   - null                  → no grouping
//   - 'countryAgg' | 'platform' | 'joinWeek'  → group by that dimension
//   - `experiment:<id>`     → "experiment analysis" mode (TASK-500): players
//                             without a non-control variation_id for <id> are
//                             excluded, and remaining players are grouped by
//                             their variation.
export type GroupBy =
  | null
  | 'countryAgg'
  | 'platform'
  | 'joinWeek'
  | `experiment:${string}`

export const PLATFORMS: readonly string[] = ['ios', 'android', 'web']

/**
 * Event names whose accomplishment-rate (per-player) we report in the metrics
 * table. Listed in the order they appear in the UI.
 */
export const RETENTION_EVENTS = [
  'returned_1d',
  'returned_2d',
  'returned_3d',
  'sub_buy_success',
] as const

export type RetentionEvent = (typeof RETENTION_EVENTS)[number]

export interface RetentionMetrics {
  /** Group label when `groupBy` is active; `undefined` for the aggregate row. */
  group?: string
  /** Distinct players in this group who pass the filter. */
  totalPlayers: number
  /** Count of players who accomplished each retention event at least once. */
  counts: Record<RetentionEvent, number>
}

export const EMPTY_FILTERS: Filters = {
  countryAgg: null,
  platform: null,
  joinWeek: null,
}
