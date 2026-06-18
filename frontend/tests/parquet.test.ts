import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchFileList } from '../src/data/parquet'
import { toMs } from '../src/data/timestamp'

// May 1, 2026 00:00:00 UTC in various units:
const MS = new Date('2026-05-01T00:00:00Z').getTime()
const US = MS * 1_000
const NS = MS * 1_000_000

describe('toMs', () => {
  it('passes Date values through (returning ms)', () => {
    expect(toMs(new Date(MS))).toBe(MS)
  })

  it('converts bigint milliseconds since epoch', () => {
    expect(toMs(BigInt(MS))).toBe(MS)
  })

  it('converts bigint microseconds since epoch', () => {
    expect(toMs(BigInt(US))).toBe(MS)
  })

  it('converts bigint nanoseconds since epoch', () => {
    expect(toMs(BigInt(NS))).toBe(MS)
  })

  it('falls back to Date constructor for ISO strings', () => {
    expect(toMs('2026-05-01T00:00:00Z')).toBe(MS)
  })

  it('treats plain numbers as milliseconds', () => {
    expect(toMs(MS)).toBe(MS)
  })
})

describe('fetchFileList', () => {
  afterEach(() => vi.restoreAllMocks())

  it('returns the files array from /api/data', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ files: ['a.parquet', 'b.parquet'] }),
    } as Response)

    const result = await fetchFileList()

    expect(fetchMock).toHaveBeenCalledWith('/api/data')
    expect(result).toEqual(['a.parquet', 'b.parquet'])
  })

  it('returns an empty array when the response omits the files field', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response)

    expect(await fetchFileList()).toEqual([])
  })

  it('throws with the HTTP status when the server returns an error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
    } as Response)

    await expect(fetchFileList()).rejects.toThrow(/500/)
  })
})
