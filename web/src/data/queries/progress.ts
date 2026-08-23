import { useQuery } from '@tanstack/react-query'
import { supabase } from '../supabaseClient'

type WorkingSetRow = {
  id: string
  workout_id: string
  exercise_id: string
  reps: number
  rir: number | null
  effective_kg: number | null
}

export type ProgressPoint = {
  date: string
  topKg: number
  reps: number
}

export type ExerciseProgress = {
  exerciseId: string
  name: string
  inCurrentProgram: boolean
  points: ProgressPoint[]
}

/**
 * Top work set per exercise per session. Reads `v_working_set`, which already
 * excludes warmups and computes effective_kg from pin × station factor — kg is
 * never stored (CLAUDE.md §4.1).
 *
 * The view carries no foreign keys for PostgREST to embed through, so the
 * workout dates are fetched alongside and joined here.
 */
async function fetchProgress(currentExerciseIds: string[]): Promise<ExerciseProgress[]> {
  const [setsResult, workoutsResult, exercisesResult] = await Promise.all([
    supabase.from('v_working_set').select('id, workout_id, exercise_id, reps, rir, effective_kg'),
    supabase.from('workout').select('id, date'),
    supabase.from('exercise').select('id, name_nb'),
  ])

  if (setsResult.error) throw setsResult.error
  if (workoutsResult.error) throw workoutsResult.error
  if (exercisesResult.error) throw exercisesResult.error

  const dateByWorkout = new Map(
    (workoutsResult.data as { id: string; date: string }[]).map((w) => [w.id, w.date]),
  )
  const nameByExercise = new Map(
    (exercisesResult.data as { id: string; name_nb: string }[]).map((e) => [e.id, e.name_nb]),
  )

  // exercise → date → best set that day
  const best = new Map<string, Map<string, ProgressPoint>>()

  for (const row of setsResult.data as WorkingSetRow[]) {
    const date = dateByWorkout.get(row.workout_id)
    if (!date || row.effective_kg === null) continue
    const kg = Number(row.effective_kg)

    if (!best.has(row.exercise_id)) best.set(row.exercise_id, new Map())
    const byDate = best.get(row.exercise_id) as Map<string, ProgressPoint>
    const existing = byDate.get(date)
    // Top set = heaviest; ties broken by reps.
    if (!existing || kg > existing.topKg || (kg === existing.topKg && row.reps > existing.reps)) {
      byDate.set(date, { date, topKg: kg, reps: row.reps })
    }
  }

  const out: ExerciseProgress[] = []
  for (const [exerciseId, byDate] of best) {
    out.push({
      exerciseId,
      name: nameByExercise.get(exerciseId) ?? '—',
      inCurrentProgram: currentExerciseIds.includes(exerciseId),
      points: [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1)),
    })
  }

  // Current-programme exercises first, then by name.
  return out.sort((a, b) => {
    if (a.inCurrentProgram !== b.inCurrentProgram) return a.inCurrentProgram ? -1 : 1
    return a.name.localeCompare(b.name, 'nb')
  })
}

export function useProgress(currentExerciseIds: string[]) {
  return useQuery({
    queryKey: ['progress', [...currentExerciseIds].sort().join(',')],
    queryFn: () => fetchProgress(currentExerciseIds),
  })
}
