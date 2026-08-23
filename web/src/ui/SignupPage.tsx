import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { nb } from '../i18n/nb'
import { useAuth } from '../data/auth'
import { supabase } from '../data/supabaseClient'

export function SignupPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)

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
    const { error } = await signUp(email, password)
    setLoading(false)
    if (error) {
      setError(error)
      return
    }

    // If email confirmations are on, signUp succeeds but returns no session —
    // detect that and tell the user to check their inbox instead of silently
    // sitting on this page.
    const { data } = await supabase.auth.getSession()
    if (data.session) navigate('/', { replace: true })
    else setAwaitingConfirmation(true)
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <h1 className="text-2xl font-semibold text-stone-900">{nb.appName}</h1>
      <h2 className="mt-2 text-base text-stone-600">{nb.auth.signupTitle}</h2>

      {awaitingConfirmation ? (
        <p className="mt-6 text-sm text-stone-700">{nb.auth.signupAwaitingConfirmation}</p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <label className="block text-sm font-medium text-stone-700" htmlFor="email">
            {nb.auth.emailLabel}
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={nb.auth.emailPlaceholder}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-base"
          />

          <label className="block text-sm font-medium text-stone-700" htmlFor="password">
            {nb.auth.newPasswordLabel}
          </label>
          <input
            id="password"
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
            {nb.auth.signupSubmit}
          </button>
        </form>
      )}

      <p className="mt-6 text-sm text-stone-600">
        {nb.auth.hasAccount}{' '}
        <Link to="/login" className="font-medium text-stone-900 underline">
          {nb.auth.signIn}
        </Link>
      </p>
    </div>
  )
}
