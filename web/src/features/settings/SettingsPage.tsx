import { nb } from '../../i18n/nb'
import { useAuth } from '../../data/auth'

export function SettingsPage() {
  const { signOut } = useAuth()

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold text-stone-900">{nb.settings.title}</h1>
      <dl className="mt-6 space-y-1 text-sm">
        <dt className="text-stone-500">{nb.settings.buildHash}</dt>
        <dd className="font-mono text-stone-900">{__BUILD_HASH__}</dd>
      </dl>
      <button
        type="button"
        onClick={() => void signOut()}
        className="mt-8 rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700"
      >
        {nb.auth.signOut}
      </button>
    </div>
  )
}
