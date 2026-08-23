import { describe, it, expect } from 'vitest'
import {
  EPLEY_K_DEFAULT,
  e1rm,
  predictedRepsAt,
  fitEpleyK,
  epleyKFrom,
  observationsFrom,
  suggestNext,
} from './progression'
import type { ProgressionInput, SessionPerformance, LoggedSet } from './progression'

const LOW = { factor: 0.5, maxEffectiveKg: 37.42 }
const UPPER = { factor: 1.0, maxEffectiveKg: 74.84 }
const PRESS = { factor: 0.6, maxEffectiveKg: 44.9 }

function input(over: Partial<ProgressionInput> = {}): ProgressionInput {
  return {
    history: [],
    repMin: 8,
    repMax: 12,
    rirMin: 1,
    targetSets: 3,
    loadSource: 'stack',
    stationFactor: UPPER.factor,
    stationMaxEffectiveKg: UPPER.maxEffectiveKg,
    plateKg: 4.536,
    isUnilateral: false,
    amrapAllowed: true,
    epleyK: EPLEY_K_DEFAULT,
    ...over,
  }
}

type SetSpec = {
  reps: number
  rir?: number | null
  pin?: number | null
  side?: 'L' | 'R' | null
  isWarmup?: boolean
  isAmrap?: boolean
}

function session(date: string, pin: number | null, sets: SetSpec[]): SessionPerformance {
  return {
    date,
    sets: sets.map((s, i): LoggedSet => ({
      setIndex: i + 1,
      reps: s.reps,
      rir: s.isAmrap ? 0 : s.rir === undefined ? 2 : s.rir,
      pin: s.pin === undefined ? pin : s.pin,
      externalKg: null,
      side: s.side ?? null,
      isWarmup: s.isWarmup ?? false,
      isAmrap: s.isAmrap ?? false,
    })),
  }
}

/**
 * Three sessions marks the exercise calibrated without needing a low RIR.
 * The two earlier ones sit a pin lower on purpose: three *identical* sessions
 * on one pin is the definition of stalled (rule 7), which would otherwise
 * swallow every test that isn't about stalling.
 */
function calibratedHistory(pin: number | null, sets: SetSpec[]): SessionPerformance[] {
  const priorPin = pin === null ? null : Math.max(1, pin - 1)
  return [
    session('2026-07-01', priorPin, sets),
    session('2026-07-08', priorPin, sets),
    session('2026-07-15', pin, sets),
  ]
}

describe('Epley model — §4', () => {
  it('EPLEY_K_DEFAULT is 30', () => {
    expect(EPLEY_K_DEFAULT).toBe(30)
  })

  it('e1rm follows kg × (1 + reps/k)', () => {
    expect(e1rm(30.618, 12, 30)).toBeCloseTo(42.865, 3)
    expect(e1rm(34.02, 12, 30)).toBeCloseTo(47.628, 3)
    expect(e1rm(15.876, 14, 30)).toBeCloseTo(23.285, 3)
  })

  describe('predicted reps at a new load — the three worked examples', () => {
    it('seated row, low pulley, pin 12 → 13 at 12 reps → 9', () => {
      expect(predictedRepsAt(30.618, 12, 32.886, 30)).toBe(9)
    })
    it('lat pulldown, upper pulley, pin 6 → 7 at 12 reps → 7', () => {
      expect(predictedRepsAt(34.02, 12, 38.556, 30)).toBe(7)
    })
    it('triceps pushdown, upper pulley, pin 2 → 3 at 14 reps → 4', () => {
      expect(predictedRepsAt(15.876, 14, 20.412, 30)).toBe(4)
    })
  })

  it('one rep costs less of the load at high reps than low — the reason the constant went', () => {
    const costAt = (reps: number) => 1 / (30 + reps)
    expect(costAt(8)).toBeGreaterThan(costAt(20))
    expect(costAt(8) * 100).toBeCloseTo(2.6, 1)
    expect(costAt(20) * 100).toBeCloseTo(2.0, 1)
  })
})

