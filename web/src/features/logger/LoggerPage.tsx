import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { nb } from '../../i18n/nb'
import { useWorkoutById, useSetWorkoutStatus } from '../../data/queries/workout'
import { useSessionTemplate } from '../../data/queries/sessionTemplate'
import { useSetEntries } from '../../data/queries/setEntry'
import { useLastSets } from '../../data/queries/lastSets'
import { useSuggestions } from '../../data/queries/suggestions'
import { useRecordObservations } from '../../data/queries/repCostObservation'
import { ExerciseBlock } from './ExerciseBlock'

export function LoggerPage() {
  const { workoutId } = useParams<{ workoutId: string }>()
  const navigate = useNavigate()

  const { data: workout, isLoading: workoutLoading } = useWorkoutById(workoutId)
  const { data: template, isLoading: templateLoading } = useSessionTemplate(workout?.template_id)
  const { data: setEntries } = useSetEntries(workoutId)
  const setWorkoutStatus = useSetWorkoutStatus()
  const recordObservations = useRecordObservations()

  const exerciseIds = useMemo(
    () => (template?.items ?? []).map((i) => i.exercise_id),
    [template],
  )
  const { data: lastSets } = useLastSets(exerciseIds, workout?.date)
  const { data: suggestions } = useSuggestions(
    workout?.template_id,
    template?.items ?? [],
    workout?.date,
  )
  // ExerciseBlock/SetRow seed their state on mount, so they must not mount
  // before the previous session's numbers are in hand — otherwise the carried
  // over pin and reps silently never appear.
  const lastSetsReady = exerciseIds.length === 0 || lastSets !== undefined

  const setsByExercise = useMemo(() => {
    const map = new Map<string, typeof setEntries>()
    for (const s of setEntries ?? []) {
      if (!map.has(s.exercise_id)) map.set(s.exercise_id, [])
      map.get(s.exercise_id)?.push(s)
    }
    return map
  }, [setEntries])

  if (workoutLoading || templateLoading || !workout || !template || !lastSetsReady) {
    return <div className="p-6 text-sm text-muted">{nb.logger.loading}</div>
  }

  const items = template.items.slice().sort((a, b) => a.order - b.order)

  return (
    <div className="mx-auto max-w-md pb-28">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="text-sm text-muted underline"
        >
          ← {nb.logger.back}
        </button>
        <div className="mt-1 flex items-baseline justify-between">
          <h1 className="text-lg font-semibold text-ink">
            {template.code} — {template.name_nb}
          </h1>
          <span className="font-mono text-xs text-muted">{workout.date}</span>
        </div>
        <p className="mt-0.5 text-xs text-faint">{nb.logger.logHint}</p>
      </header>

      <div className="space-y-3 p-4">
        {items.length === 0 && <p className="text-sm text-muted">{nb.logger.noExercises}</p>}

        {items.map((item) => (
          <ExerciseBlock
            key={item.id}
            item={item}
            workoutId={workout.id}
            existingSets={setsByExercise.get(item.exercise_id) ?? []}
            last={lastSets?.get(item.exercise_id)}
            suggestion={suggestions?.get(item.exercise_id)}
          />
        ))}
      </div>

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md border-t border-line bg-surface p-4">
        <button
          type="button"
          onClick={async () => {
            await setWorkoutStatus.mutateAsync({ workoutId: workout.id, status: 'completed' })
            // Finishing a session may have produced a pin change worth learning
            // this exercise's Epley k from. Idempotent, and never blocks exit.
            try {
              await recordObservations.mutateAsync({
                templateId: workout.template_id,
                items: template.items,
              })
            } catch {
              // Calibration data is a nicety; losing it must not strand the user.
            }
            navigate('/')
          }}
          className="w-full rounded-xl bg-brand py-3 text-sm font-semibold text-white"
        >
          {workout.status === 'completed' ? nb.logger.completed : nb.logger.finishSession}
        </button>
      </div>
    </div>
  )
}
