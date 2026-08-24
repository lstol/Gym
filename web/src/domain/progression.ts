// The progression engine — docs/PROGRESSION_V2.md, superseding CLAUDE.md §4.3–4.4.
//
// This is the part where a bug is silent: it produces plausible numbers that are
// quietly wrong, and you find out after training on them for six weeks.
// Everything here is pure, takes plain data, and is covered test-first.
//
// Two ideas carry the whole file:
//   * progression targets the LOWEST working set, not the highest, so a session
//     that collapsed (12/9/7) is told to even out rather than to add a rep;
//   * one Epley model does both the rep forecast and the calibration jump.
//     There is no linear "% per rep" constant, because that cost is not
//     constant — it is 1/(k + reps), ~2.6 % at 8 reps and ~2.0 % at 20.

import { effectiveKg, isNearStationCeiling } from './load'

export const EPLEY_K_DEFAULT = 30

const MAX_PIN = 15
const DELOAD_FRACTION = 0.9
const STALL_SESSIONS = 3
const AMRAP_CLAMP = 25
const MAX_CALIBRATION_PINS = 3
const MAX_RIR_ESTIMATE_PINS = 2
const K_MIN = 15
const K_MAX = 60
const CALIBRATION_SESSIONS = 3
const CALIBRATION_RIR = 3

export type Side = 'L' | 'R'

export type LoggedSet = {
  setIndex: number
  reps: number
  rir: number | null
  pin: number | null
  externalKg: number | null
  side: Side | null
  isWarmup: boolean
  isAmrap: boolean
}

export type SessionPerformance = {
  date: string
  sets: LoggedSet[]
}

export type ProgressionInput = {
  /** Sessions containing this exercise, any session template, ascending by date. */
  history: SessionPerformance[]
  repMin: number
  repMax: number
  /** Bottom of the template item's RIR band. There is no midpoint any more. */
  rirMin: number
  targetSets: number
  loadSource: 'stack' | 'bodyweight' | 'external'
  stationFactor: number | null
  stationMaxEffectiveKg: number | null
  plateKg: number
  isUnilateral: boolean
  amrapAllowed: boolean
  epleyK: number
}

export type Reason =
  | 'no_history'
  | 'calibrating'
  | 'calibration_jump'
  | 'station_ceiling'
  | 'failure_below_target'
  | 'ragged_sets'
  | 'progress_load'
  | 'consolidate'
  | 'stalled'
  | 'progress_reps'

export type Suggestion = {
  reason: Reason
  pin: number | null
  targetReps: number | null
  targetSets: number
  repMin: number
  repMax: number
  currentEffectiveKg: number | null
  nextEffectiveKg: number | null
  predictedReps: number | null
  /** Reps of the last session's working sets, for the ragged-sets banner. */
  lastReps: number[]
  weakerSide: Side | null
  lastDate: string | null
  requestAmrap: boolean
  jumpSplit: boolean
  fromRirEstimate: boolean
  stalledSessions: number
  atCeiling: boolean
}

// ---------------------------------------------------------------- Epley model

export function e1rm(kg: number, reps: number, k: number): number {
  return kg * (1 + reps / k)
}

/** Reps expected at `newKg`, given `currentReps` achieved at `currentKg`. */
export function predictedRepsAt(
  currentKg: number,
  currentReps: number,
  newKg: number,
  k: number,
): number {
  return Math.round(k * (e1rm(currentKg, currentReps, k) / newKg - 1))
}

/**
 * The k at which two sessions imply the same e1RM. Solving
 *   fromKg(1 + fromReps/k) = toKg(1 + toReps/k)
 * gives k = (toKg·toReps − fromKg·fromReps) / (fromKg − toKg).
 * Returns null when the observation carries no signal.
 */
export function fitEpleyK(o: {
  fromKg: number
  fromReps: number
  toKg: number
  toReps: number
}): number | null {
  if (o.fromKg === o.toKg) return null
  if (o.fromReps === o.toReps) return null
  const k = (o.toKg * o.toReps - o.fromKg * o.fromReps) / (o.fromKg - o.toKg)
  if (!Number.isFinite(k) || k < K_MIN || k > K_MAX) return null
  return k
}

