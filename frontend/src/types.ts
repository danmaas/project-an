// Subset of the event-log schema we care about for TASK-100.
// The full schema includes user_id_hash, country, platform, join_week,
// screen_name, experiment_id, variation_id — we'll wire those in for later tasks.
export interface PlayerEvent {
  ts: Date
  event: string
}

export interface HourlyBucket {
  hour: Date
  count: number
}