describe('fitting k from a pin change — §4a', () => {
  it('solves for the k at which both sessions imply the same e1RM', () => {
    const k = fitEpleyK({ fromKg: 30, fromReps: 12, toKg: 33, toReps: 9 }) as number
    expect(k).toBeCloseTo(21, 3)
    expect(e1rm(30, 12, k)).toBeCloseTo(e1rm(33, 9, k), 6)
  })

  it('discards an unchanged load rather than dividing by zero', () => {
    expect(fitEpleyK({ fromKg: 30, fromReps: 12, toKg: 30, toReps: 9 })).toBeNull()
  })

  it('discards an unchanged rep count', () => {
    expect(fitEpleyK({ fromKg: 30, fromReps: 12, toKg: 33, toReps: 12 })).toBeNull()
  })

  it('discards a fit outside [15, 60] as noise', () => {
    // A 3 kg rise costing 7 reps implies k = 65 — outside the plausible band.
    expect(fitEpleyK({ fromKg: 30, fromReps: 12, toKg: 33, toReps: 5 })).toBeNull()
  })
})

describe('epleyKFrom — §4a', () => {
  it('returns the default with fewer than three observations', () => {
    expect(epleyKFrom([])).toBe(30)
    expect(epleyKFrom([28, 31.5])).toBe(30)
  })

  it('returns the median once there are three', () => {
    expect(epleyKFrom([28, 31.5, 34])).toBe(31.5)
  })

  it('an out-of-range observation was filtered at write, so two remain and it stays default', () => {
    expect(epleyKFrom([28, 31.5])).toBe(30)
  })

  it('clamps a median outside [15, 60]', () => {
    expect(epleyKFrom([61, 62, 63])).toBe(60)
    expect(epleyKFrom([10, 11, 12])).toBe(15)
  })
})

describe('rule 0 — no history', () => {
  it('makes no proposal', () => {
    expect(suggestNext(input()).reason).toBe('no_history')
  })
})

describe('the real session of 23 August — §7', () => {
  const C = { rirMin: 3, targetSets: 3 }

  it('shoulder press 12/9/7 at RIR 0 holds the pin and targets 12, never 13', () => {
    const s = suggestNext(
      input({
        ...C,
        repMin: 10,
        repMax: 15,
        amrapAllowed: false,
        stationFactor: PRESS.factor,
        stationMaxEffectiveKg: PRESS.maxEffectiveKg,
        history: [session('2026-08-23', 4, [{ reps: 12, rir: 0 }, { reps: 9, rir: 0 }, { reps: 7, rir: 0 }])],
      }),
    )
    expect(s.reason).toBe('failure_below_target')
    expect(s.pin).toBe(4)
    expect(s.targetReps).toBe(12)
    expect(s.targetReps).not.toBe(13)
  })

  it('chest press 12/12/12 at RIR 4/3/2 is calibrated by its RIR and adds a rep', () => {
    const s = suggestNext(
      input({
        ...C,
        repMin: 10,
        repMax: 15,
        amrapAllowed: false,
        stationFactor: PRESS.factor,
        stationMaxEffectiveKg: PRESS.maxEffectiveKg,
        history: [session('2026-08-23', 4, [{ reps: 12, rir: 4 }, { reps: 12, rir: 3 }, { reps: 12, rir: 2 }])],
      }),
    )
    expect(s.reason).toBe('progress_reps')
    expect(s.targetReps).toBe(13)
  })

  it('seated row 12/12/12 at RIR 10/10/8 asks for an AMRAP — rule 5 must not pre-empt it', () => {
    const s = suggestNext(
      input({
        ...C,
        repMin: 8,
        repMax: 12,
        stationFactor: LOW.factor,
        stationMaxEffectiveKg: LOW.maxEffectiveKg,
        history: [session('2026-08-23', 7, [{ reps: 12, rir: 10 }, { reps: 12, rir: 10 }, { reps: 12, rir: 8 }])],
      }),
    )
    // Every set hit rep_max with RIR >= 1, so rule 5 would fire — calibration comes first.
    expect(s.reason).toBe('calibrating')
    expect(s.pin).toBe(7)
    expect(s.requestAmrap).toBe(true)
  })

  it('lat pulldown 12/12/12 at RIR 6 asks for an AMRAP', () => {
    const s = suggestNext(
      input({
        ...C,
        repMin: 8,
        repMax: 13,
        history: [session('2026-08-23', 7, [{ reps: 12, rir: 6 }, { reps: 12, rir: 6 }, { reps: 12, rir: 6 }])],
      }),
    )
    expect(s.reason).toBe('calibrating')
    expect(s.requestAmrap).toBe(true)
  })

  it('biceps curl 10/10/10 with a RIR 1 set is calibrated and adds a rep', () => {
    const s = suggestNext(
      input({
        ...C,
        repMin: 10,
        repMax: 16,
        stationFactor: LOW.factor,
        stationMaxEffectiveKg: LOW.maxEffectiveKg,
        history: [session('2026-08-23', 6, [{ reps: 10, rir: 5 }, { reps: 10, rir: 3 }, { reps: 10, rir: 1 }])],
      }),
    )
    expect(s.reason).toBe('progress_reps')
    expect(s.targetReps).toBe(11)
  })

  it('triceps pushdown 10/10/10 at RIR 3/2/2 is calibrated and adds a rep', () => {
    const s = suggestNext(
      input({
        ...C,
        repMin: 10,
        repMax: 20,
        history: [session('2026-08-23', 4, [{ reps: 10, rir: 3 }, { reps: 10, rir: 2 }, { reps: 10, rir: 2 }])],
      }),
    )
    expect(s.reason).toBe('progress_reps')
    expect(s.targetReps).toBe(11)
  })

  it('cable crunch 10/10/10 at RIR 5 asks for an AMRAP', () => {
    const s = suggestNext(
      input({
        ...C,
        repMin: 10,
        repMax: 20,
        history: [session('2026-08-23', 9, [{ reps: 10, rir: 5 }, { reps: 10, rir: 5 }, { reps: 10, rir: 5 }])],
      }),
    )
    expect(s.reason).toBe('calibrating')
    expect(s.requestAmrap).toBe(true)
  })
})

