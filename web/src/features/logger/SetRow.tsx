import { useEffect, useRef, useState } from 'react'
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
  /** What was done for this set index last session, if anything. */
  suggested?: { reps: number; rir: number | null }
  pin: number | null
  externalKg: number | null
}

const AUTOSAVE_DELAY_MS = 700

export function SetRow({
  workoutId,
  exerciseId,
  stationId,
  setIndex,
  side,
  sideLabel,
  existing,
  suggested,
  pin,
  externalKg,
}: SetRowProps) {
  const [id] = useState(() => existing?.id ?? crypto.randomUUID())

  // Already logged today wins; otherwise start from last session's numbers.
  const [reps, setReps] = useState(
    existing?.reps?.toString() ?? suggested?.reps?.toString() ?? '',
  )
  const [rir, setRir] = useState(
    existing?.rir?.toString() ?? suggested?.rir?.toString() ?? '',
  )
  const [saved, setSaved] = useState(!!existing)
  const saveSetEntry = useSaveSetEntry(workoutId)

  // Values carried over from last session are a starting point, not a record —
  // they stay unsaved until the user edits them or taps to confirm, so sets
  // that were never performed never end up in the log.
  const isSuggestion = !existing && !!suggested && !saved
  const dirty = useRef(false)

  function save() {
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
        is_warmup: false,
      },
      { onSuccess: () => setSaved(true) },
    )
  }

  useEffect(() => {
    if (!dirty.current || reps === '') return
    const handle = setTimeout(save, AUTOSAVE_DELAY_MS)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reps, rir, pin, externalKg])

  function onEdit(setter: (v: string) => void, value: string) {
    dirty.current = true
    setSaved(false)
    setter(value)
  }

  const inputTone = isSuggestion ? 'text-faint italic' : 'text-ink'

  return (
    <div className="grid grid-cols-[2rem_1fr_1fr_2rem] items-center gap-2">
      <div className="tnum text-center text-sm font-semibold text-faint">
        {setIndex}
        {sideLabel && <span className="ml-0.5 text-[10px]">{sideLabel}</span>}
      </div>
      <input
        type="text"
        inputMode="numeric"
        aria-label={`${nb.logger.reps} ${setIndex}`}
        placeholder="–"
        value={reps}
        onChange={(e) => onEdit(setReps, e.target.value)}
        className={`tnum h-11 w-full min-w-0 rounded-lg border border-line bg-surface text-center text-base focus:border-brand focus:outline-none ${inputTone}`}
      />
      <input
        type="text"
        inputMode="numeric"
        aria-label={`${nb.logger.rir} ${setIndex}`}
        placeholder="–"
        value={rir}
        onChange={(e) => onEdit(setRir, e.target.value)}
        className={`tnum h-11 w-full min-w-0 rounded-lg border border-line bg-surface text-center text-base focus:border-brand focus:outline-none ${inputTone}`}
      />

      {saved ? (
        <span className="text-center text-sm text-done" aria-label={nb.logger.saved}>
          ✓
        </span>
      ) : isSuggestion ? (
        <button
          type="button"
          onClick={save}
          aria-label={`${nb.logger.confirm} ${setIndex}`}
          title={nb.logger.confirm}
          className="h-8 w-8 rounded-lg border border-brand text-sm font-bold text-brand"
        >
          ✓
        </button>
      ) : (
        <span className="text-center text-sm text-faint">
          {saveSetEntry.isPending ? '…' : ''}
        </span>
      )}
    </div>
  )
}
