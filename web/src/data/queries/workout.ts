import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, getCurrentUserId } from '../supabaseClient'
import type { Workout, WorkoutStatus } from '../types'

async function fetchWorkout(templateId: string, date: string): Promise<Workout | null> {
  const { data, error } = await supabase
    .from('workout')
    .select('*')
    .eq('template_id', templateId)
    .eq('date', date)
    .maybeSingle()

  if (error) throw error
  return data as Workout | null
}

export function useWorkout(templateId: string | undefined, date: string) {
  return useQuery({
    queryKey: ['workout', templateId, date],
    queryFn: () => fetchWorkout(templateId as string, date),
    enabled: !!templateId,
  })
}

async function fetchWorkoutById(workoutId: string): Promise<Workout> {
  const { data, error } = await supabase.from('workout').select('*').eq('id', workoutId).single()
  if (error) throw error
  return data as Workout
}

export function useWorkoutById(workoutId: string | undefined) {
  return useQuery({
    queryKey: ['workout', 'id', workoutId],
    queryFn: () => fetchWorkoutById(workoutId as string),
    enabled: !!workoutId,
  })
}

async function createWorkout(args: {
  programId: string
  templateId: string
  date: string
}): Promise<Workout> {
  const userId = await getCurrentUserId()
  const { data, error } = await supabase
    .from('workout')
    .insert({
      user_id: userId,
      program_id: args.programId,
      template_id: args.templateId,
      date: args.date,
      status: 'planned',
    })
    .select()
    .single()

  if (error) throw error
  return data as Workout
}

export function useCreateWorkout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createWorkout,
    onSuccess: (workout) => {
      queryClient.setQueryData(['workout', workout.template_id, workout.date], workout)
    },
  })
}

async function setWorkoutStatus(workoutId: string, status: WorkoutStatus): Promise<Workout> {
  const { data, error } = await supabase
    .from('workout')
    .update({ status })
    .eq('id', workoutId)
    .select()
    .single()

  if (error) throw error
  return data as Workout
}

export function useSetWorkoutStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { workoutId: string; status: WorkoutStatus }) =>
      setWorkoutStatus(args.workoutId, args.status),
    onSuccess: (workout) => {
      queryClient.setQueryData(['workout', workout.template_id, workout.date], workout)
    },
  })
}
