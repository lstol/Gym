import { describe, it, expect } from 'vitest'
import { PCT_PER_REP, suggestNext } from './progression'
import type { ProgressionInput, SessionPerformance } from './progression'

/** A stack exercise on a given station, with sensible defaults per test. */
function input(over: Partial<ProgressionInput> = {}): ProgressionInput {
  return {
    history: [],
    repMin: 8,
    repMax: 12,
    targetSets: 3,
    loadSource: 'stack',
    stationFactor: 1.0,
    stationMaxEffectiveKg: 74.84,
    isUnilateral: false,
    ...over,
  }
}

function session(
  date: string,
  sets: { reps: number; rir: number | null; pin?: number | null; side?: 'L' | 'R' | null; isWarmup?: boolean }[],
): SessionPerformance {
  return {
    date,
    sets: sets.map((s, i) => ({
      setIndex: i + 1,
      reps: s.reps,
      rir: s.rir ?? null,
      pin: s.pin === undefined ? 10 : s.pin,
      externalKg: null,
      side: s.side ?? null,
      isWarmup: s.isWarmup ?? false,
    })),
  }
}

describe('PCT_PER_REP', () => {
  it('is a single named constant, per CLAUDE.md §4.4', () => {
    expect(PCT_PER_REP).toBe(2.5)
  })
})

describe('no history', () => {
  it('makes no proposal at all', () => {
    expect(suggestNext(input()).kind).toBe('no_history')
  })
})

describe('double progression — CLAUDE.md §4.3', () => {
  it('all prescribed work sets at rep_max with rir >= 1 → propose the next pin', () => {
    const s = suggestNext(
      input({
        history: [session('2026-08-01', [
          { reps: 12, rir: 2, pin: 6 },
          { reps: 12, rir: 1, pin: 6 },
          { reps: 12, rir: 1, pin: 6 },
        ])],
      }),
    )
    expect(s.kind).toBe('increase_load')
    expect(s.pin).toBe(7)
  })

  it('one set short of rep_max → same pin, target reps + 1', () => {
    const s = suggestNext(
      input({
        history: [session('2026-08-01', [
          { reps: 12, rir: 2, pin: 6 },
          { reps: 12, rir: 2, pin: 6 },
          { reps: 11, rir: 2, pin: 6 },
        ])],
      }),
    )
    expect(s.kind).toBe('increase_reps')
    expect(s.pin).toBe(6)
    expect(s.targetReps).toBe(13 - 1) // top set was 12 → aim 13, capped at rep_max 12
  })

  it('one set at rep_max but rir = 0 → same pin (fatigue, not readiness)', () => {
    const s = suggestNext(
      input({
        history: [session('2026-08-01', [
          { reps: 12, rir: 2, pin: 6 },
          { reps: 12, rir: 1, pin: 6 },
          { reps: 12, rir: 0, pin: 6 },
        ])],
      }),
    )
    expect(s.kind).toBe('increase_reps')
    expect(s.pin).toBe(6)
  })

  it('an unknown RIR is not treated as readiness', () => {
    const s = suggestNext(
      input({
        history: [session('2026-08-01', [
          { reps: 12, rir: null, pin: 6 },
          { reps: 12, rir: null, pin: 6 },
          { reps: 12, rir: null, pin: 6 },
        ])],
      }),
    )
    expect(s.kind).toBe('increase_reps')
  })

  it('warmup sets do not affect the decision', () => {
    const s = suggestNext(
      input({
        history: [session('2026-08-01', [
          { reps: 5, rir: 5, pin: 2, isWarmup: true },
          { reps: 12, rir: 2, pin: 6 },
          { reps: 12, rir: 2, pin: 6 },
          { reps: 12, rir: 2, pin: 6 },
        ])],
      }),
    )
    expect(s.kind).toBe('increase_load')
    expect(s.pin).toBe(7)
  })

  it('never proposes more load and more sets in the same session', () => {
    const s = suggestNext(
      input({
        history: [session('2026-08-01', [
          { reps: 12, rir: 2, pin: 6 },
          { reps: 12, rir: 2, pin: 6 },
          { reps: 12, rir: 2, pin: 6 },
        ])],
      }),
    )
    expect(s.kind).toBe('increase_load')
    expect(s.targetSets).toBe(3)
  })
})

