import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { nb } from '../../i18n/nb'
import { useActiveProgram } from '../../data/queries/program'
import { useSessionTemplate } from '../../data/queries/sessionTemplate'
import { useWorkout, useCreateWorkout, useSetWorkoutStatus } from '../../data/queries/workout'
import { useSetEntries } from '../../data/queries/setEntry'
import { toLocalDateString, isoWeekday } from '../../data/localDate'
import { getDraftExerciseIndex, saveDraftExerciseIndex, clearDraft } from '../../data/workoutDraft'
import { effectiveKg, isNearStationCeiling } from '../../domain/load'
import { SetRow } from './SetRow'
import type { Side } from '../../data/types'

export function LoggerPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { data: program } = useActiveProgram()

  const today = toLocalDateString(new Date())
  const [selectedDate, setSelectedDate] = useState(today)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(
    searchParams.get('template') ?? undefined,
  )
  const [started, setStarted] = useState(false)

  const templates = program?.session_templates ?? []
  const matchingWeekday = templates.find((t) => t.weekday === isoWeekday(new Date(selectedDate)))
  // Derived, not stored: falls back to the weekday match until the user
  // explicitly picks something else.
  const effectiveTemplateId = selectedTemplateId ?? matchingWeekday?.id

  if (!started) {
    return (
      <div className="mx-auto max-w-md p-6">
        <h1 className="text-xl font-semibold text-stone-900">{nb.logger.pickTitle}</h1>
        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-stone-700" htmlFor="date">
            {nb.logger.dateLabel}
          </label>
          <input
            id="date"
            type="date"
            value={selectedDate}
            max={today}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-base"
          />

          <label className="block text-sm font-medium text-stone-700" htmlFor="template">
            {nb.logger.sessionLabel}
          </label>
          <select
            id="template"
            value={effectiveTemplateId ?? ''}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-base"
          >
            <option value="" disabled>
              …
            </option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code} — {t.name_nb}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={!effectiveTemplateId}
            onClick={() => {
              if (!effectiveTemplateId) return
              setSelectedTemplateId(effectiveTemplateId)
              setStarted(true)
            }}
            className="w-full rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {nb.logger.start}
          </button>
        </div>
      </div>
    )
  }

  return (
    <ActiveLogger
      templateId={effectiveTemplateId as string}
      date={selectedDate}
      programId={program?.id as string}
      onExit={() => navigate('/')}
    />
  )
}