describe('calibration — §3', () => {
  it('three sessions calibrate an exercise even with high RIR throughout', () => {
    const s = suggestNext(
      input({
        rirMin: 3,
        repMin: 8,
        repMax: 12,
        stationFactor: LOW.factor,
        stationMaxEffectiveKg: LOW.maxEffectiveKg,
        history: calibratedHistory(7, [{ reps: 10, rir: 8 }, { reps: 10, rir: 8 }, { reps: 10, rir: 8 }]),
      }),
    )
    expect(s.reason).not.toBe('calibrating')
  })

  it('an AMRAP of 22 on the seated row at pin 7 proposes pin 8', () => {
    const s = suggestNext(
      input({
        rirMin: 3,
        repMin: 8,
        repMax: 12,
        stationFactor: LOW.factor,
        stationMaxEffectiveKg: LOW.maxEffectiveKg,
        history: [
          session('2026-08-30', 7, [
            { reps: 12, rir: 10 },
            { reps: 12, rir: 10 },
            { reps: 22, isAmrap: true },
          ]),
        ],
      }),
    )
    expect(s.reason).toBe('calibration_jump')
    expect(s.pin).toBe(8)
    expect(s.nextEffectiveKg).toBeCloseTo(21.546, 3)
  })

  it('clamps an absurd AMRAP to 25 reps before the Epley step', () => {
    const s = suggestNext(
      input({
        rirMin: 3,
        repMin: 8,
        repMax: 12,
        stationFactor: LOW.factor,
        stationMaxEffectiveKg: LOW.maxEffectiveKg,
        history: [
          session('2026-08-30', 7, [
            { reps: 12, rir: 10 },
            { reps: 12, rir: 10 },
            { reps: 40, isAmrap: true },
          ]),
        ],
      }),
    )
    expect(Number.isFinite(s.nextEffectiveKg as number)).toBe(true)
    expect(s.pin).not.toBeNull()
  })

  it('caps the jump at 3 pins and says the jump was split', () => {
    // Low pulley pin 8 (21.55 kg), a 25-rep AMRAP against a 8+1 = 9 capacity
    // target implies ~3.9 pins. It is capped to 3.
    const s = suggestNext(
      input({
        rirMin: 1,
        repMin: 6,
        repMax: 8,
        stationFactor: LOW.factor,
        stationMaxEffectiveKg: LOW.maxEffectiveKg,
        history: [
          session('2026-08-30', 8, [
            { reps: 8, rir: 6 },
            { reps: 8, rir: 6 },
            { reps: 25, isAmrap: true },
          ]),
        ],
      }),
    )
    expect(s.pin).toBe(11)
    expect(s.jumpSplit).toBe(true)
  })

  it('an AMRAP jump that would cross 90 % of the station maximum yields station_ceiling', () => {
    const s = suggestNext(
      input({
        rirMin: 3,
        repMin: 8,
        repMax: 12,
        stationFactor: LOW.factor,
        stationMaxEffectiveKg: LOW.maxEffectiveKg,
        history: [
          session('2026-08-30', 14, [
            { reps: 12, rir: 10 },
            { reps: 12, rir: 10 },
            { reps: 25, isAmrap: true },
          ]),
        ],
      }),
    )
    expect(s.reason).toBe('station_ceiling')
  })

  it('falls back to a RIR estimate when AMRAP is not allowed', () => {
    const s = suggestNext(
      input({
        rirMin: 2,
        repMin: 10,
        repMax: 15,
        amrapAllowed: false,
        stationFactor: PRESS.factor,
        stationMaxEffectiveKg: PRESS.maxEffectiveKg,
        history: [session('2026-08-23', 4, [{ reps: 12, rir: 8 }, { reps: 12, rir: 8 }, { reps: 12, rir: 8 }])],
      }),
    )
    expect(s.reason).toBe('calibration_jump')
    expect(s.fromRirEstimate).toBe(true)
    expect(s.pin as number).toBeGreaterThan(4)
    expect((s.pin as number) - 4).toBeLessThanOrEqual(2)
  })

  it('never proposes a downward jump when RIR is already at or below target', () => {
    const s = suggestNext(
      input({
        rirMin: 3,
        repMin: 10,
        repMax: 15,
        amrapAllowed: false,
        stationFactor: PRESS.factor,
        stationMaxEffectiveKg: PRESS.maxEffectiveKg,
        history: [session('2026-08-23', 4, [{ reps: 12, rir: 5 }, { reps: 12, rir: 5 }, { reps: 12, rir: 4 }])],
      }),
    )
    expect(s.pin as number).toBeGreaterThanOrEqual(4)
  })
})

