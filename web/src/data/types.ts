// Hand-written row types for phase 1. Once the schema is live, replace with
// `supabase gen types typescript` output and keep these as a thin re-export.

export type CalibrationStatus = 'spec' | 'measured'

export type Station = {
  id: string
  machine_id: string
  code: string
  factor: number
  max_effective_kg: number
  calibration_status: CalibrationStatus
  note: string | null
}

export type LoadSource = 'stack' | 'bodyweight' | 'external'

export type Exercise = {
  id: string
  slug: string
  name_nb: string
  muscle_group: string
  is_unilateral: boolean
  default_station_id: string | null
  load_source: LoadSource
}

export type ProgramStatus = 'planned' | 'active' | 'completed'

export type Program = {
  id: string
  name: string
  start_date: string
  end_date: string
  status: ProgramStatus
  notes: string | null
}

export type SessionTemplate = {
  id: string
  program_id: string
  code: string
  name_nb: string
  weekday: number
}

export type SessionTemplateItem = {
  id: string
  template_id: string
  exercise_id: string
  order: number
  target_sets: number
  rep_min: number
  rep_max: number
  rest_sec: number
  rir_min: number
  rir_max: number
  is_optional: boolean
  note: string | null
  exercise?: Exercise
}

export type SessionTemplateWithItems = SessionTemplate & {
  items: SessionTemplateItem[]
}

export type ProgramWithTemplates = Program & {
  session_templates: SessionTemplateWithItems[]
}
