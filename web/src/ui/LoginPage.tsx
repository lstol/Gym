import { useState } from 'react'
import { nb } from '../i18n/nb'
import { useAuth } from '../data/auth'

export function LoginPage() {
  const { sendMagicLink, verifyCode } = useAuth()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)

  async function handleSendLink(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const { error } = await sendMagicLink(email)
    if (error) setError(error)
    else setSent(true)
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setVerifying(true)
    const { error } = await verifyCode(email, code)
    setVerifying(false)
    if (error) setError(error)
    // On success, the AuthProvider's onAuthStateChange picks up the new
    // session automatically — no navigation needed here.
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <h1 className="text-2xl font-semibold text-stone-900">{nb.appName}</h1>
      <h2 className="mt-2 text-base text-stone-600">{nb.auth.loginTitle}</h2>

      {!sent && (
        <form onSubmit={handleSendLink} className="mt-6 space-y-3">
          <label className="block text-sm font-medium text-stone-700" htmlFor="email">
            {nb.auth.emailLabel}
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={nb.auth.emailPlaceholder}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-base"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            className="w-full rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white"
          >
            {nb.auth.sendLink}
          </button>
        </form>
      )}

      {sent && (
        <div className="mt-6 space-y-4">
          <p className="text-sm text-stone-700">{nb.auth.linkSent}</p>
          <form onSubmit={handleVerifyCode} className="space-y-3">
            <label className="block text-sm font-medium text-stone-700" htmlFor="code">
              {nb.auth.codeLabel}
            </label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={nb.auth.codePlaceholder}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-base tracking-widest"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={verifying}
              className="w-full rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {nb.auth.verifyCode}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