function ActiveLogger({
  templateId,
  date,
  programId,
  onExit,
}: {
  templateId: string
  date: string
  programId: string
  onExit: () => void
}) {
  const { data: template, isLoading: templateLoading } = useSessionTemplate(templateId)
  const { data: workout, isLoading: workoutLoading } = useWorkout(templateId, date)
  const createWorkout = useCreateWorkout()
  const setWorkoutStatus = useSetWorkoutStatus()
  const { data: setEntries } = useSetEntries(workout?.id)

  useEffect(() => {
    if (!workoutLoading && workout === null && !createWorkout.isPending) {
      createWorkout.mutate({ programId, templateId, date })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutLoading, workout, programId, templateId, date])

  const [exerciseIndex, setExerciseIndex] = useState(() => getDraftExerciseIndex(templateId, date))
  const [extraSets, setExtraSets] = useState(0)
  const [pin, setPin] = useState(1)
  const [externalKg, setExternalKg] = useState(0)
  const [loadedExerciseId, setLoadedExerciseId] = useState<string | undefined>(undefined)

  const items = template?.items ?? []
  const item = items[exerciseIndex]
  const exercise = item?.exercise

  const existingForExercise = useMemo(
    () => (setEntries ?? []).filter((s) => s.exercise_id === exercise?.id),
    [setEntries, exercise?.id],
  )

  // Reset the exercise-level load state when the exercise changes. Adjusting
  // state directly during render (React's documented pattern for this) keeps
  // it in one render pass instead of an effect-triggered extra one.
  if (exercise && exercise.id !== loadedExerciseId) {
    setLoadedExerciseId(exercise.id)
    setExtraSets(0)
    if (exercise.load_source === 'stack') {
      setPin(existingForExercise.at(-1)?.pin ?? 1)
    } else if (exercise.load_source === 'external') {
      setExternalKg(existingForExercise.at(-1)?.external_kg ?? 0)
    }
  }

  function goToExercise(nextIndex: number) {
    const clamped = Math.max(0, Math.min(items.length - 1, nextIndex))
    setExerciseIndex(clamped)
    saveDraftExerciseIndex(templateId, date, clamped)
  }

  async function finishSession() {
    if (workout) await setWorkoutStatus.mutateAsync({ workoutId: workout.id, status: 'completed' })
    clearDraft(templateId, date)
    onExit()
  }

  if (templateLoading || workoutLoading || !workout || !item || !exercise) {
    return <div className="p-6 text-sm text-stone-500">{nb.logger.loading}</div>
  }

  const station = exercise.station ?? undefined
  const eff =
    exercise.load_source === 'stack' && station ? effectiveKg(pin, station.factor) : null
  const nearCeiling =
    eff !== null && station ? isNearStationCeiling(eff, station.max_effective_kg) : false

  const totalSets = item.target_sets + extraSets
  const sides: (Side | null)[] = exercise.is_unilateral ? ['L', 'R'] : [null]

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col">
      <div className="border-b border-stone-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-stone-400">
              {template?.code} — {template?.name_nb}
            </div>
            <div className="text-lg font-semibold text-stone-900">{exercise.name_nb}</div>
          </div>
          <div className="rounded-full bg-stone-100 px-3 py-1 font-mono text-xs font-semibold text-stone-600">
            {exerciseIndex + 1} {nb.logger.exerciseProgress} {items.length}
          </div>
        </div>
        <div className="mt-1 text-xs text-stone-500">
          {item.rep_min}–{item.rep_max} reps · {item.rir_min}–{item.rir_max} RIR
          {item.note && <span> · {item.note}</span>}
        </div>
      </div>

      <div className="flex-1 space-y-4 p-4">
        {exercise.load_source === 'stack' && (
          <div className="flex items-center justify-center gap-6 py-2">
            <button
              type="button"
              onClick={() => setPin((p) => Math.max(1, p - 1))}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-stone-300 bg-stone-100 text-lg font-bold"
            >
              −
            </button>
            <div className="flex flex-col items-center">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-semibold text-stone-400">{nb.logger.pin}</span>
                <span className="font-mono text-3xl font-bold">{pin}</span>
              </div>
              {eff !== null && (
                <div className="font-mono text-sm text-stone-500">
                  ≈ {eff.toFixed(1).replace('.', ',')} kg
                  {nearCeiling && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                      {nb.logger.ceilingWarning}
                    </span>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setPin((p) => Math.min(15, p + 1))}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-stone-900 bg-stone-900 text-lg font-bold text-white"
            >
              +
            </button>
          </div>
        )}

        {exercise.load_source === 'external' && (
          <div className="flex flex-col items-center gap-2 py-2">
            <label htmlFor="externalKg" className="text-xs font-semibold text-stone-400">
              {nb.logger.externalKg}
            </label>
            <input
              id="externalKg"
              type="text"
              inputMode="decimal"
              value={externalKg}
              onChange={(e) => setExternalKg(Number(e.target.value) || 0)}
              className="w-24 rounded-lg border border-stone-300 px-3 py-2 text-center font-mono text-xl"
            />
          </div>
        )}

        <div className="space-y-2">
          {Array.from({ length: totalSets }, (_, i) => i + 1).flatMap((setIndex) =>
            sides.map((side) => {
              const existing = existingForExercise.find(
                (s) => s.set_index === setIndex && s.side === side,
              )
              return (
                <SetRow
                  key={`${setIndex}-${side}`}
                  workoutId={workout.id}
                  exerciseId={exercise.id}
                  stationId={station?.id ?? null}
                  setIndex={setIndex}
                  side={side}
                  sideLabel={side ?? undefined}
                  existing={existing}
                  pin={exercise.load_source === 'stack' ? pin : null}
                  externalKg={exercise.load_source === 'external' ? externalKg : null}
                />
              )
            }),
          )}
          <button
            type="button"
            onClick={() => setExtraSets((n) => n + 1)}
            className="w-full rounded-lg border border-dashed border-stone-300 py-2 text-sm font-medium text-stone-500"
          >
            + {nb.logger.addSet}
          </button>
        </div>
      </div>

      <div className="sticky bottom-0 flex flex-col gap-2 border-t border-stone-200 bg-white p-4">
        <div className="flex gap-2">
          <button
            type="button"
            disabled={exerciseIndex === 0}
            onClick={() => goToExercise(exerciseIndex - 1)}
            className="flex-1 rounded-lg border border-stone-300 py-3 text-sm font-medium disabled:opacity-40"
          >
            {nb.logger.prevExercise}
          </button>
          {exerciseIndex < items.length - 1 ? (
            <button
              type="button"
              onClick={() => goToExercise(exerciseIndex + 1)}
              className="flex-1 rounded-lg bg-stone-900 py-3 text-sm font-medium text-white"
            >
              {nb.logger.nextExercise}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void finishSession()}
              className="flex-1 rounded-lg bg-stone-900 py-3 text-sm font-medium text-white"
            >
              {nb.logger.finishSession}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
