import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { nb } from '../i18n/nb'
import { useAuth } from '../data/auth'

export function ChangePasswordPage() {
  const { changePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError(nb.auth.passwordTooShort)
      return
    }
    if (password !== confirm) {
      setError(nb.auth.passwordMismatch)
      return
    }

    setLoading(true)
    const { error } = await changePassword(password)
    setLoading(false)
    if (error) setError(error)
    else navigate('/', { replace: true })
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <h1 className="text-2xl font-semibold text-stone-900">{nb.auth.changePasswordTitle}</h1>
      <p className="mt-2 text-sm text-stone-600">{nb.auth.changePasswordHint}</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        <label className="block text-sm font-medium text-stone-700" htmlFor="new-password">
          {nb.auth.newPasswordLabel}
        </label>
        <input
          id="new-password"
          type="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-base"
        />

        <label className="block text-sm font-medium text-stone-700" htmlFor="confirm-password">
          {nb.auth.confirmPasswordLabel}
        </label>
        <input
          id="confirm-password"
          type="password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-base"
        />

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {nb.auth.changePasswordSubmit}
        </button>
      </form>
    </div>
  )
}