describe('the decision tree — §2', () => {
  const base = {
    rirMin: 1,
    repMin: 8,
    repMax: 12,
    stationFactor: LOW.factor,
    stationMaxEffectiveKg: LOW.maxEffectiveKg,
  }

  it('rule 3 — failure below the rep target holds the pin and evens the sets', () => {
    const s = suggestNext(
      input({
        ...base,
        history: calibratedHistory(7, [{ reps: 11, rir: 0 }, { reps: 9, rir: 0 }, { reps: 8, rir: 0 }]),
      }),
    )
    expect(s.reason).toBe('failure_below_target')
    expect(s.targetReps).toBe(11)
  })

  it('rule 4 — a spread of 3 is ragged', () => {
    const s = suggestNext(
      input({ ...base, history: calibratedHistory(7, [{ reps: 12, rir: 2 }, { reps: 10, rir: 2 }, { reps: 9, rir: 2 }]) }),
    )
    expect(s.reason).toBe('ragged_sets')
    expect(s.targetReps).toBe(12)
  })

  it('a spread of 2 is normal fatigue, not ragged', () => {
    const s = suggestNext(
      input({ ...base, history: calibratedHistory(7, [{ reps: 12, rir: 2 }, { reps: 11, rir: 2 }, { reps: 10, rir: 2 }]) }),
    )
    expect(s.reason).toBe('progress_reps')
    expect(s.targetReps).toBe(11)
  })

  it('rule 5 — every set at rep_max with RIR >= 1 proposes the next pin', () => {
    const s = suggestNext(
      input({ ...base, history: calibratedHistory(7, [{ reps: 12, rir: 2 }, { reps: 12, rir: 1 }, { reps: 12, rir: 1 }]) }),
    )
    expect(s.reason).toBe('progress_load')
    expect(s.pin).toBe(8)
    expect(s.predictedReps).toBeGreaterThan(0)
  })

  it('rule 6 — at rep_max but a set went to failure, so consolidate', () => {
    const s = suggestNext(
      input({ ...base, history: calibratedHistory(7, [{ reps: 12, rir: 2 }, { reps: 12, rir: 1 }, { reps: 12, rir: 0 }]) }),
    )
    expect(s.reason).toBe('consolidate')
    expect(s.pin).toBe(7)
  })

  it('rule 5 cannot fire when fewer sets were logged than prescribed', () => {
    const s = suggestNext(
      input({ ...base, history: calibratedHistory(7, [{ reps: 12, rir: 2 }, { reps: 12, rir: 2 }]) }),
    )
    expect(s.reason).not.toBe('progress_load')
  })

  it('rule 7 — three sessions on the same pin with no rise in the lowest set is stalled', () => {
    const flat: SetSpec[] = [{ reps: 10, rir: 2 }, { reps: 10, rir: 2 }, { reps: 10, rir: 2 }]
    const s = suggestNext(
      input({
        ...base,
        history: [
          session('2026-07-01', 8, flat),
          session('2026-07-08', 8, flat),
          session('2026-07-15', 8, flat),
        ],
      }),
    )
    expect(s.reason).toBe('stalled')
    expect(s.pin as number).toBeLessThan(8)
    expect(s.stalledSessions).toBe(3)
  })

  it('is not stalled while the lowest set is still climbing', () => {
    const s = suggestNext(
      input({
        ...base,
        history: [
          session('2026-07-01', 8, [{ reps: 8, rir: 2 }, { reps: 8, rir: 2 }, { reps: 8, rir: 2 }]),
          session('2026-07-08', 8, [{ reps: 9, rir: 2 }, { reps: 9, rir: 2 }, { reps: 9, rir: 2 }]),
          session('2026-07-15', 8, [{ reps: 10, rir: 2 }, { reps: 10, rir: 2 }, { reps: 10, rir: 2 }]),
        ],
      }),
    )
    expect(s.reason).toBe('progress_reps')
  })

  it('rule 8 — the target follows the LOWEST set, which is the core fix', () => {
    const s = suggestNext(
      input({ ...base, history: calibratedHistory(7, [{ reps: 12, rir: 2 }, { reps: 11, rir: 2 }, { reps: 10, rir: 2 }]) }),
    )
    expect(s.targetReps).toBe(11) // not 13
  })

  it('rule 2 — a next pin above 90 % of the station maximum flags the ceiling', () => {
    const s = suggestNext(
      input({
        ...base,
        history: calibratedHistory(14, [{ reps: 12, rir: 2 }, { reps: 12, rir: 2 }, { reps: 12, rir: 2 }]),
      }),
    )
    expect(s.reason).toBe('station_ceiling')
    expect(s.pin).toBe(14)
  })
})

