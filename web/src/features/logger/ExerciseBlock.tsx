import { useState } from 'react'
import { nb } from '../../i18n/nb'
import { effectiveKg, isNearStationCeiling } from '../../domain/load'
import type { SessionTemplateItem, SetEntry, Side } from '../../data/types'
import type { LastPerformance } from '../../data/queries/lastSets'
import type { Suggestion } from '../../domain/progression'
import { SetRow } from './SetRow'
import { SuggestionBanner } from './SuggestionBanner'

export function ExerciseBlock({
  item,
  workoutId,
  existingSets,
  last,
  suggestion,
}: {
  item: SessionTemplateItem
  workoutId: string
  existingSets: SetEntry[]
  last?: LastPerformance
  suggestion?: Suggestion
}) {
  const exercise = item.exercise
  const station = exercise?.station ?? undefined

  // Start from what's already logged today; failing that, from what was done
  // last time this exercise came up.
  const loggedToday = existingSets.at(-1)
  const [pin, setPin] = useState(loggedToday?.pin ?? last?.pin ?? 1)
  const [externalKg, setExternalKg] = useState(loggedToday?.external_kg ?? last?.externalKg ?? 0)
  const [extraSets, setExtraSets] = useState(0)

  if (!exercise) return null

  const eff = exercise.load_source === 'stack' && station ? effectiveKg(pin, station.factor) : null
  const nearCeiling =
    eff !== null && station ? isNearStationCeiling(eff, station.max_effective_kg) : false

  const totalSets = item.target_sets + extraSets
  const sides: (Side | null)[] = exercise.is_unilateral ? ['L', 'R'] : [null]

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <header>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-ink">{exercise.name_nb}</h2>
          {station && (
            <span className="shrink-0 rounded-full bg-sunken px-2 py-0.5 text-[11px] font-medium text-muted">
              {station.code.replace(/_/g, ' ')}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted">
          {nb.logger.target}: {item.target_sets} × {item.rep_min}–{item.rep_max} reps ·{' '}
          {item.rir_min}–{item.rir_max} RIR · {item.rest_sec}s
        </p>
        {item.note && <p className="mt-0.5 text-xs italic text-faint">{item.note}</p>}
        {last && (
          <p className="mt-1 text-xs text-brand">
            {nb.logger.lastTime} {last.date}:{' '}
            {last.pin !== null
              ? `${nb.logger.pin.toLowerCase()} ${last.pin}`
              : last.externalKg
                ? `${last.externalKg} kg`
                : nb.logger.bodyweight.toLowerCase()}{' '}
            · {[...last.bySetIndex.values()].map((s) => s.reps).join('/')} reps
          </p>
        )}
        {suggestion && (
          <SuggestionBanner
            suggestion={suggestion}
            stationMaxKg={station?.max_effective_kg ?? null}
            onApply={(nextPin) => {
              if (nextPin !== null) setPin(nextPin)
            }}
          />
        )}
      </header>

      {exercise.load_source === 'stack' && (
        <div className="mt-3 flex items-center justify-center gap-5 rounded-xl bg-sunken py-3">
          <button
            type="button"
            aria-label="Lavere pinne"
            onClick={() => setPin((p) => Math.max(1, p - 1))}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-xl font-bold"
          >
            −
          </button>
          <div className="min-w-[7rem] text-center">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-faint">
              {nb.logger.pin}
            </div>
            <div className="font-mono text-3xl font-bold leading-none text-ink">{pin}</div>
            {eff !== null && (
              <div className="mt-0.5 font-mono text-xs text-muted">
                ≈ {eff.toFixed(1).replace('.', ',')} kg
              </div>
            )}
          </div>
          <button
            type="button"
            aria-label="Høyere pinne"
            onClick={() => setPin((p) => Math.min(15, p + 1))}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-brand text-xl font-bold text-white"
          >
            +
          </button>
        </div>
      )}

      {nearCeiling && (
        <p className="mt-2 rounded-lg bg-warn-soft px-2 py-1 text-xs font-medium text-warn">
          {nb.logger.ceilingWarning}
        </p>
      )}

      {exercise.load_source === 'external' && (
        <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-sunken py-3">
          <label htmlFor={`kg-${item.id}`} className="text-xs font-semibold text-muted">
            {nb.logger.externalKg}
          </label>
          <input
            id={`kg-${item.id}`}
            type="text"
            inputMode="decimal"
            value={externalKg}
            onChange={(e) => setExternalKg(Number(e.target.value) || 0)}
            className="w-20 rounded-lg border border-line bg-surface px-2 py-1.5 text-center font-mono text-lg"
          />
          <span className="text-xs text-muted">kg</span>
        </div>
      )}

      {exercise.load_source === 'bodyweight' && (
        <p className="mt-3 rounded-xl bg-sunken py-2 text-center text-xs text-muted">
          {nb.logger.bodyweight}
        </p>
      )}

      <div className="mt-3">
        <div className="grid grid-cols-[2rem_1fr_1fr_2rem] items-end gap-2 px-1 pb-1">
          <span className="text-center text-[10px] font-semibold uppercase tracking-wide text-faint">
            {nb.logger.setNumber}
          </span>
          <span className="text-center text-[10px] font-semibold uppercase tracking-wide text-faint">
            {nb.logger.reps}
          </span>
          <span className="text-center text-[10px] font-semibold uppercase tracking-wide text-faint">
            {nb.logger.rir}
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
                suggested={last?.bySetIndex.get(setIndex)}
                offerAmrap={suggestion?.requestAmrap === true && setIndex === totalSets}
                pin={exercise.load_source === 'stack' ? pin : null}
                externalKg={exercise.load_source === 'external' ? externalKg : null}
              />
            )),
          )}
        </div>

        <button
          type="button"
          onClick={() => setExtraSets((n) => n + 1)}
          className="mt-2 w-full rounded-lg border border-dashed border-line py-2 text-xs font-medium text-muted"
        >
          + {nb.logger.addSet}
        </button>
      </div>
    </section>
  )
}
