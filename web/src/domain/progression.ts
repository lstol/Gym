// The progression engine — CLAUDE.md §4.3–4.5.
//
// This is the part where a bug is silent: it produces plausible numbers that
// are quietly wrong, and you find out after training on them for six weeks.
// Everything here is pure, takes plain data, and is covered test-first.
//
// The engine FORECASTS; it never blocks. With no micro-plates available,
// refusing a pin increase would mean never progressing on the high pulley.

import { stackKg, effectiveKg, isNearStationCeiling, PLATE_KG } from './load'

/**
 * Cost of one pin, in reps, per percent of load added. A crude approximation
 * from rep-max tables — it varies by exercise and person and is least reliable
 * above 12 reps, exactly where it gets used hardest. It lives here as a single
 * named constant precisely so it can be recalibrated from suggestion_feedback
 * after a couple of blocks.
 */
export const PCT_PER_REP = 2.5

const MAX_PIN = 15
const CEILING_FRACTION = 0.9
const DELOAD_FRACTION = 0.9
const STALL_SESSIONS = 3

export type Side = 'L' | 'R'

export type LoggedSet = {
  setIndex: number
  reps: number
  rir: number | null
  pin: number | null
  externalKg: number | null
  side: Side | null
  isWarmup: boolean
}

export type SessionPerformance = {
  date: string
  sets: LoggedSet[]
}

export type ProgressionInput = {
  /** Sessions of the SAME session template, ascending by date. */
  history: SessionPerformance[]
  repMin: number
  repMax: number
  targetSets: number
  loadSource: 'stack' | 'bodyweight' | 'external'
  stationFactor: number | null
  stationMaxEffectiveKg: number | null
  isUnilateral: boolean
  /** Test hook: exercise the load branch regardless of the rep condition. */
  forceLoadIncrease?: boolean
}

export type RangeAdvisory = {
  suggestedMin: number
  suggestedMax: number
}

export type SuggestionKind =
  | 'no_history'
  | 'increase_reps'
  | 'increase_load'
  | 'stalled'
  | 'at_stack_max'

export type Suggestion = {
  kind: SuggestionKind
  /** Pin to set next time; null for exercises not loaded from the stack. */
  pin: number | null
  targetReps: number | null
  targetSets: number
  repMin: number
  repMax: number
  currentEffectiveKg: number | null
  nextEffectiveKg: number | null
  /** Fractional load increase, e.g. 0.133 for 13.3 %. */
  pctIncrease: number | null
  repCost: number | null
  predictedReps: number | null
  rangeAdvisory: RangeAdvisory | null
  atCeiling: boolean
  weakerSide: Side | null
  lastDate: string | null
}

function base(inp: ProgressionInput, kind: SuggestionKind): Suggestion {
  return {
    kind,
    pin: null,
    targetReps: null,
    targetSets: inp.targetSets,
    repMin: inp.repMin,
    repMax: inp.repMax,
    currentEffectiveKg: null,
    nextEffectiveKg: null,
    pctIncrease: null,
    repCost: null,
    predictedReps: null,
    rangeAdvisory: null,
    atCeiling: false,
    weakerSide: null,
    lastDate: null,
  }
}

function workSets(session: SessionPerformance): LoggedSet[] {
  return session.sets.filter((s) => !s.isWarmup)
}

/** The weaker side is the one whose best set is lowest — CLAUDE.md §4.5. */
function weakerSideOf(sets: LoggedSet[]): Side | null {
  const left = sets.filter((s) => s.side === 'L')
  const right = sets.filter((s) => s.side === 'R')
  if (left.length === 0 || right.length === 0) return null
  const best = (xs: LoggedSet[]) => Math.max(...xs.map((x) => x.reps))
  return best(right) <= best(left) ? 'R' : 'L'
}

function topReps(sets: LoggedSet[]): number {
  return Math.max(...sets.map((s) => s.reps))
}

/** Highest pin whose effective load is at or below `targetKg`. */
function pinAtOrBelow(targetKg: number, factor: number): number {
  for (let pin = MAX_PIN; pin >= 1; pin--) {
    if (effectiveKg(pin, factor) <= targetKg) return pin
  }
  return 1
}

/**
 * How many consecutive most-recent sessions share the current pin without the
 * top set ever improving.
 */
