import { useEffect, useMemo, useRef, useState } from 'react'
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
import { SESSION_ACCENT } from './sessionAccent'

type DragState = {
  workout: ScheduledWorkout
  x: number
  y: number
  active: boolean
}

export function CalendarSection({ program }: { program: ProgramWithTemplates }) {
  const today = toLocalDateString(new Date())
  const navigate = useNavigate()
  const [cursor, setCursor] = useState(today)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const { first, last } = monthBounds(cursor)
  const { data: workouts } = useWorkoutsInRange(first, last)
  const generateSchedule = useGenerateSchedule()
  const moveWorkout = useMoveWorkout()
  const deleteWorkout = useDeleteWorkout()

  const [drag, setDrag] = useState<DragState | null>(null)
  const [hoverDate, setHoverDate] = useState<string | null>(null)
  const [overTrash, setOverTrash] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)
  const justDragged = useRef(false)

  /**
   * The whole day cell is one tap target — hitting the date number or the
   * session chip must behave identically. Previously a tap on the chip
   * selected the day and the click then bubbled to the cell and deselected it
   * again, so tapping the letter appeared to do nothing.
   */
  function selectDay(date: string) {
    if (justDragged.current) {
      justDragged.current = false
      return
    }
    setSelectedDate((current) => (current === date ? null : date))
  }

  const needsGeneration = !program.scheduled_through || program.scheduled_through < last
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

  function dateUnderPointer(x: number, y: number): string | null {
    const el = document.elementFromPoint(x, y)
    const cell = el?.closest('[data-date]') as HTMLElement | null
    return cell?.dataset.date ?? null
  }

  function isOverTrash(x: number, y: number): boolean {
    const el = document.elementFromPoint(x, y)
    return !!el?.closest('[data-trash]')
  }

  function handlePointerDown(e: React.PointerEvent, workout: ScheduledWorkout) {
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    setDrag({ workout, x: e.clientX, y: e.clientY, active: false })
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!drag) return
    const movedEnough =
      Math.abs(e.clientX - drag.x) > 6 || Math.abs(e.clientY - drag.y) > 6 || drag.active
    if (!movedEnough) return
    setDrag({ ...drag, x: e.clientX, y: e.clientY, active: true })
    setHoverDate(dateUnderPointer(e.clientX, e.clientY))
    setOverTrash(isOverTrash(e.clientX, e.clientY))
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (!drag) return
    const wasDragging = drag.active
    const dropDate = dateUnderPointer(e.clientX, e.clientY)
    const trash = isOverTrash(e.clientX, e.clientY)

    if (wasDragging && trash) {
      deleteWorkout.mutate(drag.workout.id)
    } else if (wasDragging && dropDate && dropDate !== drag.workout.date) {
      moveWorkout.mutate({ workoutId: drag.workout.id, date: dropDate })
    }

    // A drag ends with a click event too. Remember so the click that follows
    // is ignored rather than treated as a tap on the day.
    justDragged.current = wasDragging

    setDrag(null)
    setHoverDate(null)
    setOverTrash(false)
  }

  const leadingBlanks = isoWeekdayOf(first) - 1
  const days = datesInRange(first, last)
  const [year, month] = cursor.split('-').map(Number)

  return (
    <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-ink">
          {nb.calendar.months[month - 1]} {year}
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={nb.calendar.prevMonth}
            onClick={() => setCursor(addMonths(cursor, -1))}
            className="h-8 w-8 rounded-lg border border-line text-muted"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setCursor(today)}
            className="h-8 rounded-lg border border-line px-2 text-xs font-medium text-muted"
          >
            {nb.calendar.today}
          </button>
          <button
            type="button"
            aria-label={nb.calendar.nextMonth}
            onClick={() => setCursor(addMonths(cursor, 1))}
            className="h-8 w-8 rounded-lg border border-line text-muted"
          >
            ›
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-faint">
        {nb.calendar.weekdays.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div ref={gridRef} className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {days.map((date) => {
          const sessions = byDate.get(date) ?? []
          const isToday = date === today
          const isSelected = date === selectedDate
          const isHovered = drag?.active && hoverDate === date
          return (
            <div
              key={date}
              data-date={date}
              onClick={() => selectDay(date)}
              className={`flex min-h-[3.5rem] cursor-pointer flex-col items-center gap-0.5 rounded-lg border p-1 transition-colors ${
                isHovered
                  ? 'border-brand bg-brand-soft'
                  : isSelected
                    ? 'border-brand bg-sunken'
                    : isToday
                      ? 'border-brand/40 bg-sunken'
                      : 'border-transparent'
              }`}
            >
              <span
                className={`tnum text-xs ${isToday ? 'font-bold text-brand' : 'text-muted'}`}
              >
                {Number(date.slice(8))}
              </span>
              <span className="flex flex-wrap justify-center gap-0.5">
                {sessions.map((s) => {
                  const accent = SESSION_ACCENT[s.template?.code ?? ''] ?? SESSION_ACCENT.default
                  const dragging = drag?.active && drag.workout.id === s.id
                  return (
                    <span
                      key={s.id}
                      onPointerDown={(e) => handlePointerDown(e, s)}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      className={`inline-flex min-w-6 touch-none select-none items-center justify-center rounded px-1.5 text-[11px] font-bold leading-6 ${
                        s.status === 'completed'
                          ? 'bg-done text-white'
                          : s.status === 'skipped'
                            ? 'bg-warn-soft text-warn line-through'
                            : `${accent.bg} text-white`
                      } ${dragging ? 'opacity-30' : ''}`}
                    >
                      {s.template?.code ?? '?'}
                    </span>
                  )
                })}
              </span>
            </div>
          )
        })}
      </div>

      <p className="mt-2 text-[11px] text-faint">{nb.calendar.dragHint}</p>

      {selectedDate && (
        <DayDetail
          sessions={byDate.get(selectedDate) ?? []}
          onOpen={(id) => navigate(`/logger/${id}`)}
        />
      )}

      {drag?.active && (
        <>
          <div
            className="pointer-events-none fixed z-50 rounded px-2 text-xs font-bold leading-6 text-white shadow-lg"
            style={{
              left: drag.x - 14,
              top: drag.y - 14,
              backgroundColor: 'var(--color-brand)',
            }}
          >
            {drag.workout.template?.code}
          </div>
          <div
            data-trash
            className={`fixed inset-x-0 bottom-0 z-40 flex h-20 items-center justify-center border-t text-sm font-semibold transition-colors ${
              overTrash
                ? 'border-danger bg-danger text-white'
                : 'border-line bg-surface text-danger'
            }`}
          >
            {nb.calendar.dropToDelete}
          </div>
        </>
      )}
    </section>
  )
}

function DayDetail({
  sessions,
  onOpen,
}: {
  sessions: ScheduledWorkout[]
  onOpen: (workoutId: string) => void
}) {
  if (sessions.length === 0) {
    return <div className="mt-3 rounded-xl bg-sunken p-3 text-sm text-faint">{nb.calendar.noSessions}</div>
  }

  return (
    <div className="mt-3 space-y-2">
      {sessions.map((s) => {
        const accent = SESSION_ACCENT[s.template?.code ?? ''] ?? SESSION_ACCENT.default
        return (
          <div key={s.id} className="flex items-center justify-between rounded-xl bg-sunken p-3">
            <div className="flex items-center gap-2">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold text-white ${accent.bg}`}
              >
                {s.template?.code}
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">{s.template?.name_nb}</p>
                <p className="text-xs text-faint">
                  {s.status === 'completed'
                    ? nb.calendar.completedStatus
                    : s.status === 'skipped'
                      ? nb.calendar.skipped
                      : nb.calendar.planned}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpen(s.id)}
              className="rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white"
            >
              {nb.calendar.openLog}
            </button>
          </div>
        )
      })}
    </div>
  )
}
