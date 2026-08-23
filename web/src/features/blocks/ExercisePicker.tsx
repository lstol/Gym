import { useMemo, useState } from 'react'
import { nb } from '../../i18n/nb'
import { useExercises, useCreateCustomExercise } from '../../data/queries/exercise'
import type { Exercise, LoadSource } from '../../data/types'

/**
 * Search the catalog, or define an exercise the machine's own chart doesn't
 * cover. Custom exercises are private to the user (RLS on exercise.user_id).
 */
export function ExercisePicker({
  excludeIds,
  onPick,
  onCancel,
}: {
  excludeIds: string[]
  onPick: (exercise: Exercise) => void
  onCancel: () => void
}) {
  const { data: exercises } = useExercises()
  const createCustom = useCreateCustomExercise()
  const [query, setQuery] = useState('')
  const [customMode, setCustomMode] = useState(false)
  const [customLoad, setCustomLoad] = useState<LoadSource>('external')

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (exercises ?? [])
      .filter((e) => !excludeIds.includes(e.id))
      .filter((e) => (q ? e.name_nb.toLowerCase().includes(q) : true))
  }, [exercises, excludeIds, query])

  async function handleCreateCustom() {
    const name = query.trim()
    if (!name) return
    const created = await createCustom.mutateAsync({
      name,
      loadSource: customLoad,
      stationId: null,
    })
    onPick(created)
  }

  return (
    <div className="mt-2 rounded-xl border border-line bg-surface p-3">
      <input
        type="search"
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={nb.program.searchPlaceholder}
        className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm"
      />

      {!customMode && (
        <>
          <ul className="mt-2 max-h-56 space-y-0.5 overflow-y-auto">
            {matches.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => onPick(e)}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm hover:bg-sunken"
                >
                  <span className="truncate">{e.name_nb}</span>
                  <span className="ml-2 shrink-0 text-[10px] uppercase tracking-wide text-faint">
                    {e.station?.code.replace(/_/g, ' ') ??
                      (e.load_source === 'bodyweight' ? nb.logger.bodyweight : nb.program.dumbbell)}
                  </span>
                </button>
              </li>
            ))}
            {matches.length === 0 && (
              <li className="px-2 py-2 text-sm text-faint">{nb.program.noMatches}</li>
            )}
          </ul>

          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setCustomMode(true)}
              className="flex-1 rounded-lg border border-line px-3 py-2 text-xs font-medium text-brand"
            >
              + {nb.program.otherExercise}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-line px-3 py-2 text-xs font-medium text-muted"
            >
              {nb.program.cancel}
            </button>
          </div>
        </>
      )}

      {customMode && (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-muted">{nb.program.otherExerciseHelp}</p>
          <div className="flex gap-1.5">
            {(
              [
                ['external', nb.program.dumbbell],
                ['bodyweight', nb.logger.bodyweight],
                ['stack', nb.program.stack],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setCustomLoad(value)}
                className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium ${
                  customLoad === value
                    ? 'border-brand bg-brand-soft text-brand-dark'
                    : 'border-line text-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!query.trim() || createCustom.isPending}
              onClick={() => void handleCreateCustom()}
              className="flex-1 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
            >
              {nb.program.createAndAdd}
            </button>
            <button
              type="button"
              onClick={() => setCustomMode(false)}
              className="rounded-lg border border-line px-3 py-2 text-xs font-medium text-muted"
            >
              {nb.program.back}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
