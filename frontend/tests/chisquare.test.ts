import { describe, it, expect } from 'vitest'
import { chiSquarePValue, chiSquareTest } from '../src/data/chisquare'

describe('chiSquarePValue', () => {
  it('returns 1 for chi2 = 0', () => {
    expect(chiSquarePValue(0, 1)).toBe(1)
    expect(chiSquarePValue(0, 5)).toBe(1)
  })

  // Critical values for df=1 (from any standard chi-square table).
  it.each([
    [2.706, 1, 0.1],
    [3.841, 1, 0.05],
    [6.635, 1, 0.01],
    [10.828, 1, 0.001],
  ])('matches chi-square table for df=1 (χ²=%f → p≈%f)', (chi2, df, expectedP) => {
    expect(chiSquarePValue(chi2, df)).toBeCloseTo(expectedP, 3)
  })

  // Critical values for df=2 and df=3.
  it.each([
    [5.991, 2, 0.05],
    [9.21, 2, 0.01],
    [7.815, 3, 0.05],
    [11.345, 3, 0.01],
  ])('matches chi-square table for df=%i (χ²=%f → p≈%f)', (chi2, df, expectedP) => {
    expect(chiSquarePValue(chi2, df)).toBeCloseTo(expectedP, 3)
  })

  it('is monotonically decreasing in chi2 for fixed df', () => {
    const p1 = chiSquarePValue(1, 2)
    const p2 = chiSquarePValue(5, 2)
    const p3 = chiSquarePValue(15, 2)
    expect(p1).toBeGreaterThan(p2)
    expect(p2).toBeGreaterThan(p3)
  })

  it('rejects invalid arguments', () => {
    expect(() => chiSquarePValue(-1, 1)).toThrow()
    expect(() => chiSquarePValue(1, 0)).toThrow()
    expect(() => chiSquarePValue(1, -2)).toThrow()
  })
})

describe('chiSquareTest', () => {
  it('rejects tables that are too small', () => {
    expect(() => chiSquareTest([[1, 2]])).toThrow(/at least 2 rows/)
    expect(() => chiSquareTest([[1], [2]])).toThrow(/at least 2 columns/)
  })

  it('returns chi2=0 and p=1 when observed equals expected (perfect independence)', () => {
    const r = chiSquareTest([
      [10, 10],
      [10, 10],
    ])
    expect(r.chi2).toBeCloseTo(0, 10)
    expect(r.df).toBe(1)
    expect(r.p).toBe(1)
  })

  it('returns chi2=0 and p=1 for an empty table', () => {
    const r = chiSquareTest([
      [0, 0],
      [0, 0],
    ])
    expect(r.chi2).toBe(0)
    expect(r.df).toBe(1)
    expect(r.p).toBe(1)
  })

  // The classic Wikipedia handedness × gender example (without Yates' correction):
  //   Men:   43 right, 9 left  (52)
  //   Women: 44 right, 4 left  (48)
  // expected[1][1] = 13·52/100 = 6.76, etc. χ² ≈ 1.7775, p ≈ 0.183.
  it('computes a 2x2 contingency-test correctly', () => {
    const r = chiSquareTest([
      [43, 9],
      [44, 4],
    ])
    expect(r.df).toBe(1)
    expect(r.chi2).toBeCloseTo(1.7775, 3)
    expect(r.p).toBeCloseTo(0.183, 2)
  })

  it('flags a clearly significant association', () => {
    // Strong association: variation A almost always accomplishes, B almost never.
    const r = chiSquareTest([
      [90, 10], // var A: 90 accomplished, 10 not
      [10, 90], // var B: 10 accomplished, 90 not
    ])
    expect(r.df).toBe(1)
    expect(r.p).toBeLessThan(0.001)
  })

  it('handles a 3x2 table (df=2)', () => {
    // Three variations, all with the same rate → no association.
    const r = chiSquareTest([
      [20, 80],
      [20, 80],
      [20, 80],
    ])
    expect(r.df).toBe(2)
    expect(r.chi2).toBeCloseTo(0, 6)
    expect(r.p).toBe(1)
  })

  it('computes correct degrees of freedom for a 3x3 table', () => {
    const r = chiSquareTest([
      [10, 5, 5],
      [5, 10, 5],
      [5, 5, 10],
    ])
    expect(r.df).toBe(4)
    expect(r.p).toBeGreaterThan(0)
    expect(r.p).toBeLessThan(1)
  })
})
