import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { nb } from '../i18n/nb'
import { useAuth } from '../data/auth'

export function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) setError(error)
    else navigate('/', { replace: true })
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <h1 className="text-2xl font-semibold text-ink">{nb.appName}</h1>
      <h2 className="mt-2 text-base text-muted">{nb.auth.loginTitle}</h2>

      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        <label className="block text-sm font-medium text-muted" htmlFor="email">
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
          className="w-full rounded-lg border border-line px-3 py-2 text-base"
        />

        <label className="block text-sm font-medium text-muted" htmlFor="password">
          {nb.auth.passwordLabel}
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-line px-3 py-2 text-base"
        />

        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {nb.auth.signIn}
        </button>
      </form>

      <p className="mt-6 text-sm text-muted">
        {nb.auth.noAccount}{' '}
        <Link to="/signup" className="font-medium text-ink underline">
          {nb.auth.signupSubmit}
        </Link>
      </p>
    </div>
  )
}