function stalledSessionCount(history: SessionPerformance[], pin: number | null): number {
  if (pin === null) return 0
  let count = 0
  let previousTop: number | null = null

  for (let i = history.length - 1; i >= 0; i--) {
    const sets = workSets(history[i])
    if (sets.length === 0) break
    const sessionPin = sets[0].pin
    if (sessionPin !== pin) break

    const top = topReps(sets)
    // Walking backwards: an earlier session with fewer reps means reps rose.
    if (previousTop !== null && top < previousTop) break
    previousTop = top
    count++
  }
  return count
}

export function suggestNext(inp: ProgressionInput): Suggestion {
  const last = inp.history.at(-1)
  if (!last) return base(inp, 'no_history')

  let sets = workSets(last)
  if (sets.length === 0) return base(inp, 'no_history')

  const weakerSide = inp.isUnilateral ? weakerSideOf(sets) : null
  if (weakerSide) sets = sets.filter((s) => s.side === weakerSide)

  const currentPin = sets[0].pin
  const isStack = inp.loadSource === 'stack' && currentPin !== null && inp.stationFactor !== null
  const factor = inp.stationFactor ?? 1
  const currentKg = isStack ? effectiveKg(currentPin as number, factor) : null

  const top = topReps(sets)
  const enoughSets = sets.length >= inp.targetSets
  const allAtMax = sets.every((s) => s.reps >= inp.repMax)
  const allRested = sets.every((s) => s.rir !== null && s.rir >= 1)
  const readyForLoad = inp.forceLoadIncrease === true || (enoughSets && allAtMax && allRested)

  // Stalling is checked before anything else — repeating the same prescription
  // a fourth time is not progression.
  if (!readyForLoad && isStack) {
    const stalledFor = stalledSessionCount(inp.history, currentPin)
    if (stalledFor >= STALL_SESSIONS) {
      const target = (currentKg as number) * DELOAD_FRACTION
      const deloadPin = pinAtOrBelow(target, factor)
      const s = base(inp, 'stalled')
      s.pin = deloadPin
      s.currentEffectiveKg = currentKg
      s.nextEffectiveKg = effectiveKg(deloadPin, factor)
      s.targetReps = inp.repMin
      s.weakerSide = weakerSide
      s.lastDate = last.date
      return s
    }
  }

  if (readyForLoad && isStack) {
    const pin = currentPin as number
    if (pin >= MAX_PIN) {
      const s = base(inp, 'at_stack_max')
      s.pin = MAX_PIN
      s.currentEffectiveKg = currentKg
      s.targetReps = inp.repMax
      s.atCeiling = true
      s.weakerSide = weakerSide
      s.lastDate = last.date
      return s
    }

    const nextKg = effectiveKg(pin + 1, factor)
    const stepKg = PLATE_KG * factor
    const pctIncrease = stepKg / (currentKg as number)
    const repCost = (pctIncrease * 100) / PCT_PER_REP
    const predictedReps = Math.round(top - repCost)

    // The proposal always goes ahead. If the forecast lands under the floor,
    // the range itself is too narrow for this position on the stack — say so
    // rather than silently rewriting the template.
    const rangeAdvisory: RangeAdvisory | null =
      predictedReps < inp.repMin
        ? {
            suggestedMin: Math.max(5, inp.repMax - Math.ceil(repCost)),
            suggestedMax: inp.repMax,
          }
        : null

    const s = base(inp, 'increase_load')
    s.pin = pin + 1
    s.currentEffectiveKg = currentKg
    s.nextEffectiveKg = nextKg
    s.pctIncrease = pctIncrease
    s.repCost = repCost
    s.predictedReps = predictedReps
    s.rangeAdvisory = rangeAdvisory
    s.atCeiling =
      inp.stationMaxEffectiveKg !== null && isNearStationCeiling(nextKg, inp.stationMaxEffectiveKg)
    s.weakerSide = weakerSide
    s.lastDate = last.date
    // Load and sets never move in the same session — targetSets is unchanged.
    return s
  }

  const s = base(inp, 'increase_reps')
  s.pin = currentPin
  s.currentEffectiveKg = currentKg
  s.targetReps = Math.min(top + 1, inp.repMax)
  s.atCeiling =
    currentKg !== null &&
    inp.stationMaxEffectiveKg !== null &&
    isNearStationCeiling(currentKg, inp.stationMaxEffectiveKg)
  s.weakerSide = weakerSide
  s.lastDate = last.date
  return s
}

/** Exposed for the UI's "what would the next pin weigh" readout. */
export { stackKg, effectiveKg, CEILING_FRACTION }
