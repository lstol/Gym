import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, getCurrentUserId } from '../supabaseClient'
import type { Workout } from '../types'
import { plannedOccurrences, compareDates, addDays } from '../../domain/schedule'
import type { TemplateSchedule } from '../../domain/schedule'

export type ScheduledWorkout = Workout & {
  template?: { id: string; code: string; name_nb: string }
}

async function fetchWorkoutsInRange(from: string, to: string): Promise<ScheduledWorkout[]> {
  const { data, error } = await supabase
    .from('workout')
    .select('*, template:template_id(id, code, name_nb)')
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true })

  if (error) throw error
  return data as ScheduledWorkout[]
}

export function useWorkoutsInRange(from: string, to: string) {
  return useQuery({
    queryKey: ['workouts', from, to],
    queryFn: () => fetchWorkoutsInRange(from, to),
  })
}

/**
 * Materialise planned sessions up to `through`, starting the day after the
 * program's `scheduled_through` watermark. Only ever fills forward, so a
 * session deliberately deleted (travel, illness) never reappears.
 */
async function generateSchedule(args: {
  programId: string
  startDate: string
  scheduledThrough: string | null
  templates: TemplateSchedule[]
  through: string
}): Promise<number> {
  const from = args.scheduledThrough ? addDays(args.scheduledThrough, 1) : args.startDate
  if (compareDates(from, args.through) > 0) return 0

  const occurrences = plannedOccurrences(args.templates, from, args.through)
  if (occurrences.length > 0) {
    const userId = await getCurrentUserId()
    const { error } = await supabase.from('workout').upsert(
      occurrences.map((o) => ({
        user_id: userId,
        program_id: args.programId,
        template_id: o.templateId,
        date: o.date,
        status: 'planned',
      })),
      { onConflict: 'user_id,template_id,date', ignoreDuplicates: true },
    )
    if (error) throw error
  }

  const { error: updateError } = await supabase
    .from('program')
    .update({ scheduled_through: args.through })
    .eq('id', args.programId)
  if (updateError) throw updateError

  return occurrences.length
}

export function useGenerateSchedule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: generateSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workouts'] })
      queryClient.invalidateQueries({ queryKey: ['program'] })
    },
  })
}

async function moveWorkout(args: { workoutId: string; date: string }): Promise<void> {
  const { error } = await supabase
    .from('workout')
    .update({ date: args.date })
    .eq('id', args.workoutId)
  if (error) throw error
}

export function useMoveWorkout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: moveWorkout,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workouts'] }),
  })
}

async function deleteWorkout(workoutId: string): Promise<void> {
  const { error } = await supabase.from('workout').delete().eq('id', workoutId)
  if (error) throw error
}

export function useDeleteWorkout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteWorkout,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workouts'] }),
  })
}
