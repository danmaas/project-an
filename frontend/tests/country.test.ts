import { describe, it, expect } from 'vitest'
import { COUNTRY_CLASSES, classifyCountry } from '../src/data/country'

describe('classifyCountry', () => {
  it.each([
    ['us', 'ENG'],
    ['ca', 'ENG'],
    ['gb', 'ENG'],
    ['ie', 'ENG'],
    ['au', 'ENG'],
    ['nz', 'ENG'],
  ])('rolls %s into ENG', (raw, expected) => {
    expect(classifyCountry(raw)).toBe(expected)
  })

  it.each([
    ['kr', 'kr'],
    ['tw', 'tw'],
    ['jp', 'jp'],
  ])('retains the literal value for %s', (raw, expected) => {
    expect(classifyCountry(raw)).toBe(expected)
  })

  it.each([
    ['fr', 'EUR'],
    ['de', 'EUR'],
    ['za', 'EUR'],
    ['nl', 'EUR'],
    ['hu', 'EUR'],
  ])('rolls %s into EUR', (raw, expected) => {
    expect(classifyCountry(raw)).toBe(expected)
  })

  it('classifies unknown codes as Other', () => {
    expect(classifyCountry('br')).toBe('Other')
    expect(classifyCountry('zz')).toBe('Other')
  })

  it('handles uppercase input', () => {
    expect(classifyCountry('US')).toBe('ENG')
    expect(classifyCountry('JP')).toBe('jp')
  })

  it('classifies null / empty / undefined as Other', () => {
    expect(classifyCountry(null)).toBe('Other')
    expect(classifyCountry(undefined)).toBe('Other')
    expect(classifyCountry('')).toBe('Other')
  })
})

describe('COUNTRY_CLASSES', () => {
  it('lists all class labels in canonical UI order', () => {
    expect([...COUNTRY_CLASSES]).toEqual(['ENG', 'kr', 'tw', 'jp', 'EUR', 'Other'])
  })
})
