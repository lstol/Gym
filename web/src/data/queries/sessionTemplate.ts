import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, getCurrentUserId } from '../supabaseClient'
import { addDays } from '../../domain/schedule'
import type { SessionTemplateWithItems } from '../types'

async function fetchSessionTemplate(templateId: string): Promise<SessionTemplateWithItems> {
  const { data, error } = await supabase
    .from('session_template')
    .select(
      `*, items:session_template_item(
        *, exercise:exercise_id(*, station:default_station_id(*, machine:machine_id(*)))
      )`,
    )
    .eq('id', templateId)
    .order('order', { referencedTable: 'items', ascending: true })
    .single()

  if (error) throw error
  return data as SessionTemplateWithItems
}

export function useSessionTemplate(templateId: string | undefined) {
  return useQuery({
    queryKey: ['session_template', templateId],
    queryFn: () => fetchSessionTemplate(templateId as string),
    enabled: !!templateId,
  })
}

/**
 * Changing which weekday a template runs on also has to carry every
 * already-materialised *planned* workout along with it — otherwise the
 * calendar keeps showing sessions on the old day until the forward-only
 * watermark eventually regenerates past them (it never does for dates
 * already filled). Completed and skipped sessions are left where they
 * actually happened; a skipped session is data, not a slot to relabel.
 */
async function updateTemplateWeekday(args: {
  templateId: string
  oldWeekday: number
  newWeekday: number
}): Promise<void> {
  if (args.oldWeekday === args.newWeekday) return

  const { error: templateError } = await supabase
    .from('session_template')
    .update({ weekday: args.newWeekday })
    .eq('id', args.templateId)
  if (templateError) throw templateError

  const userId = await getCurrentUserId()
  const { data: planned, error: fetchError } = await supabase
    .from('workout')
    .select('id, date')
    .eq('template_id', args.templateId)
    .eq('status', 'planned')
    .eq('user_id', userId)
  if (fetchError) throw fetchError

  const dayDelta = args.newWeekday - args.oldWeekday
  for (const w of planned ?? []) {
    const { error } = await supabase
      .from('workout')
      .update({ date: addDays(w.date as string, dayDelta) })
      .eq('id', w.id)
    if (error) throw error
  }
}

export function useUpdateTemplateWeekday() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateTemplateWeekday,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workouts'] })
      queryClient.invalidateQueries({ queryKey: ['program'] })
      queryClient.invalidateQueries({ queryKey: ['session_template'] })
    },
  })
}
