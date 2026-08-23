import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { nb } from '../../i18n/nb'
import { useWorkoutById, useSetWorkoutStatus } from '../../data/queries/workout'
import { useSessionTemplate } from '../../data/queries/sessionTemplate'
import { useSetEntries } from '../../data/queries/setEntry'
import { ExerciseBlock } from './ExerciseBlock'

export function LoggerPage() {
  const { workoutId } = useParams<{ workoutId: string }>()
  const navigate = useNavigate()

  const { data: workout, isLoading: workoutLoading } = useWorkoutById(workoutId)
  const { data: template, isLoading: templateLoading } = useSessionTemplate(workout?.template_id)
  const { data: setEntries } = useSetEntries(workoutId)
  const setWorkoutStatus = useSetWorkoutStatus()

  const setsByExercise = useMemo(() => {
    const map = new Map<string, typeof setEntries>()
    for (const s of setEntries ?? []) {
      if (!map.has(s.exercise_id)) map.set(s.exercise_id, [])
      map.get(s.exercise_id)?.push(s)
    }
    return map
  }, [setEntries])

  if (workoutLoading || templateLoading || !workout || !template) {
    return <div className="p-6 text-sm text-stone-500">{nb.logger.loading}</div>
  }

  const items = template.items.slice().sort((a, b) => a.order - b.order)

  return (
    <div className="mx-auto max-w-md pb-28">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/95 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="text-sm text-stone-500 underline"
        >
          ← {nb.logger.back}
        </button>
        <div className="mt-1 flex items-baseline justify-between">
          <h1 className="text-lg font-semibold text-stone-900">
            {template.code} — {template.name_nb}
          </h1>
          <span className="font-mono text-xs text-stone-500">{workout.date}</span>
        </div>
        <p className="mt-0.5 text-xs text-stone-400">{nb.logger.logHint}</p>
      </header>

      <div className="space-y-3 p-4">
        {items.length === 0 && <p className="text-sm text-stone-500">{nb.logger.noExercises}</p>}

        {items.map((item) => (
          <ExerciseBlock
            key={item.id}
            item={item}
            workoutId={workout.id}
            existingSets={setsByExercise.get(item.exercise_id) ?? []}
          />
        ))}
      </div>

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md border-t border-stone-200 bg-white p-4">
        <button
          type="button"
          onClick={async () => {
            await setWorkoutStatus.mutateAsync({ workoutId: workout.id, status: 'completed' })
            navigate('/')
          }}
          className="w-full rounded-xl bg-stone-900 py-3 text-sm font-semibold text-white"
        >
          {workout.status === 'completed' ? nb.logger.completed : nb.logger.finishSession}
        </button>
      </div>
    </div>
  )
}
