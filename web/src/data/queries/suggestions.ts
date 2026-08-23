import { useQuery } from '@tanstack/react-query'
import { supabase } from '../supabaseClient'
import { suggestNext } from '../../domain/progression'
import type { SessionPerformance, Suggestion } from '../../domain/progression'
import type { SessionTemplateItem } from '../types'

type Row = {
  exercise_id: string
  set_index: number
  pin: number | null
  external_kg: number | null
  reps: number
  rir: number | null
  side: 'L' | 'R' | null
  is_warmup: boolean
  workout: { date: string; status: string } | null
}

/**
 * History for the progression engine, scoped to the SAME session template —
 * CLAUDE.md §4.3 compares like with like, so session B's nedtrekk does not
 * drive session A's.
 *
 * Skipped sessions are excluded. Anything else that has logged sets counts as
 * performed: requiring status = 'completed' would silently drop a session
 * where the user logged their sets but never tapped "Avslutt økt".
 */
async function fetchHistory(
  templateId: string,
  exerciseIds: string[],
  beforeDate: string,
): Promise<Map<string, SessionPerformance[]>> {
  if (exerciseIds.length === 0) return new Map()

  const { data, error } = await supabase
    .from('set_entry')
    .select(
      'exercise_id, set_index, pin, external_kg, reps, rir, side, is_warmup, workout:workout_id!inner(date, status, template_id)',
    )
    .in('exercise_id', exerciseIds)
    .eq('workout.template_id', templateId)
    .neq('workout.status', 'skipped')
    .lt('workout.date', beforeDate)
    .order('set_index', { ascending: true })

  if (error) throw error

  const byExercise = new Map<string, Map<string, SessionPerformance>>()
  for (const row of (data ?? []) as unknown as Row[]) {
    const date = row.workout?.date
    if (!date) continue
    if (!byExercise.has(row.exercise_id)) byExercise.set(row.exercise_id, new Map())
    const sessions = byExercise.get(row.exercise_id) as Map<string, SessionPerformance>
    if (!sessions.has(date)) sessions.set(date, { date, sets: [] })
    sessions.get(date)?.sets.push({
      setIndex: row.set_index,
      reps: row.reps,
      rir: row.rir,
      pin: row.pin,
      externalKg: row.external_kg,
      side: row.side,
      isWarmup: row.is_warmup,
    })
  }

  const out = new Map<string, SessionPerformance[]>()
  for (const [exerciseId, sessions] of byExercise) {
    out.set(
      exerciseId,
      [...sessions.values()].sort((a, b) => (a.date < b.date ? -1 : 1)),
    )
  }
  return out
}

export function useSuggestions(
  templateId: string | undefined,
  items: SessionTemplateItem[],
  beforeDate: string | undefined,
) {
  const exerciseIds = items.map((i) => i.exercise_id)
  const key = [...exerciseIds].sort().join(',')

  return useQuery({
    queryKey: ['suggestions', templateId, key, beforeDate],
    enabled: !!templateId && !!beforeDate && exerciseIds.length > 0,
    queryFn: async (): Promise<Map<string, Suggestion>> => {
      const history = await fetchHistory(templateId as string, exerciseIds, beforeDate as string)
      const out = new Map<string, Suggestion>()
      for (const item of items) {
        const exercise = item.exercise
        if (!exercise) continue
        out.set(
          item.exercise_id,
          suggestNext({
            history: history.get(item.exercise_id) ?? [],
            repMin: item.rep_min,
            repMax: item.rep_max,
            targetSets: item.target_sets,
            loadSource: exercise.load_source,
            stationFactor: exercise.station?.factor ?? null,
            stationMaxEffectiveKg: exercise.station?.max_effective_kg ?? null,
            isUnilateral: exercise.is_unilateral,
          }),
        )
      }
      return out
    },
  })
}
