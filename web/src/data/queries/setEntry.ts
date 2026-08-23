import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, getCurrentUserId } from '../supabaseClient'
import type { SetEntry } from '../types'

async function fetchSetEntries(workoutId: string): Promise<SetEntry[]> {
  const { data, error } = await supabase
    .from('set_entry')
    .select('*')
    .eq('workout_id', workoutId)
    .order('set_index', { ascending: true })

  if (error) throw error
  return data as SetEntry[]
}

export function useSetEntries(workoutId: string | undefined) {
  return useQuery({
    queryKey: ['set_entry', workoutId],
    queryFn: () => fetchSetEntries(workoutId as string),
    enabled: !!workoutId,
  })
}

export type SaveSetEntryInput = {
  id?: string
  workout_id: string
  exercise_id: string
  station_id: string | null
  set_index: number
  pin: number | null
  external_kg: number | null
  reps: number
  rir: number | null
  side: 'L' | 'R' | null
  is_warmup: boolean
  is_amrap: boolean
}

async function saveSetEntry(input: SaveSetEntryInput): Promise<SetEntry> {
  const userId = await getCurrentUserId()
  const { data, error } = await supabase
    .from('set_entry')
    .upsert({ ...input, user_id: userId })
    .select()
    .single()

  if (error) throw error
  return data as SetEntry
}

export function useSaveSetEntry(workoutId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: saveSetEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set_entry', workoutId] })
    },
  })
}
