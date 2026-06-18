// Self-contained chi-square statistics. Implements:
//   - the chi-square test of independence on a contingency table
//   - the chi-square distribution CDF (upper tail = p-value)
//
// Numerical guts: regularized upper incomplete gamma function Q(a, x), via
// series for x < a+1 and Lentz's continued fraction otherwise, with logGamma
// computed by the Lanczos approximation. See Numerical Recipes §6.2.

/** Result of a chi-square test. */
export interface ChiSquareResult {
  chi2: number
  df: number
  p: number
}

/**
 * Chi-square test of independence on a contingency table.
 *
 * `table[i][j]` is the observed count for row category i and column category j.
 * Returns NaN/null guards are NOT applied — callers must ensure ≥2 rows and
 * ≥2 columns; otherwise an error is thrown.
 */
export function chiSquareTest(table: readonly (readonly number[])[]): ChiSquareResult {
  const rows = table.length
  if (rows < 2) throw new Error('chi-square test requires at least 2 rows')
  const cols = table[0].length
  if (cols < 2) throw new Error('chi-square test requires at least 2 columns')

  const rowTotals = new Array<number>(rows).fill(0)
  const colTotals = new Array<number>(cols).fill(0)
  let grandTotal = 0
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const v = table[i][j]
      rowTotals[i] += v
      colTotals[j] += v
      grandTotal += v
    }
  }
  const df = (rows - 1) * (cols - 1)
  if (grandTotal === 0) return { chi2: 0, df, p: 1 }

  let chi2 = 0
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const expected = (rowTotals[i] * colTotals[j]) / grandTotal
      if (expected === 0) continue // observed must also be 0; contributes nothing
      const diff = table[i][j] - expected
      chi2 += (diff * diff) / expected
    }
  }
  return { chi2, df, p: chiSquarePValue(chi2, df) }
}

/** Upper-tail p-value: P(X ≥ chi2) for X ~ χ²(df). */
export function chiSquarePValue(chi2: number, df: number): number {
  if (chi2 < 0) throw new Error('chi-square statistic must be non-negative')
  if (df <= 0) throw new Error('degrees of freedom must be positive')
  if (chi2 === 0) return 1
  // χ²(df) CDF at chi2 = P(df/2, chi2/2); we want Q = 1 - P.
  return regularizedUpperIncompleteGamma(df / 2, chi2 / 2)
}

// ---------------------------------------------------------------------------
// Numerical core
// ---------------------------------------------------------------------------

function regularizedUpperIncompleteGamma(a: number, x: number): number {
  if (x < a + 1) {
    // Series is faster and more accurate for small x.
    return 1 - gammaSeriesLower(a, x)
  }
  return gammaContinuedFractionUpper(a, x)
}

// Series for the regularized lower incomplete gamma P(a, x), x < a+1.
function gammaSeriesLower(a: number, x: number): number {
  const ITMAX = 200
  const EPS = 1e-15
  let ap = a
  let sum = 1 / a
  let del = sum
  for (let n = 1; n <= ITMAX; n++) {
    ap += 1
    del *= x / ap
    sum += del
    if (Math.abs(del) < Math.abs(sum) * EPS) break
  }
  return sum * Math.exp(-x + a * Math.log(x) - logGamma(a))
}

// Continued fraction for the regularized upper incomplete gamma Q(a, x),
// x >= a+1, evaluated via Lentz's algorithm.
function gammaContinuedFractionUpper(a: number, x: number): number {
  const ITMAX = 200
  const EPS = 1e-15
  const FPMIN = 1e-300
  let b = x + 1 - a
  let c = 1 / FPMIN
  let d = 1 / b
  let h = d
  for (let i = 1; i <= ITMAX; i++) {
    const an = -i * (i - a)
    b += 2
    d = an * d + b
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = b + an / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const delta = d * c
    h *= delta
    if (Math.abs(delta - 1) < EPS) break
  }
  return h * Math.exp(-x + a * Math.log(x) - logGamma(a))
}

// Lanczos approximation for log Γ(z). Valid for z > 0; uses reflection for z < 0.5.
function logGamma(z: number): number {
  if (z < 0.5) {
    // Reflection: Γ(z)·Γ(1−z) = π / sin(πz).
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z)
  }
  const COEF = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ]
  const g = 7
  z -= 1
  let x = COEF[0]
  for (let i = 1; i < g + 2; i++) x += COEF[i] / (z + i)
  const t = z + g + 0.5
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x)
}
