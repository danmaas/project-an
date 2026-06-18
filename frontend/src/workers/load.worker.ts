// Worker that loads a Parquet event log, normalizes rows, and synthesizes
// retention events. Runs entirely off the main thread so the UI stays
// responsive on large datasets (us = 1.4M rows, full = 10.5M rows).

import { asyncBufferFromUrl, parquetRead } from 'hyparquet'
import { classifyCountry } from '../data/country'
import { synthesizeRetentionEvents } from '../data/synthesize'
import { toMs } from '../data/timestamp'
import type { PlayerEvent } from '../types'

export type LoadInbound = { type: 'load'; filename: string }

/**
 * The worker streams the assembled event log back to the main thread in
 * chunks rather than as a single huge array. A monolithic `postMessage`
 * structured-clone of, say, 6M PlayerEvents exceeds the browser's per-message
 * clone budget and throws "Data cannot be cloned, out of memory"; chunking
 * keeps each individual clone small (~tens of MB) so even multi-GB total
 * payloads can be transferred.
 */
export type LoadOutbound =
  | { type: 'progress'; phase: string; percent: number }
  | { type: 'streamStart'; total: number }
  | { type: 'streamChunk'; offset: number; events: PlayerEvent[] }
  | { type: 'streamEnd' }
  | { type: 'error'; message: string }

// Convenience to keep the discriminated union honest in TS.
function post(msg: LoadOutbound) {
  ;(self as unknown as { postMessage: (m: LoadOutbound) => void }).postMessage(msg)
}

self.onmessage = async (event: MessageEvent<LoadInbound>) => {
  if (event.data.type !== 'load') return
  const { filename } = event.data
  try {
    post({ type: 'progress', phase: 'fetching parquet', percent: 2 })
    const file = await asyncBufferFromUrl({ url: `/api/data/${filename}` })

    post({ type: 'progress', phase: 'decoding columns', percent: 10 })
    // Use rows-as-arrays format (default rowFormat). Smaller in memory than
    // the object form (no per-row keys), and we index by position below.
    // The column order matches the `columns` array we pass in.
    const COLUMNS = [
      'ts',
      'event',
      'user_id_hash',
      'user_create_time',
      'country',
      'platform',
      'join_week',
      'experiment_id',
      'variation_id',
    ] as const
    const COL_TS = 0
    const COL_EVENT = 1
    const COL_USER_ID = 2
    const COL_CREATE = 3
    const COL_COUNTRY = 4
    const COL_PLATFORM = 5
    const COL_JOIN_WEEK = 6
    const COL_EXP = 7
    const COL_VAR = 8

    let rows: unknown[][] = []
    await parquetRead({
      file,
      columns: COLUMNS as unknown as string[],
      onComplete: (data) => {
        rows = data as unknown[][]
      },
    })

    const total = rows.length
    post({ type: 'progress', phase: `normalizing ${total.toLocaleString()} events`, percent: 50 })

    const events: PlayerEvent[] = new Array(total)
    const CHUNK = 100_000
    let lastReported = -1
    for (let i = 0; i < total; i++) {
      const r = rows[i]
      events[i] = {
        ts: toMs(r[COL_TS]),
        event: String(r[COL_EVENT]),
        userIdHash: String(r[COL_USER_ID] ?? ''),
        userCreateTime: toMs(r[COL_CREATE]),
        countryAgg: classifyCountry(r[COL_COUNTRY] == null ? null : String(r[COL_COUNTRY])),
        platform: String(r[COL_PLATFORM] ?? ''),
        joinWeek: toMs(r[COL_JOIN_WEEK]),
        experimentId: r[COL_EXP] == null ? '' : String(r[COL_EXP]),
        variationId: r[COL_VAR] == null ? '' : String(r[COL_VAR]),
      }
      // Free the source row as we go so the GC can reclaim it; reduces peak
      // memory during the conversion pass on large files.
      ;(rows as unknown as (unknown | undefined)[])[i] = undefined
      if (i > 0 && i % CHUNK === 0) {
        const pct = 50 + Math.floor((i / total) * 35)
        if (pct !== lastReported) {
          lastReported = pct
          post({
            type: 'progress',
            phase: `normalizing ${total.toLocaleString()} events`,
            percent: pct,
          })
        }
      }
    }

    post({ type: 'progress', phase: 'synthesizing retention events', percent: 88 })
    const withSynthetic = synthesizeRetentionEvents(events)

    // Stream to the main thread in chunks. Each chunk is independently
    // structured-cloned, so the per-message cap doesn't matter — only the
    // chunk size does.
    const STREAM_CHUNK = 100_000
    const finalTotal = withSynthetic.length
    post({ type: 'streamStart', total: finalTotal })
    for (let off = 0; off < finalTotal; off += STREAM_CHUNK) {
      const end = Math.min(off + STREAM_CHUNK, finalTotal)
      const slice = withSynthetic.slice(off, end)
      post({ type: 'streamChunk', offset: off, events: slice })
      // Release the items we just sent so the worker's peak memory doesn't
      // double during streaming. (The slice was copied for the postMessage
      // clone; the originals are no longer needed.)
      withSynthetic.fill(undefined as unknown as PlayerEvent, off, end)
      const pct = 90 + Math.floor((end / finalTotal) * 10)
      post({ type: 'progress', phase: 'transferring', percent: pct })
    }
    post({ type: 'streamEnd' })
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}

