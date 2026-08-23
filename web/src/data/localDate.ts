// A workout date is a calendar date decided in local time — never derive it
// from a UTC timestamp. A 21:30 session in Norway must not land on tomorrow.
// See CLAUDE.md §9.
export function toLocalDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** ISO weekday: 1 = Monday … 7 = Sunday — matches session_template.weekday. */
export function isoWeekday(date: Date): number {
  const jsDay = date.getDay() // 0 = Sunday … 6 = Saturday
  return jsDay === 0 ? 7 : jsDay
}
