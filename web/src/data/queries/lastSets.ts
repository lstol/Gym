import { useQuery } from '@tanstack/react-query'
import { supabase } from '../supabaseClient'

type Row = {
  exercise_id: string
  set_index: number
  pin: number | null
  external_kg: number | null
  reps: number
  rir: number | null
  workout: { date: string } | null
}

export type LastPerformance = {
  date: string
  pin: number | null
  externalKg: number | null
  /** reps/RIR keyed by set index, from that session. */
  bySetIndex: Map<number, { reps: number; rir: number | null }>
}

/**
 * What was done last time for each exercise, so the logger can start from it
 * instead of a blank row. Only sessions strictly before `beforeDate` count, so
 * re-opening today's log doesn't suggest today's own numbers back at you.
 */
async function fetchLastSets(
  exerciseIds: string[],
  beforeDate: string,
): Promise<Map<string, LastPerformance>> {
  if (exerciseIds.length === 0) return new Map()

  const { data, error } = await supabase
    .from('set_entry')
    .select('exercise_id, set_index, pin, external_kg, reps, rir, workout:workout_id!inner(date)')
    .in('exercise_id', exerciseIds)
    .eq('is_warmup', false)
    .lt('workout.date', beforeDate)
    .order('set_index', { ascending: true })

  if (error) throw error

  const out = new Map<string, LastPerformance>()
  for (const row of (data ?? []) as unknown as Row[]) {
    const date = row.workout?.date
    if (!date) continue

    const existing = out.get(row.exercise_id)
    if (!existing || date > existing.date) {
      // A newer session supersedes whatever was collected for this exercise.
      out.set(row.exercise_id, {
        date,
        pin: row.pin,
        externalKg: row.external_kg,
        bySetIndex: new Map([[row.set_index, { reps: row.reps, rir: row.rir }]]),
      })
    } else if (date === existing.date) {
      existing.bySetIndex.set(row.set_index, { reps: row.reps, rir: row.rir })
    }
  }
  return out
}

export function useLastSets(exerciseIds: string[], beforeDate: string | undefined) {
  const key = [...exerciseIds].sort().join(',')
  return useQuery({
    queryKey: ['last_sets', key, beforeDate],
    queryFn: () => fetchLastSets(exerciseIds, beforeDate as string),
    enabled: !!beforeDate && exerciseIds.length > 0,
  })
}
