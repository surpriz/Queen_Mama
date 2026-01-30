import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'

interface EmailSignInProps {
  onBack: () => void
}

export function EmailSignIn({ onBack }: EmailSignInProps) {
  const { loginWithCredentials } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      await loginWithCredentials(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-8 w-full max-w-sm">
      <button
        type="button"
        onClick={onBack}
        className="self-start text-body-sm text-qm-text-secondary hover:text-qm-text-primary transition-colors"
      >
        &larr; Back
      </button>

      <h2 className="text-title-sm font-semibold text-qm-text-primary">Sign in with Email</h2>

      {error && (
        <div className="p-3 rounded-qm-md bg-qm-error-light text-qm-error text-body-sm">
          {error}
        </div>
      )}

      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
        className="px-4 py-3 rounded-qm-md bg-qm-surface-light border border-qm-border-subtle text-qm-text-primary placeholder:text-qm-text-disabled focus:border-qm-accent focus:outline-none"
      />

      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
        className="px-4 py-3 rounded-qm-md bg-qm-surface-light border border-qm-border-subtle text-qm-text-primary placeholder:text-qm-text-disabled focus:border-qm-accent focus:outline-none"
      />

      <button
        type="submit"
        disabled={isLoading}
        className="px-4 py-3 rounded-qm-lg bg-gradient-to-r from-qm-gradient-start to-qm-gradient-end text-white font-medium disabled:opacity-50 hover:shadow-qm-glow transition-shadow"
      >
        {isLoading ? <LoadingSpinner size={20} className="mx-auto" /> : 'Sign In'}
      </button>
    </form>
  )
}
