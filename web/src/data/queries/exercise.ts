import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, getCurrentUserId } from '../supabaseClient'
import type { Exercise } from '../types'

async function fetchExercises(): Promise<Exercise[]> {
  const { data, error } = await supabase
    .from('exercise')
    .select('*, station:default_station_id(*, machine:machine_id(*))')
    .order('name_nb', { ascending: true })

  if (error) throw error
  return data as Exercise[]
}

export function useExercises() {
  return useQuery({ queryKey: ['exercise'], queryFn: fetchExercises })
}

async function addTemplateItem(args: {
  templateId: string
  exerciseId: string
  order: number
}): Promise<void> {
  const userId = await getCurrentUserId()
  const { error } = await supabase.from('session_template_item').insert({
    user_id: userId,
    template_id: args.templateId,
    exercise_id: args.exerciseId,
    order: args.order,
    target_sets: 3,
    rep_min: 8,
    rep_max: 12,
    rest_sec: 90,
    rir_min: 1,
    rir_max: 3,
    is_optional: false,
  })
  if (error) throw error
}

export function useAddTemplateItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: addTemplateItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['program'] })
      queryClient.invalidateQueries({ queryKey: ['session_template'] })
    },
  })
}

async function removeTemplateItem(itemId: string): Promise<void> {
  const { error } = await supabase.from('session_template_item').delete().eq('id', itemId)
  if (error) throw error
}

export function useRemoveTemplateItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: removeTemplateItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['program'] })
      queryClient.invalidateQueries({ queryKey: ['session_template'] })
    },
  })
}
