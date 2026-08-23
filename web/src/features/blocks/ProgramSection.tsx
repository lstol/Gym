import { useState } from 'react'
import { nb } from '../../i18n/nb'
import type { ProgramWithTemplates } from '../../data/types'
import { useExercises, useAddTemplateItem, useRemoveTemplateItem } from '../../data/queries/exercise'

export function ProgramSection({ program }: { program: ProgramWithTemplates }) {
  const [editing, setEditing] = useState(false)
  const { data: exercises } = useExercises()
  const addItem = useAddTemplateItem()
  const removeItem = useRemoveTemplateItem()

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-stone-900">{program.name}</h2>
          <p className="text-xs text-stone-500">
            {program.start_date} → {program.end_date ?? nb.program.openEnded}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing((e) => !e)}
          className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium"
        >
          {editing ? nb.program.done : nb.program.edit}
        </button>
      </div>

      <div className="mt-3 space-y-3">
        {program.session_templates
          .slice()
          .sort((a, b) => a.code.localeCompare(b.code))
          .map((t) => {
            const usedIds = t.items.map((i) => i.exercise_id)
            const available = (exercises ?? []).filter((e) => !usedIds.includes(e.id))
            const nextOrder = Math.max(0, ...t.items.map((i) => i.order)) + 1

            return (
              <div key={t.id} className="rounded-xl bg-stone-50 p-3">
                <p className="text-sm font-semibold text-stone-900">
                  {t.code} — {t.name_nb}
                </p>
                <ul className="mt-2 divide-y divide-stone-200">
                  {t.items
                    .slice()
                    .sort((a, b) => a.order - b.order)
                    .map((item) => (
                      <li key={item.id} className="flex items-center justify-between py-1.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-stone-800">
                            {item.exercise?.name_nb ?? '—'}
                          </p>
                          <p className="text-xs text-stone-500">
                            {item.target_sets} {nb.program.sets} · {item.rep_min}–{item.rep_max} reps
                          </p>
                        </div>
                        {editing && (
                          <button
                            type="button"
                            onClick={() => removeItem.mutate(item.id)}
                            className="ml-2 shrink-0 rounded-lg border border-stone-300 px-2 py-1 text-xs text-red-600"
                          >
                            {nb.program.removeExercise}
                          </button>
                        )}
                      </li>
                    ))}
                </ul>

                {editing && available.length > 0 && (
                  <select
                    aria-label={nb.program.addExercise}
                    value=""
                    onChange={(e) => {
                      if (!e.target.value) return
                      addItem.mutate({
                        templateId: t.id,
                        exerciseId: e.target.value,
                        order: nextOrder,
                      })
                    }}
                    className="mt-2 w-full rounded-lg border border-stone-300 px-2 py-1.5 text-sm"
                  >
                    <option value="">+ {nb.program.addExercise}</option>
                    {available.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name_nb}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )
          })}
      </div>
    </section>
  )
}
