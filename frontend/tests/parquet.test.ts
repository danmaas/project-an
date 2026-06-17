import { describe, it, expect } from 'vitest'
import { toDate } from '../src/data/parquet'

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