/** Median of an exercise's observations once there are three, else the default. */
export function epleyKFrom(observations: number[]): number {
  if (observations.length < 3) return EPLEY_K_DEFAULT
  const sorted = [...observations].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
  return Math.min(K_MAX, Math.max(K_MIN, median))
}

// ------------------------------------------------------------------- helpers

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

/** Working sets that count towards the rules: no warmups, no AMRAPs (§3a). */
function ruleSets(session: SessionPerformance): LoggedSet[] {
  return session.sets.filter((s) => !s.isWarmup && !s.isAmrap)
}

function amrapSet(session: SessionPerformance): LoggedSet | undefined {
  return session.sets.find((s) => s.isAmrap && !s.isWarmup)
}

function weakerSideOf(sets: LoggedSet[]): Side | null {
  const left = sets.filter((s) => s.side === 'L')
  const right = sets.filter((s) => s.side === 'R')
  if (left.length === 0 || right.length === 0) return null
  const best = (xs: LoggedSet[]) => Math.max(...xs.map((x) => x.reps))
  return best(right) <= best(left) ? 'R' : 'L'
}

/** An unknown RIR is never readiness. */
function rirOf(s: LoggedSet): number {
  return s.rir ?? 0
}

function pinAtOrBelow(targetKg: number, factor: number): number {
  for (let pin = MAX_PIN; pin >= 1; pin--) {
    if (effectiveKg(pin, factor) <= targetKg) return pin
  }
  return 1
}

/** Highest pin that stays under the station's 90 % ceiling. */
function pinUnderCeiling(factor: number, maxEffectiveKg: number | null): number {
  if (maxEffectiveKg === null) return MAX_PIN
  for (let pin = MAX_PIN; pin >= 1; pin--) {
    if (!isNearStationCeiling(effectiveKg(pin, factor), maxEffectiveKg)) return pin
  }
  return 1
}

function stalledSessionCount(history: SessionPerformance[], pin: number | null): number {
  if (pin === null) return 0
  let count = 0
  let laterMin: number | null = null

  for (let i = history.length - 1; i >= 0; i--) {
    const sets = ruleSets(history[i])
    if (sets.length === 0) break
    if (sets[0].pin !== pin) break
    const minReps = Math.min(...sets.map((s) => s.reps))
    // Walking backwards: an earlier session with fewer reps means reps rose.
    if (laterMin !== null && minReps < laterMin) break
    laterMin = minReps
    count++
  }
  return count
}

/** §3 — uncalibrated until three sessions, or any session with minRir <= 3. */
function isCalibrated(history: SessionPerformance[]): boolean {
  if (history.length >= CALIBRATION_SESSIONS) return true
  return history.some((session) => {
    const sets = ruleSets(session)
    if (sets.length === 0) return false
    return Math.min(...sets.map(rirOf)) <= CALIBRATION_RIR
  })
}

function blank(inp: ProgressionInput, reason: Reason): Suggestion {
  return {
    reason,
    pin: null,
    targetReps: null,
    targetSets: inp.targetSets,
    repMin: inp.repMin,
    repMax: inp.repMax,
    currentEffectiveKg: null,
    nextEffectiveKg: null,
    predictedReps: null,
    lastReps: [],
    weakerSide: null,
    lastDate: null,
    requestAmrap: false,
    jumpSplit: false,
    fromRirEstimate: false,
    stalledSessions: 0,
    atCeiling: false,
  }
}

// --------------------------------------------------------------- the engine

