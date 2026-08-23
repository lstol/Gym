import { nb } from '../../i18n/nb'
import type { Suggestion } from '../../domain/progression'

function kg(v: number | null): string {
  return v === null ? '' : `${v.toFixed(1).replace('.', ',')} kg`
}

/**
 * The engine proposes; the user decides. Nothing here writes anything — the
 * "bruk" action only pre-sets the controls (CLAUDE.md rule 5).
 */
export function SuggestionBanner({
  suggestion,
  onApply,
}: {
  suggestion: Suggestion
  onApply: (pin: number | null) => void
}) {
  if (suggestion.kind === 'no_history') return null

  const showApply = suggestion.pin !== null && suggestion.kind !== 'at_stack_max'

  return (
    <div className="mt-2 rounded-xl border border-brand/25 bg-brand-soft px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-brand">
            {nb.suggestion.title}
          </p>

          {suggestion.kind === 'increase_load' && (
            <p className="text-sm font-semibold text-brand-dark">
              {nb.logger.pin} {suggestion.pin} · {kg(suggestion.nextEffectiveKg)}
              <span className="ml-1 font-normal text-brand">
                ({nb.suggestion.estimated} {suggestion.predictedReps} {nb.suggestion.reps})
              </span>
            </p>
          )}

          {suggestion.kind === 'increase_reps' && (
            <p className="text-sm font-semibold text-brand-dark">
              {suggestion.pin !== null
                ? `${nb.logger.pin} ${suggestion.pin} · ${kg(suggestion.currentEffectiveKg)} · `
                : ''}
              {suggestion.targetReps} {nb.suggestion.reps}
            </p>
          )}

          {suggestion.kind === 'stalled' && (
            <p className="text-sm font-semibold text-brand-dark">
              {nb.suggestion.stalled} — {nb.logger.pin} {suggestion.pin} ·{' '}
              {kg(suggestion.nextEffectiveKg)}
            </p>
          )}

          {suggestion.kind === 'at_stack_max' && (
            <p className="text-sm font-semibold text-brand-dark">{nb.suggestion.atStackMax}</p>
          )}

          {suggestion.lastDate && (
            <p className="mt-0.5 text-[11px] text-brand/80">
              {nb.suggestion.basedOn} {suggestion.lastDate}
            </p>
          )}
        </div>

        {showApply && (
          <button
            type="button"
            onClick={() => onApply(suggestion.pin)}
            className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white"
          >
            {nb.suggestion.apply}
          </button>
        )}
      </div>

      {suggestion.rangeAdvisory && (
        <p className="mt-1.5 rounded-lg bg-warn-soft px-2 py-1 text-[11px] text-warn">
          {nb.suggestion.rangeAdvisory
            .replace('{min}', String(suggestion.rangeAdvisory.suggestedMin))
            .replace('{max}', String(suggestion.rangeAdvisory.suggestedMax))}
        </p>
      )}

      {suggestion.atCeiling && (
        <p className="mt-1.5 rounded-lg bg-warn-soft px-2 py-1 text-[11px] text-warn">
          {nb.suggestion.ceiling}
        </p>
      )}
    </div>
  )
}
