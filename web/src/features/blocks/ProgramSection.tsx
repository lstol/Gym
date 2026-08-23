import { useState } from 'react'
import { nb } from '../../i18n/nb'
import type { ProgramWithTemplates } from '../../data/types'
import { useAddTemplateItem, useRemoveTemplateItem } from '../../data/queries/exercise'
import { ExercisePicker } from './ExercisePicker'
import { SESSION_ACCENT } from '../calendar/sessionAccent'

export function ProgramSection({ program }: { program: ProgramWithTemplates }) {
  const [editing, setEditing] = useState(false)
  const [pickerFor, setPickerFor] = useState<string | null>(null)
  const addItem = useAddTemplateItem()
  const removeItem = useRemoveTemplateItem()

  return (
    <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink">{program.name}</h2>
          <p className="text-xs text-faint">
            {program.start_date} → {program.end_date ?? nb.program.openEnded}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing((e) => !e)
            setPickerFor(null)
          }}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
            editing ? 'bg-brand text-white' : 'border border-line text-muted'
          }`}
        >
          {editing ? nb.program.done : nb.program.edit}
        </button>
      </div>

      <div className="mt-3 space-y-3">
        {program.session_templates
          .slice()
          .sort((a, b) => a.code.localeCompare(b.code))
          .map((t) => {
            const accent = SESSION_ACCENT[t.code] ?? SESSION_ACCENT.default
            const usedIds = t.items.map((i) => i.exercise_id)
            const nextOrder = Math.max(0, ...t.items.map((i) => i.order)) + 1

            return (
              <div key={t.id} className="rounded-xl bg-sunken p-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold text-white ${accent.bg}`}
                  >
                    {t.code}
                  </span>
                  <p className="text-sm font-semibold text-ink">{t.name_nb}</p>
                </div>

                <ul className="mt-2 divide-y divide-line">
                  {t.items
                    .slice()
                    .sort((a, b) => a.order - b.order)
                    .map((item) => (
                      <li key={item.id} className="flex items-center justify-between py-1.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-ink">
                            {item.exercise?.name_nb ?? '—'}
                          </p>
                          <p className="tnum text-xs text-faint">
                            {item.target_sets} {nb.program.sets} · {item.rep_min}–{item.rep_max} reps
                          </p>
                        </div>
                        {editing && (
                          <button
                            type="button"
                            onClick={() => removeItem.mutate(item.id)}
                            className="ml-2 shrink-0 rounded-lg border border-line px-2 py-1 text-xs text-danger"
                          >
                            {nb.program.removeExercise}
                          </button>
                        )}
                      </li>
                    ))}
                </ul>

                {editing &&
                  (pickerFor === t.id ? (
                    <ExercisePicker
                      excludeIds={usedIds}
                      onCancel={() => setPickerFor(null)}
                      onPick={(exercise) => {
                        addItem.mutate({
                          templateId: t.id,
                          exerciseId: exercise.id,
                          order: nextOrder,
                        })
                        setPickerFor(null)
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPickerFor(t.id)}
                      className="mt-2 w-full rounded-lg border border-dashed border-line py-2 text-xs font-medium text-brand"
                    >
                      + {nb.program.addExercise}
                    </button>
                  ))}
              </div>
            )
          })}
      </div>
    </section>
  )
}
