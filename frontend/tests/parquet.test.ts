import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchFileList, toDate } from '../src/data/parquet'

// May 1, 2026 00:00:00 UTC in various units:
const MS = new Date('2026-05-01T00:00:00Z').getTime()
const US = MS * 1_000
const NS = MS * 1_000_000

describe('toDate', () => {
  it('passes Date values through', () => {
    const d = new Date(MS)
    expect(toDate(d)).toBe(d)
  })

  it('converts bigint milliseconds since epoch', () => {
    expect(toDate(BigInt(MS)).getTime()).toBe(MS)
  })

  it('converts bigint microseconds since epoch', () => {
    expect(toDate(BigInt(US)).getTime()).toBe(MS)
  })

  it('converts bigint nanoseconds since epoch', () => {
    expect(toDate(BigInt(NS)).getTime()).toBe(MS)
  })

  it('falls back to Date constructor for ISO strings', () => {
    expect(toDate('2026-05-01T00:00:00Z').getTime()).toBe(MS)
  })

  it('treats plain numbers as milliseconds', () => {
    expect(toDate(MS).getTime()).toBe(MS)
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
