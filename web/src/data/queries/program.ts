import { useQuery } from '@tanstack/react-query'
import { supabase } from '../supabaseClient'
import type { ProgramWithTemplates } from '../types'

async function fetchActiveProgram(): Promise<ProgramWithTemplates | null> {
  const { data, error } = await supabase
    .from('program')
    .select(
      `*, session_templates:session_template(
        *, items:session_template_item(*, exercise:exercise_id(*))
      )`,
    )
    .eq('status', 'active')
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data as ProgramWithTemplates | null
}

export function useActiveProgram() {
  return useQuery({
    queryKey: ['program', 'active'],
    queryFn: fetchActiveProgram,
  })
}
