// The load model — CLAUDE.md §4.1, the single most important rule in that
// file. Effective kilograms are computed here, never stored: a corrected
// station.factor must recompute all history.

export const TOP_PLATE_KG = 6.804
export const PLATE_KG = 4.536

/** Weight of the stack at a given pop-pin position (1–15). */
export function stackKg(pin: number): number {
  return TOP_PLATE_KG + PLATE_KG * pin
}

/** Effective resistance a station delivers at a given pin. */
export function effectiveKg(pin: number, stationFactor: number): number {
  return stackKg(pin) * stationFactor
}

/**
 * True once effective load reaches 90% of the station's max — CLAUDE.md §4.1:
 * the answer at that point is a different exercise, not another pin.
 */
export function isNearStationCeiling(effectiveKgValue: number, maxEffectiveKg: number): boolean {
  return effectiveKgValue >= maxEffectiveKg * 0.9
}