describe('rep prediction — the worked examples in CLAUDE.md §4.4', () => {
  it('seated row, low pulley, pin 12, 12 reps → 7.4 % → ~9 reps, no advisory', () => {
    const s = suggestNext(
      input({
        repMin: 8,
        repMax: 12,
        stationFactor: 0.5,
        stationMaxEffectiveKg: 37.42,
        history: [session('2026-08-01', [
          { reps: 12, rir: 2, pin: 12 },
          { reps: 12, rir: 2, pin: 12 },
          { reps: 12, rir: 2, pin: 12 },
        ])],
      }),
    )
    expect(s.kind).toBe('increase_load')
    expect(s.currentEffectiveKg).toBeCloseTo(30.62, 2)
    expect((s.pctIncrease as number) * 100).toBeCloseTo(7.4, 1)
    expect(s.predictedReps).toBe(9)
    expect(s.rangeAdvisory).toBeNull()
  })

  it('lat pulldown, upper pulley, pin 6, 12 reps → 13.3 % → ~7 reps, proposal still goes ahead with an advisory', () => {
    const s = suggestNext(
      input({
        repMin: 8,
        repMax: 12,
        stationFactor: 1.0,
        history: [session('2026-08-01', [
          { reps: 12, rir: 2, pin: 6 },
          { reps: 12, rir: 2, pin: 6 },
          { reps: 12, rir: 2, pin: 6 },
        ])],
      }),
    )
    expect(s.kind).toBe('increase_load') // the engine forecasts, it never blocks
    expect(s.currentEffectiveKg).toBeCloseTo(34.02, 2)
    expect((s.pctIncrease as number) * 100).toBeCloseTo(13.3, 1)
    expect(s.predictedReps).toBe(7)
    // suggestedRange = [max(5, rep_max - ceil(repCost)), rep_max] → [6, 12]
    expect(s.rangeAdvisory).toEqual({ suggestedMin: 6, suggestedMax: 12 })
  })

  it('triceps pushdown, upper pulley, pin 2, 14 reps → 28.6 % → ~3 reps, handled without clamping to nonsense', () => {
    const s = suggestNext(
      input({
        repMin: 6,
        repMax: 16,
        stationFactor: 1.0,
        history: [session('2026-08-01', [
          { reps: 14, rir: 2, pin: 2 },
          { reps: 14, rir: 2, pin: 2 },
          { reps: 14, rir: 2, pin: 2 },
        ])],
        // top set is 14, below rep_max 16 — force the load branch for this check
        forceLoadIncrease: true,
      }),
    )
    expect(s.currentEffectiveKg).toBeCloseTo(15.88, 2)
    expect((s.pctIncrease as number) * 100).toBeCloseTo(28.6, 1)
    expect(s.predictedReps).toBe(3)
    expect(s.predictedReps).toBeGreaterThan(0)
    expect(s.rangeAdvisory).toEqual({ suggestedMin: 5, suggestedMax: 16 })
  })

  it('a wide range such as 6–16 round-trips through the template unchanged', () => {
    const s = suggestNext(
      input({
        repMin: 6,
        repMax: 16,
        history: [session('2026-08-01', [{ reps: 10, rir: 2, pin: 5 }])],
      }),
    )
    expect(s.repMin).toBe(6)
    expect(s.repMax).toBe(16)
  })
})

describe('station ceiling — CLAUDE.md §4.1', () => {
  it('flags an exercise whose next load reaches 90 % of the station maximum', () => {
    const s = suggestNext(
      input({
        stationFactor: 0.5,
        stationMaxEffectiveKg: 37.42,
        repMax: 12,
        history: [session('2026-08-01', [
          { reps: 12, rir: 2, pin: 14 },
          { reps: 12, rir: 2, pin: 14 },
          { reps: 12, rir: 2, pin: 14 },
        ])],
      }),
    )
    expect(s.kind).toBe('increase_load')
    expect(s.atCeiling).toBe(true)
  })

  it('does not flag one comfortably below the ceiling', () => {
    const s = suggestNext(
      input({
        stationFactor: 0.5,
        stationMaxEffectiveKg: 37.42,
        history: [session('2026-08-01', [
          { reps: 12, rir: 2, pin: 8 },
          { reps: 12, rir: 2, pin: 8 },
          { reps: 12, rir: 2, pin: 8 },
        ])],
      }),
    )
    expect(s.atCeiling).toBe(false)
  })

  it('never proposes a pin past the top of the stack', () => {
    const s = suggestNext(
      input({
        history: [session('2026-08-01', [
          { reps: 12, rir: 2, pin: 15 },
          { reps: 12, rir: 2, pin: 15 },
          { reps: 12, rir: 2, pin: 15 },
        ])],
      }),
    )
    expect(s.pin).toBe(15)
    expect(s.kind).toBe('at_stack_max')
  })
})

