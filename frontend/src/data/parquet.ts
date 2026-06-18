import LoadWorker from '../workers/load.worker?worker'
import type { LoadOutbound } from '../workers/load.worker'
import type { PlayerEvent } from '../types'

/** Progress information emitted while a parquet file is being loaded. */
export interface LoadProgress {
  phase: string
  percent: number
}

/** List the available event-log Parquet files in the backend's data directory. */
export async function fetchFileList(): Promise<string[]> {
  const response = await fetch('/api/data')
  if (!response.ok) {
    throw new Error(`Failed to list event logs: HTTP ${response.status}`)
  }
  const body = (await response.json()) as { files?: string[] }
  return body.files ?? []
}

/**
 * Load a Parquet event log on a background thread. The worker handles the
 * (potentially seconds-long) decode + normalize + synthesize work, posting
 * progress messages so the main thread can drive a progress bar, and streams
 * the assembled event log back in chunks (so the structured-clone size cap
 * doesn't apply to the total payload).
 */
export function fetchEvents(
  filename: string,
  onProgress: (p: LoadProgress) => void = () => {},
): Promise<PlayerEvent[]> {
  return new Promise((resolve, reject) => {
    const worker = new LoadWorker()
    // Pre-allocated once we receive `streamStart`; assembled in place.
    let events: PlayerEvent[] | null = null
    worker.onmessage = (e: MessageEvent<LoadOutbound>) => {
      const msg = e.data
      if (msg.type === 'progress') {
        onProgress({ phase: msg.phase, percent: msg.percent })
      } else if (msg.type === 'streamStart') {
        events = new Array<PlayerEvent>(msg.total)
      } else if (msg.type === 'streamChunk') {
        if (!events) {
          reject(new Error('streamChunk arrived before streamStart'))
          worker.terminate()
          return
        }
        const { offset, events: chunk } = msg
        for (let i = 0; i < chunk.length; i++) events[offset + i] = chunk[i]
      } else if (msg.type === 'streamEnd') {
        worker.terminate()
        resolve(events ?? [])
      } else if (msg.type === 'error') {
        worker.terminate()
        reject(new Error(msg.message))
      }
    }
    worker.onerror = (e) => {
      worker.terminate()
      reject(new Error(`Worker error: ${e.message || 'unknown'}`))
    }
    worker.postMessage({ type: 'load', filename })
  })
}
