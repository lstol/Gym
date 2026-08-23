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
  pin,
  externalKg,
}: SetRowProps) {
  const [id] = useState(() => existing?.id ?? crypto.randomUUID())
  const [reps, setReps] = useState(existing?.reps?.toString() ?? '')
  const [rir, setRir] = useState(existing?.rir?.toString() ?? '')
  const [saved, setSaved] = useState(!!existing)
  const saveSetEntry = useSaveSetEntry(workoutId)

  // Autosave: no Save button. Debounced so a row isn't written on every
  // keystroke, and never written while reps is still empty.
  const dirty = useRef(false)

  useEffect(() => {
    // Only write once the user has actually touched this row — mounting an
    // already-logged set must not re-save it.
    if (!dirty.current || reps === '') return

    const handle = setTimeout(() => {
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
    }, AUTOSAVE_DELAY_MS)

    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reps, rir, pin, externalKg])

  function onEdit(setter: (v: string) => void, value: string) {
    dirty.current = true
    setSaved(false)
    setter(value)
  }

  const hasValue = reps !== ''

  return (
    <div className="grid grid-cols-[2rem_1fr_1fr_1.75rem] items-center gap-2">
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
        className="tnum h-11 w-full min-w-0 rounded-lg border border-line bg-surface text-center text-base focus:border-brand focus:outline-none"
      />
      <input
        type="text"
        inputMode="numeric"
        aria-label={`${nb.logger.rir} ${setIndex}`}
        placeholder="–"
        value={rir}
        onChange={(e) => onEdit(setRir, e.target.value)}
        className="tnum h-11 w-full min-w-0 rounded-lg border border-line bg-surface text-center text-base focus:border-brand focus:outline-none"
      />
      <span
        aria-live="polite"
        aria-label={saved ? nb.logger.saved : undefined}
        className="text-center text-sm"
        title={saved ? nb.logger.saved : undefined}
      >
        {saved && hasValue ? (
          <span className="text-done">✓</span>
        ) : saveSetEntry.isPending ? (
          <span className="text-faint">…</span>
        ) : null}
      </span>
    </div>
  )
}
