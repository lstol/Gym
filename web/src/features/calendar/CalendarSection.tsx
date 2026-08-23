import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { nb } from '../../i18n/nb'
import { addMonths, isoWeekdayOf, monthBounds, datesInRange } from '../../domain/schedule'
import {
  useWorkoutsInRange,
  useGenerateSchedule,
  useMoveWorkout,
  useDeleteWorkout,
} from '../../data/queries/schedule'
import type { ScheduledWorkout } from '../../data/queries/schedule'
import type { ProgramWithTemplates } from '../../data/types'
import { toLocalDateString } from '../../data/localDate'

const STATUS_STYLE: Record<string, string> = {
  planned: 'bg-stone-200 text-stone-700',
  completed: 'bg-emerald-600 text-white',
  skipped: 'bg-amber-100 text-amber-700 line-through',
}

export function CalendarSection({ program }: { program: ProgramWithTemplates }) {
  const today = toLocalDateString(new Date())
  const [cursor, setCursor] = useState(today)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const { first, last } = monthBounds(cursor)
  const { data: workouts } = useWorkoutsInRange(first, last)
  const generateSchedule = useGenerateSchedule()

  // Materialise planned sessions for the month being viewed. Only ever fills
  // forward of the watermark, so deleted sessions stay deleted.
  const needsGeneration =
    !program.scheduled_through || program.scheduled_through < last
  useEffect(() => {
    if (!needsGeneration || generateSchedule.isPending) return
    generateSchedule.mutate({
      programId: program.id,
      startDate: program.start_date,
      scheduledThrough: program.scheduled_through,
      templates: program.session_templates.map((t) => ({ id: t.id, weekday: t.weekday })),
      through: last,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsGeneration, last])

  const byDate = useMemo(() => {
    const map = new Map<string, ScheduledWorkout[]>()
    for (const w of workouts ?? []) {
      if (!map.has(w.date)) map.set(w.date, [])
      map.get(w.date)?.push(w)
    }
    return map
  }, [workouts])

  // Pad the grid so the month starts on the correct weekday column (Mon-first).
  const leadingBlanks = isoWeekdayOf(first) - 1
  const days = datesInRange(first, last)
  const [year, month] = cursor.split('-').map(Number)

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-stone-900">
          {nb.calendar.months[month - 1]} {year}
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={nb.calendar.prevMonth}
            onClick={() => setCursor(addMonths(cursor, -1))}
            className="h-8 w-8 rounded-lg border border-stone-200 text-sm"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setCursor(today)}
            className="h-8 rounded-lg border border-stone-200 px-2 text-xs font-medium"
          >
            {nb.calendar.today}
          </button>
          <button
            type="button"
            aria-label={nb.calendar.nextMonth}
            onClick={() => setCursor(addMonths(cursor, 1))}
            className="h-8 w-8 rounded-lg border border-stone-200 text-sm"
          >
            ›
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-stone-400">
        {nb.calendar.weekdays.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {days.map((date) => {
          const sessions = byDate.get(date) ?? []
          const isToday = date === today
          const isSelected = date === selectedDate
          return (
            <button
              key={date}
              type="button"
              onClick={() => setSelectedDate(isSelected ? null : date)}
              className={`flex min-h-[3rem] flex-col items-center gap-0.5 rounded-lg border p-1 ${
                isSelected
                  ? 'border-stone-900 bg-stone-50'
                  : isToday
                    ? 'border-stone-400 bg-stone-50'
                    : 'border-transparent hover:bg-stone-50'
              }`}
            >
              <span
                className={`text-xs ${isToday ? 'font-bold text-stone-900' : 'text-stone-500'}`}
              >
                {Number(date.slice(8))}
              </span>
              <span className="flex flex-wrap justify-center gap-0.5">
                {sessions.map((s) => (
                  <span
                    key={s.id}
                    className={`rounded px-1 text-[10px] font-bold leading-4 ${
                      STATUS_STYLE[s.status] ?? STATUS_STYLE.planned
                    }`}
                  >
                    {s.template?.code ?? '?'}
                  </span>
                ))}
              </span>
            </button>
          )
        })}
      </div>

      {selectedDate && (
        <DayDetail
          date={selectedDate}
          sessions={byDate.get(selectedDate) ?? []}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </section>
  )
}

function DayDetail({
  date,
  sessions,
  onClose,
}: {
  date: string
  sessions: ScheduledWorkout[]
  onClose: () => void
}) {
  const navigate = useNavigate()
  const moveWorkout = useMoveWorkout()
  const deleteWorkout = useDeleteWorkout()
  const [movingId, setMovingId] = useState<string | null>(null)

  if (sessions.length === 0) {
    return (
      <div className="mt-3 rounded-xl bg-stone-50 p-3 text-sm text-stone-500">
        {nb.calendar.noSessions}
      </div>
    )
  }

  return (
    <div className="mt-3 space-y-2">
      {sessions.map((s) => (
        <div key={s.id} className="rounded-xl bg-stone-50 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-stone-900">
                {s.template?.code} — {s.template?.name_nb}
              </p>
              <p className="text-xs text-stone-500">
                {s.status === 'completed'
                  ? nb.calendar.completedStatus
                  : s.status === 'skipped'
                    ? nb.calendar.skipped
                    : nb.calendar.planned}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/logger/${s.id}`)}
              className="rounded-lg bg-stone-900 px-3 py-2 text-xs font-semibold text-white"
            >
              {nb.calendar.openLog}
            </button>
          </div>

          {movingId === s.id ? (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="date"
                defaultValue={date}
                onChange={(e) => {
                  if (!e.target.value) return
                  moveWorkout.mutate({ workoutId: s.id, date: e.target.value })
                  setMovingId(null)
                  onClose()
                }}
                className="flex-1 rounded-lg border border-stone-300 px-2 py-1 text-sm"
              />
            </div>
          ) : (
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setMovingId(s.id)}
                className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium"
              >
                {nb.calendar.move}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(nb.calendar.confirmRemove)) deleteWorkout.mutate(s.id)
                }}
                className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-red-600"
              >
                {nb.calendar.remove}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