export function suggestNext(inp: ProgressionInput): Suggestion {
  const last = inp.history.at(-1)
  if (!last) return blank(inp, 'no_history')

  let sets = ruleSets(last)
  if (sets.length === 0) return blank(inp, 'no_history')

  const weakerSide = inp.isUnilateral ? weakerSideOf(sets) : null
  if (weakerSide) sets = sets.filter((s) => s.side === weakerSide)

  const currentPin = sets[0].pin
  const isStack = inp.loadSource === 'stack' && currentPin !== null && inp.stationFactor !== null
  const factor = inp.stationFactor ?? 1
  const currentKg = isStack ? effectiveKg(currentPin as number, factor) : null

  const reps = sets.map((s) => s.reps)
  const rirs = sets.map(rirOf)
  const topReps = Math.max(...reps)
  const minReps = Math.min(...reps)
  const spread = topReps - minReps
  const minRir = Math.min(...rirs)
  const prescribedSetsComplete = sets.length >= inp.targetSets

  const common = (s: Suggestion): Suggestion => {
    s.pin = currentPin
    s.currentEffectiveKg = currentKg
    s.lastReps = reps
    s.weakerSide = weakerSide
    s.lastDate = last.date
    return s
  }

  // Rule 1 — calibration comes before everything except "no history". A set of
  // 12 at RIR 10 satisfies rule 5 on paper; the load is simply wrong.
  if (isStack && !isCalibrated(inp.history)) {
    return calibrate(inp, {
      last,
      currentPin: currentPin as number,
      currentKg: currentKg as number,
      factor,
      minRir,
      minReps,
      reps,
      weakerSide,
    })
  }

  // Rule 2 — the next pin would cross the station ceiling.
  if (isStack && inp.stationMaxEffectiveKg !== null) {
    const nextKg = effectiveKg((currentPin as number) + 1, factor)
    if (isNearStationCeiling(nextKg, inp.stationMaxEffectiveKg)) {
      const s = common(blank(inp, 'station_ceiling'))
      s.atCeiling = true
      s.targetReps = Math.min(minReps + 1, inp.repMax)
      return s
    }
  }

  // Rule 3 — went to failure without reaching the rep target. Even the sets out
  // before adding anything; do NOT read the top set here.
  if (minRir === 0 && topReps < inp.repMax) {
    const s = common(blank(inp, 'failure_below_target'))
    s.targetReps = topReps
    return s
  }

  // Rule 4 — ragged sets: the load is not sustainable for the set count.
  if (spread >= 3) {
    const s = common(blank(inp, 'ragged_sets'))
    s.targetReps = topReps
    return s
  }

  // Rule 5 — the range is finished with reps in reserve: add load.
  if (prescribedSetsComplete && reps.every((r) => r >= inp.repMax) && rirs.every((r) => r >= 1)) {
    if (isStack) {
      const pin = currentPin as number
      const nextPin = Math.min(MAX_PIN, pin + 1)
      const nextKg = effectiveKg(nextPin, factor)
      const s = common(blank(inp, 'progress_load'))
      s.pin = nextPin
      s.nextEffectiveKg = nextKg
      s.predictedReps = predictedRepsAt(currentKg as number, topReps, nextKg, inp.epleyK)
      s.atCeiling =
        inp.stationMaxEffectiveKg !== null &&
        isNearStationCeiling(nextKg, inp.stationMaxEffectiveKg)
      return s
    }
    // No stack to step: keep pushing reps.
    const s = common(blank(inp, 'progress_reps'))
    s.targetReps = minReps + 1
    return s
  }

  // Rule 6 — reached the top of the range but a set went to failure.
  if (reps.every((r) => r >= inp.repMax) && minRir === 0) {
    const s = common(blank(inp, 'consolidate'))
    s.targetReps = topReps
    return s
  }

  // Rule 7 — same pin, three sessions, no rise in the LOWEST set.
  if (isStack) {
    const stalledFor = stalledSessionCount(inp.history, currentPin)
    if (stalledFor >= STALL_SESSIONS) {
      const deloadPin = Math.min(
        (currentPin as number) - 1,
        pinAtOrBelow((currentKg as number) * DELOAD_FRACTION, factor),
      )
      const s = common(blank(inp, 'stalled'))
      s.pin = Math.max(1, deloadPin)
      s.nextEffectiveKg = effectiveKg(Math.max(1, deloadPin), factor)
      s.targetReps = inp.repMin
      s.stalledSessions = stalledFor
      return s
    }
  }

  // Rule 8 — the ordinary case. Target the LOWEST set: this is the core fix.
  const s = common(blank(inp, 'progress_reps'))
  s.targetReps = Math.min(minReps + 1, inp.repMax)
  return s
}

// ---------------------------------------------------------------- §3 details

