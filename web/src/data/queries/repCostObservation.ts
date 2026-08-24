import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, getCurrentUserId } from '../supabaseClient'
import { observationsFrom, epleyKFrom, EPLEY_K_DEFAULT } from '../../domain/progression'
import type { SessionPerformance } from '../../domain/progression'
import type { SessionTemplateItem } from '../types'

type Row = {
  exercise_id: string
  set_index: number
  pin: number | null
  reps: number
  rir: number | null
  is_warmup: boolean
  is_amrap: boolean
  workout: { date: string; status: string; template_id: string } | null
}

/**
 * History across every session template the exercise appears in — see the
 * comment on `fetchHistory` in `queries/suggestions.ts` for why. Also
 * returns, per exercise, which template each session's date belongs to: a
 * pin-change observation is tagged with the template of its "to" session for
 * provenance, not with whichever template happens to trigger the recompute.
 */
async function fetchAllHistory(
  exerciseIds: string[],
): Promise<{
  history: Map<string, SessionPerformance[]>
  templateByDate: Map<string, Map<string, string>>
}> {
  const { data, error } = await supabase
    .from('set_entry')
    .select(
      'exercise_id, set_index, pin, reps, rir, is_warmup, is_amrap, workout:workout_id!inner(date, status, template_id)',
    )
    .in('exercise_id', exerciseIds)
    .neq('workout.status', 'skipped')
    .order('set_index', { ascending: true })

  if (error) throw error

  const byExercise = new Map<string, Map<string, SessionPerformance>>()
  const templateByDate = new Map<string, Map<string, string>>()
  for (const row of (data ?? []) as unknown as Row[]) {
    const date = row.workout?.date
    const templateId = row.workout?.template_id
    if (!date || !templateId) continue
    if (!byExercise.has(row.exercise_id)) byExercise.set(row.exercise_id, new Map())
    const sessions = byExercise.get(row.exercise_id) as Map<string, SessionPerformance>
    if (!sessions.has(date)) sessions.set(date, { date, sets: [] })
    sessions.get(date)?.sets.push({
      setIndex: row.set_index,
      reps: row.reps,
      rir: row.rir,
      pin: row.pin,
      externalKg: null,
      side: null,
      isWarmup: row.is_warmup,
      isAmrap: row.is_amrap,
    })

    if (!templateByDate.has(row.exercise_id)) templateByDate.set(row.exercise_id, new Map())
    templateByDate.get(row.exercise_id)?.set(date, templateId)
  }

  const history = new Map<string, SessionPerformance[]>()
  for (const [id, sessions] of byExercise) {
    history.set(id, [...sessions.values()].sort((a, b) => (a.date < b.date ? -1 : 1)))
  }
  return { history, templateByDate }
}

/**
 * Recompute rep-cost observations for these exercises. Idempotent: the table
 * has a unique key on (user, exercise, observed_at) — not template, since the
 * same pin-change observation must stay one row no matter which template's
 * "Avslutt økt" triggers the recompute that finds it.
 */
async function recordObservations(args: {
  templateId: string
  items: SessionTemplateItem[]
}): Promise<number> {
  const exerciseIds = args.items.map((i) => i.exercise_id)
  if (exerciseIds.length === 0) return 0

  const userId = await getCurrentUserId()
  const { history, templateByDate } = await fetchAllHistory(exerciseIds)

  const rows = args.items.flatMap((item) => {
    const factor = item.exercise?.station?.factor ?? null
    const datesToTemplate = templateByDate.get(item.exercise_id)
    return observationsFrom(history.get(item.exercise_id) ?? [], factor).map((o) => ({
      user_id: userId,
      exercise_id: item.exercise_id,
      session_template_id: datesToTemplate?.get(o.observedAt) ?? args.templateId,
      observed_at: o.observedAt,
      from_kg: o.fromKg,
      to_kg: o.toKg,
      from_reps: o.fromReps,
      to_reps: o.toReps,
      epley_k: o.epleyK,
    }))
  })

  if (rows.length === 0) return 0

  const { error } = await supabase
    .from('rep_cost_observation')
    .upsert(rows, { onConflict: 'user_id,exercise_id,observed_at' })
  if (error) throw error
  return rows.length
}

export function useRecordObservations() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: recordObservations,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestions'] })
      queryClient.invalidateQueries({ queryKey: ['epley_k'] })
    },
  })
}

export type EpleyKSummary = {
  exerciseId: string
  name: string
  k: number
  observations: number
  isDefault: boolean
}

/** Per-exercise k for the Settings display. */
export function useEpleyKSummary() {
  return useQuery({
    queryKey: ['epley_k'],
    queryFn: async (): Promise<EpleyKSummary[]> => {
      const [obs, exercises] = await Promise.all([
        supabase.from('rep_cost_observation').select('exercise_id, epley_k'),
        supabase.from('exercise').select('id, name_nb'),
      ])
      if (obs.error) throw obs.error
      if (exercises.error) throw exercises.error

      const names = new Map(
        (exercises.data as { id: string; name_nb: string }[]).map((e) => [e.id, e.name_nb]),
      )
      const byExercise = new Map<string, number[]>()
      for (const row of obs.data as { exercise_id: string; epley_k: number }[]) {
        if (!byExercise.has(row.exercise_id)) byExercise.set(row.exercise_id, [])
        byExercise.get(row.exercise_id)?.push(Number(row.epley_k))
      }

      return [...byExercise.entries()]
        .map(([exerciseId, values]) => ({
          exerciseId,
          name: names.get(exerciseId) ?? '—',
          k: epleyKFrom(values),
          observations: values.length,
          isDefault: values.length < 3,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'nb'))
    },
  })
}

export { EPLEY_K_DEFAULT }
