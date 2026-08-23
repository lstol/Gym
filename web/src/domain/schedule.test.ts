import { describe, it, expect } from 'vitest'
import { addDays, isoWeekdayOf, datesInRange, plannedOccurrences } from './schedule'

describe('date arithmetic on plain calendar dates', () => {
  it('crosses a month boundary', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01')
  })

  it('crosses a year boundary', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('handles a leap day', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('does not drift across the late-October DST change (CET → CEST ends 2026-10-25)', () => {
    // A naive UTC-based implementation shifts by an hour here and can land on
    // the wrong calendar day. See CLAUDE.md §9 — a workout date is a local
    // calendar date, never derived from a UTC instant.
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25')
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26')
    expect(addDays('2026-10-25', 7)).toBe('2026-11-01')
  })

  it('walks a full week without losing a day across DST', () => {
    const week = datesInRange('2026-10-22', '2026-10-28')
    expect(week).toEqual([
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
    ])
  })
})

describe('isoWeekdayOf', () => {
  it('returns 1 for Monday and 7 for Sunday', () => {
    expect(isoWeekdayOf('2026-08-24')).toBe(1) // Monday
    expect(isoWeekdayOf('2026-08-23')).toBe(7) // Sunday
  })

  it('stays correct on the DST changeover day', () => {
    expect(isoWeekdayOf('2026-10-25')).toBe(7)
  })
})

describe('plannedOccurrences', () => {
  const templates = [
    { id: 'a', weekday: 1 },
    { id: 'b', weekday: 3 },
    { id: 'c', weekday: 7 },
  ]

  it('lays A/B/C onto their weekdays across a week', () => {
    const result = plannedOccurrences(templates, '2026-08-24', '2026-08-30')
    expect(result).toEqual([
      { date: '2026-08-24', templateId: 'a' },
      { date: '2026-08-26', templateId: 'b' },
      { date: '2026-08-30', templateId: 'c' },
    ])
  })

  it('repeats week after week — a block has no fixed length', () => {
    const result = plannedOccurrences([{ id: 'a', weekday: 1 }], '2026-08-24', '2026-09-21')
    expect(result.map((o) => o.date)).toEqual([
      '2026-08-24',
      '2026-08-31',
      '2026-09-07',
      '2026-09-14',
      '2026-09-21',
    ])
  })

  it('returns nothing when the range is empty or inverted', () => {
    expect(plannedOccurrences(templates, '2026-08-30', '2026-08-24')).toEqual([])
  })

  it('includes both endpoints of the range', () => {
    const result = plannedOccurrences([{ id: 'a', weekday: 1 }], '2026-08-24', '2026-08-24')
    expect(result).toEqual([{ date: '2026-08-24', templateId: 'a' }])
  })
})