function calibrate(
  inp: ProgressionInput,
  ctx: {
    last: SessionPerformance
    currentPin: number
    currentKg: number
    factor: number
    minRir: number
    minReps: number
    reps: number[]
    weakerSide: Side | null
  },
): Suggestion {
  const finish = (s: Suggestion): Suggestion => {
    s.currentEffectiveKg = ctx.currentKg
    s.lastReps = ctx.reps
    s.weakerSide = ctx.weakerSide
    s.lastDate = ctx.last.date
    return s
  }

  const amrap = amrapSet(ctx.last)
  const useRirFallback = !inp.amrapAllowed

  // 3a — no measurement yet, and one is allowed: ask for it.
  if (!amrap && !useRirFallback) {
    const s = finish(blank(inp, 'calibrating'))
    s.pin = ctx.currentPin
    s.requestAmrap = true
    return s
  }

  let rawDelta: number
  let fromRirEstimate = false

  if (amrap) {
    // 3b — Epley from a counted all-out set.
    const amrapReps = Math.min(amrap.reps, AMRAP_CLAMP)
    const targetCapacity = inp.repMax + inp.rirMin
    const targetKg =
      (ctx.currentKg * (1 + amrapReps / inp.epleyK)) / (1 + targetCapacity / inp.epleyK)
    rawDelta = Math.round((targetKg - ctx.currentKg) / (inp.plateKg * ctx.factor))
  } else {
    // 3c — self-reported RIR, capped harder because the input is biased.
    fromRirEstimate = true
    const rirGap = ctx.minRir - inp.rirMin
    const pctPerRep = 100 / (inp.epleyK + ctx.minReps)
    rawDelta = Math.round(
      (ctx.currentKg * rirGap * pctPerRep) / 100 / (inp.plateKg * ctx.factor),
    )
  }

  const cap = fromRirEstimate ? MAX_RIR_ESTIMATE_PINS : MAX_CALIBRATION_PINS
  const capped = clamp(rawDelta, 0, cap)

  // Never propose past the station's 90 % ceiling; if that bites, say so.
  const ceilingPin = pinUnderCeiling(ctx.factor, inp.stationMaxEffectiveKg)
  const wantedPin = Math.min(MAX_PIN, ctx.currentPin + capped)
  const pin = Math.min(wantedPin, ceilingPin)

  if (pin < wantedPin || (capped > 0 && pin === ctx.currentPin)) {
    const s = finish(blank(inp, 'station_ceiling'))
    s.pin = ctx.currentPin
    s.atCeiling = true
    return s
  }

  if (capped === 0) {
    // Already at roughly the right load — fall through to ordinary rep work.
    const s = finish(blank(inp, 'progress_reps'))
    s.pin = ctx.currentPin
    s.targetReps = Math.min(ctx.minReps + 1, inp.repMax)
    return s
  }

  const s = finish(blank(inp, 'calibration_jump'))
  s.pin = pin
  s.nextEffectiveKg = effectiveKg(pin, ctx.factor)
  s.jumpSplit = rawDelta > cap
  s.fromRirEstimate = fromRirEstimate
  return s
}

// ------------------------------------------------------- §4a observations

export type RepCostObservation = {
  observedAt: string
  fromKg: number
  toKg: number
  fromReps: number
  toReps: number
  epleyK: number
}

/**
 * Every consecutive pair of sessions where the pin moved and the effort was
 * comparable (both sessions' minRir within ±1) yields one estimate of this
 * exercise's Epley k. Pairs that carry no signal are dropped by fitEpleyK.
 */
export function observationsFrom(
  history: SessionPerformance[],
  factor: number | null,
): RepCostObservation[] {
  if (factor === null) return []
  const out: RepCostObservation[] = []

  for (let i = 1; i < history.length; i++) {
    const prev = ruleSets(history[i - 1])
    const curr = ruleSets(history[i])
    if (prev.length === 0 || curr.length === 0) continue

    const fromPin = prev[0].pin
    const toPin = curr[0].pin
    if (fromPin === null || toPin === null || fromPin === toPin) continue

    const prevMinRir = Math.min(...prev.map(rirOf))
    const currMinRir = Math.min(...curr.map(rirOf))
    if (Math.abs(prevMinRir - currMinRir) > 1) continue

    const fromKg = effectiveKg(fromPin, factor)
    const toKg = effectiveKg(toPin, factor)
    const fromReps = Math.max(...prev.map((s) => s.reps))
    const toReps = Math.max(...curr.map((s) => s.reps))

    const k = fitEpleyK({ fromKg, fromReps, toKg, toReps })
    if (k === null) continue

    out.push({ observedAt: history[i].date, fromKg, toKg, fromReps, toReps, epleyK: k })
  }
  return out
}
