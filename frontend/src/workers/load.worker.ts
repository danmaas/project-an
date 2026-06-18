// Worker that loads a Parquet event log, normalizes rows, and synthesizes
// retention events. Runs entirely off the main thread so the UI stays
// responsive on large datasets (us = 1.4M rows, full = 10.5M rows).
//
// Memory strategy: read parquet **one batch of row groups at a time** via
// `parquetRead({rowStart, rowEnd, metadata})`. Each batch is normalized,
// has its retention events synthesized in-line, and is then streamed to the
// main thread in ~100k-row chunks. The previous batch's decoded buffers are
// garbage-collected before the next batch is read, so worker peak memory is
// bounded to one batch (~500k rows) instead of the whole file.

import {
  asyncBufferFromUrl,
  parquetMetadataAsync,
  parquetRead,
  type FileMetaData,
} from 'hyparquet'
import { classifyCountry } from '../data/country'
import { toMs } from '../data/timestamp'
import type { PlayerEvent } from '../types'

export type LoadInbound = { type: 'load'; filename: string }

/**
 * Worker→main stream protocol:
 *   streamStart → streamChunk* → streamEnd, with progress messages interleaved.
 * No `offset` is sent — chunks are appended in order on the main thread, since
 * we don't know the final length up front (synthesized retention events can
 * inflate the row count by a few percent).
 */
export type LoadOutbound =
  | { type: 'progress'; phase: string; percent: number }
  | { type: 'streamStart' }
  | { type: 'streamChunk'; events: PlayerEvent[] }
  | { type: 'streamEnd' }
  | { type: 'error'; message: string }

function post(msg: LoadOutbound) {
  ;(self as unknown as { postMessage: (m: LoadOutbound) => void }).postMessage(msg)
}

// Parquet columns we read (order fixed so we can index by position).
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

// Row-group batching parameters.
const BATCH_ROW_GROUPS = 10 // ~500k rows per batch for our 50k-row groups
const STREAM_CHUNK = 100_000 // chunk size for postMessage to main thread

// Retention-event synthesis: for each player, a `returned_Nd` event is
// emitted iff that player has at least one `screen` event whose timestamp
// falls in the half-open window
//     [user_create_time + N days, user_create_time + (N+1) days)
// The synthetic event borrows its timestamp (and country / platform /
// join_week / user_create_time) from the first qualifying screen encountered
// in input order. Done in-line with batch decoding so no whole-file buffer
// is ever materialized; per-player emission state is kept across batches so
// a (player, N) emission doesn't repeat just because the player's screens
// straddle a batch boundary.
const DAY_MS = 86_400_000
const RETENTION_DAYS: ReadonlySet<number> = new Set([1, 2, 3, 5, 7])

self.onmessage = async (event: MessageEvent<LoadInbound>) => {
  if (event.data.type !== 'load') return
  const { filename } = event.data
  try {
    post({ type: 'progress', phase: 'fetching metadata', percent: 1 })
    const file = await asyncBufferFromUrl({ url: `/api/data/${filename}` })
    const metadata: FileMetaData = await parquetMetadataAsync(file)
    const totalRows = Number(metadata.num_rows)
    const groupCount = metadata.row_groups.length

    post({
      type: 'progress',
      phase: `${totalRows.toLocaleString()} rows in ${groupCount} groups`,
      percent: 3,
    })
    post({ type: 'streamStart' })

    // Per-player Set of N values already emitted (kept across batches).
    const emitted = new Map<string, Set<number>>()

    let cursor = 0
    for (let g = 0; g < groupCount; g += BATCH_ROW_GROUPS) {
      const endGroup = Math.min(g + BATCH_ROW_GROUPS, groupCount)
      let batchRowCount = 0
      for (let i = g; i < endGroup; i++) {
        batchRowCount += Number(metadata.row_groups[i].num_rows)
      }
      const batchStart = cursor
      const batchEnd = batchStart + batchRowCount
      cursor = batchEnd

      // Decode this batch's rows. parquetRead with rowStart/rowEnd reads only
      // the row groups overlapping the range.
      let rows: unknown[][] = []
      await parquetRead({
        file,
        metadata,
        columns: COLUMNS as unknown as string[],
        rowStart: batchStart,
        rowEnd: batchEnd,
        onComplete: (data) => {
          rows = data as unknown[][]
        },
      })

      // Normalize + synthesize on the fly, pushing into a chunk buffer.
      // Chunks are flushed at STREAM_CHUNK boundaries so per-message clone
      // size stays well under the structured-clone cap.
      let chunk: PlayerEvent[] = []
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        const ev: PlayerEvent = {
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
        ;(rows as unknown as (unknown | undefined)[])[i] = undefined // free source
        chunk.push(ev)

        // Synthesize a returned_Nd event if this is a screen in a retention window.
        if (ev.event === 'screen' && ev.userIdHash) {
          const offsetMs = ev.ts - ev.userCreateTime
          if (offsetMs >= 0) {
            const n = Math.floor(offsetMs / DAY_MS)
            if (RETENTION_DAYS.has(n)) {
              let already = emitted.get(ev.userIdHash)
              if (!already) {
                already = new Set()
                emitted.set(ev.userIdHash, already)
              }
              if (!already.has(n)) {
                already.add(n)
                chunk.push({
                  ts: ev.ts,
                  event: `returned_${n}d`,
                  userIdHash: ev.userIdHash,
                  userCreateTime: ev.userCreateTime,
                  countryAgg: ev.countryAgg,
                  platform: ev.platform,
                  joinWeek: ev.joinWeek,
                  experimentId: '',
                  variationId: '',
                })
              }
            }
          }
        }

        // Flush chunk when it hits the streaming threshold.
        if (chunk.length >= STREAM_CHUNK) {
          post({ type: 'streamChunk', events: chunk })
          chunk = []
        }
      }
      if (chunk.length > 0) {
        post({ type: 'streamChunk', events: chunk })
        chunk = []
      }
      // Help the GC reclaim the batch before reading the next one.
      rows = []

      const pct = 3 + Math.floor((batchEnd / totalRows) * 95)
      post({
        type: 'progress',
        phase: `processed ${batchEnd.toLocaleString()}/${totalRows.toLocaleString()} rows`,
        percent: pct,
      })
    }

    post({ type: 'progress', phase: 'ready', percent: 100 })
    post({ type: 'streamEnd' })
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}
