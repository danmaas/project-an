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
    let events: PlayerEvent[] = []
    worker.onmessage = (e: MessageEvent<LoadOutbound>) => {
      const msg = e.data
      if (msg.type === 'progress') {
        onProgress({ phase: msg.phase, percent: msg.percent })
      } else if (msg.type === 'streamStart') {
        events = []
      } else if (msg.type === 'streamChunk') {
        // Pre-grow the array, then write each event into the new slots —
        // cheaper than `push.apply` and safe for chunks of any size.
        const start = events.length
        const len = msg.events.length
        events.length = start + len
        for (let i = 0; i < len; i++) events[start + i] = msg.events[i]
      } else if (msg.type === 'streamEnd') {
        worker.terminate()
        resolve(events)
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