describe('stalling — CLAUDE.md §4.3', () => {
  it('marks stalled after the same pin in 3 consecutive sessions with no rep increase', () => {
    const sets = [
      { reps: 10, rir: 2, pin: 8 },
      { reps: 10, rir: 2, pin: 8 },
      { reps: 10, rir: 2, pin: 8 },
    ]
    const s = suggestNext(
      input({
        history: [session('2026-08-01', sets), session('2026-08-08', sets), session('2026-08-15', sets)],
      }),
    )
    expect(s.kind).toBe('stalled')
    // ~90 % of 45.36 kg is 40.8 kg → the highest pin at or under that is 7
    expect(s.pin).toBe(7)
  })

  it('does not mark stalled while reps are still climbing', () => {
    const s = suggestNext(
      input({
        history: [
          session('2026-08-01', [{ reps: 8, rir: 2, pin: 8 }]),
          session('2026-08-08', [{ reps: 9, rir: 2, pin: 8 }]),
          session('2026-08-15', [{ reps: 10, rir: 2, pin: 8 }]),
        ],
      }),
    )
    expect(s.kind).toBe('increase_reps')
  })

  it('does not mark stalled when only two sessions share the pin', () => {
    const sets = [{ reps: 10, rir: 2, pin: 8 }]
    const s = suggestNext(
      input({ history: [session('2026-08-01', [{ reps: 10, rir: 2, pin: 7 }]), session('2026-08-08', sets), session('2026-08-15', sets)] }),
    )
    expect(s.kind).toBe('increase_reps')
  })
})

describe('unilateral exercises — CLAUDE.md §4.5', () => {
  it('progression follows the weaker side', () => {
    const s = suggestNext(
      input({
        isUnilateral: true,
        repMax: 12,
        history: [session('2026-08-01', [
          { reps: 12, rir: 2, pin: 6, side: 'L' },
          { reps: 12, rir: 2, pin: 6, side: 'L' },
          { reps: 12, rir: 2, pin: 6, side: 'L' },
          { reps: 10, rir: 2, pin: 6, side: 'R' },
          { reps: 10, rir: 2, pin: 6, side: 'R' },
          { reps: 10, rir: 2, pin: 6, side: 'R' },
        ])],
      }),
    )
    // The strong side finished the range; the weak side did not, so no load rise.
    expect(s.kind).toBe('increase_reps')
    expect(s.weakerSide).toBe('R')
    expect(s.targetReps).toBe(11)
  })

  it('proposes load only once the weaker side has finished the range too', () => {
    const s = suggestNext(
      input({
        isUnilateral: true,
        repMax: 12,
        // target_sets counts per side for a unilateral exercise
        history: [session('2026-08-01', [
          { reps: 12, rir: 2, pin: 6, side: 'L' },
          { reps: 12, rir: 2, pin: 6, side: 'L' },
          { reps: 12, rir: 2, pin: 6, side: 'L' },
          { reps: 12, rir: 1, pin: 6, side: 'R' },
          { reps: 12, rir: 1, pin: 6, side: 'R' },
          { reps: 12, rir: 1, pin: 6, side: 'R' },
        ])],
      }),
    )
    expect(s.kind).toBe('increase_load')
    expect(s.pin).toBe(7)
  })
})

describe('non-stack exercises', () => {
  it('makes a rep proposal for bodyweight work without inventing a pin', () => {
    const s = suggestNext(
      input({
        loadSource: 'bodyweight',
        stationFactor: null,
        stationMaxEffectiveKg: null,
        repMin: 12,
        repMax: 15,
        history: [session('2026-08-01', [{ reps: 13, rir: 2, pin: null }])],
      }),
    )
    expect(s.kind).toBe('increase_reps')
    expect(s.pin).toBeNull()
    expect(s.targetReps).toBe(14)
  })
})
