import { useState } from 'react'
import { nb } from '../../i18n/nb'
import { effectiveKg, isNearStationCeiling } from '../../domain/load'
import type { SessionTemplateItem, SetEntry, Side } from '../../data/types'
import { SetRow } from './SetRow'

export function ExerciseBlock({
  item,
  workoutId,
  existingSets,
}: {
  item: SessionTemplateItem
  workoutId: string
  existingSets: SetEntry[]
}) {
  const exercise = item.exercise
  const station = exercise?.station ?? undefined

  const lastLogged = existingSets.at(-1)
  const [pin, setPin] = useState(lastLogged?.pin ?? 1)
  const [externalKg, setExternalKg] = useState(lastLogged?.external_kg ?? 0)
  const [extraSets, setExtraSets] = useState(0)

  if (!exercise) return null

  const eff = exercise.load_source === 'stack' && station ? effectiveKg(pin, station.factor) : null
  const nearCeiling =
    eff !== null && station ? isNearStationCeiling(eff, station.max_effective_kg) : false

  const totalSets = item.target_sets + extraSets
  const sides: (Side | null)[] = exercise.is_unilateral ? ['L', 'R'] : [null]

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4">
      <header>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-stone-900">{exercise.name_nb}</h2>
          {station && (
            <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">
              {station.code.replace(/_/g, ' ')}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-stone-500">
          {nb.logger.target}: {item.target_sets} × {item.rep_min}–{item.rep_max} reps ·{' '}
          {item.rir_min}–{item.rir_max} RIR · {item.rest_sec}s
        </p>
        {item.note && <p className="mt-0.5 text-xs italic text-stone-400">{item.note}</p>}
      </header>

      {exercise.load_source === 'stack' && (
        <div className="mt-3 flex items-center justify-center gap-5 rounded-xl bg-stone-50 py-3">
          <button
            type="button"
            aria-label="Lavere pinne"
            onClick={() => setPin((p) => Math.max(1, p - 1))}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-stone-300 bg-white text-xl font-bold"
          >
            −
          </button>
          <div className="min-w-[7rem] text-center">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">
              {nb.logger.pin}
            </div>
            <div className="font-mono text-3xl font-bold leading-none text-stone-900">{pin}</div>
            {eff !== null && (
              <div className="mt-0.5 font-mono text-xs text-stone-500">
                ≈ {eff.toFixed(1).replace('.', ',')} kg
              </div>
            )}
          </div>
          <button
            type="button"
            aria-label="Høyere pinne"
            onClick={() => setPin((p) => Math.min(15, p + 1))}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-900 text-xl font-bold text-white"
          >
            +
          </button>
        </div>
      )}

      {nearCeiling && (
        <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
          {nb.logger.ceilingWarning}
        </p>
      )}

      {exercise.load_source === 'external' && (
        <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-stone-50 py-3">
          <label htmlFor={`kg-${item.id}`} className="text-xs font-semibold text-stone-500">
            {nb.logger.externalKg}
          </label>
          <input
            id={`kg-${item.id}`}
            type="text"
            inputMode="decimal"
            value={externalKg}
            onChange={(e) => setExternalKg(Number(e.target.value) || 0)}
            className="w-20 rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-center font-mono text-lg"
          />
          <span className="text-xs text-stone-500">kg</span>
        </div>
      )}

      {exercise.load_source === 'bodyweight' && (
        <p className="mt-3 rounded-xl bg-stone-50 py-2 text-center text-xs text-stone-500">
          {nb.logger.bodyweight}
        </p>
      )}

      <div className="mt-3">
        <div className="grid grid-cols-[2rem_1fr_1fr_2.5rem_4rem] items-end gap-2 px-1 pb-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">
            {nb.logger.setNumber}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">
            {nb.logger.reps}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">
            {nb.logger.rir}
          </span>
          <span className="text-center text-[10px] font-semibold uppercase tracking-wide text-stone-400">
            {nb.logger.warmup}
          </span>
          <span />
        </div>

        <div className="space-y-1.5">
          {Array.from({ length: totalSets }, (_, i) => i + 1).flatMap((setIndex) =>
            sides.map((side) => (
              <SetRow
                key={`${setIndex}-${side}`}
                workoutId={workoutId}
                exerciseId={exercise.id}
                stationId={station?.id ?? null}
                setIndex={setIndex}
                side={side}
                sideLabel={side ?? undefined}
                existing={existingSets.find((s) => s.set_index === setIndex && s.side === side)}
                pin={exercise.load_source === 'stack' ? pin : null}
                externalKg={exercise.load_source === 'external' ? externalKg : null}
              />
            )),
          )}
        </div>

        <button
          type="button"
          onClick={() => setExtraSets((n) => n + 1)}
          className="mt-2 w-full rounded-lg border border-dashed border-stone-300 py-2 text-xs font-medium text-stone-500"
        >
          + {nb.logger.addSet}
        </button>
      </div>
    </section>
  )
}
