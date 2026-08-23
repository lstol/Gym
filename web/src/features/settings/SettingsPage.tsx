import { Link } from 'react-router-dom'
import { nb } from '../../i18n/nb'
import { useAuth } from '../../data/auth'
import { useEpleyKSummary } from '../../data/queries/repCostObservation'

export function SettingsPage() {
  const { signOut } = useAuth()
  const { data: epleyK } = useEpleyKSummary()

  return (
    <div className="mx-auto max-w-md space-y-4 p-4 pb-16">
      <header className="flex items-center justify-between px-1 pt-2">
        <h1 className="text-xl font-semibold text-ink">{nb.settings.title}</h1>
        <Link to="/" className="text-sm text-muted underline">
          {nb.logger.back}
        </Link>
      </header>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold text-ink">{nb.settings.repCostTitle}</h2>
        <p className="mt-1 text-xs text-muted">{nb.settings.repCostHelp}</p>
        <p className="mt-1 text-xs italic text-faint">{nb.settings.repCostCaveat}</p>

        {(epleyK ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-faint">{nb.settings.repCostEmpty}</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {(epleyK ?? []).map((row) => (
              <li key={row.exerciseId} className="flex items-center justify-between py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink">{row.name}</p>
                  <p className="text-xs text-faint">
                    {row.observations}{' '}
                    {row.observations === 1 ? nb.settings.observation : nb.settings.observations}
                    {row.isDefault ? ` · ${nb.settings.usingDefault}` : ''}
                  </p>
                </div>
                <span className="tnum shrink-0 text-sm font-semibold text-brand">
                  k = {row.k.toFixed(1).replace('.', ',')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <dl className="space-y-1 text-sm">
          <dt className="text-muted">{nb.settings.buildHash}</dt>
          <dd className="font-mono text-ink">{__BUILD_HASH__}</dd>
        </dl>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-6 rounded-lg border border-line px-4 py-2 text-sm font-medium text-muted"
        >
          {nb.auth.signOut}
        </button>
      </section>
    </div>
  )
}