describe('AMRAP sets are a measuring instrument, not a working set — §3a', () => {
  const withAmrap = {
    rirMin: 1,
    repMin: 8,
    repMax: 12,
    stationFactor: LOW.factor,
    stationMaxEffectiveKg: LOW.maxEffectiveKg,
  }

  it('a 22-rep AMRAP after 12/12 does not trip ragged_sets', () => {
    const s = suggestNext(
      input({
        ...withAmrap,
        history: calibratedHistory(7, [
          { reps: 12, rir: 2 },
          { reps: 12, rir: 2 },
          { reps: 22, isAmrap: true },
        ]),
      }),
    )
    expect(s.reason).not.toBe('ragged_sets')
  })

  it("an AMRAP's forced RIR 0 does not trip failure_below_target", () => {
    const s = suggestNext(
      input({
        ...withAmrap,
        history: calibratedHistory(7, [
          { reps: 11, rir: 2 },
          { reps: 11, rir: 2 },
          { reps: 20, isAmrap: true },
        ]),
      }),
    )
    expect(s.reason).not.toBe('failure_below_target')
    expect(s.reason).toBe('progress_reps')
  })

  it('warmups are excluded as before', () => {
    const s = suggestNext(
      input({
        ...withAmrap,
        history: calibratedHistory(7, [
          { reps: 5, rir: 5, isWarmup: true },
          { reps: 12, rir: 2 },
          { reps: 12, rir: 2 },
          { reps: 12, rir: 2 },
        ]),
      }),
    )
    expect(s.reason).toBe('progress_load')
  })
})

