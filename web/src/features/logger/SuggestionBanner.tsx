import { nb } from '../../i18n/nb'
import type { Suggestion } from '../../domain/progression'

function kg(v: number | null): string {
  return v === null ? '' : v.toFixed(1).replace('.', ',')
}

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ''))
}

/**
 * One line, always with a reason — the user must see *why* without opening
 * anything. The engine proposes; "Bruk" only pre-sets the pin control and
 * writes nothing.
 */
export function SuggestionBanner({
  suggestion,
  stationMaxKg,
  onApply,
}: {
  suggestion: Suggestion
  stationMaxKg: number | null
  onApply: (pin: number | null) => void
}) {
  if (suggestion.reason === 'no_history') return null

  const s = suggestion
  const t = nb.suggestion
  let text = ''

  switch (s.reason) {
    case 'progress_load':
      text = fill(t.progressLoad, {
        pin: s.pin ?? '',
        kg: kg(s.nextEffectiveKg),
        predictedReps: s.predictedReps ?? '',
      })
      break
    case 'progress_reps':
      text = fill(t.progressReps, { reps: s.targetReps ?? '' })
      break
    case 'failure_below_target':
      text = fill(t.failureBelowTarget, { reps: s.targetReps ?? '' })
      break
    case 'ragged_sets':
      text = fill(t.raggedSets, { reps: s.lastReps.join('/') })
      break
    case 'consolidate':
      text = t.consolidate
      break
    case 'stalled':
      text = fill(t.stalled, { n: s.stalledSessions, pin: s.pin ?? '' })
      break
    case 'station_ceiling':
      text = fill(t.stationCeiling, {
        kg: kg(s.currentEffectiveKg),
        max: stationMaxKg === null ? '' : kg(stationMaxKg),
      })
      break
    case 'calibrating':
      text = t.calibrating
      break
    case 'calibration_jump':
      text = fill(t.calibrationJump, {
        n: (s.pin ?? 0) - 0,
        pin: s.pin ?? '',
        kg: kg(s.nextEffectiveKg),
      })
      break
  }

  const isWarning = s.reason === 'station_ceiling' || s.reason === 'stalled'
  const showApply = s.pin !== null && (s.reason === 'progress_load' || s.reason === 'calibration_jump')

  return (
    <div
      className={`mt-2 rounded-xl border px-3 py-2 ${
        isWarning ? 'border-warn/30 bg-warn-soft' : 'border-brand/25 bg-brand-soft'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className={`text-[10px] font-semibold uppercase tracking-wide ${
              isWarning ? 'text-warn' : 'text-brand'
            }`}
          >
            {t.title}
          </p>
          <p className={`text-sm font-medium ${isWarning ? 'text-warn' : 'text-brand-dark'}`}>
            {text}
          </p>
          {s.fromRirEstimate && <p className="mt-0.5 text-[11px] text-brand/80">{t.rirEstimate}</p>}
          {s.jumpSplit && <p className="mt-0.5 text-[11px] text-brand/80">{t.jumpSplit}</p>}
          {s.lastDate && <p className="mt-0.5 text-[11px] text-brand/70">{t.basedOn} {s.lastDate}</p>}
        </div>

        {showApply && (
          <button
            type="button"
            onClick={() => onApply(s.pin)}
            className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white"
          >
            {t.apply}
          </button>
        )}
      </div>
    </div>
  )
}
