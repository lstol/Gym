// Scheduling works on plain `YYYY-MM-DD` calendar dates and never on UTC
// instants — see CLAUDE.md §9. Norway switches CET/CEST in late October, and
// anything that round-trips a workout date through a timestamp can land on the
// wrong day. All arithmetic here is done on the date parts directly.

export type TemplateSchedule = {
  id: string
  /** ISO weekday: 1 = Monday … 7 = Sunday. */
  weekday: number
}

export type PlannedOccurrence = {
  date: string
  templateId: string
}

function parts(date: string): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number)
  return [y, m, d]
}

function format(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * Add days to a calendar date. Uses UTC internally purely as day-count
 * arithmetic — the values are never interpreted as a local instant, so no
 * timezone or DST shift can reach the result.
 */
export function addDays(date: string, days: number): string {
  const [y, m, d] = parts(date)
  const t = Date.UTC(y, m - 1, d) + days * 86400000
  const next = new Date(t)
  return format(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate())
}

/** ISO weekday of a calendar date: 1 = Monday … 7 = Sunday. */
export function isoWeekdayOf(date: string): number {
  const [y, m, d] = parts(date)
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 = Sunday
  return day === 0 ? 7 : day
}

export function compareDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** Every calendar date from `from` to `to`, inclusive. */
export function datesInRange(from: string, to: string): string[] {
  const out: string[] = []
  let cursor = from
  while (compareDates(cursor, to) <= 0) {
    out.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return out
}

/**
 * Which sessions fall on which dates in a range, from the templates' weekly
 * recurrence. This is the *expected* schedule — actual `workout` rows may
 * override it once a session is moved, skipped or logged.
 */
export function plannedOccurrences(
  templates: TemplateSchedule[],
  from: string,
  to: string,
): PlannedOccurrence[] {
  const out: PlannedOccurrence[] = []
  for (const date of datesInRange(from, to)) {
    const weekday = isoWeekdayOf(date)
    for (const t of templates) {
      if (t.weekday === weekday) out.push({ date, templateId: t.id })
    }
  }
  return out
}

/** First and last day of the month containing `date`. */
export function monthBounds(date: string): { first: string; last: string } {
  const [y, m] = parts(date)
  const first = format(y, m, 1)
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { first, last: format(y, m, lastDay) }
}

/** Shift a date by whole months, clamping to the end of a shorter month. */
export function addMonths(date: string, months: number): string {
  const [y, m, d] = parts(date)
  const total = y * 12 + (m - 1) + months
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  const lastDay = new Date(Date.UTC(ny, nm, 0)).getUTCDate()
  return format(ny, nm, Math.min(d, lastDay))
}