describe('RIR hygiene', () => {
  it('a null RIR counts as 0, never as readiness', () => {
    const s = suggestNext(
      input({
        rirMin: 1,
        repMin: 8,
        repMax: 12,
        stationFactor: LOW.factor,
        stationMaxEffectiveKg: LOW.maxEffectiveKg,
        history: calibratedHistory(7, [
          { reps: 12, rir: null },
          { reps: 12, rir: null },
          { reps: 12, rir: null },
        ]),
      }),
    )
    expect(s.reason).toBe('consolidate')
    expect(s.reason).not.toBe('progress_load')
  })
})

describe('non-stack exercises', () => {
  it('gives a rep target for bodyweight work without inventing a pin', () => {
    const s = suggestNext(
      input({
        loadSource: 'bodyweight',
        stationFactor: null,
        stationMaxEffectiveKg: null,
        rirMin: 1,
        repMin: 12,
        repMax: 20,
        history: calibratedHistory(null, [
          { reps: 13, rir: 2 },
          { reps: 13, rir: 2 },
          { reps: 13, rir: 2 },
        ]),
      }),
    )
    expect(s.reason).toBe('progress_reps')
    expect(s.pin).toBeNull()
    expect(s.targetReps).toBe(14)
  })
})

describe('unilateral exercises — CLAUDE.md §4.5', () => {
  it('progression follows the weaker side', () => {
    const s = suggestNext(
      input({
        isUnilateral: true,
        rirMin: 1,
        repMin: 8,
        repMax: 12,
        stationFactor: LOW.factor,
        stationMaxEffectiveKg: LOW.maxEffectiveKg,
        history: calibratedHistory(6, [
          { reps: 12, rir: 2, side: 'L' },
          { reps: 12, rir: 2, side: 'L' },
          { reps: 12, rir: 2, side: 'L' },
          { reps: 10, rir: 2, side: 'R' },
          { reps: 10, rir: 2, side: 'R' },
          { reps: 10, rir: 2, side: 'R' },
        ]),
      }),
    )
    expect(s.weakerSide).toBe('R')
    expect(s.reason).toBe('progress_reps')
    expect(s.targetReps).toBe(11)
  })
})

describe('observationsFrom — §4a', () => {
  it('records one observation per pin change at comparable effort', () => {
    const obs = observationsFrom(
      [
        session('2026-07-01', 12, [{ reps: 12, rir: 2 }]),
        session('2026-07-08', 13, [{ reps: 9, rir: 2 }]),
      ],
      0.5,
    )
    expect(obs).toHaveLength(1)
    expect(obs[0].observedAt).toBe('2026-07-08')
    expect(obs[0].fromKg).toBeCloseTo(30.618, 3)
    expect(obs[0].toKg).toBeCloseTo(32.886, 3)
    expect(obs[0].epleyK).toBeGreaterThanOrEqual(15)
    expect(obs[0].epleyK).toBeLessThanOrEqual(60)
  })

  it('ignores a pair where the pin did not move', () => {
    expect(
      observationsFrom(
        [
          session('2026-07-01', 12, [{ reps: 12, rir: 2 }]),
          session('2026-07-08', 12, [{ reps: 11, rir: 2 }]),
        ],
        0.5,
      ),
    ).toHaveLength(0)
  })

  it('ignores a pair logged at incomparable effort', () => {
    expect(
      observationsFrom(
        [
          session('2026-07-01', 12, [{ reps: 12, rir: 8 }]),
          session('2026-07-08', 13, [{ reps: 9, rir: 1 }]),
        ],
        0.5,
      ),
    ).toHaveLength(0)
  })

  it('ignores exercises with no station to compute kilograms from', () => {
    expect(
      observationsFrom(
        [session('2026-07-01', 12, [{ reps: 12 }]), session('2026-07-08', 13, [{ reps: 9 }])],
        null,
      ),
    ).toHaveLength(0)
  })
})
