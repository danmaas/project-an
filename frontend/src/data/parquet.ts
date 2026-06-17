import { asyncBufferFromUrl, parquetReadObjects } from 'hyparquet'
import type { PlayerEvent } from '../types'
import { classifyCountry } from './country'

/** List the available event-log Parquet files in the backend's data directory. */
export async function fetchFileList(): Promise<string[]> {
  const response = await fetch('/api/data')
  if (!response.ok) {
    throw new Error(`Failed to list event logs: HTTP ${response.status}`)
  }
  const body = (await response.json()) as { files?: string[] }
  return body.files ?? []
}

/** Fetch a Parquet file from the backend and decode just the columns we need. */
export async function fetchEvents(filename: string): Promise<PlayerEvent[]> {
  const url = `/api/data/${filename}`
  const file = await asyncBufferFromUrl({ url })
  const rows = (await parquetReadObjects({
    file,
    columns: ['ts', 'event', 'user_id_hash', 'country', 'platform', 'join_week'],
  })) as Array<Record<string, unknown>>
  return rows.map((r) => ({
    ts: toDate(r.ts),
    event: String(r.event),
    userIdHash: String(r.user_id_hash ?? ''),
    countryAgg: classifyCountry(r.country == null ? null : String(r.country)),
    platform: String(r.platform ?? ''),
    joinWeek: toDate(r.join_week),
  }))
}

// Parquet TIMESTAMP_NS values are returned as bigint nanoseconds since epoch by
// hyparquet (Date can't represent that precision); TIMESTAMP_MICROS and
// TIMESTAMP_MILLIS may come through as Date or bigint depending on the file.
// We accept all four shapes and normalize to Date.
export function toDate(value: unknown): Date {
  if (value instanceof Date) return value
  if (typeof value === 'bigint') {
    const n = Number(value)
    // Magnitude check: a 2026 timestamp is ~1.78e12 ms, ~1.78e15 µs, ~1.78e18 ns.
    if (n < 1e13) return new Date(n)
    if (n < 1e16) return new Date(n / 1e3)
    return new Date(n / 1e6)
  }
  if (typeof value === 'number') return new Date(value)
  return new Date(String(value))
}
