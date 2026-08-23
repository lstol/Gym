import { useState } from 'react'
import { nb } from '../../i18n/nb'
import type { SetEntry, Side } from '../../data/types'
import { useSaveSetEntry } from '../../data/queries/setEntry'

type SetRowProps = {
  workoutId: string
  exerciseId: string
  stationId: string | null
  setIndex: number
  side: Side | null
  sideLabel?: string
  existing: SetEntry | undefined
  pin: number | null
  externalKg: number | null
}

export function SetRow({
  workoutId,
  exerciseId,
  stationId,
  setIndex,
  side,
  sideLabel,
  existing,
  pin,
  externalKg,
}: SetRowProps) {
  const [id] = useState(() => existing?.id ?? crypto.randomUUID())
  const [reps, setReps] = useState(existing?.reps?.toString() ?? '')
  const [rir, setRir] = useState(existing?.rir?.toString() ?? '')
  const [warmup, setWarmup] = useState(existing?.is_warmup ?? false)
  const [savedAt, setSavedAt] = useState<number | null>(existing ? 1 : null)
  const saveSetEntry = useSaveSetEntry(workoutId)

  function handleSave() {
    if (reps === '') return
    saveSetEntry.mutate(
      {
        id,
        workout_id: workoutId,
        exercise_id: exerciseId,
        station_id: stationId,
        set_index: setIndex,
        pin,
        external_kg: externalKg,
        reps: Number(reps),
        rir: rir === '' ? null : Number(rir),
        side,
        is_warmup: warmup,
      },
      { onSuccess: () => setSavedAt(Date.now()) },
    )
  }

  return (
    <div className="flex items-center gap-2 rounded-lg bg-stone-100 px-2 py-2">
      <div className="w-10 shrink-0 text-center font-mono text-sm font-semibold text-stone-500">
        {setIndex}
        {sideLabel && <span className="ml-1 text-xs">{sideLabel}</span>}
      </div>
      <input
        type="text"
        inputMode="numeric"
        aria-label={nb.logger.reps}
        placeholder="–"
        value={reps}
        onChange={(e) => {
          setReps(e.target.value)
          setSavedAt(null)
        }}
        className="h-10 w-full min-w-0 rounded-lg border border-stone-300 bg-white text-center font-mono text-base"
      />
      <input
        type="text"
        inputMode="numeric"
        aria-label={nb.logger.rir}
        placeholder="–"
        value={rir}
        onChange={(e) => {
          setRir(e.target.value)
          setSavedAt(null)
        }}
        className="h-10 w-full min-w-0 rounded-lg border border-stone-300 bg-white text-center font-mono text-base"
      />
      <button
        type="button"
        aria-pressed={warmup}
        aria-label={nb.logger.warmup}
        onClick={() => {
          setWarmup((w) => !w)
          setSavedAt(null)
        }}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-xs font-bold ${
          warmup
            ? 'border-amber-400 bg-amber-100 text-amber-700'
            : 'border-stone-300 bg-white text-stone-300'
        }`}
      >
        W
      </button>
      <button
        type="button"
        onClick={handleSave}
        disabled={reps === '' || saveSetEntry.isPending}
        className={`h-10 shrink-0 rounded-lg px-3 text-xs font-semibold disabled:opacity-40 ${
          savedAt ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-900 text-white'
        }`}
      >
        {savedAt ? nb.logger.saved : nb.logger.save}
      </button>
    </div>
  )
}
