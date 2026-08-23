import { useQuery } from '@tanstack/react-query'
import { supabase } from '../supabaseClient'
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
