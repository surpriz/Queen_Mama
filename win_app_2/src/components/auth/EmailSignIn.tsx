import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import * as authApi from '@/services/auth/authApiClient'
import { getApiBaseUrl } from '@/services/config/appEnvironment'

interface EmailSignInProps {
  onBack: () => void
  onSwitchToGoogle?: () => void
  onSwitchToRegister?: () => void
}

type ViewState =
  | { type: 'enterEmail' }
  | { type: 'enterPassword'; email: string }
  | { type: 'useGoogle'; email: string }
  | { type: 'noAccount'; email: string }

export function EmailSignIn({ onBack, onSwitchToGoogle, onSwitchToRegister }: EmailSignInProps) {
  const { loginWithCredentials } = useAuth()
  const [viewState, setViewState] = useState<ViewState>({ type: 'enterEmail' })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setError(null)
    setIsLoading(true)

    try {
      const result = await authApi.checkEmail(email.trim())

      if (!result.exists) {
        setViewState({ type: 'noAccount', email: email.trim() })
      } else if (result.authMethod === 'google') {
        setViewState({ type: 'useGoogle', email: email.trim() })
      } else {
        setViewState({ type: 'enterPassword', email: email.trim() })
      }
    } catch {
      // If email check fails (network error), show password field anyway
      setViewState({ type: 'enterPassword', email: email.trim() })
    } finally {
      setIsLoading(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (viewState.type !== 'enterPassword') return

    setError(null)
    setIsLoading(true)

    try {
      await loginWithCredentials(viewState.email, password)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed'
      // If error indicates OAuth user, switch to Google view
      if (message.toLowerCase().includes('google') || message.toLowerCase().includes('oauth')) {
        setViewState({ type: 'useGoogle', email: viewState.email })
      } else {
        setError(message)
      }
      setIsLoading(false)
    }
  }

  const handleForgotPassword = () => {
    const currentEmail = viewState.type === 'enterPassword' ? viewState.email : email
    const encodedEmail = encodeURIComponent(currentEmail)
    const baseUrl = getApiBaseUrl()
    window.electronAPI?.openExternal(`${baseUrl}/forgot-password?email=${encodedEmail}`)
  }

  const handleBackToEmail = () => {
    setViewState({ type: 'enterEmail' })
    setPassword('')
    setError(null)
  }

  // --- View: Enter Email ---
  if (viewState.type === 'enterEmail') {
    return (
      <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4 p-8 w-full max-w-sm">
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
          placeholder="Email address"
          required
          autoFocus
          className="px-4 py-3 rounded-qm-md bg-qm-surface-light border border-qm-border-subtle text-qm-text-primary placeholder:text-qm-text-disabled focus:border-qm-accent focus:outline-none"
        />

        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-3 rounded-qm-lg bg-gradient-to-r from-qm-gradient-start to-qm-gradient-end text-white font-medium disabled:opacity-50 hover:shadow-qm-glow transition-shadow"
        >
          {isLoading ? <LoadingSpinner size={20} className="mx-auto" /> : 'Continue'}
        </button>
      </form>
    )
  }

  // --- View: Enter Password ---
  if (viewState.type === 'enterPassword') {
    return (
      <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4 p-8 w-full max-w-sm">
        <button
          type="button"
          onClick={handleBackToEmail}
          className="self-start text-body-sm text-qm-text-secondary hover:text-qm-text-primary transition-colors"
        >
          &larr; Back
        </button>

        <h2 className="text-title-sm font-semibold text-qm-text-primary">Enter your password</h2>
        <p className="text-body-sm text-qm-text-secondary">{viewState.email}</p>

        {error && (
          <div className="p-3 rounded-qm-md bg-qm-error-light text-qm-error text-body-sm">
            {error}
          </div>
        )}

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          autoFocus
          className="px-4 py-3 rounded-qm-md bg-qm-surface-light border border-qm-border-subtle text-qm-text-primary placeholder:text-qm-text-disabled focus:border-qm-accent focus:outline-none"
        />

        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-3 rounded-qm-lg bg-gradient-to-r from-qm-gradient-start to-qm-gradient-end text-white font-medium disabled:opacity-50 hover:shadow-qm-glow transition-shadow"
        >
          {isLoading ? <LoadingSpinner size={20} className="mx-auto" /> : 'Sign In'}
        </button>

        <button
          type="button"
          onClick={handleForgotPassword}
          className="text-body-sm text-qm-accent hover:underline"
        >
          Forgot password?
        </button>
      </form>
    )
  }

  // --- View: Use Google ---
  if (viewState.type === 'useGoogle') {
    return (
      <div className="flex flex-col items-center gap-4 p-8 w-full max-w-sm">
        <button
          type="button"
          onClick={handleBackToEmail}
          className="self-start text-body-sm text-qm-text-secondary hover:text-qm-text-primary transition-colors"
        >
          &larr; Back
        </button>

        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/10">
          <svg className="w-8 h-8" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
        </div>

        <h2 className="text-title-sm font-semibold text-qm-text-primary text-center">
          This account uses Google
        </h2>
        <p className="text-body-sm text-qm-text-secondary text-center">
          <span className="font-medium text-qm-text-primary">{viewState.email}</span> is linked to Google Sign-In.
        </p>

        <button
          onClick={() => onSwitchToGoogle?.()}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-qm-lg bg-white text-gray-900 font-medium hover:bg-gray-100 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </button>
      </div>
    )
  }

  // --- View: No Account Found ---
  return (
    <div className="flex flex-col items-center gap-4 p-8 w-full max-w-sm">
      <button
        type="button"
        onClick={handleBackToEmail}
        className="self-start text-body-sm text-qm-text-secondary hover:text-qm-text-primary transition-colors"
      >
        &larr; Back
      </button>

      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/10">
        <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>

      <h2 className="text-title-sm font-semibold text-qm-text-primary text-center">
        No account found
      </h2>
      <p className="text-body-sm text-qm-text-secondary text-center">
        No account exists for <span className="font-medium text-qm-text-primary">{viewState.type === 'noAccount' ? viewState.email : ''}</span>.
      </p>

      <button
        onClick={() => onSwitchToRegister?.()}
        className="w-full px-4 py-3 rounded-qm-lg bg-gradient-to-r from-qm-gradient-start to-qm-gradient-end text-white font-medium hover:shadow-qm-glow transition-shadow"
      >
        Create Account
      </button>
    </div>
  )
}
