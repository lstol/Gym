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
  const [isSaved, setIsSaved] = useState(!!existing)
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
      { onSuccess: () => setIsSaved(true) },
    )
  }

  return (
    <div className="grid grid-cols-[2rem_1fr_1fr_2.5rem_4rem] items-center gap-2">
      <div className="text-center font-mono text-sm font-semibold text-stone-500">
        {setIndex}
        {sideLabel && <span className="ml-0.5 text-[10px]">{sideLabel}</span>}
      </div>
      <input
        type="text"
        inputMode="numeric"
        aria-label={`${nb.logger.reps} ${setIndex}`}
        placeholder="–"
        value={reps}
        onChange={(e) => {
          setReps(e.target.value)
          setIsSaved(false)
        }}
        className="h-11 w-full min-w-0 rounded-lg border border-stone-300 text-center font-mono text-base"
      />
      <input
        type="text"
        inputMode="numeric"
        aria-label={`${nb.logger.rir} ${setIndex}`}
        placeholder="–"
        value={rir}
        onChange={(e) => {
          setRir(e.target.value)
          setIsSaved(false)
        }}
        className="h-11 w-full min-w-0 rounded-lg border border-stone-300 text-center font-mono text-base"
      />
      <button
        type="button"
        role="checkbox"
        aria-checked={warmup}
        aria-label={`${nb.logger.warmup} ${setIndex}`}
        onClick={() => {
          setWarmup((w) => !w)
          setIsSaved(false)
        }}
        className={`h-11 w-full rounded-lg border text-xs font-bold ${
          warmup
            ? 'border-amber-400 bg-amber-100 text-amber-700'
            : 'border-stone-300 bg-white text-stone-300'
        }`}
      >
        ✓
      </button>
      <button
        type="button"
        onClick={handleSave}
        disabled={reps === '' || saveSetEntry.isPending}
        className={`h-11 rounded-lg text-xs font-semibold disabled:opacity-40 ${
          isSaved ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-900 text-white'
        }`}
      >
        {isSaved ? nb.logger.saved : nb.logger.save}
      </button>
    </div>
  )
}
