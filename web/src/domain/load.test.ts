import { describe, it, expect } from 'vitest'
import { stackKg, effectiveKg, isNearStationCeiling } from './load'

describe('stackKg', () => {
  it('pin 15 equals the full stack — 74.84 kg (165 lb). Arithmetic check per CLAUDE.md §9.', () => {
    expect(stackKg(15)).toBeCloseTo(74.84, 2)
  })

  it('pin 1 is top plate + one plate', () => {
    expect(stackKg(1)).toBeCloseTo(11.34, 2)
  })
})

describe('effectiveKg', () => {
  it('pin 6 on upper_pulley (factor 1.0) = 34.02 kg', () => {
    expect(effectiveKg(6, 1.0)).toBeCloseTo(34.02, 2)
  })

  it('pin 12 on low_pulley (factor 0.5) = 30.62 kg', () => {
    expect(effectiveKg(12, 0.5)).toBeCloseTo(30.62, 2)
  })

  it('pin 6 on press_arm (factor 0.6) = 20.41 kg', () => {
    expect(effectiveKg(6, 0.6)).toBeCloseTo(20.41, 2)
  })
})

describe('isNearStationCeiling', () => {
  it('flags an exercise at or above 90% of station max', () => {
    // low_pulley max is 37.42 kg; pin 14 → 35.15 kg ≈ 94%
    expect(isNearStationCeiling(effectiveKg(14, 0.5), 37.42)).toBe(true)
  })

  it('does not flag well below the ceiling', () => {
    // pin 12 on low_pulley → 30.62 kg ≈ 82% of 37.42
    expect(isNearStationCeiling(effectiveKg(12, 0.5), 37.42)).toBe(false)
  })

  it('is exact at the 90% boundary', () => {
    expect(isNearStationCeiling(90, 100)).toBe(true)
    expect(isNearStationCeiling(89.9, 100)).toBe(false)
  })
})
