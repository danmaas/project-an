/**
 * Normalize a Parquet timestamp value (or anything Date-like that hyparquet
 * might hand us) to milliseconds since the Unix epoch.
 *
 * Parquet TIMESTAMP_NS values come through as bigint nanoseconds; TIMESTAMP_US
 * as bigint microseconds; TIMESTAMP_MS as bigint or Date depending on the
 * source. We pick the right scale by magnitude so the function works
 * regardless of which timestamp precision the column happens to use.
 */
export function toMs(value: unknown): number {
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'bigint') {
    const n = Number(value)
    // A 2026 timestamp is ~1.78e12 ms, ~1.78e15 µs, or ~1.78e18 ns.
    if (n < 1e13) return n
    if (n < 1e16) return n / 1e3
    return n / 1e6
  }
  if (typeof value === 'number') return value
  return new Date(String(value)).getTime()
}
